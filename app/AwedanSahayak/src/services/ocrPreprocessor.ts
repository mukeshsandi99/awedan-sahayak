/**
 * OCR Preprocessor — Multi-pass pipeline for Hindi + English documents.
 *
 * Generates multiple preprocessed variants of a document image,
 * sends each to the OCR API, and merges results with confidence scoring.
 *
 * Registry/Sale Deed focus: preserves names, khata, plot, rakba,
 * amount, date, registration number, village, police station, district.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { scanDocument } from './apiClient';
import {
  isNativeProcessorAvailable,
  autoEnhance,
  applyFilter,
  applyAdaptiveThreshold,
  removeShadows,
  whitenBackground,
  applyTextSharpen,
  createPreview,
} from './nativeImageProcessor';

export interface OcrPass {
  label: string;
  rawText: string;
  confidence: number;
}

export interface MultiPassOcrResult {
  rawText: string;
  cleanedText: string;
  passes: OcrPass[];
  bestPass: string; // label of the best pass
  overallConfidence: number;
  language: 'hindi' | 'english' | 'mixed';
  lowConfidenceRegions: string[];
  // Registry-specific extraction
  extracted?: RegistryFields;
}

export interface RegistryFields {
  names: string[];
  khataNumber: string | null;
  plotNumber: string | null;
  rakba: string | null;
  amount: string | null;
  date: string | null;
  registrationNumber: string | null;
  village: string | null;
  policeStation: string | null;
  district: string | null;
  office: string | null;
  handwritingNote: string | null;
}

// ── Preprocessing Pipeline ──────────────────────────────────────────

async function imageToBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

/** Generate multiple preprocessed variants of a document image */
async function generateVariants(originalUri: string): Promise<{ label: string; uri: string }[]> {
  const variants: { label: string; uri: string }[] = [];

  // Always include original
  variants.push({ label: 'Original', uri: originalUri });

  if (!isNativeProcessorAvailable()) {
    // Without native processor, just return original + downsized preview
    const preview = await createPreview(originalUri, 2400);
    if (preview && preview !== originalUri) {
      variants.push({ label: 'Preview', uri: preview });
    }
    return variants;
  }

  // Enhanced (shadow removal + whitening + sharpen + contrast)
  const enhanced = await autoEnhance(originalUri);
  if (enhanced && enhanced !== originalUri) {
    variants.push({ label: 'Enhanced', uri: enhanced });
  }

  // Grayscale only (good for printed text)
  const gray = await applyFilter(originalUri, 'grayscale');
  if (gray && gray !== originalUri) {
    variants.push({ label: 'Grayscale', uri: gray });
  }

  // Black & White / threshold (best for clean printed documents)
  const bwUri = await applyFilter(originalUri, 'blackWhite');
  if (bwUri && bwUri !== originalUri) {
    variants.push({ label: 'BlackWhite', uri: bwUri });
  }

  // Adaptive threshold — local binarisation (best for uneven lighting)
  const thresh = await applyAdaptiveThreshold(originalUri, 31, 12);
  if (thresh && thresh !== originalUri) {
    variants.push({ label: 'AdaptiveThreshold', uri: thresh });
  }

  // High contrast document
  const hiContrast = await applyFilter(originalUri, 'highContrast');
  if (hiContrast && hiContrast !== originalUri) {
    variants.push({ label: 'HighContrast', uri: hiContrast });
  }

  // Shadow-removed only
  const noShadow = await removeShadows(originalUri);
  if (noShadow && noShadow !== originalUri) {
    variants.push({ label: 'ShadowRemoved', uri: noShadow });
  }

  // Whitened background
  const whitened = await whitenBackground(originalUri, 0.15);
  if (whitened && whitened !== originalUri) {
    variants.push({ label: 'Whitened', uri: whitened });
  }

  // Text sharpened (grayscale + sharpen + contrast)
  const sharp = await applyTextSharpen(originalUri);
  if (sharp && sharp !== originalUri) {
    variants.push({ label: 'TextSharpened', uri: sharp });
  }

  return variants;
}

// ── Multi-pass OCR ──────────────────────────────────────────────────

