const BASE = import.meta.env.VITE_API_URL || 'http://localhost:7000/api';

export async function extractPolicy(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/policies/extract`, { method: 'POST', body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}
