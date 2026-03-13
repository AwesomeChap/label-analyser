import sharp from 'sharp';

const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const JPEG_QUALITY = 82;
const MAX_BYTES = 400 * 1024; // 400KB target

/**
 * @param {Buffer} buffer
 * @returns {Promise<Buffer>}
 */
export async function compressImage(buffer) {
  let pipeline = sharp(buffer);
  const meta = await pipeline.metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;

  if (w > MAX_WIDTH || h > MAX_HEIGHT) {
    pipeline = pipeline.resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true });
  }

  let out = await pipeline
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  if (out.length > MAX_BYTES) {
    const ratio = Math.sqrt(MAX_BYTES / out.length);
    const q = Math.max(40, Math.floor(JPEG_QUALITY * ratio));
    out = await sharp(out)
      .jpeg({ quality: q, mozjpeg: true })
      .toBuffer();
  }

  return out;
}
