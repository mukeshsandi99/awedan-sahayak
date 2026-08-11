/**
 * Court petition type definitions.
 * Each type has key, Hindi/English names, category, and required fields.
 */

export interface CourtPetitionTypeDef {
  key: string;
  nameHindi: string;
  nameEnglish: string;
  category: 'bail' | 'plaint' | 'petition' | 'application' | 'undertaking';
  description: string;
  /** Field keys required for this petition type. */
  requiredFields: string[];
  /** Fields specific to this petition type (beyond the common ones). */
  specificFields: string[];
}

/** Common fields shared by all court petitions. */
export const COMMON_COURT_FIELDS: { key: string; labelHindi: string; labelEnglish: string }[] = [
  { key: 'court_name', labelHindi: 'न्यायालय का नाम', labelEnglish: 'Court Name' },
  { key: 'district', labelHindi: 'जिला', labelEnglish: 'District' },
  { key: 'case_type', labelHindi: 'केस प्रकार', labelEnglish: 'Case Type' },
  { key: 'case_number', labelHindi: 'केस नंबर', labelEnglish: 'Case Number' },
  { key: 'year', labelHindi: 'वर्ष', labelEnglish: 'Year' },
  { key: 'petitioner_name', labelHindi: 'आवेदक/याचिकाकर्ता का नाम', labelEnglish: 'Petitioner Name' },
  { key: 'respondent_name', labelHindi: 'विपक्षी/प्रतिवादी का नाम', labelEnglish: 'Respondent Name' },
  { key: 'advocate_name', labelHindi: 'अधिवक्ता का नाम (वैकल्पिक)', labelEnglish: 'Advocate Name (Optional)' },
  { key: 'police_station', labelHindi: 'थाना', labelEnglish: 'Police Station' },
  { key: 'fir_number', labelHindi: 'FIR/केस नंबर', labelEnglish: 'FIR/Case Number' },
  { key: 'sections_of_law', labelHindi: 'कानून की धाराएं', labelEnglish: 'Sections of Law' },
  { key: 'date_of_occurrence', labelHindi: 'घटना की तिथि', labelEnglish: 'Date of Occurrence' },
  { key: 'facts_of_case', labelHindi: 'मामले के तथ्य', labelEnglish: 'Facts of the Case' },
  { key: 'grounds', labelHindi: 'आधार', labelEnglish: 'Grounds' },
  { key: 'prayer', labelHindi: 'प्रार्थना', labelEnglish: 'Prayer' },
  { key: 'verification_text', labelHindi: 'सत्यापन', labelEnglish: 'Verification' },
  { key: 'place', labelHindi: 'स्थान', labelEnglish: 'Place' },
  { key: 'date', labelHindi: 'दिनांक', labelEnglish: 'Date' },
];

/** Plaint-specific additional fields. */
export const PLAINT_FIELDS: { key: string; labelHindi: string; labelEnglish: string }[] = [
  { key: 'cause_of_action', labelHindi: 'वाद हेतुक', labelEnglish: 'Cause of Action' },
  { key: 'jurisdiction', labelHindi: 'क्षेत्राधिकार', labelEnglish: 'Jurisdiction' },
  { key: 'valuation', labelHindi: 'मूल्यांकन', labelEnglish: 'Valuation' },
  { key: 'court_fee', labelHindi: 'कोर्ट फीस', labelEnglish: 'Court Fee' },
  { key: 'property_schedule', labelHindi: 'संपत्ति अनुसूची', labelEnglish: 'Property Schedule' },
  { key: 'relief_sought', labelHindi: 'अनुतोष', labelEnglish: 'Relief Sought' },
  { key: 'limitation_statement', labelHindi: 'परिसीमा कथन', labelEnglish: 'Limitation Statement' },
  { key: 'document_list', labelHindi: 'दस्तावेज़ सूची', labelEnglish: 'List of Documents' },
];

