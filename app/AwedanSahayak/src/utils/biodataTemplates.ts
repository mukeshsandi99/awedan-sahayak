/**
 * Marriage & Professional Biodata HTML templates.
 * Each template renders a complete A4 page designed for Print.
 *
 * KEY RULES:
 * - A4 dimensions: 595 x 842 pts
 * - Photo is base64 data URI (converted by biodataPdf.ts before calling)
 * - Empty fields are hidden (no blank labels)
 * - Single-page optimized (no trailing blank page)
 */

export type BiodataTemplateKey = 'classic' | 'elegant' | 'modern' | 'traditional' | 'professional';

export type BiodataColorTheme = 'blue' | 'maroon' | 'green' | 'gold' | 'purple' | 'neutral';

export const BIODATA_THEME_COLORS: Record<BiodataColorTheme, { primary: string; accent: string; bg: string }> = {
  blue:     { primary: '#1565C0', accent: '#E3F2FD', bg: '#F5F9FF' },
  maroon:   { primary: '#8B0000', accent: '#FFEBEE', bg: '#FFF8F5' },
  green:    { primary: '#2E7D32', accent: '#E8F5E9', bg: '#F5FFF5' },
  gold:     { primary: '#B8860B', accent: '#FFF8E1', bg: '#FFFDF5' },
  purple:   { primary: '#6A1B9A', accent: '#F3E5F5', bg: '#FDF5FF' },
  neutral:  { primary: '#424242', accent: '#F5F5F5', bg: '#FAFAFA' },
};

export const BIODATA_THEME_LABELS: Record<BiodataColorTheme, string> = {
  blue: 'नीला', maroon: 'मैरून', green: 'हरा', gold: 'सुनहरा', purple: 'बैंगनी', neutral: 'सादा',
};

