const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export const FALLBACK_DEFAULT_PROMPT = `You are analyzing an image of labels on small boxes. Your task is to extract ONLY the visible printed text from the labels. Ignore completely: QR codes, barcodes, datamatrix codes, and any other non-text graphics.

For each distinct text block (a line or group of lines that appear together on a label), provide:
1. The exact text as it appears, preserving all spaces, line breaks, punctuation, and gaps. Do not correct or normalize the text.
2. A bounding box as [x_min, y_min, x_max, y_max] in NORMALIZED coordinates from 0 to 1.
Respond with a single valid JSON object: {"textBlocks":[{"text":"...","bbox":[x_min,y_min,x_max,y_max]}],"fullText":"..."}`;

export async function getDefaultPrompt() {
  try {
    const res = await fetch(`${API_BASE}/api/analyze/prompt`);
    if (!res.ok) return FALLBACK_DEFAULT_PROMPT;
    const data = await res.json();
    return data.prompt ?? FALLBACK_DEFAULT_PROMPT;
  } catch {
    return FALLBACK_DEFAULT_PROMPT;
  }
}

export async function analyzeLabel(imageBase64, prompt, filename) {
  const body = { image: imageBase64 };
  if (typeof prompt === 'string' && prompt.trim()) body.prompt = prompt.trim();
  if (typeof filename === 'string' && filename.trim()) body.filename = filename.trim();
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText || 'Analysis failed');
  }
  return res.json();
}

export async function getHistory(page = 1, limit = 10) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const res = await fetch(`${API_BASE}/api/history?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = err?.error || res.statusText || 'Failed to load history';
    throw new Error(message);
  }
  return res.json();
}

export async function reanalyseLabel(id, prompt) {
  const body = typeof prompt === 'string' && prompt.trim() ? { prompt: prompt.trim() } : {};
  const res = await fetch(`${API_BASE}/api/history/${encodeURIComponent(id)}/reanalyse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText || 'Re-analysis failed');
  }
  return res.json();
}

export async function deleteLabel(id) {
  const res = await fetch(`${API_BASE}/api/history/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText || 'Delete failed');
  }
}

export async function deleteAllLabels() {
  const res = await fetch(`${API_BASE}/api/history`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText || 'Delete all failed');
  }
}
