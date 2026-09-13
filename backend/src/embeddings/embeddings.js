import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';

const genAI = new GoogleGenerativeAI(config.geminiKey);
const BATCH_SIZE = 100;

export async function embedTexts(texts) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  const out = [];
  const model = genAI.getGenerativeModel({ model: config.embeddingModel });

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const slice = texts.slice(i, i + BATCH_SIZE);
    const requests = slice.map((t) => ({
      content: { role: 'user', parts: [{ text: t }] },
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: config.embeddingDimensions,
    }));
    const res = await model.batchEmbedContents({ requests });
    for (const e of res.embeddings) out.push(e.values);
  }
  return out;
}

export async function embedQuery(text) {
  const model = genAI.getGenerativeModel({ model: config.embeddingModel });
  const res = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
    taskType: 'RETRIEVAL_QUERY',
    outputDimensionality: config.embeddingDimensions,
  });
  return res.embedding.values;
}