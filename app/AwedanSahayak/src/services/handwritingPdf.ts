import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { Platform, Alert } from 'react-native';

const FONT_ASSET = require('../../assets/fonts/NotoSansDevanagari.ttf');
let _fontBase64: string | null = null;

async function getFontDataUri(): Promise<string> {
  if (_fontBase64) return _fontBase64;
  try {
    const assets = await Asset.loadAsync(FONT_ASSET);
    const localUri = assets?.[0]?.localUri;
    if (localUri) {
      const b64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
      if (b64 && b64.length > 1000) {
        _fontBase64 = `url(data:font/ttf;base64,${b64})`;
        return _fontBase64;
      }
    }
  } catch {}
  return '';
}

export interface HandwritingOptions {
  text: string;
  pageStyle: 'ruled' | 'plain' | 'notebook';
  inkColor: 'blue' | 'black';
  fontSize: number;
  lineSpacing: number;
  pageMargin: number;
  watermarkEnabled: boolean;
  language: string;
}

/**
 * Builds handwriting-style HTML pages.
 * Renders text on ruled/plain/notebook style pages.
 * Uses Noto Sans Devanagari font (appears as clean handwritten-style Devanagari).
 */
function buildHandwritingHtml(opts: HandwritingOptions, fontDataUri: string): string {
  const inkHex = opts.inkColor === 'blue' ? '#003C8F' : '#1a1a1a';
  const fontSize = opts.fontSize;
  const lineHeight = fontSize * opts.lineSpacing;
  const margin = opts.pageMargin;

  // Page background based on style
  let bgStyle = '';
  if (opts.pageStyle === 'ruled') {
    bgStyle = `background-image: repeating-linear-gradient(#fff, #fff ${lineHeight - 1}px, #d0e0f0 ${lineHeight - 1}px, #d0e0f0 ${lineHeight}px);`;
  } else if (opts.pageStyle === 'notebook') {
    bgStyle = `
      background-image:
        linear-gradient(#fdd 0px, transparent 1px),
        repeating-linear-gradient(#fff, #fff ${lineHeight - 1}px, #c8d8f0 ${lineHeight - 1}px, #c8d8f0 ${lineHeight}px);
      background-position: 0 0, 0 0;
    `;
  }

  // Split text with newlines
  const paragraphs = opts.text.split('\n').filter(Boolean);
  const lines = paragraphs.map((p) => `<p style="text-indent:2em;">${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`).join('\n');

  const watermark = opts.watermarkEnabled
    ? `<div class="watermark">Computer-generated handwriting | Awedan Sahayak</div>`
    : '';

  return `<!DOCTYPE html><html lang="${opts.language}"><head><meta charset="UTF-8"><style>
    @font-face { font-family:'Noto'; src:${fontDataUri}; }
    *{margin:0;padding:0;box-sizing:border-box;}
    body{
      font-family:'Noto','Mangal',serif;
      font-size:${fontSize}px;
      line-height:${lineHeight}px;
      color:${inkHex};
      padding:${margin}px ${margin + 10}px ${margin + 20}px ${margin + 20}px;
      text-rendering:optimizeLegibility;
      -webkit-font-feature-settings:"kern","liga","clig";
      font-feature-settings:"kern","liga","clig";
      ${bgStyle}
    }
    p{margin-bottom:${lineHeight * 0.5}px;text-align:justify;}
    .watermark{text-align:center;font-size:10px;color:#bbb;margin-top:40px;padding-top:12px;border-top:1px solid #f0f0f0;position:fixed;bottom:30px;left:0;right:0;}
  </style></head><body>${lines}${watermark}</body></html>`;
}

export async function generateHandwritingPdf(opts: HandwritingOptions): Promise<{ uri: string; filename: string }> {
  const fontDataUri = await getFontDataUri();
  const html = buildHandwritingHtml(opts, fontDataUri);

  const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792, base64: false });
  const filename = `Handwriting_${Date.now()}.pdf`;
  const destUri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.moveAsync({ from: uri, to: destUri });
  return { uri: destUri, filename };
}

export async function shareHandwritingPdf(uri: string): Promise<void> {
  const isAvail = await Sharing.isAvailableAsync();
  if (!isAvail) { Alert.alert('शेयरिंग उपलब्ध नहीं', 'शेयरिंग उपलब्ध नहीं है।'); return; }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'हस्तलिखित PDF शेयर करें' });
}
