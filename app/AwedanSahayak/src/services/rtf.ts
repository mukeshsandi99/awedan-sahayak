/**
 * RTF (Rich Text Format) export service for Awedan Sahayak.
 *
 * Generates .rtf files that open natively in Microsoft Word,
 * Google Docs, WPS Office, and LibreOffice — with proper
 * Hindi Devanagari text rendering and basic formatting.
 *
 * Why RTF instead of .docx:
 *   The "docx" npm package requires Node.js Buffer + ZIP APIs
 *   which are not available in React Native. RTF is a plain-text
 *   format with simple formatting tags — zero dependencies,
 *   universally supported, and preserves Devanagari text.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

// ── Types ───────────────────────────────────────────────────────────

export interface RtfExportOptions {
  /** The generated Hindi application text. */
  generatedText: string;
  /** Hindi name of the application type. */
  applicationName: string;
  /** Applicant's name for the filename. */
  applicantName?: string;
}

export interface RtfExportResult {
  uri: string;
  filename: string;
}

// ── RTF Unicode encoder ─────────────────────────────────────────────

/**
 * Converts a string to RTF-safe Unicode escapes.
 *
 * RTF requires non-ASCII characters (code points > 127) to be
 * written as \u<decimal>? escape sequences. Without this, raw
 * UTF-8 bytes produce garbled mojibake like "à¤¸à¥à¤µà¤¾".
 *
 * ASCII characters (0-127) pass through unchanged (with RTF
 * special characters \, {, } escaped).
 *
 * Example: "सेवा" → "⍠?⍵?⍗?⍦?"
 */
function rtfUnicodeEscape(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 127) {
      // ASCII — escape RTF specials
      if (code === 0x5C) result += '\\\\';       // backslash
      else if (code === 0x7B) result += '\\{';    // {
      else if (code === 0x7D) result += '\\}';    // }
      else result += text.charAt(i);
    } else {
      // Non-ASCII — RTF Unicode escape
      result += `\\u${code}?`;
    }
  }
  return result;
}

// ── RTF builder ─────────────────────────────────────────────────────

/**
 * Builds a valid RTF document from the Hindi application text.
 *
 * RTF structure:
 *   {\rtf1\ansi\deff0 {\fonttbl {\f0 Noto Sans Devanagari;}}
 *   {\colortbl ;}
 *   \pard <rtf-escaped paragraph text>\par
 *   ...}
 *
 * Formatting applied:
 *   - Header (first line with सेवा में) → bold + centered
 *   - Subject line (विषय) → bold
 *   - All other text → normal justified paragraphs
 *   - Double newlines → paragraph breaks
 *
 * Unicode: All non-ASCII characters are converted to \uNNNN? escapes.
 */
function buildRtf(options: RtfExportOptions): string {
  const { generatedText, applicationName } = options;

  const lines = generatedText.split('\n');

  // RTF header — specifies Unicode support and font
  const rtfHeader = [
    '{\\rtf1\\ansi\\deff0',
    '{\\fonttbl{\\f0\\fnil Noto Sans Devanagari;}{\\f1\\fnil Mangal;}}',
    '{\\colortbl ;\\red0\\green0\\blue0;\\red128\\green128\\blue128;}',
    '\\deflang1033',
    '',
  ].join('\n');

  // Build body paragraphs
  const paragraphs: string[] = [];
  let inHeader = true;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      paragraphs.push('\\par'); // blank line = paragraph break
      continue;
    }

    // Convert to RTF Unicode escapes
    const escaped = rtfUnicodeEscape(trimmed);

    // Detect header section (सेवा में or the first address block)
    const isHeaderLine =
      inHeader &&
      (/^\\u/.test(escaped) && (
       trimmed.startsWith('सेवा') ||
       trimmed.includes('श्रीमान') ||
       trimmed.includes('महोदय') ||
       /^[अआइईउऊएऐओऔ].*,$/.test(trimmed)));

    // Detect subject line
    const isSubject = trimmed.startsWith('विषय');

    if (isHeaderLine || isSubject) {
      paragraphs.push(`\\pard\\qc\\b ${escaped}\\b0\\par`);
      if (trimmed.startsWith('विषय')) inHeader = false;
    } else {
      inHeader = false;
      // Normal justified paragraph — good for Hindi body text
      paragraphs.push(`\\pard\\qj ${escaped}\\par`);
    }
  }

  // RTF footer — watermark with credit
  const watermark = rtfUnicodeEscape(
    '\\line\\line Awedan Sahayak ऐप से बनाया गया | एम.एम. एंटरप्राइजेज / M.M. Enterprises',
  );
  const rtfFooter = `\\par\\pard\\qc\\fs16\\cf2 ${watermark}\\par\n}`;

  return rtfHeader + paragraphs.join('\n') + '\n' + rtfFooter;
}

// ── Helpers ─────────────────────────────────────────────────────────

function safeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9ऀ-ॿ _-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Generates an RTF file from the application text and saves it
 * to the device's document directory.
 */
export async function generateRtf(options: RtfExportOptions): Promise<RtfExportResult> {
  const rtfContent = buildRtf(options);

  const namePart = safeFilename(options.applicantName ?? 'aavedak');
  const typePart = safeFilename(options.applicationName);
  const filename = `Awedan_${typePart}_${namePart}_${Date.now()}.rtf`;

  const destUri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(destUri, rtfContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  console.log(`[RTF] Generated: ${destUri} (${rtfContent.length} chars)`);
  return { uri: destUri, filename };
}

/**
 * Opens the system share sheet for the RTF file.
 */
export async function shareRtf(uri: string, filename: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    Alert.alert(
      'शेयरिंग उपलब्ध नहीं',
      'इस डिवाइस पर फ़ाइल शेयरिंग उपलब्ध नहीं है।',
    );
    return;
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/rtf',
    dialogTitle: 'Word डॉक्यूमेंट साझा करें / Share Document',
    UTI: 'public.rtf',
  });
}
