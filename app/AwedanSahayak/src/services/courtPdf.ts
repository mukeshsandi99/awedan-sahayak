import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { Alert } from 'react-native';

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

export interface CourtPdfData {
  petitionTypeName: string;
  fields: Record<string, string>;
}

export function buildCourtPetitionText(petitionTypeName: string, fields: Record<string, string>): string {
  const lines: string[] = [];

  // Court heading
  lines.push(`न्यायालय: ${fields.court_name || '_____________'}`);
  if (fields.district) lines.push(`जिला: ${fields.district}`);
  if (fields.case_type) lines.push(`केस प्रकार: ${fields.case_type}`);
  if (fields.case_number) lines.push(`केस संख्या: ${fields.case_number}${fields.year ? ` / ${fields.year}` : ''}`);
  lines.push('');
  lines.push(petitionTypeName.toUpperCase());
  lines.push('');

  // Parties
  if (fields.petitioner_name) lines.push(`आवेदक / याचिकाकर्ता: ${fields.petitioner_name}`);
  if (fields.respondent_name) lines.push(`विपक्षी / प्रतिवादी: ${fields.respondent_name}`);
  if (fields.advocate_name) lines.push(`अधिवक्ता: ${fields.advocate_name}`);
  lines.push('');

  // Case details
  if (fields.police_station) lines.push(`थाना: ${fields.police_station}`);
  if (fields.fir_number) lines.push(`FIR / केस नंबर: ${fields.fir_number}`);
  if (fields.sections_of_law) lines.push(`धाराएं: ${fields.sections_of_law}`);
  if (fields.date_of_occurrence) lines.push(`घटना तिथि: ${fields.date_of_occurrence}`);
  if (fields.custody_date) lines.push(`हिरासत तिथि: ${fields.custody_date}`);
  lines.push('');

  // Main content
  if (fields.facts_of_case) { lines.push('तथ्य (FACTS):'); lines.push(fields.facts_of_case); lines.push(''); }
  if (fields.grounds) { lines.push('आधार (GROUNDS):'); lines.push(fields.grounds); lines.push(''); }

  // Plaint-specific
  if (fields.cause_of_action) { lines.push('वाद हेतुक (CAUSE OF ACTION):'); lines.push(fields.cause_of_action); lines.push(''); }
  if (fields.jurisdiction) { lines.push('क्षेत्राधिकार (JURISDICTION):'); lines.push(fields.jurisdiction); lines.push(''); }
  if (fields.valuation) lines.push(`मूल्यांकन: ${fields.valuation}`);
  if (fields.court_fee) lines.push(`कोर्ट फीस: ${fields.court_fee}`);
  if (fields.property_schedule) { lines.push('संपत्ति अनुसूची:'); lines.push(fields.property_schedule); lines.push(''); }
  if (fields.limitation_statement) { lines.push('परिसीमा कथन:'); lines.push(fields.limitation_statement); lines.push(''); }
  if (fields.document_list) { lines.push('दस्तावेज़ सूची:'); lines.push(fields.document_list); lines.push(''); }

  // Bail-specific
  if (fields.criminal_history) { lines.push('आपराधिक इतिहास:'); lines.push(fields.criminal_history); lines.push(''); }
  if (fields.cooperation_assurance) { lines.push('जांच में सहयोग का आश्वासन:'); lines.push(fields.cooperation_assurance); lines.push(''); }
  if (fields.flight_risk_statement) { lines.push('फरार न होने का कथन:'); lines.push(fields.flight_risk_statement); lines.push(''); }
  if (fields.evidence_tampering_assurance) { lines.push('साक्ष्य संरक्षण आश्वासन:'); lines.push(fields.evidence_tampering_assurance); lines.push(''); }
  if (fields.medical_family_grounds) { lines.push('चिकित्सा/पारिवारिक आधार:'); lines.push(fields.medical_family_grounds); lines.push(''); }
  if (fields.co_accused_parity) { lines.push('सह-अभियुक्त समता:'); lines.push(fields.co_accused_parity); lines.push(''); }

  // Prayer
  if (fields.relief_sought) { lines.push('अनुतोष (RELIEF SOUGHT):'); lines.push(fields.relief_sought); lines.push(''); }
  if (fields.prayer) { lines.push('प्रार्थना (PRAYER):'); lines.push(fields.prayer); lines.push(''); }

  // Verification
  if (fields.verification_text) { lines.push('सत्यापन (VERIFICATION):'); lines.push(fields.verification_text); lines.push(''); }

  // Signature area
  lines.push('');
  if (fields.place) lines.push(`स्थान: ${fields.place}`);
  if (fields.date) lines.push(`दिनांक: ${fields.date}`);
  lines.push('');
  lines.push('_________________________');
  lines.push('आवेदक / याचिकाकर्ता के हस्ताक्षर');
  lines.push('');
  lines.push('_________________________');
  lines.push('अधिवक्ता के हस्ताक्षर');

  return lines.join('\n');
}

async function buildCourtHtml(text: string, petitionTypeName: string, fontDataUri: string): Promise<string> {
  const bodyHtml = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

  return `<!DOCTYPE html><html lang="hi"><head><meta charset="UTF-8"><style>
    @font-face { font-family:'Noto'; src:${fontDataUri}; }
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Noto','Mangal',serif;font-size:13px;line-height:2.0;color:#1a1a1a;padding:60px 56px 90px 56px;text-align:justify;}
    .court-header{text-align:center;margin-bottom:24px;padding-bottom:12px;border-bottom:2px solid #333;}
    .court-title{font-size:16px;font-weight:700;color:#333;}
    .page-num{text-align:right;font-size:10px;color:#999;margin-bottom:20px;}
    .footer{text-align:center;font-size:10px;color:#999;margin-top:60px;padding-top:12px;border-top:1px solid #e0e0e0;}
  </style></head><body>
    <div class="court-header"><div class="court-title">माननीय न्यायालय में<br>${petitionTypeName}</div></div>
    <div class="content">${bodyHtml}</div>
    <div class="footer">Awedan Sahayak | M.M. Enterprises<br>यह केवल प्रारंभिक मसौदा है — दाखिल करने से पहले अधिवक्ता से जांच कराएं।</div>
  </body></html>`;
}

export async function generateCourtPdf(petitionTypeName: string, fields: Record<string, string>): Promise<{ uri: string; filename: string }> {
  const fontDataUri = await getFontDataUri();
  const text = buildCourtPetitionText(petitionTypeName, fields);
  const html = await buildCourtHtml(text, petitionTypeName, fontDataUri);

  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842, base64: false }); // A4
  const safeName = petitionTypeName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
  const filename = `Court_${safeName}_${Date.now()}.pdf`;
  const destUri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.moveAsync({ from: uri, to: destUri });
  return { uri: destUri, filename };
}

export async function shareCourtPdf(uri: string): Promise<void> {
  const isAvail = await Sharing.isAvailableAsync();
  if (!isAvail) { Alert.alert('शेयरिंग उपलब्ध नहीं', 'शेयरिंग उपलब्ध नहीं है।'); return; }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'याचिका PDF शेयर करें' });
}
