/**
 * Awedan Sahayak — Backend API Server
 *
 * Express server providing AI-powered Hindi legal application drafting.
 */

import dotenv from 'dotenv';

// ═══════════════════════════════════════════════════════════════════════
// 1. Load .env IMMEDIATELY — before any other imports that read env vars
// ═══════════════════════════════════════════════════════════════════════
dotenv.config();

// ═══════════════════════════════════════════════════════════════════════
// 2. Validate environment BEFORE anything else starts
// ═══════════════════════════════════════════════════════════════════════
import { validateEnv, getEnvConfig } from './config/env';
validateEnv();
const env = getEnvConfig();

import express from 'express';
import cors from 'cors';
import { generateRouter } from './routes/generate';
import { ocrRouter } from './routes/ocr';
import { scanRouter } from './routes/scan';
import { billingRouter } from './routes/billing';
import { aiRouter } from './routes/aiRoutes';
import { getActiveConfig } from './services/aiService';
import { createLogger } from './config/logger';
import { createAuthMiddleware } from './middleware/auth';
import { generalLimiter, aiLimiter, ocrLimiter } from './middleware/rateLimit';

const app = express();

// ── Logger ──────────────────────────────────────────────────────────

const log = createLogger('Server');

// ── Trust proxy (Render / reverse proxy) ────────────────────────────
//
// Render terminates TLS at its load balancer and forwards to the app
// over HTTP. Without 'trust proxy', Express sees the LB's IP instead
// of the client's real IP — which breaks rate limiting (all requests
// appear from the same proxy IP).
//
// We trust 1 proxy hop (Render's load balancer). If deploying behind
// multiple proxies, increase this number or set to true.
app.set('trust proxy', 1);

// ── Middleware ──────────────────────────────────────────────────────

// CORS — hardened for production
// Native mobile apps send no Origin header → always allowed.
// Browser origins validated against ALLOWED_ORIGINS env var (comma-separated).
// In development, localhost origins are always allowed.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Native mobile app requests have no Origin header — always allow
      if (!origin) {
        callback(null, true);
        return;
      }

      // Development: allow all localhost origins
      if (env.nodeEnv === 'development') {
        callback(null, true);
        return;
      }

      // Production: validate against allowlist
      if (allowedOrigins.length === 0) {
        // No origins configured — block all browser requests in production
        log.warn(`[CORS] Blocked browser origin "${origin}" — ALLOWED_ORIGINS is empty.`);
        callback(new Error('CORS not allowed from browser origins. Use the mobile app.'));
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        log.warn(`[CORS] Blocked unknown origin: "${origin}"`);
        callback(new Error('CORS policy: origin not allowed.'));
      }
    },
    // Allow the X-App-Token header in cross-origin requests
    allowedHeaders: ['Content-Type', 'X-App-Token'],
  }),
);
// Increase JSON body limit for OCR image uploads (base64 photos can be 1-5MB).
// Default 100KB is far too small for camera-captured images.
app.use(express.json({ limit: '10mb' }));

// ── Startup banner ─────────────────────────────────────────────────

try {
  const config = getActiveConfig();
  log.info('');
  log.info('╔══════════════════════════════════════════╗');
  log.info('║       आवेदन सहायक — API Server          ║');
  log.info('╠══════════════════════════════════════════╣');
  log.info(`║  Provider : ${config.provider.padEnd(30)}║`);
  log.info(`║  Model    : ${config.model.padEnd(30)}║`);
  log.info('╚══════════════════════════════════════════╝');
  log.info('');
} catch (err: any) {
  log.error('Failed to initialize AI provider:', err.message);
  log.error('Set AI_PROVIDER and API keys in server/.env');
}

// ── Public routes (NO authentication required) ──────────────────────

app.get('/api/health', (_req, res) => {
  // Health response deliberately minimal — exposes no server internals
  res.json({ status: 'ok' });
});

// ── General rate limiter ─────────────────────────────────────────────
//
// Applies to ALL /api/* routes registered after this line.
// Health endpoint (registered above) is NOT rate-limited.

app.use('/api', generalLimiter());

// ── Authentication middleware ───────────────────────────────────────
//
// Applied AFTER the health route so health remains public.
// All routes registered AFTER this line require X-App-Token.

const authMiddleware = createAuthMiddleware();

// ── Protected API routes ────────────────────────────────────────────
//
// Each route also has a specific rate limiter applied in its own file:
//   generate.ts  → aiLimiter (10 req / 15 min)
//   ocr.ts       → ocrLimiter (10 req / 30 min)
//   scan.ts      → ocrLimiter (scan-document) + aiLimiter (cleanup-ocr)

app.use('/api', authMiddleware, generateRouter);
app.use('/api', authMiddleware, ocrRouter);
app.use('/api', authMiddleware, scanRouter);
app.use('/api', authMiddleware, billingRouter);
app.use('/api', authMiddleware, aiRouter);

// ── Error handler ──────────────────────────────────────────────────

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error('Unhandled error:', err);
  res.status(500).json({
    error: 'आंतरिक सर्वर त्रुटि / Internal server error',
    ...(env.nodeEnv === 'development' ? { detail: err.message } : {}),
  });
});

// ── Start ──────────────────────────────────────────────────────────

const server = app.listen(env.port, () => {
  log.info(`Listening on http://localhost:${env.port}`);
  log.info(`API: POST http://localhost:${env.port}/api/generate-application`);
});

// ── Server-level timeout ────────────────────────────────────────────
// AI generation on free-tier Render + cold starts can take 60-90s.
// We cap at 120s — long enough for DeepSeek to respond, short enough
// that the client gets a response rather than an indefinite hang.
// Client-side timeouts are 45s (default) / 90s (AI routes).
server.timeout = 120_000; // 120 seconds

