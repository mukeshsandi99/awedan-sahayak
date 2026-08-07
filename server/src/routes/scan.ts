/**
 * POST /api/scan-document
 *
 * Accepts a base64-encoded photo of a handwritten application,
 * preprocesses it with a handwriting-optimised pipeline, then sends to
 * Google Cloud Vision API with DOCUMENT_TEXT_DETECTION.
 *
 * Handwriting preprocessing differs from printed documents (Aadhar):
 *   - Higher resolution cap (3072px vs 2048px) — handwriting strokes
 *     are thinner and need more pixel density for Vision API
 *   - Gaussian blur BEFORE sharpen — reduces paper texture/fibre noise
 *     that confuses handwriting recognition, then sharpens edges
 *   - Stronger contrast normalisation — handwriting ink varies widely
 *     in darkness depending on pen type and pressure
 *
 * POST /api/cleanup-ocr
 *
 * Optional AI pass: sends raw OCR text to the configured LLM with a
 * conservative prompt that only fixes clear typos/OCR errors without
 * changing meaning or sentence structure.
 *
 * Requires: GOOGLE_VISION_API_KEY in server/.env
 *
 * SECURITY: Scanned document text is NEVER logged in production.
 *           AI_PROVIDER + API key for /api/cleanup-ocr
 */

import { Router, Request, Response } from 'express';
import sharp from 'sharp';
import { createLogger } from '../config/logger';
import { ocrLimiter, aiLimiter } from '../middleware/rateLimit';

const log = createLogger('Scan');

export const scanRouter = Router();

// scan-document route uses OCR limiter (Google Vision API)
// cleanup-ocr route uses AI limiter (LLM-based text correction)
// Apply OCR limiter to the entire router; specific routes can override

// ── Config ───────────────────────────────────────────────────────────

function getVisionApiKey(): string {
  return process.env.GOOGLE_VISION_API_KEY ?? '';
}
function getVisionApiUrl(): string {
  const key = getVisionApiKey();
  return `https://vision.googleapis.com/v1/images:annotate?key=${key}`;
}

// ── Handwriting-specific image preprocessing ─────────────────────────
//
// Key differences from the Aadhar OCR pipeline (ocr.ts):
//   1. Higher MAX_DIM (3072 vs 2048) — handwriting strokes are thinner
//   2. Gaussian blur BEFORE sharpen — kills paper texture/fibre noise
//      that causes false positives in handwriting recognition
//   3. Sharper sharpen (sigma 1.8 vs 1.2) — recovers edge detail lost
//      to the blur, critical for thin Devanagari matras

async function preprocessHandwriting(base64: string): Promise<string> {
  const inputBuffer = Buffer.from(base64, 'base64');
  const metadata = await sharp(inputBuffer).metadata();
  const origW = metadata.width ?? 3072;
  const origH = metadata.height ?? 3072;

  // Higher cap for handwriting — Vision API sees more stroke detail
  const MAX_DIM = 3072;
  let targetW = origW;
  let targetH = origH;
  if (origW > MAX_DIM || origH > MAX_DIM) {
    if (origW >= origH) {
      targetW = MAX_DIM;
      targetH = Math.round(origH * (MAX_DIM / origW));
    } else {
      targetH = MAX_DIM;
      targetW = Math.round(origW * (MAX_DIM / origH));
    }
  }

  const processed = await sharp(inputBuffer)
    .resize({ width: targetW, height: targetH, fit: 'inside', kernel: 'lanczos3' })
    .grayscale()
    .normalize()                          // full contrast stretch
    .blur(0.6)                            // kill paper texture/fibre noise
    .sharpen({ sigma: 1.8, m1: 1.0, m2: 0.2 })  // recover thin stroke edges
    .jpeg({ quality: 85 })                // slightly higher quality for handwriting
    .toBuffer();

  const outSize = processed.length;
  log.info(`[Scan Preproc] HW ${origW}x${origH} → ${targetW}x${targetH} → JPEG ${(outSize / 1024).toFixed(1)}KB (blur+sharpen)`);
  return processed.toString('base64');
}

// ── Validation ─────────────────────────────────────────────────────

function validateRequest(body: any): { valid: true; imageBase64: string } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }
  if (!body.imageBase64 || typeof body.imageBase64 !== 'string') {
    return { valid: false, error: 'Missing or invalid "imageBase64".' };
  }
  if (body.imageBase64.length > 20_000_000) {
    return { valid: false, error: 'Image too large — max 20MB base64.' };
  }
  return { valid: true, imageBase64: body.imageBase64 };
}

// ── Route handler ──────────────────────────────────────────────────

