import { Router } from 'express';
import { analyzeWithGemini, DEFAULT_EXTRACTION_PROMPT } from '../lib/gemini.js';
import { supabase, bucketName } from '../lib/supabase.js';
import { compressImage } from '../lib/compress.js';

export const analyzeRouter = Router();

analyzeRouter.get('/prompt', (_, res) => {
  res.json({ prompt: DEFAULT_EXTRACTION_PROMPT });
});

/**
 * POST /api/analyze
 * Body: { image: base64 [, prompt?: string, filename?: string ] }
 */
analyzeRouter.post('/', async (req, res) => {
  try {
    const { image: imageBase64, prompt: customPrompt, filename: nameHint } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: 'image (base64) is required.' });
    }

    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured.' });
    }
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured.' });
    }

    const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    const mime = (imageBase64.match(/^data:(image\/\w+);base64,/) || [])[1] || 'image/jpeg';

    const compressed = await compressImage(buffer);
    const id = crypto.randomUUID();
    const path = `${id}/image.jpg`;

    const { error: uploadError } = await supabase.storage.from(bucketName).upload(path, compressed, {
      contentType: 'image/jpeg',
      upsert: false,
    });
    if (uploadError) throw new Error(`Upload: ${uploadError.message}`);

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(path);
    const promptUsed =
      typeof customPrompt === 'string' && customPrompt.trim()
        ? customPrompt.trim()
        : DEFAULT_EXTRACTION_PROMPT;

    const extracted = await analyzeWithGemini(buffer, mime, process.env.GOOGLE_GEMINI_API_KEY, promptUsed);

    const name = typeof nameHint === 'string' && nameHint.trim() ? nameHint.trim() : 'image';
    const row = {
      id,
      name,
      full_text: extracted.fullText ?? '',
      text_blocks: extracted.textBlocks ?? [],
      extraction_prompt: promptUsed,
      image_url: urlData.publicUrl,
    };

    const { error: insertError } = await supabase.from('label_analyses').insert(row);
    if (insertError) throw insertError;

    res.json({
      id: row.id,
      name: row.name,
      fullText: row.full_text,
      textBlocks: row.text_blocks,
      extractionPrompt: row.extraction_prompt,
      imageUrl: row.image_url,
    });
  } catch (err) {
    console.error('Analyze error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed.' });
  }
});
