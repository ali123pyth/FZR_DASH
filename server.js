/**
 * FZR Group Dashboard — Node.js Server
 * Deployed on Railway, connected to ali123pyth/FZR_DASH repo.
 *
 * Serves: public/index.html (the dashboard)
 * API:    POST /api/claude  (proxies to Anthropic, key server-side only)
 *
 * Environment variables (set in Railway):
 *   ANTHROPIC_API_KEY   — sk-ant-...
 *   PORT                — set automatically by Railway
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Health check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:  process.env.ANTHROPIC_API_KEY ? 'ready' : 'missing_key',
    service: 'FZR Dashboard',
    ts:      new Date().toISOString()
  });
});

// ─── Claude API endpoint ──────────────────────────────────────
app.post('/api/claude', async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY not configured on server.' } });
  }

  // Enforce model + cap tokens for cost control
  const body = {
    ...req.body,
    model:      'claude-sonnet-4-20250514',
    max_tokens: Math.min(req.body.max_tokens || 600, 1000)
  };

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    const data = await upstream.json();
    res.status(upstream.status).json(data);

  } catch (err) {
    console.error('[Claude proxy error]', err.message);
    res.status(502).json({ error: { message: 'Failed to reach Anthropic: ' + err.message } });
  }
});

// ─── Fallback: serve index.html for any unmatched route ───────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`FZR Dashboard running on port ${PORT}`);
  console.log(`Anthropic key configured: ${!!process.env.ANTHROPIC_API_KEY}`);
});
