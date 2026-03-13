import { Router } from 'express';
import { supabase, bucketName } from '../lib/supabase.js';
import { analyzeWithGemini, DEFAULT_EXTRACTION_PROMPT } from '../lib/gemini.js';

export const historyRouter = Router();

historyRouter.get('/', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        error: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env',
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('label_analyses')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('History Supabase error:', error);
      return res.status(500).json({
        error: error.message || 'Database error. Ensure the label_analyses table exists (run supabase/schema.sql in Supabase SQL Editor).',
      });
    }

    const rows = Array.isArray(data) ? data : [];
    const total = typeof count === 'number' ? count : rows.length;
    const items = rows.map((row) => {
      let textBlocks = row.text_blocks ?? [];
      if (typeof textBlocks === 'string') {
        try {
          textBlocks = JSON.parse(textBlocks);
        } catch {
          textBlocks = [];
        }
      }
      if (!Array.isArray(textBlocks)) textBlocks = [];
      return {
        id: row.id,
        created_at: row.created_at,
        name: row.name ?? '',
        fullText: row.full_text ?? '',
        textBlocks,
        extractionPrompt: row.extraction_prompt ?? null,
        imageUrl: row.image_url ?? null,
      };
    });

    res.json({ items, total });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ error: err.message || 'Failed to load history.' });
  }
});

/**
 * Re-run extraction for one analysis. Shared by route and Vercel serverless.
 */
export async function runReanalyse(id, body = {}) {
  const customPrompt = body.prompt;
  if (!id) throw new Error('Missing id.');
  if (!supabase) throw new Error('Supabase not configured.');
  if (!process.env.GOOGLE_GEMINI_API_KEY) throw new Error('Gemini API key not configured.');

  const { data: row, error: fetchError } = await supabase.from('label_analyses').select('*').eq('id', id).single();
  if (fetchError || !row) throw new Error('Analysis not found.');

  if (!bucketName) throw new Error('Storage not configured.');

  const { data: blob, error: downloadError } = await supabase.storage.from(bucketName).download(`${id}/image.jpg`);
  if (downloadError || !blob) throw new Error('Image not found in storage.');

  const buffer = Buffer.from(await blob.arrayBuffer());
  const promptUsed =
    typeof customPrompt === 'string' && customPrompt.trim()
      ? customPrompt.trim()
      : (row.extraction_prompt || DEFAULT_EXTRACTION_PROMPT);

  const extracted = await analyzeWithGemini(buffer, 'image/jpeg', process.env.GOOGLE_GEMINI_API_KEY, promptUsed);

  const updates = {
    full_text: extracted.fullText ?? '',
    text_blocks: extracted.textBlocks ?? [],
    extraction_prompt: promptUsed,
  };

  const { error: updateError } = await supabase.from('label_analyses').update(updates).eq('id', id);
  if (updateError) throw updateError;

  return {
    id: row.id,
    created_at: row.created_at,
    name: row.name ?? '',
    fullText: updates.full_text,
    textBlocks: updates.text_blocks,
    extractionPrompt: updates.extraction_prompt,
    imageUrl: row.image_url,
  };
}

historyRouter.post('/:id/reanalyse', async (req, res) => {
  try {
    const out = await runReanalyse(req.params.id, req.body || {});
    res.json(out);
  } catch (err) {
    console.error('Reanalyse error:', err);
    const status =
      err.message === 'Missing id.'
        ? 400
        : err.message === 'Analysis not found.'
          ? 404
          : err.message.includes('not found')
            ? 400
            : 500;
    res.status(status).json({ error: err.message || 'Re-analysis failed.' });
  }
});

historyRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Missing id.' });
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured.' });

    const { error: deleteError } = await supabase.from('label_analyses').delete().eq('id', id);
    if (deleteError) throw deleteError;

    if (bucketName) {
      await supabase.storage.from(bucketName).remove([`${id}/image.jpg`]);
    }
    res.status(204).send();
  } catch (err) {
    console.error('History delete error:', err);
    res.status(500).json({ error: err.message || 'Delete failed.' });
  }
});

historyRouter.delete('/', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured.' });

    const { data: rows } = await supabase.from('label_analyses').select('id');
    if (rows?.length && bucketName) {
      const paths = rows.map((r) => `${r.id}/image.jpg`);
      await supabase.storage.from(bucketName).remove(paths);
    }
    const { error } = await supabase.from('label_analyses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    console.error('History delete all error:', err);
    res.status(500).json({ error: err.message || 'Delete all failed.' });
  }
});
