import imageCompression from 'browser-image-compression';

const OPTIONS = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.85,
};

/**
 * @param {File} file
 * @returns {Promise<string>} base64 data URL
 */
export async function compressAndToBase64(file) {
  const compressed = await imageCompression(file, OPTIONS);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(compressed);
  });
}
