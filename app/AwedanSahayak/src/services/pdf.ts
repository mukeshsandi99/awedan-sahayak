/**
 * PDF generation service for Awedan Sahayak.
 *
 * Uses expo-print to convert an HTML template to a PDF file,
 * expo-sharing to share via WhatsApp/other apps, and
 * expo-file-system to save to device storage.
 *
 * The HTML template renders the formal Hindi application with:
 * - Letter-like margins and layout
 * - Noto Sans Devanagari font for proper Hindi rendering
 * - Extra line spacing for handwritten additions (signatures)
 * - Footer watermark
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
// Use legacy API — the new expo-file-system File/Directory API requires
// a larger migration (async file handles, different path model).
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { Platform, Alert } from 'react-native';

// ── Types ───────────────────────────────────────────────────────────

export interface PdfExportOptions {
  /** The generated Hindi application text. */
  generatedText: string;
  /** Hindi name of the application type (e.g. "धमकी की शिकायत"). */
  applicationName: string;
  /** Office type for the header (thana, block, bdo, co, sdo, sp, dc, court, bank, college, school, pwd, rcd, bcd, transport, custom). */
  officeType: string;
  /** Human-readable office name in Hindi. */
  officeName?: string;
  /** Applicant's village for the filename. */
  village?: string;
  /** Applicant's name for the filename. */
  applicantName?: string;
}

export interface PdfExportResult {
  /** Local file URI of the generated PDF. */
  uri: string;
  /** Suggested filename. */
  filename: string;
}

// ── Font embedding ──────────────────────────────────────────────────

/** Path to the bundled Noto Sans Devanagari TTF in app assets. */
const FONT_ASSET = require('../../assets/fonts/NotoSansDevanagari.ttf');

/** Loaded base64-encoded font data, cached after first read. */
let _fontBase64: string | null = null;

/**
 * Reads the bundled Noto Sans Devanagari font and returns it as a
 * base64 data URI. The font is embedded directly in the PDF HTML so
 * expo-print's WebView doesn't need network access or system fonts.
 *
 * Strategy (tries in order):
 *   1. Asset.loadAsync (standard Expo path)
 *   2. Direct file read from Asset.fromModule URI
 *   3. Direct file read from require() resolved path
 */
async function getFontDataUri(): Promise<string> {
  if (_fontBase64) return _fontBase64;

  const readAsBase64 = async (uri: string): Promise<string | null> => {
    try {
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (b64 && b64.length > 1000) {
        console.log(`[PDF] Font loaded: ${(b64.length * 0.75 / 1024).toFixed(0)}KB from ${uri.substring(uri.length - 40)}`);
        return b64;
      }
    } catch (e: any) {
      console.warn(`[PDF] Failed to read font from ${uri}:`, e?.message);
    }
    return null;
  };

  // Strategy 1: Asset.loadAsync
  try {
    const assets = await Asset.loadAsync(FONT_ASSET);
    const localUri = assets?.[0]?.localUri;
    if (localUri) {
      const b64 = await readAsBase64(localUri);
      if (b64) {
        _fontBase64 = `url(data:font/ttf;base64,${b64})`;
        return _fontBase64;
      }
    }
  } catch (e: any) {
    console.warn('[PDF] Asset.loadAsync failed:', e?.message);
  }

  // Strategy 2: Asset.fromModule
  try {
    const asset = Asset.fromModule(FONT_ASSET);
    if (asset?.localUri || asset?.uri) {
      const uri = asset.localUri || asset.uri;
      const b64 = await readAsBase64(uri);
      if (b64) {
        _fontBase64 = `url(data:font/ttf;base64,${b64})`;
        return _fontBase64;
      }
    }
  } catch (e: any) {
    console.warn('[PDF] Asset.fromModule failed:', e?.message);
  }

  // Strategy 3: try direct file access
  try {
    // require() returns a number (module ID); resolve via Asset registry
    const asset = Asset.fromModule(FONT_ASSET);
    const resolvedUri = asset?.localUri || asset?.uri;
    if (resolvedUri) {
      // Force download if not yet cached
      await asset.downloadAsync?.();
      const b64 = await readAsBase64(asset.localUri || asset.uri);
      if (b64) {
        _fontBase64 = `url(data:font/ttf;base64,${b64})`;
        return _fontBase64;
      }
    }
  } catch (e: any) {
    console.warn('[PDF] Direct asset read failed:', e?.message);
  }

  console.error('[PDF] ⚠️  All font loading strategies failed — Devanagari rendering will be broken!');
  return '';
}

