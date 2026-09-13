const SECTION_PATTERNS = [
  { section: 'maternity', re: /\b(maternity|normal\s+delivery|cesarean|c-section|caesarean|baby\s+day|vaccination)\b/i },
  { section: 'waiting_periods', re: /\b(waiting\s+period|pre-?existing|ped|30\s+days?|first\s+year|second\s+year|initial\s+waiting)\b/i },
  { section: 'hospitalization', re: /\b(room\s+rent|icu|intensive\s+care|hospitalization|pre[-\s]?hospital|post[-\s]?hospital|day\s+care)\b/i },
  { section: 'demographics', re: /\b(employees?|spouses?|children|dependents?|parents?[-\s]?in[-\s]?law|total\s+lives|members?)\b/i },
  { section: 'sum_insured', re: /\b(sum\s+insured|sum\s+assured|si\b|insured\s+amount|coverage\s+amount|tier)\b/i },
  { section: 'ambulance', re: /\b(ambulance|air\s+ambulance)\b/i },
  { section: 'infertility', re: /\b(infertility|surrogacy|ivf|iui|fertility)\b/i },
  { section: 'other_benefits', re: /\b(opd|out[-\s]?patient|teleconsult|pharmacy|domiciliary|health\s+check[-\s]?up|modern\s+treatment|bariatric|psychiatric|ayush|lgbtq|live[-\s]?in|organ\s+donor|wellness)\b/i },
  { section: 'policy_details', re: /\b(policy\s+(period|number|no|tenure)|inception|renewal|premium|insured\s+name|proposer|tpa|administrator)\b/i },
];

function detectSection(text) {
  for (const { section, re } of SECTION_PATTERNS) if (re.test(text)) return section;
  return 'general';
}

function splitIntoChunks(text, maxChars, overlap) {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const chunks = [];
  let start = 0;
  const step = Math.max(1, maxChars - overlap);
  while (start < clean.length) {
    const end = Math.min(clean.length, start + maxChars);
    chunks.push(clean.slice(start, end));
    if (end === clean.length) break;
    start += step;
  }
  return chunks;
}

export function chunkPolicyPages(pages, maxChars = 3500, overlap = 500) {
  const chunks = [];
  let counter = 0;
  for (const p of pages) {
    if (!p.text || !p.text.trim()) continue;
    const section = detectSection(p.text);
    const pieces = splitIntoChunks(p.text, maxChars, overlap);
    for (const text of pieces) {
      chunks.push({
        id: `chunk_${counter++}`,
        text,
        metadata: { page: p.page, section, documentType: 'GMC' },
      });
    }
  }
  return chunks;
}