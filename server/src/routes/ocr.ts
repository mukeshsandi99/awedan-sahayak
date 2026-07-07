/**
 * POST /api/ocr-aadhar
 *
 * Accepts a base64-encoded Aadhar card image, preprocesses it with
 * sharp (grayscale, upscale, sharpen), then sends to Google Cloud
 * Vision API for high-accuracy OCR (DOCUMENT_TEXT_DETECTION).
 *
 * Requires: GOOGLE_VISION_API_KEY in server/.env
 *
 * Privacy: Image is sent to Google's servers for processing only.
 * The Aadhar number is redacted from results. No image is stored
 * on our server or in Google Cloud Storage.
 */

import { Router, Request, Response } from 'express';
import sharp from 'sharp';

export const ocrRouter = Router();

// ── Config ───────────────────────────────────────────────────────────

function getVisionApiKey(): string {
  return process.env.GOOGLE_VISION_API_KEY ?? '';
}
function getVisionApiUrl(): string {
  const key = getVisionApiKey();
  return `https://vision.googleapis.com/v1/images:annotate?key=${key}`;
}

// ── Image preprocessing ─────────────────────────────────────────────

/**
 * Preprocesses the raw base64 image before sending to Vision API.
 *
 * Pipeline:
 *   1. Resize to max 2048px on longest side — Vision API limit is 20MB,
 *      and JSON payload limit is 10MB. Large images cause "Bad image data".
 *   2. Grayscale — removes color noise
 *   3. Normalize — full contrast stretch
 *   4. Sharpen — recover edge detail
 *   5. Output as JPEG base64 — smaller than PNG for network transfer
 */
