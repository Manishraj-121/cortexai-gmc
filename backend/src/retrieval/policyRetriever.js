import { embedQuery } from '../embeddings/embeddings.js';
import { searchCollection } from '../vectorstore/qdrant.js';
import { config } from '../config.js';

const FIELD_GROUP_QUERIES = {
  insurer_tpa: [
    'insurance company name, insurer name, TPA third party administrator name',
    'policy issued by insurer and administered by TPA',
  ],
  previous_policy: [
    'previous policy period inception date renewal date tenure',
    'policy inception premium amount previous year',
  ],
  policy_structure: [
    'family structure employee spouse children parents parents-in-law',
    'sum insured tiers multiple sum insured options',
  ],
  demographics: [
    'number of employees spouses children parents total lives covered',
    'demographic counts lives covered headcount',
  ],
  hospitalization: [
    'room rent limit percentage of sum insured ICU charges',
    'pre hospitalization post hospitalization days day care expenses',
  ],
  maternity: [
    'maternity waiting period 9 months baby day one cover vaccination',
    'normal delivery limit metro non-metro C-section limit',
  ],
  waiting_periods: [
    'waiting period 30 days first year second year pre-existing disease PED',
    'initial waiting period waived off or applied',
  ],
  other_benefits: [
    'OPD benefit teleconsultation pharmacy discount domiciliary hospitalization annual health checkup',
    'modern treatment bariatric psychiatric AYUSH treatment LGBTQ live-in partner organ donor',
  ],
  infertility_ambulance: [
    'infertility treatment surrogacy limits conditions',
    'ambulance charges air ambulance charges',
  ],
  buffer_waiver: [
    'corporate buffer disease wise capping waiver conditions',
    'waiver of waiting periods corporate terms',
  ],
};

export async function retrieveEvidence(documentId, fieldGroupKey) {
  const queries = FIELD_GROUP_QUERIES[fieldGroupKey];
  if (!queries) throw new Error(`No retrieval query for field group: ${fieldGroupKey}`);

  const seen = new Map();
  for (const q of queries) {
    const vec = await embedQuery(q);
    const hits = await searchCollection(documentId, vec, config.topK);
    for (const h of hits) {
      const key = `${h.page}::${h.text.slice(0, 120)}`;
      const prev = seen.get(key);
      if (!prev || (h.score ?? 0) > (prev.score ?? 0)) seen.set(key, h);
    }
  }

  return [...seen.values()]
    // .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    // .slice(0, config.topK * 2);
    .slice(0, config.topK);         // <-- top 8 chunks
}