function estimateConfidence(text: string): number {
  if (!text || text.trim().length < 10) return 0;
  const len = text.trim().length;

  // Hindi character range detection
  const hindiChars = (text.match(/[ऀ-ॿ]/g) || []).length;
  const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
  const digits = (text.match(/[0-9]/g) || []).length;
  const totalChars = hindiChars + englishChars + digits;

  if (totalChars === 0) return 0;

  // Confidence factors
  const hasNames = /[A-Z][a-z]+ [A-Z][a-z]+/.test(text) || /[ऀ-ॿ]{3,} [ऀ-ॿ]{3,}/.test(text);
  const hasNumbers = digits > 5;
  const hasDates = /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(text);
  const hasKhata = /[Kk]hata|खाता|ख॰नं|खसरा/i.test(text);
  const hasRakba = /[Rr]akba|रकबा|क्षेत्रफल/i.test(text);
  const hasAmount = /[₹Rs.]+\s*\d|रुपये|रु\./i.test(text);
  const hasRegistry = /[Rr]egistry|रजिस्ट्री|पंजीकरण|बैनामा/i.test(text);

  let confidence = 0.3; // base

  confidence += (hindiChars / Math.max(len, 1)) * 0.2;
  if (hasNames) confidence += 0.1;
  if (hasNumbers) confidence += 0.05;
  if (hasDates) confidence += 0.05;
  if (hasKhata) confidence += 0.1;
  if (hasRakba) confidence += 0.1;
  if (hasAmount) confidence += 0.05;
  if (hasRegistry) confidence += 0.05;

  return Math.min(1, Math.round(confidence * 100) / 100);
}

function detectLanguage(text: string): 'hindi' | 'english' | 'mixed' {
  const hc = (text.match(/[ऀ-ॿ]/g) || []).length;
  const ec = (text.match(/[a-zA-Z]/g) || []).length;
  if (hc > ec * 2) return 'hindi';
  if (ec > hc * 2) return 'english';
  return 'mixed';
}

function findLowConfidenceRegions(text: string): string[] {
  const regions: string[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Very short lines with garbled chars
    if (trimmed.length < 3 && /[^a-zA-Z0-9ऀ-ॿ\s]/.test(trimmed)) {
      regions.push(trimmed);
    }
    // Lines with mostly special chars
    const alpha = (trimmed.match(/[a-zA-Z0-9ऀ-ॿ]/g) || []).length;
    if (alpha < trimmed.length * 0.4 && trimmed.length > 5) {
      regions.push(trimmed);
    }
  }
  return regions;
}

// ── Registry Field Extraction ───────────────────────────────────────

