import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config.js';

const client = new QdrantClient({
  url: config.qdrantUrl,
  apiKey: config.qdrantApiKey || undefined,
});

export function collectionNameFor(documentId) {
  return `${config.collectionPrefix}_${documentId}`;
}

async function ensureCollection(name, vectorSize) {
  const existing = await client.getCollections();
  if (existing.collections.find((c) => c.name === name)) return;
  await client.createCollection(name, {
    vectors: { size: vectorSize, distance: 'Cosine' },
  });
}

export async function indexChunks(documentId, chunks, vectors) {
  if (!chunks.length || !vectors.length) return;
  if (chunks.length !== vectors.length) {
    throw new Error(`Chunk/vector mismatch: ${chunks.length} vs ${vectors.length}`);
  }

  const name = collectionNameFor(documentId);
  await ensureCollection(name, vectors[0].length);

  const points = chunks.map((chunk, idx) => ({
    id: idx + 1,
    vector: vectors[idx],
    payload: {
      text: chunk.text,
      page: chunk.metadata?.page ?? null,
      section: chunk.metadata?.section ?? 'general',
      documentType: chunk.metadata?.documentType ?? 'GMC',
      chunkId: chunk.id,
    },
  }));

  const BATCH = 64;
  for (let i = 0; i < points.length; i += BATCH) {
    await client.upsert(name, { wait: true, points: points.slice(i, i + BATCH) });
  }
}

export async function searchCollection(documentId, queryVector, topK) {
  const name = collectionNameFor(documentId);

  let res;
  if (typeof client.query === 'function') {
    const qres = await client.query(name, {
      query: queryVector,
      limit: topK,
      with_payload: true,
    });
    res = qres.points || [];
  } else if (typeof client.search === 'function') {
    res = await client.search(name, {
      vector: queryVector,
      limit: topK,
      with_payload: true,
    });
  } else {
    throw new Error('Qdrant client has neither query() nor search() method');
  }

  return res.map((hit) => ({
    score: hit.score,
    text: hit.payload?.text || '',
    page: hit.payload?.page ?? null,
    section: hit.payload?.section || 'general',
  }));
}

export async function deleteCollection(documentId) {
  const name = collectionNameFor(documentId);
  try {
    await client.deleteCollection(name);
  } catch (err) {
    console.warn(`[qdrant] delete ${name} failed:`, err.message);
  }
}