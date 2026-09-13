import { useState } from 'react';
import { extractPolicy } from './api.js';

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await extractPolicy(file);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1>CortexAI GMC</h1>
      <p className="subtitle">Upload a GMC policy PDF to extract structured data.</p>

      <form onSubmit={onSubmit} className="upload">
        <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button disabled={!file || loading}>{loading ? 'Extracting…' : 'Extract'}</button>
      </form>

      {error && <div className="error">{error}</div>}
      {result && <ResultView result={result} />}
    </div>
  );
}

function ResultView({ result }) {
  const { document, policy, validation } = result;
  return (
    <div className="result">
      <h2>Document</h2>
      <ul>
        <li>ID: {document.id}</li>
        <li>File: {document.fileName}</li>
        <li>Pages: {document.pageCount} ({document.ocrPageCount} OCR)</li>
        <li>Chunks: {document.chunks}</li>
      </ul>

      {!validation.valid && (
        <div className="warn">
          <strong>Validation issues:</strong>
          <ul>
            {validation.issues.map((i, idx) => (
              <li key={idx}>{i.type}: {i.message}</li>
            ))}
          </ul>
        </div>
      )}

      <h2>Identity</h2>
      <p><strong>Insurer:</strong> {policy.insurer.name || '—'}</p>
      <p><strong>TPA:</strong> {policy.tpa.name || '—'}</p>

      <h2>Previous Policy</h2>
      <FieldTable rows={Object.entries(policy.previous_policy)} />

      <h2>Policy Structure</h2>
      <FieldTable rows={Object.entries(policy.policy_structure.family_structure)} />
      <p><strong>Sum insured tiers:</strong> {policy.policy_structure.sum_insured_tiers.join(', ') || '—'}</p>

      <h2>Demographics</h2>
      <ul>
        {Object.entries(policy.demographics).filter(([k]) => k !== 'evidence').map(([k, v]) => (
          <li key={k}><strong>{k}:</strong> {v ?? '—'}</li>
        ))}
      </ul>

      <h2>Benefits</h2>
      <FieldTable rows={Object.entries(policy.benefits)} />
    </div>
  );
}

function FieldTable({ rows }) {
  return (
    <table className="fields">
      <thead>
        <tr><th>Field</th><th>Status</th><th>Value</th><th>Conditions</th><th>Page</th><th>Conf.</th></tr>
      </thead>
      <tbody>
        {rows.map(([k, f]) => (
          <tr key={k}>
            <td>{k}</td>
            <td>{f?.status ?? '—'}</td>
            <td>{f?.value ?? '—'}</td>
            <td>{(f?.conditions || []).join('; ') || '—'}</td>
            <td>{f?.evidence?.page ?? '—'}</td>
            <td>{f?.evidence?.confidence?.toFixed?.(2) ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}