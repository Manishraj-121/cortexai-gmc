import express from 'express';
import cors from 'cors';
import { config, assertConfig } from './config.js';
import policyRoutes from './routes/policyRoutes.js';

process.on('unhandledRejection', (r) => console.error('[unhandledRejection]', r));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'cortexai-gmc', chatProvider: config.chatProvider });
});

app.use('/api/policies', policyRoutes);

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: err.message || 'Internal error' });
});

try {
  assertConfig();
} catch (err) {
  console.error('[config]', err.message);
  process.exit(1);
}

app.listen(config.port, () => {
  console.log(`CortexAI GMC backend running on http://localhost:${config.port}`);
});