import 'dotenv/config';

const int = (v, fallback) => {
  const n = parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  port: int(process.env.PORT, 7000),

  geminiKey: process.env.GEMINI_API_KEY || '',
  embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
  embeddingDimensions: int(process.env.GEMINI_EMBEDDING_DIMENSIONS, 768),

  chatProvider: (process.env.CHAT_PROVIDER || 'groq').toLowerCase(),

  openaiKey: process.env.OPENAI_API_KEY || '',
  openaiChatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',

  groqKey: process.env.GROQ_API_KEY || '',
  groqChatModel: process.env.GROQ_CHAT_MODEL || 'llama-3.3-70b-versatile',

  qdrantUrl: process.env.QDRANT_URL || '',
  qdrantApiKey: process.env.QDRANT_API_KEY || '',
  collectionPrefix: process.env.QDRANT_COLLECTION_PREFIX || 'gmc_policy',

  topK: int(process.env.TOP_K, 8),
  maxChunkChars: int(process.env.MAX_CHUNK_CHARS, 3500),
  overlapChars: int(process.env.CHUNK_OVERLAP_CHARS, 500),
};

export function assertConfig() {
  const missing = [];
  if (!config.geminiKey) missing.push('GEMINI_API_KEY');
  if (!config.qdrantUrl) missing.push('QDRANT_URL');
  if (config.chatProvider === 'groq' && !config.groqKey) missing.push('GROQ_API_KEY');
  if (config.chatProvider === 'openai' && !config.openaiKey) missing.push('OPENAI_API_KEY');
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  if (!['groq', 'openai'].includes(config.chatProvider)) {
    throw new Error(`CHAT_PROVIDER must be "groq" or "openai"`);
  }
}