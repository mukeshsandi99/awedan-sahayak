/**
 * CGPA ↔ Percentage conversion formulas.
 * Each formula has a unique key, label (Hindi/English), and conversion function.
 */

export interface CgpaFormula {
  key: string;
  labelHindi: string;
  labelEnglish: string;
  note?: string;
  /** Convert CGPA → Percentage */
  cgpaToPercent: (cgpa: number) => number;
  /** Convert Percentage → CGPA */
  percentToCgpa: (percent: number) => number;
}

export const CGPA_FORMULAS: CgpaFormula[] = [
  {
    key: 'cbse_9_5',
    labelHindi: 'CBSE (CGPA × 9.5)',
    labelEnglish: 'CBSE Standard (× 9.5)',
    note: 'CBSE बोर्ड के लिए मानक सूत्र। अन्य बोर्ड के लिए अलग हो सकता है।',
    cgpaToPercent: (cgpa) => Math.round(cgpa * 9.5 * 100) / 100,
    percentToCgpa: (percent) => Math.round((percent / 9.5) * 100) / 100,
  },
  {
    key: 'multiply_10',
    labelHindi: 'CGPA × 10',
    labelEnglish: '× 10 (Generic)',
    note: 'कुछ विश्वविद्यालयों में उपयोग होता है।',
    cgpaToPercent: (cgpa) => Math.round(cgpa * 10 * 100) / 100,
    percentToCgpa: (percent) => Math.round((percent / 10) * 100) / 100,
  },
  {
    key: 'custom',
    labelHindi: 'कस्टम गुणक',
    labelEnglish: 'Custom Multiplier',
    note: 'अपने विश्वविद्यालय के अनुसार गुणक डालें।',
    cgpaToPercent: (cgpa, multiplier = 9.5) => Math.round(cgpa * multiplier * 100) / 100,
    percentToCgpa: (percent, multiplier = 9.5) => Math.round((percent / multiplier) * 100) / 100,
  },
];

/** Full disclaimer shown on every calculation. */
export const CGPA_DISCLAIMER =
  'अलग-अलग बोर्ड/विश्वविद्यालय की conversion formula अलग हो सकती है। आधिकारिक नियम देखें।';