/** Bail-specific additional fields. */
export const BAIL_FIELDS: { key: string; labelHindi: string; labelEnglish: string }[] = [
  { key: 'custody_date', labelHindi: 'हिरासत/गिरफ्तारी की तिथि', labelEnglish: 'Custody/Arrest Date' },
  { key: 'criminal_history', labelHindi: 'आपराधिक इतिहास घोषणा', labelEnglish: 'Criminal History Declaration' },
  { key: 'cooperation_assurance', labelHindi: 'जांच में सहयोग का आश्वासन', labelEnglish: 'Cooperation Assurance' },
  { key: 'flight_risk_statement', labelHindi: 'फरार न होने का कथन', labelEnglish: 'Flight Risk Statement' },
  { key: 'evidence_tampering_assurance', labelHindi: 'साक्ष्य से छेड़छाड़ न करने का आश्वासन', labelEnglish: 'Evidence Tampering Assurance' },
  { key: 'medical_family_grounds', labelHindi: 'चिकित्सा/पारिवारिक आधार (वैकल्पिक)', labelEnglish: 'Medical/Family Grounds (Optional)' },
  { key: 'co_accused_parity', labelHindi: 'सह-अभियुक्त समता (वैकल्पिक)', labelEnglish: 'Co-Accused Parity (Optional)' },
];

