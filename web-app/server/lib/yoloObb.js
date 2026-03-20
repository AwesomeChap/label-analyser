/**
 * YOLO OBB service: oriented boxes + warped JPEG crops for Gemini OCR.
 * ANALYZE_PIPELINE=yolo-obb and YOLO_OBB_SERVICE_URL=http://127.0.0.1:8766
 */
const base = () => (process.env.YOLO_OBB_SERVICE_URL || 'http://127.0.0.1:8766').replace(/\/$/, '');

/**
 * @param {Buffer} imageBuffer
 * @returns {Promise<Array<{ polygon: number[][], confidence: number, className: string, cropBase64: string }>>}
 */
export async function yoloObbCrops(imageBuffer) {
  const res = await fetch(`${base()}/obb-crops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBuffer.toString('base64') }),
  });
  if (!res.ok) {
    const t = await res.text();
    let msg = t || `YOLO OBB service error: ${res.status}`;
    try {
      const j = JSON.parse(t);
      if (j.detail) msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
    } catch (_) {}
    throw new Error(msg);
  }
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

export function isYoloObbPipeline() {
  return (process.env.ANALYZE_PIPELINE || '').toLowerCase() === 'yolo-obb';
}
