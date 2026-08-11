import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { Platform, Alert } from 'react-native';
import { BiodataData, getTemplateBuilder, type BiodataTemplateKey } from '../utils/biodataTemplates';

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

export async function generateBiodataPdf(data: BiodataData, templateKey: BiodataTemplateKey, language: string, colorTheme?: string): Promise<{ uri: string; filename: string }> {
  const fontDataUri = await getFontDataUri();

  // Convert photo URI to base64 data URI — expo-print WebView cannot access file:// URIs
  let photoDataUri: string | undefined;
  if (data.photo_uri) {
    try {
      const b64 = await FileSystem.readAsStringAsync(data.photo_uri, { encoding: FileSystem.EncodingType.Base64 });
      if (b64 && b64.length > 100) {
        const ext = (data.photo_uri.split('.').pop()?.toLowerCase() || 'jpg');
        photoDataUri = `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,${b64}`;
      }
    } catch { /* photo not readable — skip */ }
  }

  const builder = getTemplateBuilder(templateKey);
  const html = builder({ ...data, photo_uri: photoDataUri, color_theme: (colorTheme || data.color_theme) as any }, fontDataUri, language);

  console.log('[BiodataPDF] template=' + templateKey + ' htmlLen=' + html.length);

  const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792, base64: false });
  const namePart = (data.full_name ?? 'biodata').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const filename = `Biodata_${namePart}_${Date.now()}.pdf`;
  const destUri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.moveAsync({ from: uri, to: destUri });
  console.log(`[BiodataPDF] Generated: ${destUri}`);
  return { uri: destUri, filename };
}

export async function shareBiodataPdf(uri: string, filename: string): Promise<void> {
  const isAvail = await Sharing.isAvailableAsync();
  if (!isAvail) {
    Alert.alert('शेयरिंग उपलब्ध नहीं', 'इस डिवाइस पर शेयरिंग उपलब्ध नहीं है।');
    return;
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'बायोडाटा शेयर करें' });
}
