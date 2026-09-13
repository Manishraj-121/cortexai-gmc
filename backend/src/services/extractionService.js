import { embedTexts } from '../embeddings/embeddings.js';
import { indexChunks } from '../vectorstore/qdrant.js';
import { retrieveEvidence } from '../retrieval/policyRetriever.js';
import { extractField, extractInsurerTpa } from '../agents/extractionAgent.js';
import {
  GMCPolicySchema,
  basePolicy,
  emptyField,
} from '../schemas/gmcPolicySchema.js';

/**
 * The source PDF font sometimes renders the rupee glyph as 'n' or a square.
 * Normalize common mis-renderings back to the rupee symbol.
 */
function fixCurrency(s) {
  if (typeof s !== 'string') return s;
  return s
    .replace(/\u25A0/g, '\u20B9')
    .replace(/\bn\s+(\d)/g, '\u20B9$1')
    .replace(/\bN\s+(\d)/g, '\u20B9$1');
}

const FIELD_GROUP_ORDER = [
  'previous_policy',
  'policy_structure',
  'demographics',
  'hospitalization',
  'maternity',
  'waiting_periods',
  'other_benefits',
  'infertility_ambulance',
  'buffer_waiver',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sanitizePage(p) {
  const n = Number(p);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function sanitizeConfidence(c) {
  const n = Number(c);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function sanitizeString(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function normalizeField(raw) {
  if (!raw || typeof raw !== 'object') return emptyField();
  const status = ['covered', 'not_covered', 'waived_off', 'conditional', 'unknown'].includes(raw.status)
    ? raw.status
    : 'unknown';
  return {
    status,
    value: fixCurrency(sanitizeString(raw.value)),
    conditions: Array.isArray(raw.conditions) ? raw.conditions.map(String) : [],
    evidence: {
      page: sanitizePage(raw?.evidence?.page),
      text: fixCurrency(sanitizeString(raw?.evidence?.text)),
      confidence: sanitizeConfidence(raw?.evidence?.confidence),
    },
  };
}

function normalizeInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^0-9-]/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function extractPolicy(document) {
  const output = basePolicy();

  // 1. Embed + index
  const chunks = document.chunks || [];
  if (chunks.length) {
    const vectors = await embedTexts(chunks.map((c) => c.text));
    await indexChunks(document.documentId, chunks, vectors);
  }

  // 2. Insurer + TPA
  try {
    const ev = await retrieveEvidence(document.documentId, 'insurer_tpa');
    const res = await extractInsurerTpa(ev);
    output.insurer.name = sanitizeString(res?.insurer);
    output.insurer.evidence = {
      page: sanitizePage(res?.insurer_page),
      text: sanitizeString(res?.evidence?.text),
      confidence: sanitizeConfidence(res?.evidence?.confidence),
    };
    output.tpa.name = sanitizeString(res?.tpa);
    output.tpa.evidence = {
      page: sanitizePage(res?.tpa_page),
      text: sanitizeString(res?.evidence?.text),
      confidence: sanitizeConfidence(res?.evidence?.confidence),
    };
  } catch (err) {
    console.warn('[extractionService] insurer_tpa failed:', err.message);
  }

  // 3. Field groups — single loop with a small pause to avoid Groq TPM burst
  for (const group of FIELD_GROUP_ORDER) {
    try {
      const ev = await retrieveEvidence(document.documentId, group);
      if (!ev.length) {
        await sleep(300);
        continue;
      }
      const res = await extractField(group, ev);
      mergeFieldGroup(output, group, res);
    } catch (err) {
      console.warn(`[extractionService] group "${group}" failed:`, err.message);
    }
    await sleep(1500);
  }

  // 4. Validate
  const parsed = GMCPolicySchema.safeParse(output);
  if (!parsed.success) {
    console.warn('[extractionService] Schema validation issues:', parsed.error.issues.slice(0, 5));
    return output;
  }
  return parsed.data;
}

function mergeFieldGroup(out, group, res) {
  if (!res || typeof res !== 'object') return;

  switch (group) {
    case 'previous_policy': {
      for (const k of ['inception_date', 'renewal_date', 'policy_period', 'tenure', 'inception_premium']) {
        out.previous_policy[k] = normalizeField(res[k]);
      }
      break;
    }
    case 'policy_structure': {
      const fs = res.family_structure || {};
      for (const k of ['employee', 'spouse', 'children', 'parents', 'parents_in_law']) {
        out.policy_structure.family_structure[k] = normalizeField(fs[k]);
      }
      out.policy_structure.sum_insured_tiers = Array.isArray(res.sum_insured_tiers)
        ? res.sum_insured_tiers.map(String).filter(Boolean)
        : [];
      out.policy_structure.evidence = {
        page: sanitizePage(res?.evidence?.page),
        text: sanitizeString(res?.evidence?.text),
        confidence: sanitizeConfidence(res?.evidence?.confidence),
      };
      break;
    }
    case 'demographics': {
      for (const k of ['employees', 'spouses', 'children', 'parents', 'parents_in_law', 'total_lives']) {
        out.demographics[k] = normalizeInt(res[k]);
      }
      out.demographics.evidence = {
        page: sanitizePage(res?.evidence?.page),
        text: sanitizeString(res?.evidence?.text),
        confidence: sanitizeConfidence(res?.evidence?.confidence),
      };
      break;
    }
    case 'hospitalization': {
      for (const k of ['room_rent', 'icu_charges', 'pre_hospitalization', 'post_hospitalization', 'day_care']) {
        if (k in out.benefits) out.benefits[k] = normalizeField(res[k]);
      }
      break;
    }
    case 'maternity': {
      for (const k of [
        'maternity_waiting_9_months', 'baby_day_one', 'vaccination',
        'normal_delivery_metro', 'normal_delivery_non_metro',
        'c_section_metro', 'c_section_non_metro',
      ]) {
        if (k in out.benefits) out.benefits[k] = normalizeField(res[k]);
      }
      break;
    }
    case 'waiting_periods': {
      for (const k of ['waiting_30_days', 'waiting_first_second_year', 'ped_waiting_period']) {
        if (k in out.benefits) out.benefits[k] = normalizeField(res[k]);
      }
      break;
    }
    case 'other_benefits': {
      for (const k of [
        'opd', 'teleconsultation', 'pharmacy_discount', 'domiciliary_hospitalization',
        'annual_health_checkup', 'modern_treatment', 'bariatric_treatment',
        'psychiatric_treatment', 'ayush_treatment', 'lgbtq_coverage',
        'live_in_partner', 'organ_donor',
      ]) {
        if (k in out.benefits) out.benefits[k] = normalizeField(res[k]);
      }
      break;
    }
    case 'infertility_ambulance': {
      for (const k of ['infertility_treatment', 'surrogacy', 'ambulance', 'air_ambulance']) {
        if (k in out.benefits) out.benefits[k] = normalizeField(res[k]);
      }
      break;
    }
    case 'buffer_waiver': {
      for (const k of ['corporate_buffer', 'disease_wise_capping', 'waiver_conditions']) {
        if (k in out.benefits) out.benefits[k] = normalizeField(res[k]);
      }
      break;
    }
  }
}