// ── HTML template ───────────────────────────────────────────────────

/**
 * Returns the appropriate office header for the letterhead.
 * Does NOT add "Government of India" or any fake banner.
 * Returns empty string for custom/generic types.
 */
function getOfficeHeader(officeType: string, officeName?: string): string {
  const name = officeName || '';
  switch (officeType) {
    case 'thana':
      return name ? `सेवा में,<br>थाना प्रभारी,<br>${name}` : 'सेवा में,<br>थाना प्रभारी';
    case 'co':
      return name ? `सेवा में,<br>अंचल अधिकारी,<br>${name}` : 'सेवा में,<br>अंचल अधिकारी';
    case 'sdo':
      return name ? `सेवा में,<br>अनुमंडल अधिकारी,<br>${name}` : 'सेवा में,<br>अनुमंडल अधिकारी';
    case 'sp':
      return name ? `सेवा में,<br>पुलिस अधीक्षक,<br>${name}` : 'सेवा में,<br>पुलिस अधीक्षक';
    case 'dc':
      return name ? `सेवा में,<br>उपायुक्त,<br>${name}` : 'सेवा में,<br>उपायुक्त';
    case 'bdo':
      return name ? `सेवा में,<br>प्रखंड विकास पदाधिकारी,<br>${name}` : 'सेवा में,<br>प्रखंड विकास पदाधिकारी';
    case 'block':
      return name ? `सेवा में,<br>प्रखंड पदाधिकारी,<br>${name}` : 'सेवा में,<br>प्रखंड पदाधिकारी';
    case 'court':
      return name ? `सेवा में,<br>माननीय न्यायालय,<br>${name}` : 'सेवा में,<br>माननीय न्यायालय';
    case 'bank':
      return name ? `सेवा में,<br>शाखा प्रबंधक,<br>${name}` : 'सेवा में,<br>शाखा प्रबंधक';
    case 'college':
      return name ? `सेवा में,<br>प्रधानाचार्य,<br>${name}` : 'सेवा में,<br>प्रधानाचार्य';
    case 'school':
      return name ? `सेवा में,<br>प्रधानाध्यापक,<br>${name}` : 'सेवा में,<br>प्रधानाध्यापक';
    case 'pwd':
    case 'rcd':
    case 'bcd':
    case 'transport':
      return name ? `सेवा में,<br>${name}` : 'सेवा में';
    case 'custom':
      return name || '';
    default:
      return name || '';
  }
}

/**
 * Builds the full HTML document for the PDF.
 *
 * Devanagari rendering:
 * - Bundles Noto Sans Devanagari as a base64-embedded @font-face.
 *   Google Fonts @import fails in expo-print's WebView because it
 *   can't make network requests; local font embedding guarantees
 *   proper rendering of matras, conjuncts, and ligatures.
 *
 * Layout:
 * - The AI-generated text is the COMPLETE application (header, body,
 *   footer). The HTML only adds a minimal letterhead line and a
 *   watermark. No fake government banners. No duplicate headers.
 */