scanRouter.post('/scan-document', ocrLimiter(), async (req: Request, res: Response) => {
  log.info('[POST /scan-document] Received request.');

  const VISION_API_KEY = getVisionApiKey();
  if (!VISION_API_KEY) {
    log.error('[POST /scan-document] GOOGLE_VISION_API_KEY not configured!');
    res.status(500).json({
      error: 'Server OCR not configured. Set GOOGLE_VISION_API_KEY in server/.env.',
    });
    return;
  }

  const validation = validateRequest(req.body);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const { imageBase64 } = validation;
  log.info(`[POST /scan-document] Raw image: ${imageBase64.length} chars base64.`);

  try {
    // Step 1: Preprocess image with handwriting-specific pipeline
    log.info('[POST /scan-document] Preprocessing image (handwriting pipeline)...');
    const processedBase64 = await preprocessHandwriting(imageBase64);
    log.info(`[POST /scan-document] Preprocessed: ${processedBase64.length} chars base64 JPEG.`);

    // Step 2: Call Google Cloud Vision API with DOCUMENT_TEXT_DETECTION
    log.info('[POST /scan-document] Calling Google Cloud Vision API (DOCUMENT_TEXT_DETECTION)...');
    const VISION_API_URL = getVisionApiUrl();

    const visionResponse = await fetch(VISION_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: processedBase64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
        }],
      }),
    });

    log.info(`[POST /scan-document] Vision API HTTP status: ${visionResponse.status}`);

    if (!visionResponse.ok) {
      const errText = await visionResponse.text();
      let err: any = {};
      try { err = JSON.parse(errText); } catch {}
      throw new Error(
        `Vision API returned ${visionResponse.status}: ${JSON.stringify(err?.error ?? errText.substring(0, 300))}`,
      );
    }

    const visionData: any = await visionResponse.json();
    const annotation: any = visionData?.responses?.[0];

    if (annotation?.error) {
      log.error('[POST /scan-document] Vision API error:', JSON.stringify(annotation.error));
      res.status(500).json({
        error: `Vision API error: ${annotation.error.message ?? 'Unknown error'}`,
      });
      return;
    }

    // Extract the full text — DOCUMENT_TEXT_DETECTION returns both
    // fullTextAnnotation (continuous block) and textAnnotations (per-word).
    // fullTextAnnotation.text preserves the document's reading order
    // and paragraph breaks, which is what we want for handwriting.
    const rawText =
      annotation?.fullTextAnnotation?.text ??
      annotation?.textAnnotations?.[0]?.description ??
      '';

    log.info(`[POST /scan-document] Extracted ${rawText.length} chars of text.`);
    if (rawText.length > 0) {
      log.info(`[POST /scan-document] First 200 chars: "${rawText.substring(0, 200)}"`);
    } else {
      log.warn('[POST /scan-document] ⚠️  No text extracted — image may be blank or unreadable.');
    }

    res.json({ rawText });
  } catch (err: any) {
    log.error('[POST /scan-document] ========================================');
    log.error('[POST /scan-document] SCAN FAILED');
    log.error('[POST /scan-document] Error:', err?.message ?? 'unknown');
    if (err?.stack) log.error('[POST /scan-document] Stack:', err.stack);
    log.error('[POST /scan-document] ========================================');
    res.status(500).json({
      error: 'Document scan failed: ' + (err?.message ?? 'unknown error'),
    });
  }
});

// ── AI cleanup endpoint ──────────────────────────────────────────────

/**
 * POST /api/cleanup-ocr
 *
 * Sends raw OCR text to the configured LLM with a conservative prompt
 * that ONLY fixes clear typos/OCR errors. Does NOT rewrite, rephrase,
 * or change meaning/structure. Output is the corrected text only.
 *
 * Body: { rawText: string }
 * Response: { cleanedText: string, provider: string }
 */
scanRouter.post('/cleanup-ocr', aiLimiter(), async (req: Request, res: Response) => {
  log.info('[POST /cleanup-ocr] Received request.');

  const { rawText } = req.body ?? {};
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    res.status(400).json({ error: 'Missing or empty "rawText" field.' });
    return;
  }

  log.info(`[POST /cleanup-ocr] Input: ${rawText.length} chars.`);

	try {
		const { AIRouter } = await import('../services/ai/AIRouter');
		const result = await AIRouter.cleanupText(rawText);
		log.info(`[POST /cleanup-ocr] Cleanup: ${result.generatedText.length} chars via ${result.provider}`);
		res.json({ cleanedText: result.generatedText, provider: result.provider });
	} catch (err: any) {
		log.error('[POST /cleanup-ocr] Error:', err?.message ?? 'unknown');
		res.status(500).json({ error: 'AI cleanup failed.' });
	}
});