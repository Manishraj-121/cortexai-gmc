import express from 'express';
import multer from 'multer';
import { processDocument } from '../ingestion/documentProcessor.js';
import { chunkPolicyPages } from '../chunking/policyChunker.js';
import { extractPolicy } from '../services/extractionService.js';
import { validatePolicy } from '../services/validationService.js';
import { config } from '../config.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    cb(new Error('Only PDF files are accepted'));
  },
});

router.post('/extract', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Missing file field "file"' });

    const document = await processDocument(req.file.buffer, req.file.originalname);
    const totalText = document.pages.map((p) => p.text).join('');
    if (totalText.replace(/\s+/g, '').length < 50) {
      return res.status(422).json({ error: 'No extractable text, even after OCR' });
    }

    const chunks = chunkPolicyPages(document.pages, config.maxChunkChars, config.overlapChars);
    document.chunks = chunks;

    const policy = await extractPolicy(document);
    const validation = validatePolicy(policy);

    res.json({
      document: {
        id: document.documentId,
        fileName: document.fileName,
        pageCount: document.pageCount,
        ocrPageCount: document.ocrPageCount,
        chunks: chunks.length,
      },
      policy,
      validation,
    });
  } catch (err) {
    next(err);
  }
});

export default router;