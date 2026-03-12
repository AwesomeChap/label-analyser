import fs from 'fs';
import multiparty from 'multiparty';
import { analyzeWithOpenAI } from '../server/openai.js';
import { analyzeWithGemini } from '../server/gemini.js';

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new multiparty.Form({ maxFilesSize: 10 * 1024 * 1024 });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let buffer;
  let mimeType = 'image/png';

  try {
    const { files } = await parseForm(req);
    const file = files?.image?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }
    const filePath = file.path;
    buffer = fs.readFileSync(filePath);
    mimeType = file.headers?.['content-type'] || mimeType;
    try {
      fs.unlinkSync(filePath);
    } catch (_) {}
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message || 'Invalid form data' });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY;

  if (!openaiKey || !geminiKey) {
    return res.status(500).json({
      error: 'Missing API keys. Set OPENAI_API_KEY and GOOGLE_GEMINI_API_KEY in Vercel environment variables.',
    });
  }

  try {
    const base64 = buffer.toString('base64');
    const [openaiResult, geminiResult] = await Promise.allSettled([
      analyzeWithOpenAI(base64, mimeType, openaiKey),
      analyzeWithGemini(buffer, mimeType, geminiKey),
    ]);

    const openai = openaiResult.status === 'fulfilled' ? openaiResult.value : { error: openaiResult.reason?.message || 'OpenAI request failed' };
    const google = geminiResult.status === 'fulfilled' ? geminiResult.value : { error: geminiResult.reason?.message || 'Gemini request failed' };

    return res.status(200).json({ openai, google });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Analysis failed.' });
  }
}
