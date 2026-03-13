export default async function handler(req, res) {
  if (req.url && (req.url.startsWith('http://') || req.url.startsWith('https://'))) {
    try {
      const u = new URL(req.url);
      req.url = u.pathname + (u.search || '');
    } catch (_) {}
  }
  const { default: app } = await import('../server/index.js');
  return new Promise((resolve, reject) => {
    res.on('finish', resolve);
    res.on('error', reject);
    app(req, res);
  });
}
