import Tesseract from 'tesseract.js';

export async function ocrImageBuffer(pngBuffer) {
  const result = await Tesseract.recognize(pngBuffer, 'eng');
  return (result?.data?.text || '').replace(/\s+/g, ' ').trim();
}