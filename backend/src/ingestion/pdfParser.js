import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pdfjsDir = path.dirname(require.resolve('pdfjs-dist/package.json'));
const standardFontDataUrl = path.join(pdfjsDir, 'standard_fonts') + path.sep;

export function hasSufficientText(text) {
  if (!text) return false;
  return text.replace(/\s+/g, '').length > 20;
}

export async function extractPdfPages(buffer) {
  const uint8 = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    useSystemFonts: true,
    disableFontFace: true,
    standardFontDataUrl,
  });
  const pdf = await loadingTask.promise;

  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => (typeof it.str === 'string' ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push({ page: i, text, hasText: hasSufficientText(text) });
  }
  return { pdf, pages };
}