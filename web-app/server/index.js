import './load-env.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeRouter } from './routes/analyze.js';
import { historyRouter } from './routes/history.js';

const PORT = process.env.PORT || 3001;
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../client/dist');

app.use(cors({ origin: true }));
app.use(express.json({ limit: '20mb' }));

app.use('/api/analyze', analyzeRouter);
app.use('/api/history', historyRouter);

app.get('/api/health', (_, res) => res.json({ ok: true }));

/** Debug OBB wiring (safe for logs; no secrets). */
app.get('/api/health/obb', async (_, res) => {
  const pipeline = (process.env.ANALYZE_PIPELINE || '').toLowerCase();
  const base = (process.env.YOLO_OBB_SERVICE_URL || 'http://127.0.0.1:8766').replace(
    /\/$/,
    '',
  );
  const out = {
    analyzePipeline: pipeline || null,
    yoloObbServiceUrl: base,
    yoloReachable: false,
    yoloHealth: null,
    yoloError: null,
  };
  try {
    const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(8000) });
    out.yoloReachable = r.ok;
    out.yoloHealth = await r.json().catch(() => null);
    if (!r.ok) out.yoloError = `HTTP ${r.status}`;
  } catch (e) {
    out.yoloError = e instanceof Error ? e.message : String(e);
  }
  res.status(out.yoloReachable ? 200 : 503).json(out);
});

// In production monolith deploys, serve the built frontend from Express.
if (process.env.SERVE_CLIENT_BUILD === 'true') {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api\/).*/, (_, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

export default app;
