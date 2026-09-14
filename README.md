# CortexAI GMC

I built this to solve a real problem: reading Group Medical Cover (GMC) insurance policy PDFs from different insurers and turning them into a single JSON that a QMS system can consume without any manual work.

The hard part isn't parsing one insurer's PDF — it's doing it for *any* insurer. Every carrier organizes their policy differently: some put room rent in a table, others bury it in a clause; some say "waived off", others say "not applicable". So instead of writing templates per insurer, I built a small RAG pipeline that retrieves the relevant chunks for each field group and asks an LLM to extract them into a fixed schema.

You can upload a PDF in the React UI and get back structured JSON with a page reference and confidence score on every field.

---

## What it extracts

- **Insurer & TPA** — detected from the document, not hardcoded
- **Previous policy** — inception date, renewal date, period, tenure, inception premium
- **Policy structure** — family structure (employee / spouse / children / parents / parents-in-law) and all sum-insured tiers
- **Demographics** — counts for each member type plus total lives
- **Hospitalization** — room rent, ICU, pre- and post-hospitalization, day care
- **Maternity** — 9-month waiting, baby day-one, vaccination, normal delivery and C-section limits (metro / non-metro)
- **Waiting periods** — 30-day, 1st/2nd-year, PED
- **Other benefits** — OPD, teleconsultation, pharmacy, domiciliary, check-up, modern treatment, bariatric, psychiatric, AYUSH, LGBTQ+, live-in partner, organ donor
- **Infertility & ambulance** — infertility, surrogacy, ambulance, air ambulance
- **Corporate terms** — buffer, disease-wise capping, waiver conditions

Every field comes back as:

```json
{
  "status": "covered | not_covered | waived_off | conditional | unknown",
  "value": "1% of Sum Insured per day, maximum ₹7,500 per day",
  "conditions": [],
  "evidence": { "page": 1, "text": "Room Rent: 1% of Sum Insured...", "confidence": 0.95 }
}
```

---

## How it works

The pipeline is a single linear flow. Each PDF goes through these steps:

```
upload → pdf.js parse → OCR fallback for scanned pages
       → section-aware chunking → Gemini embeddings → Qdrant
       → per-field-group semantic retrieval
       → schema-bound LLM extraction (Groq)
       → validation → JSON
```

A few things I want to call out because they weren't obvious when I started:

**Chunking by section, not by size.** My first attempt split pages into fixed-size chunks and retrieval kept pulling maternity clauses when I asked about waiting periods. So I now tag each chunk with a section (maternity, waiting periods, hospitalization, etc.) using regex patterns on the text, and store that as metadata in Qdrant. Retrieval quality went up immediately.

**Field-group isolation.** Asking one LLM call to fill all 45 fields in one shot caused the model to hallucinate values just to complete the JSON. Splitting into 9 independent field groups (`previous_policy`, `demographics`, `maternity`, …) fixed that, and it also means one group failing doesn't take down the whole request.

**OCR only when needed.** pdf.js gives me per-page text. If a page has less than 20 non-whitespace characters, I rasterize it and run Tesseract. Digital PDFs skip this entirely, so the common case stays fast.

**Retry on 429.** The Groq free tier caps at 8k tokens/minute. I hit that constantly during development. The extraction agent now retries with exponential backoff and honours the `try again in Xs` hint Groq sends back.

---

## Tech stack

- Node.js 20 + Express 5
- `pdfjs-dist` for PDF text, `@napi-rs/canvas` + `tesseract.js` for OCR
- Google Gemini (`gemini-embedding-001`, 768 dims) for embeddings
- Qdrant for the vector store
- Groq (`openai/gpt-oss-120b`) for extraction, OpenAI as an alternate
- Zod for the output schema
- React 19 + Vite 7 for the UI

### A note on APIs

- **Gemini embeddings** — paid tier, but there's a free quota. Fine for development.
- **Groq** — free tier, rate limited.
- **Qdrant** — cloud free tier (1 GB) or local Docker.
- **OpenAI** — only used if you set `CHAT_PROVIDER=openai`. Not needed.

---

## Setup

You need Node 20+, a Qdrant instance, a Gemini API key, and a Groq key.

**Backend:**

```bash
cd backend
npm install
cp .env.example .env      # Windows: copy .env.example .env
# fill in the .env with your keys
npm run dev
```

Backend runs on `http://localhost:7000`.

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open whatever URL Vite prints (usually `http://localhost:5173`).

### Environment variables

These are the ones you actually need to set:

```
GEMINI_API_KEY=          # for embeddings
GROQ_API_KEY=            # for extraction
QDRANT_URL=              # your Qdrant cluster URL
QDRANT_API_KEY=          # Qdrant API key
```

Everything else in `.env.example` has sensible defaults. `CHAT_PROVIDER` defaults to `groq`.

**Do not commit `.env`.** Only `.env.example` is in the repo.

---

## Running it

Two terminals:

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Then open `http://localhost:5173`, pick a GMC PDF, hit **Extract**.

If you'd rather skip the UI:

```bash
curl -X POST http://localhost:7000/api/policies/extract \
  -F "file=@samples/pdfs/sample_gmc_policy.pdf"
```

There's also a CLI:

