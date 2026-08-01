/**
 * Enterprise Template Categories
 *
 * Maps the 14 office types to 40+ logical categories and provides
 * category metadata for UI display and search filtering.
 *
 * No existing template is removed or renamed — categories are ADDITIVE.
 */

export interface TemplateCategory {
  id: string;
  nameHindi: string;
  nameEnglish: string;
  icon: string;
  officeTypes: string[];
}

export const CATEGORIES: TemplateCategory[] = [
  { id: 'police', nameHindi: 'पुलिस / थाना', nameEnglish: 'Police / Thana', icon: 'shield-checkmark', officeTypes: ['thana', 'sp'] },
  { id: 'court', nameHindi: 'न्यायालय', nameEnglish: 'Court', icon: 'scale', officeTypes: ['court'] },
  { id: 'block', nameHindi: 'प्रखंड / तहसील', nameEnglish: 'Block / Tehsil', icon: 'business', officeTypes: ['block'] },
  { id: 'co', nameHindi: 'अंचल / सर्किल', nameEnglish: 'CO / Circle', icon: 'document-text', officeTypes: ['co'] },
  { id: 'sdo', nameHindi: 'अनुविभागीय', nameEnglish: 'SDO Office', icon: 'hammer', officeTypes: ['sdo'] },
  { id: 'dc', nameHindi: 'जिला प्रशासन', nameEnglish: 'DC / District', icon: 'ribbon', officeTypes: ['dc'] },
  { id: 'bdo', nameHindi: 'विकास / पंचायत', nameEnglish: 'BDO / Panchayat', icon: 'clipboard', officeTypes: ['bdo'] },
  { id: 'revenue', nameHindi: 'राजस्व / भूमि', nameEnglish: 'Revenue / Land', icon: 'map', officeTypes: ['co', 'sdo', 'dc'] },
  { id: 'certificate', nameHindi: 'प्रमाण पत्र', nameEnglish: 'Certificates', icon: 'ribbon', officeTypes: ['block', 'sdo'] },
  { id: 'bank', nameHindi: 'बैंक / वित्तीय', nameEnglish: 'Bank / Financial', icon: 'card', officeTypes: ['bank'] },
  { id: 'education_college', nameHindi: 'महाविद्यालय', nameEnglish: 'College', icon: 'school', officeTypes: ['college'] },
  { id: 'education_school', nameHindi: 'विद्यालय', nameEnglish: 'School', icon: 'school', officeTypes: ['school'] },
  { id: 'pension', nameHindi: 'पेंशन / सामाजिक सुरक्षा', nameEnglish: 'Pension / Social Security', icon: 'heart', officeTypes: ['bdo', 'block'] },
  { id: 'ration', nameHindi: 'राशन / खाद्य', nameEnglish: 'Ration / Food', icon: 'cart', officeTypes: ['block'] },
  { id: 'electricity', nameHindi: 'बिजली / ऊर्जा', nameEnglish: 'Electricity / Energy', icon: 'flash', officeTypes: ['pwd'] },
  { id: 'water', nameHindi: 'जल / पेयजल', nameEnglish: 'Water / Drinking Water', icon: 'water', officeTypes: ['pwd', 'rcd'] },
  { id: 'construction', nameHindi: 'निर्माण / अवसंरचना', nameEnglish: 'Construction / Infrastructure', icon: 'construct', officeTypes: ['pwd', 'rcd', 'bcd'] },
  { id: 'rural', nameHindi: 'ग्रामीण विकास', nameEnglish: 'Rural Development', icon: 'leaf', officeTypes: ['rcd', 'bdo'] },
  { id: 'health', nameHindi: 'स्वास्थ्य', nameEnglish: 'Health', icon: 'medkit', officeTypes: [] },
  { id: 'labour', nameHindi: 'श्रम / रोजगार', nameEnglish: 'Labour / Employment', icon: 'briefcase', officeTypes: ['bdo'] },
  { id: 'women', nameHindi: 'महिला सुरक्षा', nameEnglish: 'Women Protection', icon: 'female', officeTypes: ['thana'] },
  { id: 'senior', nameHindi: 'वरिष्ठ नागरिक', nameEnglish: 'Senior Citizen', icon: 'people', officeTypes: ['bdo'] },
  { id: 'rti', nameHindi: 'RTI / सूचना अधिकार', nameEnglish: 'Right to Information', icon: 'information-circle', officeTypes: ['dc'] },
  { id: 'consumer', nameHindi: 'उपभोक्ता शिकायत', nameEnglish: 'Consumer Complaint', icon: 'chatbox', officeTypes: [] },
  { id: 'transport', nameHindi: 'परिवहन / RTO', nameEnglish: 'Transport / RTO', icon: 'car', officeTypes: ['transport'] },
  { id: 'passport', nameHindi: 'पासपोर्ट', nameEnglish: 'Passport', icon: 'globe', officeTypes: [] },
  { id: 'election', nameHindi: 'चुनाव / मतदाता', nameEnglish: 'Election / Voter', icon: 'checkbox', officeTypes: ['block'] },
  { id: 'agriculture', nameHindi: 'कृषि', nameEnglish: 'Agriculture', icon: 'flower', officeTypes: ['co'] },
  { id: 'forest', nameHindi: 'वन / पर्यावरण', nameEnglish: 'Forest / Environment', icon: 'tree', officeTypes: [] },
  { id: 'animal', nameHindi: 'पशुपालन', nameEnglish: 'Animal Husbandry', icon: 'paw', officeTypes: [] },
  { id: 'employment', nameHindi: 'रोजगार / नौकरी', nameEnglish: 'Employment / Job', icon: 'briefcase', officeTypes: ['bdo'] },
  { id: 'welfare', nameHindi: 'समाज कल्याण', nameEnglish: 'Social Welfare', icon: 'heart-circle', officeTypes: ['bdo', 'block'] },
  { id: 'insurance', nameHindi: 'बीमा', nameEnglish: 'Insurance', icon: 'umbrella', officeTypes: ['bank'] },
  { id: 'municipality', nameHindi: 'नगरपालिका', nameEnglish: 'Municipality', icon: 'business', officeTypes: [] },
  { id: 'other', nameHindi: 'अन्य / सामान्य', nameEnglish: 'Other / General', icon: 'apps', officeTypes: ['thana', 'block', 'bdo', 'co', 'sdo', 'sp', 'dc', 'court', 'bank', 'college', 'school', 'pwd', 'rcd', 'bcd'] },
];

/** Maps office_type → category IDs (for auto-assignment). */
const OFFICE_CATEGORY_MAP: Record<string, string[]> = {};
for (const cat of CATEGORIES) {
  for (const ot of cat.officeTypes) {
    if (!OFFICE_CATEGORY_MAP[ot]) OFFICE_CATEGORY_MAP[ot] = [];
    OFFICE_CATEGORY_MAP[ot].push(cat.id);
  }
}

/** Get the primary category ID for an office type. */
export function getPrimaryCategory(officeType: string): string {
  const cats = OFFICE_CATEGORY_MAP[officeType];
  return cats?.[0] ?? 'other';
}

/** Get all category IDs for an office type. */
export function getCategoriesForOffice(officeType: string): string[] {
  return OFFICE_CATEGORY_MAP[officeType] ?? ['other'];
}

/** Get a category by ID. */
export function getCategoryById(id: string): TemplateCategory | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