function extractRegistryFields(text: string): RegistryFields {
  const fields: RegistryFields = {
    names: [], khataNumber: null, plotNumber: null, rakba: null,
    amount: null, date: null, registrationNumber: null,
    village: null, policeStation: null, district: null, office: null,
    handwritingNote: null,
  };

  // Names (Hindi: look for श्री/श्रीमती/सुश्री patterns)
  const namePatterns = [
    /(?:श्री|श्रीमती|सुश्री|Sri\.?|Smt\.?|Mr\.?|Mrs\.?)\s*[:\-]?\s*([ऀ-ॿ\s]{3,40})/gi,
    /नाम\s*[:\-]?\s*([ऀ-ॿ\s]{3,40})/gi,
    /Name\s*[:\-]?\s*([A-Za-z\s]{3,40})/gi,
  ];
  for (const pat of namePatterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      const name = m[1].trim();
      if (name && !fields.names.includes(name)) fields.names.push(name);
    }
  }

  // Khata number
  const khataM = text.match(/(?:खाता|ख॰नं|Khata|Khatiyan)\s*(?:संख्या|नं\.?|No\.?)?\s*[:\-]?\s*(\d{1,10}[\d\-\/]*)/i);
  if (khataM) fields.khataNumber = khataM[1];

  // Plot / Khasra
  const plotM = text.match(/(?:खसरा|प्लॉट|Plot|Khasra)\s*(?:संख्या|नं\.?|No\.?)?\s*[:\-]?\s*(\d{1,10}[\d\-\/]*)/i);
  if (plotM) fields.plotNumber = plotM[1];

  // Rakba (area)
  const rakbaM = text.match(/(?:रकबा|क्षेत्रफल|Rakba|Area)\s*[:\-]?\s*([\d.]+\s*(?:हेक्टेयर|एकड़|बीघा|वर्ग|sq|hectare|acre|bigha|Ha\.?)[\s\d.]*)/i);
  if (rakbaM) fields.rakba = rakbaM[1].trim();

  // Amount
  const amountM = text.match(/(?:राशि|रुपये|रु\.?|Amount|₹|Rs\.?)\s*[:\-]?\s*([\d,]+(?:\.\d{2})?)/i);
  if (amountM) fields.amount = amountM[1];

  // Date (multiple formats)
  const dateM = text.match(/(?:दिनांक|Date|Dt\.?)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  if (dateM) fields.date = dateM[1];

  // Registration number
  const regM = text.match(/(?:पंजीकरण|रजिस्ट्री|Registration|Reg\.?)\s*(?:संख्या|नं\.?|No\.?)?\s*[:\-]?\s*([A-Z0-9\-\/]{4,30})/i);
  if (regM) fields.registrationNumber = regM[1];

  // Village
  const villM = text.match(/(?:ग्राम|गाँव|Village|Gram)\s*[:\-]?\s*([ऀ-ॿ\s]{3,30})/i);
  if (villM) fields.village = villM[1].trim();

  // Police Station
  const psM = text.match(/(?:थाना|पुलिस|Police|Thana)\s*[:\-]?\s*([ऀ-ॿ\s]{3,30})/i);
  if (psM) fields.policeStation = psM[1].trim();

  // District
  const distM = text.match(/(?:जिला|जिल्ला|District|Zila)\s*[:\-]?\s*([ऀ-ॿ\s]{3,30})/i);
  if (distM) fields.district = distM[1].trim();

  // Office
  const offM = text.match(/(?:कार्यालय|Office|Karyalaya)\s*[:\-]?\s*([ऀ-ॿ\s]{3,40})/i);
  if (offM) fields.office = offM[1].trim();

  // Handwriting note
  const hwIndicators = [
    /हस्तलिखित/i, /Handwritten/i, /हस्ताक्षर/i, /दस्तखत/i,
  ];
  const hasHW = hwIndicators.some(p => p.test(text));
  if (hasHW) {
    fields.handwritingNote = 'हस्तलिखित भाग पूरी तरह स्पष्ट नहीं पढ़ा जा सका। कृपया जाँचें।';
  }

  return fields;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Run multi-pass OCR: generate variants, OCR each, merge results.
 * Best for Registry, Sale Deed, and other complex documents.
 */
export async function multiPassOcr(imageUri: string): Promise<MultiPassOcrResult | null> {
  try {
    // Step 1: Generate preprocessed variants
    let variants = await generateVariants(imageUri);

    // Step 2: First pass — OCR all variants
    let passes: OcrPass[] = [];
    for (const v of variants.slice(0, 6)) {
      try {
        const b64 = await imageToBase64(v.uri);
        const r = await scanDocument(b64);
        const text = r.ok && r.data?.rawText ? r.data.rawText : '';
        const conf = estimateConfidence(text);
        passes.push({ label: v.label, rawText: text, confidence: conf });
      } catch {
        passes.push({ label: v.label, rawText: '', confidence: 0 });
      }
    }

    // Step 3: Auto-retry — if best confidence < 0.5, generate more aggressive variants
    const sorted = [...passes].sort((a, b) => b.confidence - a.confidence);
    if (sorted[0] && sorted[0].confidence < 0.5 && variants.length > 2) {
      // Retry with only the most aggressive variants (B&W, AdaptiveThreshold, Enhanced)
      const retryVariants = variants.filter(v =>
        ['BlackWhite', 'AdaptiveThreshold', 'Enhanced', 'HighContrast'].includes(v.label)
      );
      for (const v of retryVariants) {
        if (passes.some(p => p.label === v.label && p.confidence > 0)) continue; // skip if already tried
        try {
          const b64 = await imageToBase64(v.uri);
          const r = await scanDocument(b64);
          const text = r.ok && r.data?.rawText ? r.data.rawText : '';
          const conf = estimateConfidence(text);
          passes.push({ label: `${v.label} (Retry)`, rawText: text, confidence: conf });
        } catch { /* skip */ }
      }
    }

    // Step 4: Merge — pick highest confidence pass
    const finalSorted = [...passes].sort((a, b) => b.confidence - a.confidence);
    const best = finalSorted[0];
    if (!best || !best.rawText) return null;

    // Merge: use best as base, supplement unique lines from all passes
    const bestLines = new Set(best.rawText.split('\n').map(l => l.trim()).filter(Boolean));
    for (const pass of finalSorted.slice(1)) {
      if (pass.confidence < 0.2) continue;
      for (const line of pass.rawText.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !bestLines.has(trimmed) && trimmed.length > 5) {
          bestLines.add(trimmed);
        }
      }
    }
    const mergedText = [...bestLines].join('\n');

    // Step 5: Post-process
    const cleanedText = cleanOcrText(mergedText);
    const lowConf = findLowConfidenceRegions(mergedText);
    const extracted = extractRegistryFields(mergedText);

    return {
      rawText: mergedText,
      cleanedText,
      passes: finalSorted,
      bestPass: best.label,
      overallConfidence: best.confidence,
      language: detectLanguage(mergedText),
      lowConfidenceRegions: lowConf,
      extracted,
    };
  } catch (e: any) {
    console.error('[OCR Preprocessor] Error:', e?.message);
    return null;
  }
}

