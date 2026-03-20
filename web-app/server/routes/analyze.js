import { Router } from 'express';
import { analyzeWithGemini, DEFAULT_EXTRACTION_PROMPT } from '../lib/gemini.js';
import { analyzeWithYoloObbAndGemini } from '../lib/yoloObbAnalyze.js';
import { isYoloObbPipeline } from '../lib/yoloObb.js';
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

    const useYoloObb = isYoloObbPipeline();
    if (useYoloObb) console.info('Analyze: using YOLO OBB pipeline.');
    const extracted = useYoloObb
      ? await analyzeWithYoloObbAndGemini(buffer, mime, process.env.GOOGLE_GEMINI_API_KEY, promptUsed)
      : await analyzeWithGemini(buffer, mime, process.env.GOOGLE_GEMINI_API_KEY, promptUsed);

    const name = typeof nameHint === 'string' && nameHint.trim() ? nameHint.trim() : 'image';
    const row = {
      id,
      name,
      full_text: extracted.fullText ?? '',
      text_blocks: extracted.textBlocks ?? [],
      extraction_prompt: promptUsed,
      image_url: urlData.publicUrl,
    };
    if (useYoloObb && extracted.obbDetectionCount != null) {
      row.obb_detection_count = extracted.obbDetectionCount;
      row.obb_fallback = extracted.obbFallback === true;
    }

    const { error: insertError } = await supabase.from('label_analyses').insert(row);
    if (insertError) throw insertError;

    const response = {
      id: row.id,
      name: row.name,
      fullText: row.full_text,
      textBlocks: row.text_blocks,
      extractionPrompt: row.extraction_prompt,
      imageUrl: row.image_url,
    };
    if (row.obb_detection_count != null) {
      response.obbDetectionCount = row.obb_detection_count;
      response.obbFallback = row.obb_fallback === true;
    }
    res.json(response);
  } catch (err) {
    console.error('Analyze error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed.' });
  }
});
