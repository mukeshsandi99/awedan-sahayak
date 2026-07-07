/**
 * Awedan Sahayak — Backend API Server
 *
 * Express server providing AI-powered Hindi legal application drafting.
 */

import dotenv from 'dotenv';

// Load .env from server root BEFORE any other imports —
// modules like ocrRouter read process.env at import time.
dotenv.config();

import express from 'express';
import cors from 'cors';
import { generateRouter } from './routes/generate';
import { ocrRouter } from './routes/ocr';
import { scanRouter } from './routes/scan';
import { getActiveConfig } from './services/aiService';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// ── Middleware ──────────────────────────────────────────────────────

app.use(cors());
// Increase JSON body limit for OCR image uploads (base64 photos can be 1-5MB).
// Default 100KB is far too small for camera-captured images.
app.use(express.json({ limit: '10mb' }));

// ── Startup logging ────────────────────────────────────────────────

try {
  const config = getActiveConfig();
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║       आवेदन सहायक — API Server          ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Provider : ${config.provider.padEnd(30)}║`);
  console.log(`║  Model    : ${config.model.padEnd(30)}║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
} catch (err: any) {
  console.error('[Server] Failed to initialize AI provider:', err.message);
  console.error('[Server] Set AI_PROVIDER and API keys in server/.env');
}

// ── Routes ─────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', generateRouter);
app.use('/api', ocrRouter);
app.use('/api', scanRouter);

// ── Error handler ──────────────────────────────────────────────────

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({
    error: 'आंतरिक सर्वर त्रुटि / Internal server error',
    ...(process.env.NODE_ENV === 'development' ? { detail: err.message } : {}),
  });
});

// ── Start ──────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[Server] Listening on http://localhost:${PORT}`);
  console.log(`[Server] API endpoint: POST http://localhost:${PORT}/api/generate-application`);
});