export interface BiodataData {
  full_name?: string; photo_uri?: string; dob?: string; age?: number;
  height?: string; gender?: string; religion?: string; caste?: string;
  gotra?: string; education?: string; occupation?: string; income?: string;
  father_name?: string; mother_name?: string; family_details?: string;
  address?: string; contact_details?: string; siblings?: string;
  hobbies?: string; expectations?: string; horoscope_details?: string;
  language?: string;
  color_theme?: BiodataColorTheme;
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Only emit a row if value is truthy and non-empty after trimming. */
function has(v: any): boolean {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

/** Single field row for table-less layouts. */
function row(label: string, value: any, col1?: string): string {
  if (!has(value)) return '';
  return `<div class="drow"><span class="dlbl">${label}</span><span class="dval">${String(value)}</span></div>`;
}

/** Two-column row. */
function row2(l1: string, v1: any, l2: string, v2: any): string {
  const a = has(v1) ? `<div class="dcol"><span class="dlbl">${l1}</span><span class="dval">${String(v1)}</span></div>` : '';
  const b = has(v2) ? `<div class="dcol"><span class="dlbl">${l2}</span><span class="dval">${String(v2)}</span></div>` : '';
  if (!a && !b) return '';
  return `<div class="drow2">${a}${b}</div>`;
}

/** Section heading — only shown if there's content below. */
function section(title: string): string {
  return `<div class="sec-title">${title}</div>`;
}

/** Photo frame (matrimonial style — top-right portrait). */
function photoImg(uri?: string): string {
  if (!uri) return '';
  return `<div class="photo-frame"><img src="${uri}" /></div>`;
}

/** Photo frame (professional style — small left-aligned). */
function photoProf(uri?: string): string {
  if (!uri) return '';
  return `<div class="photo-prof"><img src="${uri}" /></div>`;
}

// ── Base CSS ──────────────────────────────────────────────────────────

function baseCss(fontDataUri: string, theme: BiodataColorTheme): string {
  const t = BIODATA_THEME_COLORS[theme] || BIODATA_THEME_COLORS.maroon;
  return `
@font-face{font-family:'Noto';src:${fontDataUri};}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:595px;min-height:842px;}
body{font-family:'Noto','Mangal',serif;font-size:13px;color:#1a1a1a;line-height:1.75;
  padding:28px 32px 20px 32px;background:#fff;}
.drow{display:flex;padding:3px 0;border-bottom:1px solid #f5f5f5;}
.dlbl{font-weight:700;font-size:11px;color:${t.primary};min-width:110px;padding-right:10px;}
.dval{font-size:13px;color:#333;flex:1;}
.drow2{display:flex;gap:16px;padding:3px 0;}
.dcol{flex:1;display:flex;border-bottom:1px solid #f5f5f5;padding:3px 0;}
.dcol .dlbl{min-width:80px;}
.sec-title{font-size:13px;font-weight:700;color:${t.primary};margin-top:14px;margin-bottom:4px;
  padding-bottom:2px;border-bottom:1.5px solid ${t.primary};letter-spacing:0.5px;}
.photo-frame{position:absolute;top:28px;right:32px;width:85px;height:105px;
  border:2px solid ${t.primary};border-radius:6px;overflow:hidden;background:#fafafa;}
.photo-frame img{width:100%;height:100%;object-fit:cover;}
.photo-prof{float:left;width:70px;height:88px;border:2px solid ${t.primary};border-radius:4px;
  overflow:hidden;margin-right:16px;margin-bottom:8px;background:#fafafa;}
.photo-prof img{width:100%;height:100%;object-fit:cover;}
.page-border{position:absolute;top:12px;left:12px;right:12px;bottom:12px;
  border:2px solid ${t.primary};border-radius:4px;pointer-events:none;opacity:0.5;}
.mek-badge{text-align:right;font-size:12px;font-weight:700;color:#666;letter-spacing:1px;margin-bottom:2px;width:100%;}
.footer-line{text-align:center;font-size:10px;color:#888;margin-top:10px;
  padding-top:6px;border-top:1px solid #f0f0f0;}
.name-title{font-size:22px;font-weight:700;color:${t.primary};margin-bottom:2px;}
.name-sub{font-size:12px;color:#888;margin-bottom:12px;}
`;
}

// ═══════════════════════════════════════════════════════════════════════
// CLASSIC MATRIMONIAL
// ═══════════════════════════════════════════════════════════════════════

function classicCss(fontDataUri: string, theme: BiodataColorTheme): string {
  const t = BIODATA_THEME_COLORS[theme] || BIODATA_THEME_COLORS.maroon;
  return baseCss(fontDataUri, theme) + `
.page-border{border:2.5px double ${t.primary};top:10px;left:10px;right:10px;bottom:10px;}
.header-center{text-align:center;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid ${t.accent};}
.header-center .mantra{font-size:14px;color:${t.primary};margin-bottom:4px;font-weight:600;}
.header-center .title{font-size:20px;font-weight:700;color:${t.primary};letter-spacing:0.5px;}
.name-title{font-size:20px;text-align:center;margin-top:4px;}
.name-sub{text-align:center;}
.photo-frame{top:98px;right:32px;}
.drow{padding:2.5px 0;}
.sec-title{margin-top:10px;}`;
}

export function buildClassicTemplate(data: BiodataData, fontDataUri: string, lang: string): string {
  const hi = lang === 'hi';
  const theme = data.color_theme ?? 'maroon';
  const content = [
    has(data.dob) || has(data.age) || has(data.height) || has(data.gender) || has(data.religion) || has(data.caste)
      ? section(hi?'व्यक्तिगत जानकारी':'Personal Details') : '',
    row2(hi?'जन्म तिथि':'DOB', data.dob, hi?'आयु':'Age', data.age),
    row2(hi?'ऊंचाई':'Height', data.height, hi?'लिंग':'Gender', data.gender),
    row2(hi?'धर्म':'Religion', data.religion, hi?'जाति':'Caste', data.caste ? `${data.caste}${data.gotra ? ` (${data.gotra})` : ''}` : undefined),
    has(data.education) || has(data.occupation) || has(data.income)
      ? section(hi?'शिक्षा व करियर':'Education & Career') : '',
    row(hi?'शिक्षा':'Education', data.education),
    row(hi?'व्यवसाय':'Occupation', data.occupation),
    row(hi?'वार्षिक आय':'Annual Income', data.income),
    has(data.father_name) || has(data.mother_name) || has(data.family_details) || has(data.siblings)
      ? section(hi?'परिवार':'Family') : '',
    row2(hi?'पिता':'Father', data.father_name, hi?'माता':'Mother', data.mother_name),
    row(hi?'भाई-बहन':'Siblings', data.siblings),
    row(hi?'पारिवारिक विवरण':'Family Details', data.family_details),
    has(data.address) || has(data.contact_details)
      ? section(hi?'संपर्क':'Contact') : '',
    row(hi?'पता':'Address', data.address),
    row(hi?'संपर्क':'Contact', data.contact_details),
    has(data.hobbies) || has(data.expectations) || has(data.horoscope_details)
      ? section(hi?'अन्य':'Other') : '',
    row(hi?'शौक':'Hobbies', data.hobbies),
    row(hi?'अपेक्षाएं':'Expectations', data.expectations),
    row(hi?'कुंडली':'Horoscope', data.horoscope_details),
  ].filter(Boolean).join('\n');

  return `<!DOCTYPE html><html lang="hi"><head><meta charset="UTF-8"><style>${classicCss(fontDataUri, theme)}</style></head><body>
<div class="page-border"></div>
<div class="header-center"><div class="mantra">॥ ॐ श्री गणेशाय नमः ॥</div><div class="title">${hi?'विवाह बायोडाटा':'Marriage Biodata'}</div></div>
${photoImg(data.photo_uri)}
<div class="name-title">${data.full_name || ''}</div>
<div class="name-sub">${[data.age ? `${data.age} वर्ष` : '', data.height, data.occupation].filter(Boolean).join(' • ')}</div>
${content}
<div class="footer-line">Awedan Sahayak</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════
// ELEGANT MATRIMONIAL
// ═══════════════════════════════════════════════════════════════════════

function elegantCss(fontDataUri: string, theme: BiodataColorTheme): string {
  const t = BIODATA_THEME_COLORS[theme] || BIODATA_THEME_COLORS.purple;
  return baseCss(fontDataUri, theme) + `
body{background:linear-gradient(135deg,${t.accent}22,${t.bg});}
.page-border{border:1.5px solid ${t.primary};top:14px;left:14px;right:14px;bottom:14px;opacity:0.7;}
.corner{position:absolute;width:24px;height:24px;border-color:${t.primary};border-style:solid;opacity:0.6;}
.corner-tl{top:14px;left:14px;border-width:2px 0 0 2px;border-radius:4px 0 0 0;}
.corner-tr{top:14px;right:14px;border-width:2px 2px 0 0;border-radius:0 4px 0 0;}
.corner-bl{bottom:14px;left:14px;border-width:0 0 2px 2px;border-radius:0 0 0 4px;}
.corner-br{bottom:14px;right:14px;border-width:0 2px 2px 0;border-radius:0 0 4px 0;}
.header-elegant{text-align:center;margin-bottom:14px;}
.header-elegant .title{font-size:22px;font-weight:700;color:${t.primary};letter-spacing:1px;}
.header-elegant .sub{font-size:11px;color:#999;margin-top:2px;}
.name-title{font-size:20px;text-align:center;font-weight:600;}
.photo-frame{border-radius:50%;width:80px;height:80px;top:80px;right:34px;border:3px solid ${t.primary};}
.dlbl{color:${t.primary};font-size:10px;text-transform:uppercase;letter-spacing:0.5px;min-width:100px;}
.drow{border-bottom:1px dotted #e8e8e8;padding:2px 0;}
.sec-title{border-bottom:none;color:${t.primary};font-size:12px;letter-spacing:0.5px;margin-top:8px;}`;
}

export function buildElegantTemplate(data: BiodataData, fontDataUri: string, lang: string): string {
  const hi = lang === 'hi';
  const theme = data.color_theme ?? 'purple';
  const content = [
    has(data.dob) || has(data.age) || has(data.height) || has(data.gender) || has(data.religion)
      ? section(hi?'व्यक्तिगत विवरण':'Personal Details') : '',
    row2(hi?'जन्म तिथि':'Date of Birth', data.dob, hi?'आयु':'Age', data.age),
    row(hi?'ऊंचाई':'Height', data.height),
    row2(hi?'धर्म':'Religion', data.religion, hi?'जाति/गोत्र':'Caste/Gotra', data.caste ? `${data.caste}${data.gotra ? ` (${data.gotra})` : ''}` : undefined),
    has(data.education) || has(data.occupation)
      ? section(hi?'शिक्षा व व्यवसाय':'Education & Occupation') : '',
    row(hi?'शिक्षा':'Education', data.education),
    row(hi?'व्यवसाय':'Occupation', data.occupation),
    row(hi?'आय':'Annual Income', data.income),
    has(data.father_name) || has(data.mother_name)
      ? section(hi?'पारिवारिक जानकारी':'Family Information') : '',
    row2(hi?'पिता':'Father', data.father_name, hi?'माता':'Mother', data.mother_name),
    row(hi?'परिवार':'Family', data.family_details),
    row(hi?'भाई-बहन':'Siblings', data.siblings),
    has(data.address) || has(data.contact_details)
      ? section(hi?'संपर्क':'Contact') : '',
    row(hi?'पता':'Address', data.address),
    row(hi?'संपर्क':'Contact', data.contact_details),
    has(data.hobbies) || has(data.expectations)
      ? section(hi?'रुचियां व अपेक्षाएं':'Interests & Expectations') : '',
    row(hi?'शौक':'Hobbies', data.hobbies),
    row(hi?'अपेक्षाएं':'Expectations', data.expectations),
  ].filter(Boolean).join('\n');

  return `<!DOCTYPE html><html lang="hi"><head><meta charset="UTF-8"><style>${elegantCss(fontDataUri, theme)}</style></head><body>
<div class="page-border"></div><div class="corner corner-tl"></div><div class="corner corner-tr"></div><div class="corner corner-bl"></div><div class="corner corner-br"></div>
<div class="header-elegant"><div class="title">${hi?'विवाह बायोडाटा':'Marriage Biodata'}</div><div class="sub">${hi?'शुभ विवाह हेतु':'For an Auspicious Alliance'}</div></div>
${photoImg(data.photo_uri)}
<div class="name-title">${data.full_name || ''}</div>
${content}
<div class="footer-line">Awedan Sahayak</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════
// MODERN MATRIMONIAL
// ═══════════════════════════════════════════════════════════════════════

function modernCss(fontDataUri: string, theme: BiodataColorTheme): string {
  const t = BIODATA_THEME_COLORS[theme] || BIODATA_THEME_COLORS.blue;
  return baseCss(fontDataUri, theme) + `
body{background:#fafafa;padding:0;}
.page-card{width:595px;height:842px;padding:24px 30px 18px 30px;background:#fff;}
.top-bar{height:6px;background:${t.primary};margin-bottom:20px;border-radius:0 0 3px 3px;}
.header-mod{display:flex;align-items:flex-start;gap:16px;margin-bottom:18px;}
.photo-mod{border-radius:8px;overflow:hidden;border:2px solid ${t.primary};}
.photo-mod img{width:80px;height:100px;object-fit:cover;display:block;}
.name-mod{font-size:22px;font-weight:700;color:${t.primary};margin-bottom:2px;}
.tag-mod{font-size:11px;color:#888;margin-bottom:6px;}
.sec-title{background:${t.accent};padding:4px 10px;border-radius:3px;font-size:11px;margin-top:8px;border-bottom:none;}
.dcol{background:#fafafa;padding:4px 8px;border-radius:4px;margin:1px;border-bottom:none;}
.dlbl{font-size:10px;min-width:80px;}`;
}

export function buildModernTemplate(data: BiodataData, fontDataUri: string, lang: string): string {
  const hi = lang === 'hi';
  const theme = data.color_theme ?? 'blue';
  const content = [
    has(data.dob) || has(data.age) || has(data.height) || has(data.gender) || has(data.religion)
      ? section(hi?'व्यक्तिगत जानकारी':'Personal Details') : '',
    row2(hi?'जन्म तिथि':'DOB', data.dob, hi?'आयु':'Age', data.age),
    row2(hi?'ऊंचाई':'Height', data.height, hi?'लिंग':'Gender', data.gender),
    row2(hi?'धर्म':'Religion', data.religion, hi?'जाति':'Caste', data.caste ? `${data.caste}${data.gotra ? ` (${data.gotra})` : ''}` : undefined),
    has(data.education) || has(data.occupation) || has(data.income)
      ? section(hi?'शिक्षा व करियर':'Education & Career') : '',
    row(hi?'शिक्षा':'Education', data.education),
    row2(hi?'व्यवसाय':'Occupation', data.occupation, hi?'आय':'Income', data.income),
    has(data.father_name) || has(data.mother_name)
      ? section(hi?'परिवार':'Family') : '',
    row2(hi?'पिता':'Father', data.father_name, hi?'माता':'Mother', data.mother_name),
    row(hi?'परिवार':'Family', data.family_details),
    has(data.address) || has(data.contact_details)
      ? section(hi?'संपर्क':'Contact') : '',
    row(hi?'पता':'Address', data.address),
    row(hi?'संपर्क':'Contact', data.contact_details),
    has(data.hobbies) || has(data.expectations)
      ? section(hi?'अन्य':'Other') : '',
    row(hi?'शौक':'Hobbies', data.hobbies),
    row(hi?'अपेक्षाएं':'Expectations', data.expectations),
  ].filter(Boolean).join('\n');

  return `<!DOCTYPE html><html lang="hi"><head><meta charset="UTF-8"><style>${modernCss(fontDataUri, theme)}</style></head><body>
<div class="page-card"><div class="top-bar"></div>
<div class="header-mod">${data.photo_uri ? `<div class="photo-mod"><img src="${data.photo_uri}" /></div>` : ''}<div><div class="name-mod">${data.full_name || ''}</div><div class="tag-mod">${[data.age ? `${data.age} वर्ष` : '', data.height, data.occupation].filter(Boolean).join(' • ')}</div></div></div>
${content}
<div class="footer-line">Awedan Sahayak</div>
</div></body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════
// TRADITIONAL MATRIMONIAL
// ═══════════════════════════════════════════════════════════════════════

function traditionalCss(fontDataUri: string, theme: BiodataColorTheme): string {
  const t = BIODATA_THEME_COLORS[theme] || BIODATA_THEME_COLORS.gold;
  return baseCss(fontDataUri, theme) + `
body{background:#FFFDF7;}
.page-border{border:3px double ${t.primary};top:8px;left:8px;right:8px;bottom:8px;opacity:0.8;border-radius:2px;}
.header-trad{text-align:center;margin-bottom:14px;padding:10px 0;border-bottom:1px solid ${t.accent};border-top:1px solid ${t.accent};}
.header-trad .om{font-size:22px;color:${t.primary};font-weight:700;}
.header-trad .title{font-size:20px;font-weight:700;color:${t.primary};margin:4px 0;}
.header-trad .sub{font-size:11px;color:#888;}
.name-title{font-size:18px;text-align:center;margin-top:6px;}
.dlbl{color:${t.primary};font-weight:600;min-width:105px;}
.photo-frame{border:3px double ${t.primary};border-radius:4px;width:78px;height:98px;top:100px;right:32px;}`;
}

export function buildTraditionalTemplate(data: BiodataData, fontDataUri: string, lang: string): string {
  const hi = lang === 'hi';
  const theme = data.color_theme ?? 'gold';
  const content = [
    has(data.dob) || has(data.age) || has(data.height) || has(data.religion) || has(data.caste)
      ? section(hi?'व्यक्तिगत जानकारी':'Personal Details') : '',
    row2(hi?'जन्म तिथि':'DOB', data.dob, hi?'आयु':'Age', data.age),
    row(hi?'ऊंचाई':'Height', data.height),
    row2(hi?'धर्म':'Religion', data.religion, hi?'जाति':'Caste', data.caste ? `${data.caste}${data.gotra ? ` (${data.gotra})` : ''}` : undefined),
    has(data.education) || has(data.occupation)
      ? section(hi?'शिक्षा एवं व्यवसाय':'Education & Occupation') : '',
    row(hi?'शिक्षा':'Education', data.education),
    row(hi?'व्यवसाय':'Occupation', data.occupation),
    row(hi?'वार्षिक आय':'Annual Income', data.income),
    has(data.father_name) || has(data.mother_name)
      ? section(hi?'पारिवारिक विवरण':'Family Details') : '',
    row2(hi?'पिता':'Father', data.father_name, hi?'माता':'Mother', data.mother_name),
    row(hi?'परिवार':'Family', data.family_details),
    row(hi?'भाई-बहन':'Siblings', data.siblings),
    has(data.address) || has(data.contact_details)
      ? section(hi?'संपर्क सूत्र':'Contact') : '',
    row(hi?'पता':'Address', data.address),
    row(hi?'संपर्क':'Contact', data.contact_details),
    has(data.hobbies) || has(data.horoscope_details) || has(data.expectations)
      ? section(hi?'अन्य जानकारी':'Additional Information') : '',
    row(hi?'शौक':'Hobbies', data.hobbies),
    row(hi?'कुंडली':'Horoscope', data.horoscope_details),
    row(hi?'अपेक्षाएं':'Expectations', data.expectations),
  ].filter(Boolean).join('\n');

  return `<!DOCTYPE html><html lang="hi"><head><meta charset="UTF-8"><style>${traditionalCss(fontDataUri, theme)}</style></head><body>
<div class="page-border"></div>
<div class="header-trad"><div class="om">॥ ॐ ॥</div><div class="title">${hi?'विवाह बायोडाटा':'Marriage Biodata'}</div><div class="sub">${hi?'शुभ विवाह हेतु':'For an Auspicious Marriage'}</div></div>
${photoImg(data.photo_uri)}
<div class="name-title">${data.full_name || ''}</div>
${content}
<div class="footer-line">Awedan Sahayak</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════
// PROFESSIONAL / JOB RESUME
// ═══════════════════════════════════════════════════════════════════════

function profCss(fontDataUri: string, theme: BiodataColorTheme): string {
  const t = BIODATA_THEME_COLORS[theme] || BIODATA_THEME_COLORS.blue;
  return baseCss(fontDataUri, theme) + `
body{background:#fff;padding:24px 32px 18px 32px;}
.header-prof{display:flex;align-items:flex-start;gap:16px;margin-bottom:16px;
  padding-bottom:12px;border-bottom:2px solid ${t.primary};}
.name-prof{font-size:22px;font-weight:700;color:${t.primary};margin-bottom:2px;}
.tag-prof{font-size:12px;color:#666;margin-bottom:6px;}
.contact-line{font-size:10px;color:#888;}
.contact-line span{margin-right:14px;}
.sec-title{background:${t.primary};color:#fff;padding:3px 10px;font-size:11px;
  letter-spacing:0.5px;border-radius:2px;margin-top:10px;border-bottom:none;}
.dlbl{min-width:100px;font-size:10px;color:${t.primary};}`;
}

export function buildProfessionalTemplate(data: BiodataData, fontDataUri: string, lang: string): string {
  const hi = lang === 'hi';
  const theme = data.color_theme ?? 'blue';
  const contactParts = [data.contact_details, data.address].filter(has);
  const content = [
    has(data.education) || has(data.occupation)
      ? section(hi?'शिक्षा':'EDUCATION') : '',
    row(hi?'शिक्षा':'Education', data.education),
    has(data.occupation) || has(data.income)
      ? section(hi?'कार्य अनुभव':'WORK EXPERIENCE') : '',
    row(hi?'व्यवसाय':'Occupation', data.occupation),
    row(hi?'आय':'Annual Income', data.income),
    has(data.hobbies) || has(data.expectations)
      ? section(hi?'कौशल व रुचियां':'SKILLS & INTERESTS') : '',
    row(hi?'रुचियां':'Interests', data.hobbies),
    row(hi?'लक्ष्य':'Career Goals', data.expectations),
    has(data.dob) || has(data.age) || has(data.religion)
      ? section(hi?'व्यक्तिगत जानकारी':'PERSONAL DETAILS') : '',
    row2(hi?'जन्म तिथि':'Date of Birth', data.dob, hi?'आयु':'Age', data.age),
    row2(hi?'लिंग':'Gender', data.gender, hi?'धर्म':'Religion', data.religion),
    row2(hi?'पिता':'Father', data.father_name, hi?'माता':'Mother', data.mother_name),
    has(data.address) || has(data.contact_details)
      ? section(hi?'संपर्क':'CONTACT') : '',
    row(hi?'पता':'Address', data.address),
    row(hi?'संपर्क':'Phone/Email', data.contact_details),
  ].filter(Boolean).join('\n');

  return `<!DOCTYPE html><html lang="hi"><head><meta charset="UTF-8"><style>${profCss(fontDataUri, theme)}</style></head><body>
<div class="header-prof">${photoProf(data.photo_uri)}<div><div class="name-prof">${data.full_name || ''}</div><div class="tag-prof">${[data.occupation, data.age?`${data.age} वर्ष`:''].filter(Boolean).join(' • ')}</div>${contactParts.length?`<div class="contact-line">${contactParts.map(p=>`<span>${p}</span>`).join('')}</div>`:''}</div></div>
${content}
<div class="footer-line">Generated by Awedan Sahayak</div>
</body></html>`;
}

// ── Builder map ────────────────────────────────────────────────────────

export function getTemplateBuilder(key: BiodataTemplateKey): typeof buildClassicTemplate {
  const builders: Record<BiodataTemplateKey, typeof buildClassicTemplate> = {
    classic: buildClassicTemplate,
    elegant: buildElegantTemplate,
    modern: buildModernTemplate,
    traditional: buildTraditionalTemplate,
    professional: buildProfessionalTemplate,
  };
  return builders[key] ?? buildClassicTemplate;
}