async function buildPdfHtml(options: PdfExportOptions): Promise<string> {
  const { generatedText, applicationName, officeType, officeName } = options;

  // Load the embedded font as base64 data URI
  const fontDataUri = await getFontDataUri();

  // Escape the generated text for HTML. The AI output is the complete
  // application — we wrap it without adding duplicate headers/footers.
  const bodyHtml = generatedText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  // Build office-appropriate header — NO fake government banners
  const officeHeader = getOfficeHeader(officeType, officeName);
  const headerHtml = officeHeader
    ? `<div class="letterhead"><div class="letterhead-office">${officeHeader}</div></div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @font-face {
      font-family: 'Noto Sans Devanagari';
      src: ${fontDataUri};
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Noto Sans Devanagari';
      src: ${fontDataUri};
      font-weight: 700;
      font-style: normal;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Noto Sans Devanagari', 'Mangal', 'Lohit Devanagari', serif;
      font-size: 15px;
      line-height: 2.0;
      color: #1a1a1a;
      padding: 56px 60px 90px 60px;
      -webkit-print-color-adjust: exact;
      /* Critical for Devanagari conjunct/matra rendering */
      text-rendering: optimizeLegibility;
      -webkit-font-feature-settings: "kern", "liga", "clig";
      font-feature-settings: "kern", "liga", "clig";
      font-kerning: normal;
    }

    .mek-badge {
      text-align: right; font-size: 11px; font-weight: 700; color: #999;
      margin-bottom: 4px; letter-spacing: 1px;
    }
    .letterhead {
      text-align: left;
      margin-bottom: 32px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e0e0e0;
    }
    .letterhead-office {
      font-size: 16px;
      font-weight: 700;
      color: #1a1a1a;
      line-height: 2.0;
    }

    .content {
      text-align: justify;
    }

    .watermark {
      text-align: center;
      font-size: 10px;
      color: #bbb;
      margin-top: 48px;
      padding-top: 12px;
      border-top: 1px solid #f0f0f0;
    }

    @media print {
      body { padding: 50px 56px 90px 56px; }
    }
  </style>
</head>
<body>
  ${headerHtml}

  <div class="content">
    ${bodyHtml}
  </div>

  <div class="watermark">
    Awedan Sahayak ऐप से बनाया गया | एम.एम. एंटरप्राइजेज
  </div>
</body>
</html>`;
  console.log('[AppPDF] officeType=' + officeType + ' htmlLen=' + html.length);
  return html;
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Sanitizes a string for use as a filename. */
function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9ऀ-ॿ _-]/g, '').replace(/\s+/g, '_').substring(0, 60);
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Generates a PDF from the application text and saves it to the device
 * cache directory. Returns the local file URI.
 */
export async function generatePdf(options: PdfExportOptions): Promise<PdfExportResult> {
  const html = await buildPdfHtml(options);

  const { uri } = await Print.printToFileAsync({
    html,
    width: 612,   // US Letter width in points
    height: 792,  // US Letter height in points
    base64: false,
  });

  // Build a readable filename
  const namePart = safeFilename(options.applicantName ?? 'aavedak');
  const typePart = safeFilename(options.applicationName);
  const filename = `Awedan_${typePart}_${namePart}_${Date.now()}.pdf`;

  // Move from Print cache to FileSystem documentDirectory for persistence
  const destUri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.moveAsync({ from: uri, to: destUri });

  console.log(`[PDF] Generated: ${destUri}`);
  return { uri: destUri, filename };
}

/**
 * Opens the system share sheet for the PDF file.
 * WhatsApp, Gmail, Bluetooth, etc. will appear as share targets.
 */
export async function sharePdf(uri: string, filename: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    Alert.alert(
      'शेयरिंग उपलब्ध नहीं',
      'इस डिवाइस पर फ़ाइल शेयरिंग उपलब्ध नहीं है।\n\nSharing is not available on this device.',
    );
    return;
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'आवेदन पत्र साझा करें / Share Application',
    UTI: 'com.adobe.pdf',
  });
}