export const COURT_PETITION_TYPES: CourtPetitionTypeDef[] = [
  // ── Bail ──
  {
    key: 'regular_bail', nameHindi: 'नियमित जमानत याचिका', nameEnglish: 'Regular Bail Petition',
    category: 'bail', description: 'गिरफ्तार अभियुक्त के लिए जमानत आवेदन।',
    requiredFields: ['court_name', 'district', 'case_number', 'petitioner_name', 'police_station', 'fir_number', 'sections_of_law', 'custody_date', 'facts_of_case', 'grounds', 'prayer'],
    specificFields: BAIL_FIELDS.map(f => f.key),
  },
  {
    key: 'anticipatory_bail', nameHindi: 'अग्रिम जमानत याचिका', nameEnglish: 'Anticipatory Bail Petition',
    category: 'bail', description: 'गिरफ्तारी से पहले अग्रिम जमानत का आवेदन।',
    requiredFields: ['court_name', 'district', 'petitioner_name', 'police_station', 'fir_number', 'sections_of_law', 'facts_of_case', 'grounds', 'prayer'],
    specificFields: BAIL_FIELDS.map(f => f.key).filter(k => k !== 'custody_date'),
  },
  {
    key: 'interim_bail', nameHindi: 'अंतरिम जमानत याचिका', nameEnglish: 'Interim Bail Petition',
    category: 'bail', description: 'स्थायी जमानत आवेदन के लंबित रहने तक अंतरिम जमानत हेतु आवेदन।',
    requiredFields: ['court_name', 'district', 'petitioner_name', 'police_station', 'fir_number', 'sections_of_law', 'facts_of_case', 'grounds', 'prayer'],
    specificFields: ['custody_date', 'medical_family_grounds', 'cooperation_assurance', 'flight_risk_statement'],
  },
  // ── Petitions ──
  {
    key: 'rejoinder', nameHindi: 'प्रत्युत्तर/रिजॉइंडर याचिका', nameEnglish: 'Rejoinder Petition',
    category: 'petition', description: 'विपक्षी के जवाब का उत्तर देने हेतु याचिका।',
    requiredFields: ['court_name', 'case_number', 'petitioner_name', 'respondent_name', 'facts_of_case', 'grounds', 'prayer'],
    specificFields: [],
  },
  {
    key: 'surrender', nameHindi: 'सरेंडर/आत्मसमर्पण याचिका', nameEnglish: 'Surrender Petition',
    category: 'petition', description: 'अदालत में आत्मसमर्पण करने हेतु आवेदन।',
    requiredFields: ['court_name', 'district', 'petitioner_name', 'police_station', 'fir_number', 'sections_of_law', 'facts_of_case', 'prayer'],
    specificFields: ['cooperation_assurance', 'flight_risk_statement'],
  },
  {
    key: 'complaint_petition', nameHindi: 'परिवाद/शिकायत याचिका', nameEnglish: 'Complaint Petition',
    category: 'petition', description: 'आपराधिक/सिविल शिकायत हेतु परिवाद।',
    requiredFields: ['court_name', 'district', 'petitioner_name', 'respondent_name', 'facts_of_case', 'grounds', 'prayer', 'sections_of_law'],
    specificFields: [],
  },
  {
    key: 'temp_injunction', nameHindi: 'अस्थायी निषेधाज्ञा याचिका', nameEnglish: 'Temporary Injunction Petition',
    category: 'petition', description: 'अस्थायी रोक/निषेधाज्ञा के लिए आवेदन।',
    requiredFields: ['court_name', 'petitioner_name', 'respondent_name', 'facts_of_case', 'grounds', 'prayer'],
    specificFields: ['cause_of_action', 'relief_sought'],
  },
  {
    key: 'permanent_injunction', nameHindi: 'स्थायी निषेधाज्ञा याचिका', nameEnglish: 'Permanent Injunction Petition',
    category: 'petition', description: 'स्थायी निषेधाज्ञा/रोक के लिए वाद।',
    requiredFields: ['court_name', 'petitioner_name', 'respondent_name', 'facts_of_case', 'grounds', 'prayer', 'cause_of_action'],
    specificFields: PLAINT_FIELDS.map(f => f.key),
  },
  {
    key: 'framing_of_issues', nameHindi: 'वाद बिंदु निर्धारण आवेदन', nameEnglish: 'Framing of Issues Application',
    category: 'application', description: 'वाद बिंदुओं (issues) के निर्धारण हेतु आवेदन।',
    requiredFields: ['court_name', 'case_number', 'petitioner_name', 'respondent_name', 'facts_of_case', 'grounds'],
    specificFields: [],
  },
  // ── Plaints ──
  {
    key: 'money_recovery', nameHindi: 'धन वसूली वाद', nameEnglish: 'Money Recovery Plaint',
    category: 'plaint', description: 'धन राशि की वसूली के लिए सिविल वाद।',
    requiredFields: ['court_name', 'petitioner_name', 'respondent_name', 'facts_of_case', 'cause_of_action', 'valuation', 'court_fee', 'prayer', 'relief_sought'],
    specificFields: [...PLAINT_FIELDS.map(f => f.key), 'date_of_occurrence'],
  },
  {
    key: 'declaration_suit', nameHindi: 'घोषणा वाद', nameEnglish: 'Declaration Suit',
    category: 'plaint', description: 'अधिकार/स्वामित्व की घोषणा हेतु वाद।',
    requiredFields: ['court_name', 'petitioner_name', 'respondent_name', 'facts_of_case', 'cause_of_action', 'valuation', 'prayer', 'relief_sought', 'property_schedule'],
    specificFields: PLAINT_FIELDS.map(f => f.key),
  },
  {
    key: 'partition_suit', nameHindi: 'बंटवारा वाद', nameEnglish: 'Partition Suit',
    category: 'plaint', description: 'संपत्ति के बंटवारे हेतु वाद।',
    requiredFields: ['court_name', 'petitioner_name', 'respondent_name', 'facts_of_case', 'cause_of_action', 'valuation', 'court_fee', 'property_schedule', 'prayer'],
    specificFields: PLAINT_FIELDS.map(f => f.key),
  },
  {
    key: 'title_suit', nameHindi: 'स्वत्व वाद', nameEnglish: 'Title Suit',
    category: 'plaint', description: 'संपत्ति के स्वामित्व अधिकार के लिए वाद।',
    requiredFields: ['court_name', 'petitioner_name', 'respondent_name', 'facts_of_case', 'cause_of_action', 'valuation', 'property_schedule', 'prayer', 'relief_sought'],
    specificFields: PLAINT_FIELDS.map(f => f.key),
  },
  {
    key: 'possession_suit', nameHindi: 'कब्जा वाद', nameEnglish: 'Possession Suit',
    category: 'plaint', description: 'संपत्ति पर कब्जा प्राप्त करने हेतु वाद।',
    requiredFields: ['court_name', 'petitioner_name', 'respondent_name', 'facts_of_case', 'cause_of_action', 'valuation', 'property_schedule', 'prayer', 'relief_sought'],
    specificFields: PLAINT_FIELDS.map(f => f.key),
  },
  {
    key: 'specific_performance', nameHindi: 'विनिर्दिष्ट पालन वाद', nameEnglish: 'Specific Performance Suit',
    category: 'plaint', description: 'अनुबंध के विशिष्ट पालन के लिए वाद।',
    requiredFields: ['court_name', 'petitioner_name', 'respondent_name', 'facts_of_case', 'cause_of_action', 'valuation', 'court_fee', 'prayer', 'relief_sought'],
    specificFields: PLAINT_FIELDS.map(f => f.key),
  },
  {
    key: 'permanent_injunction_plaint', nameHindi: 'स्थायी निषेधाज्ञा वाद', nameEnglish: 'Permanent Injunction Plaint',
    category: 'plaint', description: 'स्थायी रोक/निषेधाज्ञा के लिए सिविल वाद।',
    requiredFields: ['court_name', 'petitioner_name', 'respondent_name', 'facts_of_case', 'cause_of_action', 'valuation', 'prayer', 'relief_sought'],
    specificFields: PLAINT_FIELDS.map(f => f.key),
  },
  {
    key: 'mandatory_injunction', nameHindi: 'अनिवार्य निषेधाज्ञा वाद', nameEnglish: 'Mandatory Injunction Plaint',
    category: 'plaint', description: 'कोई कार्य करने का आदेश देने हेतु वाद।',
    requiredFields: ['court_name', 'petitioner_name', 'respondent_name', 'facts_of_case', 'cause_of_action', 'valuation', 'prayer', 'relief_sought'],
    specificFields: PLAINT_FIELDS.map(f => f.key),
  },
  {
    key: 'cancellation_of_deed', nameHindi: 'दस्तावेज़/विलेख निरस्तीकरण वाद', nameEnglish: 'Cancellation of Deed/Document Suit',
    category: 'plaint', description: 'किसी दस्तावेज़/विलेख को निरस्त करने हेतु वाद।',
    requiredFields: ['court_name', 'petitioner_name', 'respondent_name', 'facts_of_case', 'cause_of_action', 'valuation', 'court_fee', 'property_schedule', 'prayer', 'relief_sought'],
    specificFields: PLAINT_FIELDS.map(f => f.key),
  },
  // ── Undertaking ──
  {
    key: 'undertaking', nameHindi: 'शपथ पत्र/अंडरटेकिंग', nameEnglish: 'Undertaking',
    category: 'undertaking', description: 'न्यायालय में प्रस्तुत करने हेतु शपथ पत्र/वचनबद्धता।',
    requiredFields: ['court_name', 'case_number', 'petitioner_name', 'verification_text', 'place', 'date'],
    specificFields: [],
  },
];

/** Legal disclaimer for all court petitions. */
export const COURT_DISCLAIMER =
  'यह प्रारूप केवल प्रारंभिक मसौदा तैयार करने में सहायता के लिए है। दाखिल करने से पहले स्थानीय अधिवक्ता से कानून, धारा, क्षेत्राधिकार, कोर्ट-फीस और प्रक्रिया की जांच अवश्य कराएँ।\n\n' +
  'This draft is for preliminary assistance only. Before filing, get the law, sections, jurisdiction, court-fee, and procedure verified by a local advocate.';
