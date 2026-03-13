import { runReanalyse } from '../../../server/routes/history.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const id = req.query?.id ?? (req.url && (() => {
    const match = /\/api\/history\/([^/]+)\/reanalyse/.exec(req.url);
    return match ? match[1] : null;
  })());

  if (!id) {
    res.status(400).json({ error: 'Missing id.' });
    return;
  }

  let body = {};
  if (typeof req.body === 'object' && req.body !== null) {
    body = req.body;
  } else if (req.body && typeof req.body === 'string') {
    try {
      body = JSON.parse(req.body);
    } catch (_) {}
  }

  try {
    const out = await runReanalyse(id, body);
    res.status(200).json(out);
  } catch (err) {
    console.error('Reanalyse error:', err);
    const msg = err.message || 'Re-analysis failed.';
    const status = msg === 'Missing id.' ? 400 : msg === 'Analysis not found.' ? 404 : msg.includes('not found') ? 400 : 500;
    res.status(status).json({ error: msg });
  }
}