// ── Scanner PDF exports (compatible with restored Document Scanner) ──

export type QualityMode = 'small' | 'balanced' | 'high' | 'original' | 'verySmall';

interface QualityConfig { label: string; labelHi: string; quality: number; maxWidth: number; }

export const QUALITY_OPTIONS: Record<QualityMode, QualityConfig> = {
  verySmall: { label: 'बहुत छोटा',  labelHi: 'Very Small', quality: 0.30, maxWidth: 800 },
  small:     { label: 'छोटा आकार',  labelHi: 'Small',      quality: 0.45, maxWidth: 1200 },
  balanced:  { label: 'संतुलित',    labelHi: 'Balanced',   quality: 0.70, maxWidth: 1800 },
  high:      { label: 'उच्च गुणवत्ता', labelHi: 'High',   quality: 0.90, maxWidth: 2600 },
  original:  { label: 'मूल गुणवत्ता', labelHi: 'Original', quality: 1.0,  maxWidth: 99999 },
};

export async function estimatePdfImageSize(
  imageUris: string[],
  qualityMode: QualityMode,
): Promise<number> {
  let totalBytes = 0;
  const cfg = QUALITY_OPTIONS[qualityMode] || QUALITY_OPTIONS.balanced;
  for (const uri of imageUris) {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      totalBytes += ((info as any)?.size ?? 500_000) * cfg.quality;
    } catch { totalBytes += 500_000 * cfg.quality; }
  }
  return totalBytes;
}

export interface ScannedPdfOptions {
  imageUris: string[];
  title: string;
  qualityMode?: QualityMode;
  pageSize?: 'A4' | 'Letter' | 'Legal' | 'Auto';
  orientation?: 'portrait' | 'landscape';
  margin?: number;
  sessionId?: string;
}

export async function generateScannedPdf(
  imageUrisOrOptions: string[] | ScannedPdfOptions,
  title?: string,
  qualityMode?: QualityMode,
): Promise<{ uri: string; filename: string; pageCount: number; sizeBytes: number }> {
  let opts: ScannedPdfOptions;
  if (Array.isArray(imageUrisOrOptions)) {
    opts = { imageUris: imageUrisOrOptions, title: title || 'Document', qualityMode: qualityMode || 'balanced' };
  } else {
    opts = imageUrisOrOptions;
  }
  const { imageUris } = opts;
  if (!imageUris || imageUris.length === 0) throw new Error('No pages to generate PDF.');

  const cfg = QUALITY_OPTIONS[opts.qualityMode || 'balanced'];
  let imagesHtml = '';
  for (const uri of imageUris) {
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    imagesHtml += `<div class="page"><img src="data:image/jpeg;base64,${b64}" style="width:100%;height:auto;" /></div>`;
  }

  // Build A4 page layout — each .page fills one A4 sheet
  // Using @page + mm units for reliable multi-page printing in expo-print
  const { uri } = await Print.printToFileAsync({
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page{size:A4;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff}
.page{page-break-after:always;break-after:page;width:210mm;height:297mm;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fff}
.page:last-child{page-break-after:auto;break-after:auto}
.page img{max-width:98%;max-height:98%;object-fit:contain;display:block}
</style></head><body>${imagesHtml}</body></html>`,
    width: 595.28,
    height: 841.89,
    base64: false,
  });

  const filename = `Scan_${Date.now()}.pdf`;
  const destUri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.moveAsync({ from: uri, to: destUri });
  const info = await FileSystem.getInfoAsync(destUri);
  const sizeBytes = (info as any)?.size ?? 0;
  return { uri: destUri, filename, pageCount: imageUris.length, sizeBytes };
}

/**
 * Checks whether the device supports saving PDFs locally.
 * On Android, files saved to documentDirectory are accessible
 * via the file manager. On iOS, they're in the app sandbox.
 */
export function isSaveSupported(): boolean {
  return Platform.OS === 'android';
}