async function preprocessImage(base64: string): Promise<string> {
  const inputBuffer = Buffer.from(base64, 'base64');
  const metadata = await sharp(inputBuffer).metadata();
  const origW = metadata.width ?? 2048;
  const origH = metadata.height ?? 2048;

  // Cap longest side at 2048px — Google Vision DOCUMENT_TEXT_DETECTION
  // works fine at this resolution, and it keeps the JSON payload well
  // under the 10MB limit (avoids "Bad image data" / error code 3).
  const MAX_DIM = 2048;
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
    .normalize()
    .sharpen({ sigma: 1.2 })
    .jpeg({ quality: 80 })
    .toBuffer();

  const outSize = processed.length;
  console.log(`[OCR Preproc] ${origW}x${origH} → ${targetW}x${targetH} → JPEG ${(outSize / 1024).toFixed(1)}KB`);
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

// ── Field extractors ───────────────────────────────────────────────

function extractName(lines: string[]): string | null {
  // Common Aadhar card boilerplate that should NEVER be treated as a name
  const BOILERPLATE = [
    // National emblem / motto fragments (including OCR misreads)
    /^सत्यमेव/i, /^सत्वमेव/i, /^जयते/i, /^जन$/i,
    /^सत्यमेव\s*जयते$/i, /^सत्वमेव\s*ज/i,
    // Government branding
    /^भारत\s*सरकार/i,
    /^भारतीय\s*विशिष्ट\s*पहचान\s*प्राधिकरण/i, // UIDAI Hindi
    /^GOVERNMENT\s*OF\s*INDIA/i,
    /^Government\s*of\s*India/i,
    // Aadhar branding
    /^आधार[\s\-—]*/i,
    /^AADHAAR/i,
    /^Aadhaar/i,
    /^UIDAI/i,
    /^Unique\s*Identification/i,
    // Card footer/slogans
    /^मेरा\s*आधार/i,
    /^आधार.*अधिकार/i,
    /^आधार.*पहचान/i,
    /^आम\s*आदमी/i,
    // Meta / header lines
    /^Details\s*as\s*on/i,
    /^Aadhaar\s*no/i,
    /^VID:/i,
    // Relations (W/O, S/O, D/O, C/O — wife/son/daughter/care of)
    /^[WSDC]\s*\/\s*O/i,
    // Address label itself
    /^पता\s*:/i,
    /^Address\s*:/i,
    // Address keywords — these are location lines, not names
    /ग्राम/i, /Vill/i, /पोस्ट/i, /Post/i, /थाना/i, /Thana/i,
    /जिला/i, /Dist/i, /District/i, /तहसील/i, /Tehsil/i,
    /राज्य/i, /State/i, /पिन/i, /PIN/i, /नगर/i, /City/i,
    /वार्ड/i, /Ward/i, /मोहल्ला/i, /Colony/i,
    /सड़क/i, /Road/i, /मार्ग/i, /Marg/i,
    // Email / URLs
    /@/,
    /^www\./i,
    /^https?:/i,
    /^help@/i,
  ];

  function isBoilerplate(t: string): boolean {
    for (const pattern of BOILERPLATE) {
      if (pattern.test(t)) return true;
    }
    // Pure number or Aadhar-number-like line (with or without spaces)
    if (/^[\d\s]+$/.test(t)) return true;
    // Lines containing DOB / date-of-birth info
    if (/जन्म|तिथि|DOB|Date\s*of\s*Birth/i.test(t)) return true;
    // Gender-only lines (may have slash like "महिला/ FEMALE")
    if (/^(पुरुष|महिला|Male|Female|MALE|FEMALE)[\s\/]*$/i.test(t)) return true;
    return false;
  }

  // Pass 1: Hindi name (Devanagari chars, 3+ chars, 2+ words preferred)
  for (const line of lines) {
    const t = line.trim();
    if (!t || /\d/.test(t)) continue;
    if (isBoilerplate(t)) continue;
    // Must have Devanagari chars
    if (/[ऀ-ॿ]/.test(t) && t.replace(/\s/g, '').length >= 4) {
      // Prefer multi-word names (e.g., "मुकेश कुमार केशरी")
      if (t.split(/\s+/).length >= 2) return t;
    }
  }
  // Fallback: single-word Hindi name
  for (const line of lines) {
    const t = line.trim();
    if (!t || /\d/.test(t)) continue;
    if (isBoilerplate(t)) continue;
    if (/[ऀ-ॿ]/.test(t) && t.replace(/\s/g, '').length >= 4) return t;
  }

  // Pass 2: English name — ALL CAPS (e.g., "MUKESH KUMAR KESHRI")
  for (const line of lines) {
    const t = line.trim();
    if (!t || /\d/.test(t)) continue;
    if (isBoilerplate(t)) continue;
    if (/^[A-Z][A-Z\s]+$/.test(t) && t.split(/\s+/).length >= 2) return t;
  }

  // Pass 3: English name — Title Case or mixed case (e.g., "Mukesh Kumar Keshri")
  for (const line of lines) {
    const t = line.trim();
    if (!t || /\d/.test(t)) continue;
    if (isBoilerplate(t)) continue;
    if (/^[A-Za-z][A-Za-z\s]+$/.test(t) && t.split(/\s+/).length >= 2) return t;
  }

  return null;
}

function extractDob(text: string): string | null {
  // Standard: "जन्म तिथि/DOB: 21/02/2001" or "DOB: 15/08/1990"
  const m = text.match(/(?:जन्म\s*तिथि|DOB|Date\s*of\s*Birth)[\s:\/]*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
  if (m) return m[1].replace(/-/g, '/');
  const m2 = text.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4}).*?(?:जन्म|DOB|Birth)/i);
  if (m2) return m2[1].replace(/-/g, '/');
  const m3 = text.match(/जन्म.*?(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
  if (m3) return m3[1].replace(/-/g, '/');

  // Year-only format: "जन्म वर्ष / Year of Birth : 1996"
  const m4 = text.match(/(?:जन्म\s*वर्ष|Year\s*of\s*Birth)[\s:\/]*(\d{4})/i);
  if (m4) return m4[1];

  return null;
}

function extractGender(text: string): string | null {
  if (/महिला|Female|female|FEMALE/i.test(text)) return 'महिला';
  if (/पुरुष|Male|male|MALE/i.test(text)) return 'पुरुष';
  return null;
}

function extractAddress(lines: string[]): string | null {
  // Stop conditions for address capture:
  //   - Aadhar number line (12-digit pattern with spaces)
  //   - VID: line
  //   - Email address
  //   - URL
  //   - Card footer/slogan
  const STOP_PATTERNS = [
    /^\d{4}[\s-]?\d{4}[\s-]?\d{4}$/,     // Aadhar number
    /^VID:/i,                                // Virtual ID
    /^Mobile\s*:/i,                          // Phone label
    /^मोबाइल\s*:/i,                         // Phone label (Hindi)
    /^Phone\s*:/i,                           // Phone label
    /@/,                                     // Email
    /^www\./i,                               // URL
    /^https?:/i,                              // URL
    /^मेरा\s*आधार/i,
    /^help@/i,
  ];

  function isStopLine(t: string): boolean {
    for (const p of STOP_PATTERNS) {
      if (p.test(t)) return true;
    }
    return false;
  }

  // Collect lines starting from a label until a stop marker
  function captureFromLabel(labelIdx: number, labelPattern: RegExp): string | null {
    const addr: string[] = [];
    for (let i = labelIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Stop at English "Address:" label (when collecting from Hindi "पता:")
      if (i > labelIdx && /^Address\s*:/i.test(line)) break;
      // Stop at stop markers
      if (i > labelIdx && isStopLine(line)) break;

      addr.push(line);
    }
    if (addr.length === 0) return null;

    // Strip the label from the first line
    addr[0] = addr[0].replace(labelPattern, '').trim();
    // Remove any leading comma/space debris
    addr[0] = addr[0].replace(/^[,\s]+/, '');

    let result = addr.filter(Boolean).join(', ').trim();
    // Clean up: collapse multiple commas, remove leading/trailing commas
    result = result.replace(/,{2,}/g, ',').replace(/,\s*,/g, ',').replace(/^[,\s]+/, '').replace(/[,\s]+$/, '');
    return result || null;
  }

  // 1. Look for Hindi "पता:" label first (preferred)
  for (let i = 0; i < lines.length; i++) {
    if (/^पता\s*:/i.test(lines[i].trim())) {
      return captureFromLabel(i, /^पता\s*:\s*/i);
    }
  }

  // 2. Look for English "Address:" label
  for (let i = 0; i < lines.length; i++) {
    if (/^Address\s*:/i.test(lines[i].trim())) {
      return captureFromLabel(i, /^Address\s*:\s*/i);
    }
  }

  // 3. Heuristic fallback: no explicit label
  // Look for address-like multi-line block between DOB/gender and Aadhar number
  const ADDRESS_KEYWORDS = /(?:ग्राम|गाँव|Village|Vill|मोहल्ला|Colony|सड़क|Road|मार्ग|Marg|पो\.|PO|Post|पोस्ट|तहसील|Tehsil|जिला|District|DIST|राज्य|State|पिन|PIN|PINCODE|नगर|City|Town|वार्ड|Ward|झारखण्ड|बिहार|उत्तर|मध्य|राजस्थान|गुजरात|महाराष्ट्र|पंजाब|हरियाणा)/i;

  let dobIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/जन्म|DOB|Birth/i.test(lines[i])) { dobIdx = i; break; }
  }
  let aadharIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\d{4}[\s-]?\d{4}[\s-]?\d{4}$/.test(lines[i].trim())) { aadharIdx = i; break; }
  }

  if (dobIdx >= 0 && aadharIdx > dobIdx + 1) {
    const candidateLines = lines.slice(dobIdx + 1, aadharIdx).map(l => l.trim()).filter(Boolean);
    if (candidateLines.length >= 1) {
      const looksLikeAddress = candidateLines.some(l =>
        ADDRESS_KEYWORDS.test(l) || /\d/.test(l)
      );
      if (looksLikeAddress) {
        return candidateLines.join(', ');
      }
    }
  }

  return null;
}

