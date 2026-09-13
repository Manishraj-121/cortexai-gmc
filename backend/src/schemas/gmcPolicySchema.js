import { z } from 'zod';

export const EvidenceSchema = z.object({
  page: z.number().int().positive().nullable(),
  text: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export const FieldSchema = z.object({
  status: z.enum(['covered', 'not_covered', 'waived_off', 'conditional', 'unknown']),
  value: z.string().nullable(),
  conditions: z.array(z.string()),
  evidence: EvidenceSchema,
});

export function emptyEvidence() {
  return { page: null, text: null, confidence: 0 };
}

export function emptyField() {
  return { status: 'unknown', value: null, conditions: [], evidence: emptyEvidence() };
}

const benefitKeys = [
  'room_rent', 'icu_charges', 'pre_hospitalization', 'post_hospitalization', 'day_care',
  'maternity_waiting_9_months', 'baby_day_one', 'vaccination',
  'normal_delivery_metro', 'normal_delivery_non_metro',
  'c_section_metro', 'c_section_non_metro',
  'waiting_30_days', 'waiting_first_second_year', 'ped_waiting_period',
  'opd', 'teleconsultation', 'pharmacy_discount', 'domiciliary_hospitalization',
  'annual_health_checkup', 'modern_treatment', 'bariatric_treatment',
  'psychiatric_treatment', 'ayush_treatment', 'lgbtq_coverage',
  'live_in_partner', 'organ_donor',
  'infertility_treatment', 'surrogacy', 'ambulance', 'air_ambulance',
  'corporate_buffer', 'disease_wise_capping', 'waiver_conditions',
];

const BenefitsShape = {};
for (const k of benefitKeys) BenefitsShape[k] = FieldSchema;

export const GMCPolicySchema = z.object({
  insurer: z.object({ name: z.string().nullable(), evidence: EvidenceSchema }),
  tpa: z.object({ name: z.string().nullable(), evidence: EvidenceSchema }),

  previous_policy: z.object({
    inception_date: FieldSchema,
    renewal_date: FieldSchema,
    policy_period: FieldSchema,
    tenure: FieldSchema,
    inception_premium: FieldSchema,
  }),

  policy_structure: z.object({
    family_structure: z.object({
      employee: FieldSchema,
      spouse: FieldSchema,
      children: FieldSchema,
      parents: FieldSchema,
      parents_in_law: FieldSchema,
    }),
    sum_insured_tiers: z.array(z.string()),
    evidence: EvidenceSchema,
  }),

  demographics: z.object({
    employees: z.number().int().nullable(),
    spouses: z.number().int().nullable(),
    children: z.number().int().nullable(),
    parents: z.number().int().nullable(),
    parents_in_law: z.number().int().nullable(),
    total_lives: z.number().int().nullable(),
    evidence: EvidenceSchema,
  }),

  benefits: z.object(BenefitsShape),
});

export function basePolicy() {
  const benefits = {};
  for (const k of benefitKeys) benefits[k] = emptyField();

  return {
    insurer: { name: null, evidence: emptyEvidence() },
    tpa: { name: null, evidence: emptyEvidence() },
    previous_policy: {
      inception_date: emptyField(),
      renewal_date: emptyField(),
      policy_period: emptyField(),
      tenure: emptyField(),
      inception_premium: emptyField(),
    },
    policy_structure: {
      family_structure: {
        employee: emptyField(),
        spouse: emptyField(),
        children: emptyField(),
        parents: emptyField(),
        parents_in_law: emptyField(),
      },
      sum_insured_tiers: [],
      evidence: emptyEvidence(),
    },
    demographics: {
      employees: null,
      spouses: null,
      children: null,
      parents: null,
      parents_in_law: null,
      total_lives: null,
      evidence: emptyEvidence(),
    },
    benefits,
  };
}