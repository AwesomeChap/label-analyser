import { analyzeWithGemini, transcribeImageCrop } from './gemini.js';
import { yoloObbCrops } from './yoloObb.js';

function polygonToBbox(poly) {
  if (!Array.isArray(poly) || poly.length < 3) return null;
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/**
 * Run YOLO OBB + per-crop Gemini. Falls back to full-image Gemini if no detections.
 * @param {Buffer} imageBuffer - original image (e.g. JPEG)
 * @param {string} mime
 * @param {string} apiKey
 * @param {string} promptUsed - stored in DB (full-image prompt; crop path uses fixed prompt)
 */
export async function analyzeWithYoloObbAndGemini(imageBuffer, mime, apiKey, promptUsed) {
  let items = [];
  try {
    items = await yoloObbCrops(imageBuffer);
  } catch (e) {
    console.error('YOLO OBB service failed, falling back to Gemini-only:', e.message);
    const fallback = await analyzeWithGemini(imageBuffer, mime, apiKey, promptUsed);
    return { ...fallback, obbDetectionCount: 0, obbFallback: true };
  }

  if (!items.length) {
    console.info('YOLO OBB returned 0 detections, using full-image Gemini fallback.');
    const fallback = await analyzeWithGemini(imageBuffer, mime, apiKey, promptUsed);
    return { ...fallback, obbDetectionCount: 0, obbFallback: true };
  }
  console.info('YOLO OBB returned %d detections, transcribing crops with Gemini.', items.length);

  const textBlocks = [];
  const concurrency = Math.min(
    Math.max(1, parseInt(process.env.YOLO_OBB_GEMINI_CONCURRENCY || '4', 10) || 4),
    16,
  );

  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const texts = await Promise.all(
      chunk.map(async (it) => {
        const buf = Buffer.from(it.cropBase64, 'base64');
        return transcribeImageCrop(buf, 'image/jpeg', apiKey);
      }),
    );
    chunk.forEach((it, j) => {
      const text = (texts[j] || '').trim() || ' ';
      const poly = it.polygon;
      const block = { text, polygon: poly };
      const bb = polygonToBbox(poly);
      if (bb) block.bbox = bb;
      textBlocks.push(block);
    });
  }

  const fullText = textBlocks.map((b) => b.text).join('\n').trim();
  return { textBlocks, fullText, obbDetectionCount: items.length, obbFallback: false };
}
