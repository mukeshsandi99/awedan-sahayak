/**
 * Awedan Sahayak â€” Backend API Server
 *
 * Express server providing AI-powered Hindi legal application drafting.
 */

import dotenv from 'dotenv';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// 1. Load .env IMMEDIATELY â€” before any other imports that read env vars
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
dotenv.config();

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// 2. Validate environment BEFORE anything else starts
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

// â”€â”€ Logger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const log = createLogger('Server');

// â”€â”€ Trust proxy (Render / reverse proxy) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Render terminates TLS at its load balancer and forwards to the app
// over HTTP. Without 'trust proxy', Express sees the LB's IP instead
// of the client's real IP â€” which breaks rate limiting (all requests
// appear from the same proxy IP).
//
// We trust 1 proxy hop (Render's load balancer). If deploying behind
// multiple proxies, increase this number or set to true.
app.set('trust proxy', 1);

// â”€â”€ Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// CORS â€” hardened for production
// Native mobile apps send no Origin header â†’ always allowed.
// Browser origins validated against ALLOWED_ORIGINS env var (comma-separated).
// In development, localhost origins are always allowed.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Native mobile app requests have no Origin header â€” always allow
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
        // No origins configured â€” block all browser requests in production
        log.warn(`[CORS] Blocked browser origin "${origin}" â€” ALLOWED_ORIGINS is empty.`);
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

// â”€â”€ Startup banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

try {
  const config = getActiveConfig();
  log.info('');
  log.info('â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—');
  log.info('â•‘       à¤†à¤µà¥‡à¤¦à¤¨ à¤¸à¤¹à¤¾à¤¯à¤• â€” API Server          â•‘');
  log.info('â• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•£');
  log.info(`â•‘  Provider : ${config.provider.padEnd(30)}â•‘`);
  log.info(`â•‘  Model    : ${config.model.padEnd(30)}â•‘`);
  log.info('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  log.info('');
} catch (err: any) {
  log.error('Failed to initialize AI provider:', err.message);
  log.error('Set AI_PROVIDER and API keys in server/.env');
}

// â”€â”€ Public routes (NO authentication required) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get('/api/health', (_req, res) => {
  // Health response deliberately minimal â€” exposes no server internals
  res.json({ status: 'ok' });
});

// â”€â”€ General rate limiter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Applies to ALL /api/* routes registered after this line.
// Health endpoint (registered above) is NOT rate-limited.

app.use('/api', generalLimiter());

// â”€â”€ Authentication middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Applied AFTER the health route so health remains public.
// All routes registered AFTER this line require X-App-Token.

const authMiddleware = createAuthMiddleware();

// â”€â”€ Protected API routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Each route also has a specific rate limiter applied in its own file:
//   generate.ts  â†’ aiLimiter (10 req / 15 min)
//   ocr.ts       â†’ ocrLimiter (10 req / 30 min)
//   scan.ts      â†’ ocrLimiter (scan-document) + aiLimiter (cleanup-ocr)

app.use('/api', authMiddleware, generateRouter);
app.use('/api', authMiddleware, ocrRouter);
app.use('/api', authMiddleware, scanRouter);
app.use('/api', authMiddleware, billingRouter);
app.use('/api', authMiddleware, aiRouter);

// â”€â”€ Error handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error('Unhandled error:', err);
  res.status(500).json({
    error: 'à¤†à¤‚à¤¤à¤°à¤¿à¤• à¤¸à¤°à¥à¤µà¤° à¤¤à¥à¤°à¥à¤Ÿà¤¿ / Internal server error',
    ...(env.nodeEnv === 'development' ? { detail: err.message } : {}),
  });
});

// â”€â”€ Start â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const server = app.listen(env.port, () => {
  log.info(`Listening on http://localhost:${env.port}`);
  log.info(`API: POST http://localhost:${env.port}/api/generate-application`);
});

// â”€â”€ Server-level timeout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// AI generation on free-tier Render + cold starts can take 60-90s.
// We cap at 120s â€” long enough for DeepSeek to respond, short enough
// that the client gets a response rather than an indefinite hang.
// Client-side timeouts are 45s (default) / 90s (AI routes).
server.timeout = 120_000; // 120 seconds

