import './load-env.js';
import express from 'express';
import cors from 'cors';
import { analyzeRouter } from './routes/analyze.js';
import { historyRouter } from './routes/history.js';

const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: '20mb' }));

app.use('/api/analyze', analyzeRouter);
app.use('/api/history', historyRouter);

app.get('/api/health', (_, res) => res.json({ ok: true }));

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

export default app;
