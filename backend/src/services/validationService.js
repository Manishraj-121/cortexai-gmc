export function validatePolicy(policy) {
  const issues = [];

  const d = policy?.demographics || {};
  const parts = [d.employees, d.spouses, d.children, d.parents, d.parents_in_law];
  const allInts = parts.every((v) => v === null || Number.isInteger(v));

  const effectiveParents = d.parents ?? d.parents_in_law ?? 0;
  const sum = (d.employees || 0) + (d.spouses || 0) + (d.children || 0) + effectiveParents;

  if (allInts && Number.isInteger(d.total_lives)) {
    const tolerance = Math.max(5, Math.round(0.05 * d.total_lives));
    if (Math.abs(sum - d.total_lives) > tolerance) {
      issues.push({
        type: 'demographic_mismatch',
        field: 'demographics.total_lives',
        message: `Component sum (${sum}) does not match total_lives (${d.total_lives}) within ±${tolerance}`,
      });
    }
  }

  if (Number.isInteger(d.total_lives) && d.total_lives < 0) {
    issues.push({
      type: 'invalid_value',
      field: 'demographics.total_lives',
      message: 'total_lives is negative',
    });
  }

  const benefits = policy?.benefits || {};
  for (const [key, f] of Object.entries(benefits)) {
    if (f?.status === 'covered' && !f.value && (f.evidence?.confidence ?? 0) < 0.5) {
      issues.push({
        type: 'missing_limit_or_evidence',
        field: `benefits.${key}`,
        message: 'Marked covered but no value and low confidence',
      });
    }
  }

  return { valid: issues.length === 0, issues };
}