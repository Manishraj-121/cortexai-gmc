export const EVIDENCE_BLOCK = `
For every field, include:
  "evidence": { "page": <int or null>, "text": "<short snippet>", "confidence": <0..1> }
If a value cannot be found, set status to "unknown", value to null, conditions to [],
and evidence to { "page": null, "text": null, "confidence": 0 }.
DO NOT invent values. DO NOT guess page numbers.
Return STRICT JSON only — no markdown fences, no commentary.
`.trim();

const FIELD_TEMPLATE = `{
  "status": "covered | not_covered | waived_off | conditional | unknown",
  "value": "string or null",
  "conditions": ["..."],
  "evidence": { "page": null, "text": null, "confidence": 0 }
}`;

export const FIELD_GROUPS = {
  insurer_tpa: {
    instructions:
      'Identify the insurance company (insurer) and the third-party administrator (TPA) that issued/administered this GMC policy. Return names EXACTLY as printed.',
    schema: `{
      "insurer": "string or null",
      "insurer_page": "int or null",
      "tpa": "string or null",
      "tpa_page": "int or null",
      "evidence": { "page": null, "text": null, "confidence": 0 }
    }`,
  },



previous_policy: {
  instructions:
    'Extract previous policy details. Fields: ' +
    '"inception_date" = start date of the previous policy. ' +
    '"renewal_date" = end date of the previous policy. ' +
    '"policy_period" = "<start> – <end>" full range as printed. ' +
    '"tenure" = duration between inception and renewal. If the document does not state it explicitly, ' +
      'INFER it from the date range (e.g. 26 April 2024 → 25 April 2025 = "1 year" or "12 months"). ' +
      'If the range is unclear, set status="unknown". ' +
    '"inception_premium" = the previous year\'s premium amount as printed (preserve ₹ symbol and commas).',
  schema: `{
    "inception_date": ${FIELD_TEMPLATE},
    "renewal_date": ${FIELD_TEMPLATE},
    "policy_period": ${FIELD_TEMPLATE},
    "tenure": ${FIELD_TEMPLATE},
    "inception_premium": ${FIELD_TEMPLATE}
  }`,
},
  policy_structure: {
    instructions:
      'Extract family structure (employee/spouse/children/parents/parents-in-law) and multiple sum-insured tiers.',
    schema: `{
      "family_structure": {
        "employee": ${FIELD_TEMPLATE},
        "spouse": ${FIELD_TEMPLATE},
        "children": ${FIELD_TEMPLATE},
        "parents": ${FIELD_TEMPLATE},
        "parents_in_law": ${FIELD_TEMPLATE}
      },
      "sum_insured_tiers": ["5,00,000"],
      "evidence": { "page": null, "text": null, "confidence": 0 }
    }`,
  },
  
  demographics: {
      instructions:
    'Extract counts (integers) for employees, spouses, children, parents, parents_in_law, and total_lives. ' +
    'RULES: ' +
    '(1) If the document has a combined row labeled "Parents / Parents-in-law" or similar, put the number in "parents_in_law" and leave "parents" as null. ' +
    '(2) If the document has separate rows for "Parents" and "Parents-in-law", fill both. ' +
    '(3) If the document only says "Parents", put it in "parents" and leave "parents_in_law" as null. ' +
    '(4) Always extract total_lives separately even if you cannot derive it from the components.',
  schema: `{
    "employees": "int or null",
    "spouses": "int or null",
    "children": "int or null",
    "parents": "int or null",
    "parents_in_law": "int or null",
    "total_lives": "int or null",
    "evidence": { "page": null, "text": null, "confidence": 0 }
  }`,
},



  hospitalization: {
    instructions:
      'Extract room rent, ICU charges, pre/post-hospitalization, day care.',
    schema: `{
      "room_rent": ${FIELD_TEMPLATE},
      "icu_charges": ${FIELD_TEMPLATE},
      "pre_hospitalization": ${FIELD_TEMPLATE},
      "post_hospitalization": ${FIELD_TEMPLATE},
      "day_care": ${FIELD_TEMPLATE}
    }`,
  },
  maternity: {
    instructions:
      'Extract maternity benefits: 9-month waiting, baby day-one, vaccination, normal/C-section metro & non-metro.',
    schema: `{
      "maternity_waiting_9_months": ${FIELD_TEMPLATE},
      "baby_day_one": ${FIELD_TEMPLATE},
      "vaccination": ${FIELD_TEMPLATE},
      "normal_delivery_metro": ${FIELD_TEMPLATE},
      "normal_delivery_non_metro": ${FIELD_TEMPLATE},
      "c_section_metro": ${FIELD_TEMPLATE},
      "c_section_non_metro": ${FIELD_TEMPLATE}
    }`,
  },
  waiting_periods: {
    instructions:
      'Extract 30-day, first/second-year, and PED waiting periods.',
    schema: `{
      "waiting_30_days": ${FIELD_TEMPLATE},
      "waiting_first_second_year": ${FIELD_TEMPLATE},
      "ped_waiting_period": ${FIELD_TEMPLATE}
    }`,
  },
  other_benefits: {
    instructions:
      'Extract OPD, teleconsultation, pharmacy, domiciliary, health checkup, modern treatment, bariatric, psychiatric, AYUSH, LGBTQ+, live-in, organ donor.',
    schema: `{
      "opd": ${FIELD_TEMPLATE},
      "teleconsultation": ${FIELD_TEMPLATE},
      "pharmacy_discount": ${FIELD_TEMPLATE},
      "domiciliary_hospitalization": ${FIELD_TEMPLATE},
      "annual_health_checkup": ${FIELD_TEMPLATE},
      "modern_treatment": ${FIELD_TEMPLATE},
      "bariatric_treatment": ${FIELD_TEMPLATE},
      "psychiatric_treatment": ${FIELD_TEMPLATE},
      "ayush_treatment": ${FIELD_TEMPLATE},
      "lgbtq_coverage": ${FIELD_TEMPLATE},
      "live_in_partner": ${FIELD_TEMPLATE},
      "organ_donor": ${FIELD_TEMPLATE}
    }`,
  },
  infertility_ambulance: {
    instructions: 'Extract infertility, surrogacy, ambulance, air ambulance.',
    schema: `{
      "infertility_treatment": ${FIELD_TEMPLATE},
      "surrogacy": ${FIELD_TEMPLATE},
      "ambulance": ${FIELD_TEMPLATE},
      "air_ambulance": ${FIELD_TEMPLATE}
    }`,
  },
  buffer_waiver: {
    instructions: 'Extract corporate buffer, disease-wise capping, waiver conditions.',
    schema: `{
      "corporate_buffer": ${FIELD_TEMPLATE},
      "disease_wise_capping": ${FIELD_TEMPLATE},
      "waiver_conditions": ${FIELD_TEMPLATE}
    }`,
  },
};