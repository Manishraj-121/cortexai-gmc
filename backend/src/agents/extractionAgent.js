import OpenAI from 'openai';
import { config } from '../config.js';
import { FIELD_GROUPS, EVIDENCE_BLOCK } from './prompts.js';

const groqClient = config.groqKey
  ? new OpenAI({ apiKey: config.groqKey, baseURL: 'https://api.groq.com/openai/v1' })
  : null;

const openaiClient = config.openaiKey ? new OpenAI({ apiKey: config.openaiKey }) : null;

function getClient() {
  if (config.chatProvider === 'openai') {
    if (!openaiClient) throw new Error('OPENAI_API_KEY missing but CHAT_PROVIDER=openai');
    return { client: openaiClient, model: config.openaiChatModel };
  }
  if (!groqClient) throw new Error('GROQ_API_KEY missing but CHAT_PROVIDER=groq');
  return { client: groqClient, model: config.groqChatModel };
}

function buildEvidenceText(evidenceChunks) {
  return evidenceChunks
    .map((c, i) => `--- Evidence ${i + 1} (page ${c.page ?? '?'}, section ${c.section}) ---\n${c.text}`)
    .join('\n\n');
}

function safeJsonParse(raw) {
  if (!raw) throw new Error('Empty LLM response');
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  }
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1) cleaned = cleaned.slice(first, last + 1);
  return JSON.parse(cleaned);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callChat(system, user) {
  const { client, model } = getClient();

  const MAX_ATTEMPTS = 4;
  let lastErr;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });
      return res.choices?.[0]?.message?.content || '';
    } catch (err) {
      lastErr = err;
      const status = err?.status || err?.response?.status;
      const msg = err?.message || '';

      const isRateLimit = status === 429 || /rate limit/i.test(msg);
      const isServerErr = status >= 500 && status < 600;

      if ((isRateLimit || isServerErr) && attempt < MAX_ATTEMPTS) {
        // Try to honour "Please try again in X.Xs", else exponential backoff
        const m = msg.match(/try again in ([\d.]+)s/i);
        const base = m ? Math.ceil(parseFloat(m[1]) * 1000) : 2000 * attempt;
        const jitter = Math.floor(Math.random() * 500);
        const waitMs = base + jitter;
        console.warn(`[extractionAgent] ${status || 'retryable'} on attempt ${attempt}, waiting ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }

  throw lastErr;
}

export async function extractField(fieldGroupKey, evidenceChunks) {
  const group = FIELD_GROUPS[fieldGroupKey];
  if (!group) throw new Error(`Unknown field group: ${fieldGroupKey}`);

  const system = `You are a structured information extraction engine for GMC insurance policies.
Return ONLY a valid JSON object matching the schema below.
${EVIDENCE_BLOCK}`;

  const user = `Field group: ${fieldGroupKey}
Instructions: ${group.instructions}

Return JSON matching EXACTLY this shape (fill all keys):
${group.schema}

Evidence from the document:
${buildEvidenceText(evidenceChunks)}`;

  const raw = await callChat(system, user);
  return safeJsonParse(raw);
}

export async function extractInsurerTpa(evidenceChunks) {
  return extractField('insurer_tpa', evidenceChunks);
}