```bash
cd backend
npm run extract -- ../samples/pdfs/sample_gmc_policy.pdf
```

It writes a `.json` next to the input PDF.

---

## Screenshots

**Upload page**

![Upload](C:\Users\MANISH\OneDrive\Pictures\Screenshots\Screenshot 2026-09-13 112046.png)

**Extraction — insurer, TPA, previous policy**

![Extraction top](docs/screenshots/02-extraction-top.png)

**Policy structure and demographics**

![Demographics](docs/screenshots/03-extraction-demographics.png)

**Benefits with evidence page and confidence**

![Benefits](docs/screenshots/04-benefits.png)

**Error state when the backend is unreachable**

![Error](docs/screenshots/05-error.png)

---

## Output schema

The schema lives in `backend/src/schemas/gmcPolicySchema.js` and is enforced with Zod after the LLM returns.

Top-level shape:

```json
{
  "document": { "id", "fileName", "pageCount", "ocrPageCount", "chunks" },
  "policy": {
    "insurer": { "name", "evidence" },
    "tpa": { "name", "evidence" },
    "previous_policy": { ... },
    "policy_structure": { ... },
    "demographics": { ... },
    "benefits": { ... }
  },
  "validation": { "valid", "issues" }
}
```

Sample output from the provided PDF is committed at `samples/outputs/sample_gmc_policy.json`.

### Mapping to QMS fields

| QMS field | JSON path |
|---|---|
| Insurer | `policy.insurer.name` |
| TPA | `policy.tpa.name` |
| Previous inception / renewal | `policy.previous_policy.inception_date.value` |
| Policy period | `policy.previous_policy.policy_period.value` |
| Tenure | `policy.previous_policy.tenure.value` |
| Inception premium | `policy.previous_policy.inception_premium.value` |
| Family structure | `policy.policy_structure.family_structure.*` |
| Sum insured tiers | `policy.policy_structure.sum_insured_tiers[]` |
| Demographics | `policy.demographics.*` |
| Benefits | `policy.benefits.*` |

---

## Design decisions I made

Some trade-offs worth explaining, because they weren't obvious in the beginning:

**Section-aware chunking over fixed-size.** The original fixed-size approach broke tables mid-cell and retrieval often pulled the wrong section. Tagging chunks by section fixed most of the noise.

**Field-group isolation over one big prompt.** One prompt for all 45 fields was faster but hallucinated. Nine smaller calls are slower but far more accurate.

**Groq as the default provider.** Latency and the free tier. I kept the provider switchable so I could A/B test against OpenAI without touching the code.

**Zod for schema enforcement.** It gave me one source of truth for the output and caught cases where the LLM returned null where the schema expected a string.

**Currency symbol normalization.** The source PDFs sometimes render the rupee symbol in a way pdf.js reads as "n". I added a small `fixCurrency` helper in the extraction service to normalize `n 7,500` back to `₹7,500`. Ugly but effective.

---

## Assumptions

- PDFs might have selectable text, scanned pages, or a mix.
- OCR quality depends on the scan quality.
- Money amounts stay as strings when they're ambiguous (e.g. `"1% of SI, max ₹7,500/day"`).
- `waived`, `waived off`, `nil waiting` all normalize to `waived_off`.
- When the PDF shows one combined row like "Parents / Parents-in-law", I put the number in `parents_in_law` and leave `parents` empty. The prompt tells the model to do this, and the validation is tolerant enough that it doesn't flag the mismatch.
- Missing values become `null` — never invented.
- Tenure is inferred from the date range if the document doesn't state it.

---

## Known limitations

- Complex visual tables (multi-level headers, merged cells) aren't handled well. A dedicated table extractor would help — I'd look at LayoutLM or Camelot for that.
- Handwritten annotations aren't extracted.
- OCR errors on poor scans propagate through the pipeline.
- **Rate limits.** Groq's free tier caps at 8k tokens/minute on `gpt-oss-120b`. The retry logic handles most cases, but on a large PDF one or two field groups can come back as `"unknown"` if the limit is hit repeatedly.
- One LLM call per field group (10 per document) is simple but not the cheapest design at scale.
- This is a demonstration project — not something I'd hand to an underwriting team without a lot more testing.

---

## What I'd do next

- Table-aware chunking, so structured tables stay intact through embedding.
- Hybrid retrieval — dense vectors plus BM25 — because exact numbers like "7,500" sometimes get lost in pure semantic search.
- A cross-encoder reranker between retrieval and extraction.
- Cache embeddings by content hash so re-uploading the same PDF doesn't re-embed everything.
- Confidence calibration: right now the confidence is what the LLM reports. I'd want to compare it against a labeled set.

---

## Repo layout

```
backend/
  src/
    agents/          prompts + LLM extraction
    chunking/        section-aware chunker
    embeddings/      Gemini wrapper
    ingestion/       pdf.js + Tesseract
    retrieval/       field-group retrieval
    routes/          HTTP endpoint
    schemas/         Zod GMC schema
    services/        extraction + validation orchestrators
    vectorstore/     Qdrant wrapper
frontend/
  src/               React UI
samples/
  pdfs/              input sample
  outputs/           generated JSON
docs/
  screenshots/       UI screenshots
```
