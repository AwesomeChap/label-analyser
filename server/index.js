import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeWithOpenAI } from './openai.js';
import { analyzeWithGemini } from './gemini.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(file.originalname)) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  },
});

app.use(cors());
app.use(express.json());

app.post('/api/analyze', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided.' });
  }

  const buffer = req.file.buffer;
  const base64 = buffer.toString('base64');
  const mime = req.file.mimetype || 'image/png';

  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY;

  if (!openaiKey || !geminiKey) {
    return res.status(500).json({
      error: 'Missing API keys. Set OPENAI_API_KEY and GOOGLE_GEMINI_API_KEY in server/.env',
    });
  }

  try {
    const [openaiResult, geminiResult] = await Promise.allSettled([
      analyzeWithOpenAI(base64, mime, openaiKey),
      analyzeWithGemini(buffer, mime, geminiKey),
    ]);

    const openai = openaiResult.status === 'fulfilled' ? openaiResult.value : { error: openaiResult.reason?.message || 'OpenAI request failed' };
    const google = geminiResult.status === 'fulfilled' ? geminiResult.value : { error: geminiResult.reason?.message || 'Gemini request failed' };

    return res.json({ openai, google });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Analysis failed.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