/**
 * Hindi-optimized OCR — applies Devanagari-specific preprocessing
 * (stronger contrast, upscaling for small text, local thresholding)
 */
export async function hindiOptimizedOcr(imageUri: string): Promise<MultiPassOcrResult | null> {
  try {
    // For Hindi documents: prioritize B&W + AdaptiveThreshold + HighContrast
    const variants = await generateVariants(imageUri);
    const hindiVariants = variants.filter(v =>
      ['AdaptiveThreshold', 'BlackWhite', 'HighContrast', 'Enhanced', 'TextSharpened'].includes(v.label)
    );

    const passes: OcrPass[] = [];
    for (const v of hindiVariants) {
      try {
        const b64 = await imageToBase64(v.uri);
        const r = await scanDocument(b64);
        const text = r.ok && r.data?.rawText ? r.data.rawText : '';
        passes.push({ label: v.label, rawText: text, confidence: estimateConfidence(text) });
      } catch {
        passes.push({ label: v.label, rawText: '', confidence: 0 });
      }
    }

    const sorted = [...passes].sort((a, b) => b.confidence - a.confidence);
    const best = sorted[0];
    if (!best || !best.rawText) return null;

    const allLines = new Set<string>();
    for (const pass of sorted) {
      if (pass.confidence < 0.15) continue;
      for (const line of pass.rawText.split('\n')) {
        const t = line.trim();
        if (t && t.length > 3) allLines.add(t);
      }
    }
    const merged = [...allLines].join('\n');
    const cleaned = cleanOcrText(merged);

    return {
      rawText: merged,
      cleanedText: cleaned,
      passes: sorted,
      bestPass: best.label,
      overallConfidence: best.confidence,
      language: detectLanguage(merged),
      lowConfidenceRegions: findLowConfidenceRegions(merged),
      extracted: extractRegistryFields(merged),
    };
  } catch (e: any) {
    console.error('[Hindi OCR] Error:', e?.message);
    return null;
  }
}

// ── OCR Text Cleanup ────────────────────────────────────────────────

function cleanOcrText(text: string): string {
  let cleaned = text;

  // Remove duplicate consecutive lines
  const lines = cleaned.split('\n');
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t && !seen.has(t)) { seen.add(t); unique.push(t); }
    else if (!t) unique.push(''); // preserve paragraph breaks
  }
  cleaned = unique.join('\n');

  // Fix common OCR errors in Hindi
  cleaned = cleaned
    .replace(/ि्/g, 'ि')  // fix i-matra
    .replace(/ै  /g, 'ै')  // fix extra spaces after matras
    .replace(/(\d)\.(\d)/g, '$1.$2')  // preserve decimal points
    .replace(/\s{3,}/g, '\n\n');  // multiple spaces → paragraph break

  return cleaned.trim();
}
