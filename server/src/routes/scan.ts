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
 *           AI_PROVIDER + API key for /api/cleanup-ocr
 */

import { Router, Request, Response } from 'express';
import sharp from 'sharp';

export const scanRouter = Router();

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
  console.log(`[Scan Preproc] HW ${origW}x${origH} → ${targetW}x${targetH} → JPEG ${(outSize / 1024).toFixed(1)}KB (blur+sharpen)`);
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

scanRouter.post('/scan-document', async (req: Request, res: Response) => {
  console.log('[POST /scan-document] Received request.');

  const VISION_API_KEY = getVisionApiKey();
  if (!VISION_API_KEY) {
    console.error('[POST /scan-document] GOOGLE_VISION_API_KEY not configured!');
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
  console.log(`[POST /scan-document] Raw image: ${imageBase64.length} chars base64.`);

  try {
    // Step 1: Preprocess image with handwriting-specific pipeline
    console.log('[POST /scan-document] Preprocessing image (handwriting pipeline)...');
    const processedBase64 = await preprocessHandwriting(imageBase64);
    console.log(`[POST /scan-document] Preprocessed: ${processedBase64.length} chars base64 JPEG.`);

    // Step 2: Call Google Cloud Vision API with DOCUMENT_TEXT_DETECTION
    console.log('[POST /scan-document] Calling Google Cloud Vision API (DOCUMENT_TEXT_DETECTION)...');
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

    console.log(`[POST /scan-document] Vision API HTTP status: ${visionResponse.status}`);

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
      console.error('[POST /scan-document] Vision API error:', JSON.stringify(annotation.error));
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

    console.log(`[POST /scan-document] Extracted ${rawText.length} chars of text.`);
    if (rawText.length > 0) {
      console.log(`[POST /scan-document] First 200 chars: "${rawText.substring(0, 200)}"`);
    } else {
      console.warn('[POST /scan-document] ⚠️  No text extracted — image may be blank or unreadable.');
    }

    res.json({ rawText });
  } catch (err: any) {
    console.error('[POST /scan-document] ========================================');
    console.error('[POST /scan-document] SCAN FAILED');
    console.error('[POST /scan-document] Error:', err?.message ?? 'unknown');
    if (err?.stack) console.error('[POST /scan-document] Stack:', err.stack);
    console.error('[POST /scan-document] ========================================');
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
scanRouter.post('/cleanup-ocr', async (req: Request, res: Response) => {
  console.log('[POST /cleanup-ocr] Received request.');

  const { rawText } = req.body ?? {};
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    res.status(400).json({ error: 'Missing or empty "rawText" field.' });
    return;
  }

  console.log(`[POST /cleanup-ocr] Input: ${rawText.length} chars.`);

  try {
    // Lazy-load the AI service to avoid import failures if SDK is missing
    const { getActiveConfig } = await import('../services/aiService');
    const config = getActiveConfig();

    // Dynamically import the Anthropic SDK
    let Anthropic: any;
    try {
      const sdk = await import('@anthropic-ai/sdk');
      Anthropic = sdk.default ?? sdk.Anthropic;
    } catch {
      res.status(500).json({
        error: '@anthropic-ai/sdk is not installed. Run: npm install @anthropic-ai/sdk',
      });
      return;
    }

    const client = new Anthropic({
      apiKey: config.apiKey,
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    });

    const systemPrompt = `आप एक हिंदी टेक्स्ट प्रूफ़रीडर हैं। आपका कार्य केवल स्पष्ट टाइपो/वर्तनी त्रुटियां और OCR की स्पष्ट गलतियां सुधारना है।

अनिवार्य नियम:
1. केवल स्पष्ट वर्तनी की गलतियां सुधारें (जैसे "आवदेन" → "आवेदन", "शरकार" → "सरकार")
2. मूल अर्थ, भाव और वाक्य संरचना को बिल्कुल न बदलें
3. वाक्यों को दोबारा न लिखें, न ही उन्हें "बेहतर" बनाने का प्रयास करें
4. जो सही है उसे वैसा ही रहने दें — संदेह होने पर न बदलें
5. कोई नई जानकारी न जोड़ें, कोई पैराग्राफ न हटाएं
6. केवल सुधारा हुआ टेक्स्ट लौटाएं, कोई स्पष्टीकरण या टिप्पणी न दें`;

    const userMessage = `निम्नलिखित टेक्स्ट OCR (ऑप्टिकल कैरेक्टर रिकॉग्निशन) से पढ़ा गया है और इसमें गलतियाँ हो सकती हैं। कृपया केवल स्पष्ट टाइपो और OCR त्रुटियों को सुधारें। मूल अर्थ और वाक्य संरचना को बिल्कुल न बदलें।

नीचे OCR से पढ़ा गया टेक्स्ट है:
--- START ---
${rawText}
--- END ---

केवल सुधारा हुआ टेक्स्ट लौटाएं (कोई स्पष्टीकरण नहीं):`;

    console.log(`[POST /cleanup-ocr] Sending to ${config.provider} (${config.model})...`);

    const response = await client.messages.create({
      model: config.model,
      max_tokens: Math.min(rawText.length * 2, 4000),
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    let cleanedText: string;
    if (typeof response.content === 'string') {
      cleanedText = response.content;
    } else if (Array.isArray(response.content)) {
      cleanedText = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
    } else {
      cleanedText = '';
    }

    console.log(`[POST /cleanup-ocr] Output: ${cleanedText.length} chars (input was ${rawText.length}).`);

    res.json({
      cleanedText: cleanedText.trim(),
      provider: config.provider,
    });
  } catch (err: any) {
    console.error('[POST /cleanup-ocr] Error:', err?.message ?? 'unknown');
    res.status(500).json({
      error: 'AI cleanup failed: ' + (err?.message ?? 'unknown error'),
    });
  }
});
