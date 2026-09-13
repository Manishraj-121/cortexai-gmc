import crypto from 'node:crypto';
import { extractPdfPages, hasSufficientText } from './pdfParser.js';
import { renderPageToPng } from './pdfRenderer.js';
import { ocrImageBuffer } from './ocr.js';

export async function processDocument(buffer, originalName) {
  const documentId = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  const { pdf, pages } = await extractPdfPages(buffer);

  let ocrPageCount = 0;
  const outPages = [];

  for (const p of pages) {
    let text = p.text;
    let ocr = false;

    if (!hasSufficientText(text)) {
      try {
        const png = await renderPageToPng(pdf, p.page);
        const ocrText = await ocrImageBuffer(png);
        if (hasSufficientText(ocrText)) {
          text = ocrText;
          ocr = true;
          ocrPageCount += 1;
        }
      } catch (err) {
        console.warn(`[documentProcessor] OCR failed page ${p.page}:`, err.message);
      }
    }
    outPages.push({ page: p.page, text, ocr });
  }

  return {
    documentId,
    fileName: originalName,
    pageCount: pages.length,
    ocrPageCount,
    pages: outPages,
  };
}