// ── Phone number extraction ─────────────────────────────────────────

/**
 * Extracts a 10-digit Indian mobile number from OCR text.
 * Distinguishes from:
 *   - 12-digit Aadhar number (4-4-4 grouped)
 *   - 16-digit VID (4-4-4-4 grouped)
 *   - 6-digit PIN code
 *   - Years (19xx, 20xx)
 */
function extractPhoneNumber(text: string, lines: string[]): string | null {
  // Strategy:
  //   1. Look for a line with "Mobile:" / "मोबाइल:" prefix → extract 10-digit number
  //   2. Scan each line for a standalone 10-digit number (not Aadhar 12-digit or VID 16-digit)
  //   3. Fallback: scan the full text for 10-digit sequences bounded by non-digits

  // 1. Explicit label on a line
  for (const line of lines) {
    const t = line.trim();
    const labelMatch = t.match(
      /(?:Mobile|मोबाइल|Mob|फ़ोन|Phone|Contact|संपर्क)[\s:]*[+#]?\s*(\d[\d\s]{8,14}\d)/i,
    );
    if (labelMatch) {
      const num = labelMatch[1].replace(/\s+/g, '');
      if (num.length === 10 && !isAadharOrVid(num) && !looksLikeYear(num)) return num;
    }
  }

  // 2. Standalone number on a line (possibly with spaces)
  for (const line of lines) {
    const t = line.trim();
    // Allow number-only lines with optional spaces
    if (!/^[\d\s]+$/.test(t)) continue;
    const digitsOnly = t.replace(/\s+/g, '');
    if (digitsOnly.length === 10 && !isAadharOrVid(digitsOnly) && !looksLikeYear(digitsOnly)) {
      return digitsOnly;
    }
  }

  // 3. Fallback: bounded 10-digit number in full text
  // Use lookbehind/lookahead for non-digit boundaries to avoid
  // partial matches on Aadhar/VID sequences.
  const bounded = text.match(/(?:^|[^\d\s])\s*(\d[\d\s]{8,14}\d)\s*(?:$|[^\d\s])/m);
  if (bounded) {
    const num = bounded[1].replace(/\s+/g, '');
    if (num.length === 10 && !isAadharOrVid(num) && !looksLikeYear(num)) return num;
  }

  return null;
}

function looksLikeYear(num: string): boolean {
  return /^(19|20)\d{2}$/.test(num.substring(0, 4));
}

function isAadharOrVid(num: string): boolean {
  // Aadhar: 12 digits (often grouped 4-4-4)
  if (num.length === 12) return true;
  // VID: 16 digits (often grouped 4-4-4-4)
  if (num.length === 16) return true;
  return false;
}

// ── Route handler ──────────────────────────────────────────────────

ocrRouter.post('/ocr-aadhar', async (req: Request, res: Response) => {
  console.log('[POST /ocr-aadhar] Received request.');

  const VISION_API_KEY = getVisionApiKey();
  if (!VISION_API_KEY) {
    console.error('[POST /ocr-aadhar] GOOGLE_VISION_API_KEY not configured!');
    res.status(500).json({ error: 'Server OCR not configured. Set GOOGLE_VISION_API_KEY in server/.env.' });
    return;
  }

  const validation = validateRequest(req.body);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const { imageBase64 } = validation;
  console.log(`[POST /ocr-aadhar] Raw image: ${imageBase64.length} chars base64.`);

  try {
    // Step 1: Preprocess image (upscale, grayscale, sharpen)
    console.log('[POST /ocr-aadhar] Preprocessing image...');
    const processedBase64 = await preprocessImage(imageBase64);
    console.log(`[POST /ocr-aadhar] Preprocessed: ${processedBase64.length} chars base64 JPEG.`);

    // Step 2: Call Google Cloud Vision API
    console.log('[POST /ocr-aadhar] Calling Google Cloud Vision API (DOCUMENT_TEXT_DETECTION)...');
    console.log(`[OCR Debug] Processed image size: ${processedBase64.length} chars base64`);
    const VISION_API_URL = getVisionApiUrl();
    const requestBody = {
      requests: [{
        image: { content: `${processedBase64.substring(0, 50)}...[${processedBase64.length} chars]` },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
      }],
    };
    console.log('[OCR Debug] Vision API request structure:', JSON.stringify(requestBody).substring(0, 300));

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

    console.log(`[OCR Debug] Vision API HTTP status: ${visionResponse.status} ${visionResponse.statusText}`);

    if (!visionResponse.ok) {
      const errText = await visionResponse.text();
      console.error('[OCR Debug] Vision API RAW error body:', errText.substring(0, 1000));
      let err: any = {};
      try { err = JSON.parse(errText); } catch {}
      throw new Error(`Vision API returned ${visionResponse.status}: ${JSON.stringify(err?.error ?? errText.substring(0, 300))}`);
    }

    const visionData = await visionResponse.json();
    console.log('[OCR Debug] Vision API response keys:', JSON.stringify(Object.keys(visionData)));
    console.log('[OCR Debug] responses[0] keys:', JSON.stringify(visionData?.responses?.[0] ? Object.keys(visionData.responses[0]) : 'MISSING'));

    const annotation = visionData?.responses?.[0];
    const hasFullText = !!annotation?.fullTextAnnotation?.text;
    const hasTextAnnotations = !!annotation?.textAnnotations?.length;
    console.log(`[OCR Debug] fullTextAnnotation present: ${hasFullText}, textAnnotations present: ${hasTextAnnotations}`);

    if (hasFullText) {
      console.log(`[OCR Debug] fullTextAnnotation.text length: ${annotation.fullTextAnnotation.text.length}`);
    }
    if (hasTextAnnotations) {
      console.log(`[OCR Debug] textAnnotations count: ${annotation.textAnnotations.length}`);
      console.log(`[OCR Debug] textAnnotations[0].description length: ${annotation.textAnnotations[0]?.description?.length ?? 0}`);
      console.log(`[OCR Debug] textAnnotations[0].description first 200: "${(annotation.textAnnotations[0]?.description ?? '').substring(0, 200)}"`);
    }

    // Check for error in response
    if (annotation?.error) {
      console.error('[OCR Debug] Vision API returned error in response:', JSON.stringify(annotation.error));
    }

    const rawText = annotation?.fullTextAnnotation?.text ?? annotation?.textAnnotations?.[0]?.description ?? '';

    console.log(`[OCR Debug] === FINAL RAW TEXT (${rawText.length} chars) ===`);
    console.log(rawText.length > 0 ? rawText : '[OCR Debug] *** EMPTY — Vision API returned no text ***');
    console.log('[OCR Debug] === END RAW TEXT ===');

    // Step 3: Extract fields
    const allLines = rawText.split('\n');
    const lines = allLines.filter((l) => l.trim().length > 0);
    console.log(`[OCR Debug] Total lines: ${allLines.length}, non-empty lines: ${lines.length}`);

    if (lines.length > 0) {
      console.log('[OCR Debug] All lines:');
      lines.forEach((l, i) => console.log(`[OCR Debug]   [${i}] "${l.trim()}"`));
    }

    const extractedName = extractName(lines);
    const extractedDob = extractDob(rawText);
    const extractedGender = extractGender(rawText);
    const extractedAddress = extractAddress(lines);
    const extractedPhone = extractPhoneNumber(rawText, lines);

    console.log('[OCR Debug] === EXTRACTION RESULTS ===');
    console.log(`[OCR Debug]   name:    "${extractedName ?? 'null'}"`);
    console.log(`[OCR Debug]   dob:      ${extractedDob ?? 'null'}`);
    console.log(`[OCR Debug]   gender:   ${extractedGender ?? 'null'}`);
    console.log(`[OCR Debug]   address:  "${extractedAddress ?? 'null'}"`);
    console.log(`[OCR Debug]   phone:    ${extractedPhone ?? 'null'}`);
    console.log('[OCR Debug] === END EXTRACTION ===');

    const result = {
      name: extractedName,
      dob: extractedDob,
      gender: extractedGender,
      address: extractedAddress,
      phone_number: extractedPhone,
      rawText,
    };

    res.json(result);
  } catch (err: any) {
    console.error('[POST /ocr-aadhar] ========================================');
    console.error('[POST /ocr-aadhar] OCR FAILED');
    console.error('[POST /ocr-aadhar] Error:', err?.message ?? 'unknown');
    if (err?.stack) console.error('[POST /ocr-aadhar] Stack:', err.stack);
    console.error('[POST /ocr-aadhar] ========================================');
    res.status(500).json({
      error: 'OCR processing failed: ' + (err?.message ?? 'unknown error'),
      detail: process.env.NODE_ENV === 'development' ? String(err?.stack ?? err) : undefined,
    });
  }
});
