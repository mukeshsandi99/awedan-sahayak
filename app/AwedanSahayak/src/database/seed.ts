import { OfficeInsert, ApplicationTypeInsert } from '../types/database';

// ── Office seeds (14 office types — generic category cards) ──────────
//
// These are CATEGORY entries shown on the Home screen — not specific
// office listings. The user's own village/thana/district (collected as
// base identity fields) populate the generated application header.
// Actual location-specific offices with real addresses belong in the
// Office Directory (कार्यालय tab), which can have multiple entries per
// category (e.g. multiple bank branches, multiple schools in a district).

export const OFFICE_SEEDS: OfficeInsert[] = [
  {
    type: 'thana',
    name_hindi: 'थाना',
    name_english: 'Police Station',
    district: null,
    block: null,
    full_address: null,
    phone_number: null,
    latitude: null,
    longitude: null,
    working_hours: null,
    landmark: null,
    is_verified: 0,
  },
  {
    type: 'block',
    name_hindi: 'प्रखंड कार्यालय',
    name_english: 'Block Office',
    district: null,
    block: null,
    full_address: null,
    phone_number: null,
    latitude: null,
    longitude: null,
    working_hours: null,
    landmark: null,
    is_verified: 0,
  },
  {
    type: 'bdo',
    name_hindi: 'BDO कार्यालय',
    name_english: 'BDO Office (Block Development Officer)',
    district: null,
    block: null,
    full_address: null,
    phone_number: null,
    latitude: null,
    longitude: null,
    working_hours: null,
    landmark: null,
    is_verified: 0,
  },
  {
    type: 'co',
    name_hindi: 'अंचल कार्यालय',
    name_english: 'CO Office (Circle Officer)',
    district: null,
    block: null,
    full_address: null,
    phone_number: null,
    latitude: null,
    longitude: null,
    working_hours: null,
    landmark: null,
    is_verified: 0,
  },
  {
    type: 'sdo',
    name_hindi: 'SDO कार्यालय',
    name_english: 'SDO Office (Sub-Divisional Officer)',
    district: null,
    block: null,
    full_address: null,
    phone_number: null,
    latitude: null,
    longitude: null,
    working_hours: null,
    landmark: null,
    is_verified: 0,
  },
  {
    type: 'sp',
    name_hindi: 'SP कार्यालय',
    name_english: 'SP Office (Superintendent of Police)',
    district: null,
    block: null,
    full_address: null,
    phone_number: null,
    latitude: null,
    longitude: null,
    working_hours: null,
    landmark: null,
    is_verified: 0,
  },
  {
    type: 'dc',
    name_hindi: 'DC कार्यालय (समाहरणालय)',
    name_english: 'DC Office (District Collector)',
    district: null,
    block: null,
    full_address: null,
    phone_number: null,
    latitude: null,
    longitude: null,
    working_hours: null,
    landmark: null,
    is_verified: 0,
  },
  {
    type: 'court',
    name_hindi: 'व्यवहार न्यायालय',
    name_english: 'Civil Court',
    district: null,
    block: null,
    full_address: null,
    phone_number: null,
    latitude: null,
    longitude: null,
    working_hours: null,
    landmark: null,
    is_verified: 0,
  },
  {
    type: 'bank',
    name_hindi: 'बैंक शाखा',
    name_english: 'Bank Branch',
    district: null,
    block: null,
    full_address: null,
    phone_number: null,
    latitude: null,
    longitude: null,
    working_hours: null,
    landmark: null,
    is_verified: 0,
  },
  {
    type: 'college',
    name_hindi: 'महाविद्यालय',
    name_english: 'College',
    district: null,
    block: null,
    full_address: null,
    phone_number: null,
    latitude: null,
    longitude: null,
    working_hours: null,
    landmark: null,
    is_verified: 0,
  },
  {
    type: 'school',
    name_hindi: 'विद्यालय',
    name_english: 'School',
    district: null,
    block: null,
    full_address: null,
    phone_number: null,
    latitude: null,
    longitude: null,
    working_hours: null,
    landmark: null,
    is_verified: 0,
  },
  {
    type: 'pwd',
    name_hindi: 'लोक निर्माण विभाग (PWD)',
    name_english: 'Public Works Department (PWD)',
    district: null,
    block: null,
    full_address: null,
    phone_number: null,
    latitude: null,
    longitude: null,
    working_hours: null,
    landmark: null,
    is_verified: 0,
  },
  {
    type: 'rcd',
    name_hindi: 'ग्रामीण कार्य विभाग (RCD)',
    name_english: 'Rural Construction Department (RCD)',
    district: null,
    block: null,
    full_address: null,
    phone_number: null,
    latitude: null,
    longitude: null,
    working_hours: null,
    landmark: null,
    is_verified: 0,
  },
  {
    type: 'bcd',
    name_hindi: 'भवन निर्माण विभाग (BCD)',
    name_english: 'Building Construction Department (BCD)',
    district: null,
    block: null,
    full_address: null,
    phone_number: null,
    latitude: null,
    longitude: null,
    working_hours: null,
    landmark: null,
    is_verified: 0,
  },
];

// ── Base identity fields ────────────────────────────────────────────

/**
 * Every application type MUST include these standard applicant identity
 * fields so the generated header (सेवा में), salutation (सविनय निवेदन),
 * and footer (हस्ताक्षर) are populated with real data rather than dots
 * or unreplaced {{placeholders}}.
 *
 * These are prepended before the type-specific incident fields.
 */
const BASE_IDENTITY_FIELDS = [
  'applicant_name',
  'parent_spouse_name',
  'village',
  'post',
  'thana',
  'district',
  'state',
  'mobile',
  'gender',
] as const;

/** Field names that count as an "applicant name" variant already present. */
const APPLICANT_NAME_VARIANTS = new Set([
  'applicant_name', 'deponent_name', 'petitioner_name',
  'missing_person_name', 'child_name',
]);

/** Field names that count as a "parent name" variant already present. */
const PARENT_NAME_VARIANTS = new Set([
  'parent_spouse_name', 'father_name', 'father_husband_name',
  'deponent_father_name',
]);

/**
 * Prepends base identity fields to the given fields array, skipping any
 * that are already present (or that have a recognised variant already).
 * Returns the combined array as a JSON string suitable for required_fields.
 */
function withBase(fields: string[]): string {
  const existing = new Set(fields);

  // Build the list of base fields to prepend, respecting existing variants
  const toAdd: string[] = [];
  for (const f of BASE_IDENTITY_FIELDS) {
    // Don't add applicant_name if a variant is already present
    if (f === 'applicant_name' && fields.some((x) => APPLICANT_NAME_VARIANTS.has(x))) {
      continue;
    }
    // Don't add parent_spouse_name if a variant is already present
    if (f === 'parent_spouse_name' && fields.some((x) => PARENT_NAME_VARIANTS.has(x))) {
      continue;
    }
    if (!existing.has(f)) {
      toAdd.push(f);
    }
  }

  return JSON.stringify([...toAdd, ...fields]);
}

// ── Prompt template builder ─────────────────────────────────────────

// ── Prompt template builder ─────────────────────────────────────────

/**
 * Builds a standardized prompt template that works with the Claude
 * system prompt (server/src/services/claudeService.ts). The system
 * prompt controls all structural formatting (7-part layout, gender
 * grammar, narrative rules). This template provides the type-specific
 * context and the form data fields.
 */
function p(
  officeType: string,
  appNameHindi: string,
  scenarioContext: string,
): string {
  return `आवेदन प्रकार: ${appNameHindi} (${officeType} कार्यालय)
नीचे दिए गए फॉर्म डेटा का उपयोग करके एक संपूर्ण औपचारिक आवेदन पत्र तैयार करें।

महत्वपूर्ण निर्देश:
${scenarioContext}

सिस्टम प्रॉम्प्ट में वर्णित 7-भाग संरचना (सेवा में, विषय, सविनय निवेदन, घटना विवरण, अतः निवेदन, आभार, हस्ताक्षर) का सख्ती से पालन करें।
घटना विवरण भाग में सभी तथ्यों को एक प्रवाहमय कालानुक्रमिक नैरेटिव अनुच्छेद में प्रस्तुत करें — बुलेट पॉइंट या सूची का प्रयोग न करें।
प्रत्येक उल्लिखित व्यक्ति का पहली बार पूरा नाम, पिता/पति का नाम और गाँव अवश्य दें।
आवेदक के लिंग (gender फील्ड) के अनुसार सभी व्याकरणिक रूपों (निवासी/निवासिन, भवदीय/भवदीया, रहूँगा/रहूँगी) का सही प्रयोग करें।

आरोपी/विपक्षी की पहचान का प्रारूप (ACCUSED IDENTIFICATION FORMAT):
हर आरोपी/विपक्षी का उल्लेख इस सटीक प्रारूप में करें:
"[आरोपी का पूरा नाम], पिता/पति [आरोपी के पिता/पति का नाम], ग्राम [आरोपी का गाँव], थाना [आवेदक का थाना], जिला [आवेदक का जिला"
यदि आरोपी का गाँव अलग है तो वह गाँव लिखें, अन्यथा आवेदक के ही गाँव, थाना और जिला का प्रयोग करें।
यह पूर्ण पहचान प्रारूप केवल आरोपी/विपक्षी के लिए है — आवेदक की पहचान अलग से भाग 3 और भाग 7 में दी जाएगी।

फॉर्म डेटा:
{{formDataSummary}}`;
}

/** Shorter variant for non-complaint administrative forms. */
function pa(
  officeType: string,
  appNameHindi: string,
  scenarioContext: string,
): string {
  return `आवेदन प्रकार: ${appNameHindi} (${officeType} कार्यालय)
नीचे दिए गए फॉर्म डेटा का उपयोग करके एक संपूर्ण औपचारिक आवेदन पत्र तैयार करें।

महत्वपूर्ण निर्देश:
${scenarioContext}

सिस्टम प्रॉम्प्ट में वर्णित 7-भाग संरचना का पालन करें।
दस्तावेज़/प्रमाण पत्र से संबंधित आवेदनों में घटना विवरण के स्थान पर आवेदन का औचित्य एवं संलग्न दस्तावेज़ों का विवरण दें।
आवेदक के लिंग (gender) के अनुसार व्याकरणिक रूपों का सही प्रयोग करें।

फॉर्म डेटा:
{{formDataSummary}}`;
}

const G = 'gender'; // shorthand for the gender field

// ── Application type seeds (49 total) ───────────────────────────────

const COURT_DISCLAIMER = 'यह एक प्रारूप मात्र है। जटिल कानूनी मामलों के लिए कृपया वकील से सलाह लें।';

export const APPLICATION_TYPE_SEEDS: ApplicationTypeInsert[] = [

  // ═══════════════════════════════════════════════════════════════════
  // THANA — 16 types
  // ═══════════════════════════════════════════════════════════════════

  {
    office_type: 'thana',
    name_hindi: 'चोरी की शिकायत',
    name_english: 'Theft Complaint',
    keywords: JSON.stringify(['चोरी','theft','stolen','चुराया','चोर']),
    required_fields: withBase(['incident_date','incident_time','location','stolen_items','accused_name','accused_father_name','accused_village','witnesses',G]),
    prompt_template: p('thana', 'चोरी की शिकायत',
      'चोरी की घटना का कालानुक्रमिक वर्णन करें। चुराई गई वस्तुओं का पूरा विवरण और अनुमानित मूल्य बताएं। आरोपी/संदिग्ध की पूरी पहचान दें: नाम, पिता/पति का नाम, और गाँव — प्रारूप में "[नाम], पिता/पति [पिता/पति का नाम], ग्राम [गाँव], थाना [थाना], जिला [जिला]"। चोरी के तरीके का उल्लेख करें। गवाहों का विवरण दें। FIR दर्ज करने और चोरी की गई वस्तुओं की बरामदगी का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'thana',
    name_hindi: 'गुमशुदा व्यक्ति रिपोर्ट',
    name_english: 'Missing Person Report',
    keywords: JSON.stringify(['गुमशुदा','missing','गायब','लापता']),
    required_fields: withBase(['missing_person_name','age','gender','last_seen_date','last_seen_location','description','relation_to_missing','clothing_last_seen','mental_condition',G]),
    prompt_template: p('thana', 'गुमशुदा व्यक्ति रिपोर्ट',
      'गुमशुदा व्यक्ति का संपूर्ण शारीरिक विवरण (कद, रंग, बाल, कपड़े, विशेष पहचान चिह्न) दें। अंतिम बार कब, कहाँ और किसके साथ देखा गया इसका विस्तृत वर्णन करें। गुमशुदा व्यक्ति की मानसिक स्थिति, मोबाइल नंबर, और संभावित कारण बताएं। तत्काल तलाश एवं प्राथमिकी दर्ज करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'thana',
    name_hindi: 'गुमशुदा दस्तावेज़',
    name_english: 'Lost Document Report',
    keywords: JSON.stringify(['दस्तावेज़','document','lost','खोया','गुम','आधार','पैन','राशन']),
    required_fields: withBase(['document_type','document_number','lost_date','lost_location','issuing_authority','circumstances',G]),
    prompt_template: p('thana', 'गुमशुदा दस्तावेज़',
      'दस्तावेज़ कब, कहाँ और किन परिस्थितियों में खोया इसका विस्तृत विवरण दें। दस्तावेज़ का प्रकार, संख्या और जारीकर्ता प्राधिकरण स्पष्ट रूप से बताएं। दस्तावेज़ के खो जाने की सूचना दर्ज करने एवं आवश्यक प्रमाण पत्र/रसीद जारी करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'thana',
    name_hindi: 'मारपीट की शिकायत',
    name_english: 'Assault Complaint',
    keywords: JSON.stringify(['मारपीट','assault','हमला','चोट','मारा','पिटाई']),
    required_fields: withBase(['incident_date','incident_time','location','accused_names','accused_father_name','accused_village','injury_details','weapons_used','medical_report','witnesses',G]),
    prompt_template: p('thana', 'मारपीट की शिकायत',
      'घटना का कालानुक्रमिक वर्णन करें: आरोपी कब और कैसे आए, क्या कहा, और कैसे मारपीट शुरू हुई। प्रत्येक आरोपी की पूरी पहचान दें: पूरा नाम, पिता/पति का नाम (accused_father_name) और गाँव (accused_village) — प्रारूप में "[नाम], पिता/पति [पिता/पति का नाम], ग्राम [गाँव], थाना [थाना], जिला [जिला]"। किस हथियार (लाठी, डंडा, लोहे की रॉड आदि) से कहाँ-कहाँ चोट आई इसका सटीक विवरण दें। चिकित्सीय रिपोर्ट और गवाहों का उल्लेख करें। आरोपियों के विरुद्ध प्राथमिकी दर्ज कर विधिक कार्रवाई का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'thana',
    name_hindi: 'धमकी की शिकायत',
    name_english: 'Threat Complaint',
    keywords: JSON.stringify(['धमकी','threat','जान से मारने','डराना','धमकाना']),
    required_fields: withBase(['incident_date','threat_details','accused_name','accused_father_name','accused_village','evidence','witnesses','prior_incidents',G]),
    prompt_template: p('thana', 'धमकी की शिकायत',
      'धमकी की घटना का पूरा विवरण दें: आरोपी ने कब, कहाँ और किन शब्दों में धमकी दी। आरोपी का पूरा नाम (accused_name), पिता/पति का नाम (accused_father_name) और गाँव (accused_village) सहित पूरी पहचान दें — प्रारूप: "[नाम], पिता/पति [पिता/पति का नाम], ग्राम [गाँव], थाना [थाना], जिला [जिला]"। धमकी का कारण और पूर्व की घटनाओं का विवरण दें। यदि कोई सबूत (ऑडियो, वीडियो, SMS, गवाह) हो तो उल्लेख करें। जान-माल की सुरक्षा एवं आरोपी के विरुद्ध कार्रवाई का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'thana',
    name_hindi: 'चरित्र प्रमाण पत्र',
    name_english: 'Character Certificate Request',
    keywords: JSON.stringify(['चरित्र','character','certificate','प्रमाण पत्र','आचरण']),
    required_fields: withBase(['purpose','duration_at_address','employer_name','dob',G]),
    prompt_template: pa('thana', 'चरित्र प्रमाण पत्र',
      'आवेदक कितने समय से वर्तमान पते पर निवास कर रहा है और किस प्रयोजन हेतु चरित्र प्रमाण पत्र चाहिए इसका उल्लेख करें। आवेदक के आचरण और चरित्र के संबंध में सकारात्मक कथन दें। पुलिस सत्यापन उपरांत चरित्र प्रमाण पत्र निर्गत करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'thana',
    name_hindi: 'NOC आवेदन',
    name_english: 'NOC Application (No Objection Certificate)',
    keywords: JSON.stringify(['NOC','अनापत्ति','no objection']),
    required_fields: withBase(['purpose','property_details','duration',G]),
    prompt_template: pa('thana', 'NOC आवेदन',
      'किस कार्य हेतु अनापत्ति प्रमाण पत्र चाहिए इसका स्पष्ट उल्लेख करें। संबंधित संपत्ति/विषय का पूरा विवरण और अवधि बताएं। आवेदक के विरुद्ध कोई आपराधिक मामला नहीं होने का उल्लेख करें। अनापत्ति प्रमाण पत्र निर्गत करने का विनम्र अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'thana',
    name_hindi: 'FIR की प्रति',
    name_english: 'FIR Copy Request',
    keywords: JSON.stringify(['FIR','प्रति','copy','प्रथम सूचना रिपोर्ट']),
    required_fields: withBase(['fir_number','fir_date','reason_for_copy',G]),
    prompt_template: pa('thana', 'FIR की प्रति',
      'FIR संख्या, दिनांक और प्रति की आवश्यकता का कारण स्पष्ट रूप से बताएं। आवेदक का FIR से संबंध (पीड़ित/गवाह/अभियुक्त) बताएं। FIR की सत्यापित प्रति उपलब्ध कराने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'thana',
    name_hindi: 'शांति भंग की आशंका',
    name_english: 'Apprehension of Breach of Peace',
    keywords: JSON.stringify(['शांति','peace','बाधा','उपद्रव','दंगा','हंगामा']),
    required_fields: withBase(['incident_date','location','threat_details','accused_names','accused_father_name','accused_village','urgency_level',G]),
    prompt_template: p('thana', 'शांति भंग की आशंका',
      'किन व्यक्तियों द्वारा, कब और कहाँ शांति भंग की आशंका है इसका विस्तृत विवरण दें। प्रत्येक आरोपी की पूरी पहचान दें: नाम, पिता/पति का नाम (accused_father_name) और गाँव (accused_village) — प्रारूप में "[नाम], पिता/पति [पिता/पति का नाम], ग्राम [गाँव], थाना [थाना], जिला [जिला]"। पूर्व की घटनाओं का उल्लेख करें। निवारक कार्रवाई, सुरक्षा बल तैनाती, एवं धारा 107/116/151 CrPC के तहत कार्रवाई का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'thana',
    name_hindi: 'महिला सुरक्षा शिकायत',
    name_english: 'Women Safety Complaint',
    keywords: JSON.stringify(['महिला','women','सुरक्षा','safety','छेड़छाड़','harassment','उत्पीड़न']),
    required_fields: withBase(['incident_date','incident_time','location','incident_details','accused_name','accused_father_name','accused_village','witnesses','prior_complaints',G]),
    prompt_template: p('thana', 'महिला सुरक्षा शिकायत',
      'घटना का संवेदनशील एवं विस्तृत कालानुक्रमिक वर्णन करें। आरोपी की पूरी पहचान दें: नाम, पिता/पति का नाम (accused_father_name), गाँव (accused_village), और संबंध/पहचान — प्रारूप में "[नाम], पिता/पति [पिता/पति का नाम], ग्राम [गाँव], थाना [थाना], जिला [जिला]"। घटना का महिला की सुरक्षा और मानसिक स्थिति पर प्रभाव बताएं। महिला संबंधी अपराधों की धाराओं (IPC/BNS) के तहत प्राथमिकी दर्ज करने एवं सुरक्षा प्रदान करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'thana',
    name_hindi: 'दहेज उत्पीड़न शिकायत',
    name_english: 'Dowry Harassment Complaint',
    keywords: JSON.stringify(['दहेज','dowry','उत्पीड़न','harassment','प्रताड़ना']),
    required_fields: withBase(['incident_date','accused_names','accused_father_name','accused_village','dowry_demands','incident_history','witnesses','marriage_date',G]),
    prompt_template: p('thana', 'दहेज उत्पीड़न शिकायत',
      'विवाह की तिथि और दहेज की माँग का आरंभ कब से हुआ इसका उल्लेख करें। प्रत्येक आरोपी (पति, सास, ससुर, ननद, देवर आदि) की पूरी पहचान दें: नाम, पिता/पति का नाम (accused_father_name) और गाँव (accused_village) — प्रारूप में "[नाम], पिता/पति [पिता/पति का नाम], ग्राम [गाँव], थाना [थाना], जिला [जिला]"। दहेज में क्या-क्या माँगा गया और मना करने पर क्या प्रताड़ना दी गई इसका कालानुक्रमिक विवरण दें। दहेज प्रतिषेध अधिनियम की धाराओं के तहत प्राथमिकी दर्ज करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'thana',
    name_hindi: 'साइबर अपराध शिकायत',
    name_english: 'Cyber Crime Complaint',
    keywords: JSON.stringify(['साइबर','cyber','ऑनलाइन','online','फ्रॉड','fraud','हैक','hack']),
    required_fields: withBase(['incident_date','platform','fraud_amount','incident_details','accused_name','accused_father_name','accused_village','evidence_screenshots',G]),
    prompt_template: p('thana', 'साइबर अपराध शिकायत',
      'किस प्लेटफॉर्म/ऐप/वेबसाइट के माध्यम से धोखाधड़ी हुई इसका उल्लेख करें। आरोपी/संदिग्ध की पूरी पहचान दें: नाम, पिता/पति का नाम (accused_father_name), गाँव (accused_village), तथा फोन नंबर, UPI ID, बैंक खाता, ईमेल या सोशल मीडिया प्रोफाइल जो भी ज्ञात हो — प्रारूप में "[नाम], पिता/पति [पिता/पति का नाम], ग्राम [गाँव], थाना [थाना], जिला [जिला]"। घटना का चरणबद्ध विवरण दें। साइबर सेल/IT Act के तहत प्राथमिकी दर्ज करने और राशि वापसी का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'thana',
    name_hindi: 'वाहन चोरी शिकायत',
    name_english: 'Vehicle Theft Complaint',
    keywords: JSON.stringify(['वाहन','vehicle','गाड़ी','car','bike','मोटरसाइकिल','stolen vehicle']),
    required_fields: withBase(['vehicle_type','registration_number','chassis_number','engine_number','theft_date','theft_time','theft_location','vehicle_color','identifying_marks','accused_name','accused_father_name','accused_village',G]),
    prompt_template: p('thana', 'वाहन चोरी शिकायत',
      'वाहन का पूरा विवरण (प्रकार, मॉडल, रंग, रजिस्ट्रेशन नंबर, चेसिस नंबर, इंजन नंबर, विशेष पहचान चिह्न) दें। वाहन कब, कहाँ खड़ा था और किन परिस्थितियों में चोरी हुआ इसका कालानुक्रमिक विवरण दें। संदिग्ध/आरोपी की पूरी पहचान दें (यदि ज्ञात हो): नाम, पिता/पति का नाम और गाँव। आसपास के CCTV कैमरों और गवाहों का उल्लेख करें। प्राथमिकी दर्ज कर वाहन की बरामदगी हेतु कार्रवाई का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'thana',
    name_hindi: 'सामान्य शिकायत पत्र',
    name_english: 'General Complaint Letter',
    keywords: JSON.stringify(['शिकायत','complaint','सामान्य','general','समस्या','problem']),
    required_fields: withBase(['subject','complaint_details','desired_action','incident_date','accused_names','accused_father_name','accused_village',G]),
    prompt_template: p('thana', 'सामान्य शिकायत पत्र',
      'शिकायत का पूर्ण कालानुक्रमिक विवरण दें। आरोपी/विपक्षी की पूरी पहचान दें: नाम, पिता/पति का नाम (accused_father_name) और गाँव (accused_village) — प्रारूप में "[नाम], पिता/पति [पिता/पति का नाम], ग्राम [गाँव], थाना [थाना], जिला [जिला]"। समस्या का मूल कारण, प्रभावित पक्ष, और अब तक की गई कार्रवाई का उल्लेख करें। स्पष्ट एवं कार्रवाई योग्य अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'thana',
    name_hindi: 'शोर शिकायत',
    name_english: 'Noise Complaint',
    keywords: JSON.stringify(['शोर','noise','ध्वनि','आवाज़','लाउडस्पीकर','loudspeaker']),
    required_fields: withBase(['noise_source','accused_name','accused_father_name','accused_village','location','timing','duration_of_issue','previous_complaints','impact',G]),
    prompt_template: p('thana', 'शोर शिकायत',
      'शोर का स्रोत (लाउडस्पीकर, DJ, कारखाना, धार्मिक स्थल, निर्माण कार्य) एवं उसका स्थान बताएं। यदि शोर किसी व्यक्ति/प्रतिष्ठान द्वारा किया जा रहा है तो उसकी पूरी पहचान दें: नाम, पिता/पति का नाम (accused_father_name) और गाँव (accused_village)। कब से और किस समय शोर होता है इसका विवरण दें। शोर का प्रभाव और पूर्व शिकायतों का उल्लेख करें। ध्वनि प्रदूषण नियमों के तहत कार्रवाई का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'thana',
    name_hindi: 'FIR दर्ज न होने की शिकायत',
    name_english: 'Complaint Against Non-Registration of FIR',
    keywords: JSON.stringify(['FIR दर्ज नहीं','FIR not registered','इनकार','refusal']),
    required_fields: withBase(['complaint_date','police_station_name','officer_name','reason_for_fir','refusal_details','oral_written_refusal',G]),
    prompt_template: p('thana', 'FIR दर्ज न होने की शिकायत',
      'प्रारंभिक शिकायत कब और किस थाने में दी गई इसका उल्लेख करें। FIR का विषय क्या था और थाना अधिकारी ने FIR दर्ज करने से क्यों इनकार किया (मौखिक या लिखित) इसका विस्तृत विवरण दें। CrPC/BNSS की धारा 154/173 का उल्लेख करते हुए SP महोदय से FIR दर्ज कराने का आदेश देने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },

  // ═══════════════════════════════════════════════════════════════════
  // BLOCK / TEHSIL — 7 types
  // ═══════════════════════════════════════════════════════════════════

  {
    office_type: 'block', name_hindi: 'आय प्रमाण पत्र', name_english: 'Income Certificate',
    keywords: JSON.stringify(['आय','income','प्रमाण पत्र','certificate','आर्थिक']),
    required_fields: withBase(['annual_income','income_source','occupation','family_members','purpose',G]),
    prompt_template: pa('block', 'आय प्रमाण पत्र',
      'आवेदक की वार्षिक आय, आय के स्रोत, व्यवसाय और परिवार में आश्रित सदस्यों की संख्या का उल्लेख करें। प्रमाण पत्र किस प्रयोजन (छात्रवृत्ति, आरक्षण, राशन कार्ड, आवास योजना आदि) हेतु चाहिए बताएं। संलग्न दस्तावेज़ों (आय प्रमाण, बैंक स्टेटमेंट आदि) का उल्लेख करें। नियमानुसार आय प्रमाण पत्र निर्गत करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'block', name_hindi: 'जाति प्रमाण पत्र', name_english: 'Caste Certificate',
    keywords: JSON.stringify(['जाति','caste','प्रमाण पत्र','आरक्षण','reservation','SC','ST','OBC']),
    required_fields: withBase(['caste','sub_caste','religion','purpose','parent_caste_certificate',G]),
    prompt_template: pa('block', 'जाति प्रमाण पत्र',
      'आवेदक की जाति, उपजाति और धर्म का उल्लेख करें। पिता/पति के जाति प्रमाण पत्र का विवरण दें। किस प्रयोजन हेतु जाति प्रमाण पत्र चाहिए बताएं। संलग्न दस्तावेज़ों का उल्लेख कर नियमानुसार जाति प्रमाण पत्र निर्गत करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'block', name_hindi: 'निवास प्रमाण पत्र', name_english: 'Domicile Certificate',
    keywords: JSON.stringify(['निवास','domicile','residence','मूल निवास']),
    required_fields: withBase(['duration_of_residence','state','district','purpose','previous_address',G]),
    prompt_template: pa('block', 'निवास प्रमाण पत्र',
      'आवेदक कितने वर्षों से जिले/राज्य में निवास कर रहा है बताएं। पूर्व का पता और वर्तमान पते का उल्लेख करें। किस प्रयोजन हेतु निवास प्रमाण पत्र चाहिए बताएं। संलग्न दस्तावेज़ों (राशन कार्ड, वोटर ID, बिजली बिल आदि) का उल्लेख करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'block', name_hindi: 'राशन कार्ड सुधार', name_english: 'Ration Card Correction',
    keywords: JSON.stringify(['राशन','ration','कार्ड','सुधार','correction','खाद्य','NFSA']),
    required_fields: withBase(['ration_card_number','correction_type','current_details','correct_details','reason','head_of_family',G]),
    prompt_template: pa('block', 'राशन कार्ड सुधार',
      'राशन कार्ड संख्या और उसमें क्या सुधार चाहिए (नाम, पता, सदस्य जोड़ना/हटाना, आयु सुधार आदि) स्पष्ट रूप से बताएं। वर्तमान गलत जानकारी और सही जानकारी दोनों लिखें। सुधार का कारण और संलग्न दस्तावेज़ों का उल्लेख करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'block', name_hindi: 'जन्म प्रमाण पत्र सुधार', name_english: 'Birth Certificate Correction',
    keywords: JSON.stringify(['जन्म','birth','प्रमाण पत्र','certificate','सुधार','correction']),
    required_fields: withBase(['birth_certificate_number','registration_date','correction_field','current_info','correct_info','reason','child_name','father_name','mother_name',G]),
    prompt_template: pa('block', 'जन्म प्रमाण पत्र सुधार',
      'जन्म प्रमाण पत्र संख्या और पंजीकरण तिथि बताएं। किस फील्ड में सुधार चाहिए (नाम, तिथि, लिंग, माता-पिता का नाम) और वर्तमान गलत एवं सही जानकारी दोनों लिखें। सुधार का कारण और संलग्न दस्तावेज़ों (अस्पताल रिपोर्ट, आधार कार्ड, स्कूल प्रमाण पत्र) का उल्लेख करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'block', name_hindi: 'मृत्यु प्रमाण पत्र आवेदन', name_english: 'Death Certificate Application',
    keywords: JSON.stringify(['मृत्यु','death','प्रमाण पत्र','certificate','देहांत','निधन']),
    required_fields: withBase(['deceased_name','death_date','death_place','cause_of_death','relation_to_deceased','hospital_name','deceased_father_name',G]),
    prompt_template: pa('block', 'मृत्यु प्रमाण पत्र आवेदन',
      'मृतक का पूरा नाम, पिता/पति का नाम, आयु, मृत्यु की तिथि, स्थान और कारण बताएं। आवेदक का मृतक से संबंध स्पष्ट करें। अस्पताल का नाम और मृत्यु रिपोर्ट का उल्लेख करें। मृत्यु प्रमाण पत्र निर्गत करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'block', name_hindi: 'EWS प्रमाण पत्र', name_english: 'EWS Certificate',
    keywords: JSON.stringify(['EWS','आर्थिक','कमजोर','economically weaker','आरक्षण']),
    required_fields: withBase(['annual_income','property_details','caste','purpose','declaration',G]),
    prompt_template: pa('block', 'EWS प्रमाण पत्र',
      'आवेदक आर्थिक रूप से कमजोर वर्ग (EWS) के अंतर्गत आता है इसका उल्लेख करें। वार्षिक पारिवारिक आय, कृषि एवं आवासीय भूमि का विवरण, और स्व-घोषणा दें। किस प्रयोजन (शिक्षा, नौकरी) हेतु प्रमाण पत्र चाहिए बताएं। EWS प्रमाण पत्र निर्गत करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },

  // ═══════════════════════════════════════════════════════════════════
  // CO (Circle Officer) — 8 types
  // ═══════════════════════════════════════════════════════════════════

  {
    office_type: 'co', name_hindi: 'भूमि नापी आवेदन', name_english: 'Land Measurement Request',
    keywords: JSON.stringify(['भूमि','land','नापी','measurement','सर्वे','survey','पैमाइश']),
    required_fields: withBase(['khasra_number','khata_number','village','land_area','measurement_reason','boundary_dispute',G]),
    prompt_template: pa('co', 'भूमि नापी आवेदन',
      'खसरा नंबर, खाता नंबर, गाँव और भूमि का क्षेत्रफल बताएं। नापी क्यों आवश्यक है (खरीद-बिक्री, विवाद, बंटवारा, निर्माण आदि) कारण दें। सीमा विवाद हो तो पड़ोसी भू-स्वामियों का विवरण दें। राजस्व निरीक्षक/अमीन द्वारा स्थलीय नापी कराने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'co', name_hindi: 'दाखिल-खारिज आवेदन', name_english: 'Mutation Application',
    keywords: JSON.stringify(['दाखिल','खारिज','mutation','नामांतरण','transfer','विरासत','succession']),
    required_fields: withBase(['khasra_number','khata_number','village','mutation_reason','previous_owner','new_owner','succession_document','death_date_of_owner',G]),
    prompt_template: pa('co', 'दाखिल-खारिज आवेदन',
      'खसरा नंबर, खाता नंबर और गाँव का उल्लेख करें। नामांतरण का कारण (विरासत, खरीद-बिक्री, बंटवारा, बैनामा) बताएं। पूर्व स्वामी और नए स्वामी का पूरा विवरण एवं संबंध दें। विरासत होने पर मृतक की मृत्यु तिथि और उत्तराधिकार प्रमाण पत्र का उल्लेख करें। राजस्व अभिलेखों में नाम दर्ज/खारिज करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'co', name_hindi: 'परचा आवेदन', name_english: 'Parcha Application (Land Record Extract)',
    keywords: JSON.stringify(['परचा','parcha','खतौनी','Khasra-Khatauni','अभिलेख','record']),
    required_fields: withBase(['khasra_number','khata_number','village','record_type','purpose','year',G]),
    prompt_template: pa('co', 'परचा आवेदन',
      'खसरा नंबर, खाता नंबर, गाँव और फसल वर्ष बताएं। किस प्रकार का अभिलेख (खतौनी की नकल, Khasra-Panchsala, नक्शा आदि) और किस प्रयोजन (बैंक ऋण, कोर्ट केस, फसल बीमा आदि) हेतु चाहिए बताएं। निर्धारित शुल्क के साथ अभिलेख की प्रति उपलब्ध कराने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'co', name_hindi: 'राजस्व रिकॉर्ड सुधार', name_english: 'Revenue Record Correction',
    keywords: JSON.stringify(['राजस्व','revenue','रिकॉर्ड','record','सुधार','correction']),
    required_fields: withBase(['khasra_number','khata_number','village','error_description','correct_info','supporting_documents',G]),
    prompt_template: pa('co', 'राजस्व रिकॉर्ड सुधार',
      'राजस्व अभिलेखों में क्या त्रुटि है (नाम की वर्तनी, क्षेत्रफल, फसल, सीमांकन आदि) इसका सटीक विवरण दें। गलत और सही जानकारी दोनों लिखें। त्रुटि के प्रमाण हेतु संलग्न दस्तावेज़ों का उल्लेख करें। अभिलेखों में सुधार करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'co', name_hindi: 'अतिक्रमण शिकायत', name_english: 'Encroachment Complaint',
    keywords: JSON.stringify(['अतिक्रमण','encroachment','कब्जा','occupation','अवैध','illegal']),
    required_fields: withBase(['khasra_number','village','encroacher_name','encroacher_father_name','encroacher_village','encroachment_details','since_when','previous_complaints','encroachment_area',G]),
    prompt_template: p('co', 'अतिक्रमण शिकायत',
      'अतिक्रमण की गई भूमि का खसरा नंबर, गाँव और क्षेत्रफल बताएं। अतिक्रमणकर्ता की पूरी पहचान दें: पूरा नाम, पिता/पति का नाम (encroacher_father_name) और गाँव (encroacher_village) — प्रारूप में "[नाम], पिता/पति [पिता/पति का नाम], ग्राम [गाँव], थाना [थाना], जिला [जिला]"। कब से अतिक्रमण है और किस प्रकार का अतिक्रमण है इसका विस्तृत विवरण दें। पूर्व की शिकायतों का उल्लेख करें। भूमि को अतिक्रमण मुक्त कराने, बेदखली और विधिक कार्रवाई का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'co', name_hindi: 'भूमि विवाद आवेदन', name_english: 'Land Dispute Application',
    keywords: JSON.stringify(['भूमि','land','विवाद','dispute','सीमा','boundary','बंटवारा','partition']),
    required_fields: withBase(['khasra_number','village','dispute_type','opposing_party','opposing_party_father_name','opposing_party_village','dispute_details','claim_basis','evidence_documents',G]),
    prompt_template: p('co', 'भूमि विवाद आवेदन',
      'भूमि का खसरा नंबर, गाँव और विवाद का प्रकार (सीमा विवाद, स्वामित्व विवाद, बंटवारा, रास्ता विवाद आदि) बताएं। विपक्षी पक्ष की पूरी पहचान दें: पूरा नाम, पिता/पति का नाम (opposing_party_father_name) और गाँव (opposing_party_village) — प्रारूप में "[नाम], पिता/पति [पिता/पति का नाम], ग्राम [गाँव], थाना [थाना], जिला [जिला]"। विवाद का विस्तृत कालानुक्रमिक विवरण और अपने दावे का आधार बताएं। राजस्व अधिकारी से स्थलीय निरीक्षण कर विवाद निराकरण का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'co', name_hindi: 'म्यूटेशन/LPC रोकने हेतु आवेदन', name_english: 'Application to Stop Mutation/LPC',
    keywords: JSON.stringify(['म्यूटेशन','mutation','LPC','रोकना','stop','stay','जांच','inquiry','मापी','survey','मौतेसन','बंटवारा','partition','दाखिल-खारिज','विवाद','dispute','खसरा','खतौनी']),
    required_fields: withBase(['applicant_name','father_husband_name','village','post','thana','district','khata_number','plot_number','mouja_name','opposing_party_name','opposing_party_father_name','opposing_party_village','dispute_description',G]),
    prompt_template: p('co', 'म्यूटेशन/LPC रोकने हेतु आवेदन',
      'यह आवेदन किसी विवादित भूमि के म्यूटेशन (दाखिल-खारिज/नामांतरण) या LPC (Land Possession Certificate) जारी करने पर रोक लगाने हेतु है। खसरा/खाता नंबर, प्लॉट नंबर और मौजा का पूरा विवरण दें। विपक्षी पक्ष का पूरा नाम, पिता/पति का नाम और गाँव स्पष्ट रूप से बताएं। भूमि विवाद का विस्तृत कालानुक्रमिक वर्णन करें — विवाद कब और क्यों शुरू हुआ, अब तक क्या कार्रवाई हुई, और वर्तमान में मामला किस स्तर पर है। यदि मामला SDO/उच्च न्यायालय/राजस्व बोर्ड में विचाराधीन है तो उसका केस नंबर और वर्तमान स्थिति अवश्य बताएं। उल्लेख करें कि जांच पूर्ण होने तक या विवाद का अंतिम निपटारा होने तक म्यूटेशन/LPC/किसी भी प्रकार का भूमि अंतरण रोका जाए। राजस्व अधिकारी से निष्पक्ष जांच कर यथास्थिति बनाए रखने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'co', name_hindi: 'रसीद/LPC निर्गत कराने हेतु आवेदन', name_english: 'Application to Issue Receipt/LPC',
    keywords: JSON.stringify(['रसीद','receipt','LPC','Land Possession Certificate','एलपीसी','निर्गत','issue','खतौनी','परचा','parcha','खसरा','भूमि','लगान रसीद','rent receipt','दाखिल-खारिज']),
    required_fields: withBase(['applicant_name','father_husband_name','village','post','thana','district','khata_number','plot_number','mouja_name','purpose_of_lpc',G]),
    prompt_template: pa('co', 'रसीद/LPC निर्गत कराने हेतु आवेदन',
      'यह आवेदन अपनी स्वयं की भूमि का लगान रसीद (Rent Receipt) या LPC (Land Possession Certificate/भूमि कब्जा प्रमाण पत्र) निर्गत कराने हेतु है। खसरा नंबर, खाता नंबर, प्लॉट नंबर और मौजा (मौज़ा) का पूरा विवरण दें। LPC/रसीद किस प्रयोजन हेतु चाहिए (बैंक ऋण, फसल बीमा, सरकारी योजना का लाभ, कोर्ट में प्रस्तुति, क्रय-विक्रय, शपथ पत्र संलग्नक आदि) इसका स्पष्ट उल्लेख करें। आवेदक उक्त भूमि का कानूनी स्वामी/कब्जाधारी है इसका उल्लेख करें और यदि पूर्व में कोई LPC/रसीद निर्गत हुई है तो उसका विवरण दें। राजस्व अभिलेखों की जांच कर नियमानुसार शीघ्र LPC/रसीद निर्गत करने का विनम्र अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },

  // ═══════════════════════════════════════════════════════════════════
  // BDO — 5 types
  // ═══════════════════════════════════════════════════════════════════

  {
    office_type: 'bdo', name_hindi: 'मनरेगा जॉब कार्ड आवेदन', name_english: 'MGNREGA Job Card Application',
    keywords: JSON.stringify(['मनरेगा','MGNREGA','जॉब कार्ड','job card','नरेगा','NREGA','मजदूरी','रोजगार']),
    required_fields: withBase(['job_card_number','family_members','bank_account','aadhar_last4','village_panchayat','preferred_work',G]),
    prompt_template: pa('bdo', 'मनरेगा जॉब कार्ड आवेदन',
      'आवेदक का ग्राम पंचायत, परिवार के वयस्क सदस्यों की संख्या और बैंक खाता विवरण दें। आधार के अंतिम 4 अंक बताएं। पूर्व का जॉब कार्ड नंबर (यदि कोई हो) और किस प्रकार का कार्य (भूमि समतलीकरण, तालाब निर्माण, सड़क निर्माण, वृक्षारोपण आदि) चाहिए बताएं। मनरेगा योजनांतर्गत जॉब कार्ड निर्गत कर 100 दिन का रोजगार उपलब्ध कराने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'bdo', name_hindi: 'आवास योजना आवेदन', name_english: 'Awas Yojana Application',
    keywords: JSON.stringify(['आवास','awas','housing','PM Awas','इंदिरा आवास','मकान','घर']),
    required_fields: withBase(['scheme_name','current_house_type','annual_income','bpl_status','land_ownership','aadhar_last4',G]),
    prompt_template: pa('bdo', 'आवास योजना आवेदन',
      'किस आवास योजना (PM Awas Gramin/Urban, मुख्यमंत्री आवास योजना, अंबेडकर आवास योजना आदि) के अंतर्गत आवेदन है बताएं। वर्तमान आवास की स्थिति (कच्चा/पक्का/झोपड़ी), वार्षिक आय और BPL स्थिति का उल्लेख करें। आवास हेतु भूमि स्वामित्व की जानकारी दें। पात्रता के अनुसार आवास योजना का लाभ प्रदान करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'bdo', name_hindi: 'पंचायत योजना शिकायत', name_english: 'Panchayat Scheme Complaint',
    keywords: JSON.stringify(['पंचायत','panchayat','योजना','scheme','ग्राम','village','अनियमितता']),
    required_fields: withBase(['scheme_name','panchayat_name','village','complaint_details','amount_involved','evidence',G]),
    prompt_template: p('bdo', 'पंचायत योजना शिकायत',
      'किस योजना में, किस पंचायत द्वारा, कब और कैसे अनियमितता की गई इसका कालानुक्रमिक विवरण दें। संबंधित पंचायत पदाधिकारियों/सचिव का नाम और पद बताएं। अनियमितता में शामिल राशि और सबूत (फोटो, दस्तावेज़, गवाह) का उल्लेख करें। जाँच कर दोषियों के विरुद्ध कार्रवाई एवं राशि वसूली का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'bdo', name_hindi: 'विकास निधि शिकायत', name_english: 'Development Fund Grievance',
    keywords: JSON.stringify(['विकास','development','निधि','fund','भ्रष्टाचार','corruption','गबन','embezzlement']),
    required_fields: withBase(['fund_name','panchayat_name','village','grievance_details','amount','project_name','timeline',G]),
    prompt_template: p('bdo', 'विकास निधि शिकायत',
      'किस विकास निधि/योजना (MP/MLA निधि, 14वां/15वां वित्त आयोग, मनरेगा निधि आदि) में अनियमितता हुई इसका उल्लेख करें। परियोजना का नाम, स्वीकृत राशि, और कितनी राशि का गबन/दुरुपयोग हुआ बताएं। जिम्मेदार अधिकारियों/पंचायत पदाधिकारियों के नाम और पद दें। उच्चस्तरीय जाँच, दोषियों पर कार्रवाई और राशि वसूली का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'bdo', name_hindi: 'वृद्धा/विधवा पेंशन आवेदन', name_english: 'Old Age / Widow Pension Application',
    keywords: JSON.stringify(['पेंशन','pension','वृद्धा','old age','विधवा','widow','विकलांग','disability']),
    required_fields: withBase(['pension_type','age','marital_status','income','bpl_status','bank_account','aadhar_last4','disability_percentage',G]),
    prompt_template: pa('bdo', 'वृद्धावस्था/विधवा/विकलांग पेंशन आवेदन',
      'किस प्रकार की पेंशन (वृद्धावस्था, विधवा, विकलांग) हेतु आवेदन है बताएं। आयु, वैवाहिक स्थिति, आय और BPL स्थिति का उल्लेख करें। विकलांग पेंशन होने पर विकलांगता का प्रकार और प्रतिशत बताएं। बैंक खाता विवरण और आधार संलग्न करने का उल्लेख करें। पात्रतानुसार पेंशन स्वीकृत कर भुगतान का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },

  // ═══════════════════════════════════════════════════════════════════
  // SDO — 4 types
  // ═══════════════════════════════════════════════════════════════════

  {
    office_type: 'sdo', name_hindi: 'प्रमाण पत्र अपील', name_english: 'Certificate Appeal',
    keywords: JSON.stringify(['प्रमाण पत्र','certificate','अपील','appeal','अस्वीकृत','rejected']),
    required_fields: withBase(['certificate_type','lower_office_name','rejection_date','rejection_reason','appeal_grounds','supporting_documents',G]),
    prompt_template: p('sdo', 'प्रमाण पत्र अपील',
      'किस प्रमाण पत्र हेतु आवेदन किया था और किस कार्यालय ने कब और क्यों अस्वीकृत किया इसका विस्तृत विवरण दें। अस्वीकृति का कारण अनुचित/अवैध क्यों है इसके तर्कपूर्ण आधार दें। सभी संलग्न दस्तावेज़ों का उल्लेख करें। निचले कार्यालय के निर्णय को निरस्त कर प्रमाण पत्र निर्गत करने का आदेश देने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'sdo', name_hindi: 'भूमि विवाद एस्कलेशन', name_english: 'Land Dispute Escalation',
    keywords: JSON.stringify(['भूमि','land','विवाद','dispute','एस्कलेशन','escalation','अपील','appeal']),
    required_fields: withBase(['co_office_name','co_decision_date','co_case_number','dissatisfaction_reason','requested_relief','supporting_documents',G]),
    prompt_template: p('sdo', 'भूमि विवाद एस्कलेशन',
      'CO कार्यालय में मूल मामला कब दर्ज किया गया था और CO द्वारा क्या निर्णय दिया गया इसका विवरण दें। CO के निर्णय से असंतोष के विस्तृत कारण और तथ्यात्मक/कानूनी आधार बताएं। अब तक की संपूर्ण प्रक्रिया का कालानुक्रमिक वर्णन करें। SDO महोदय से मामले का पुनर्विलोकन/पुनर्विचार कर न्यायोचित निर्णय देने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'sdo', name_hindi: 'अतिक्रमण एस्कलेशन शिकायत', name_english: 'Encroachment Escalation',
    keywords: JSON.stringify(['अतिक्रमण','encroachment','एस्कलेशन','escalation','कब्जा','बेदखली','eviction']),
    required_fields: withBase(['co_office_name','prior_complaint_date','encroachment_details','co_inaction_details','encroacher_name','encroacher_father_name','encroacher_village','urgency',G]),
    prompt_template: p('sdo', 'अतिक्रमण एस्कलेशन शिकायत',
      'CO कार्यालय में अतिक्रमण की शिकायत कब दर्ज की गई थी और अब तक क्या कार्रवाई हुई (या नहीं हुई) इसका विवरण दें। अतिक्रमणकर्ता की पूरी पहचान दें: पूरा नाम, पिता/पति का नाम (encroacher_father_name) और गाँव (encroacher_village) — प्रारूप में "[नाम], पिता/पति [पिता/पति का नाम], ग्राम [गाँव], थाना [थाना], जिला [जिला]"। CO कार्यालय की निष्क्रियता का कारण बताएं। SDO से तत्काल हस्तक्षेप कर बेदखली और विधिक कार्रवाई का आदेश देने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'sdo', name_hindi: 'सामान्य प्रशासनिक शिकायत', name_english: 'General Administrative Complaint',
    keywords: JSON.stringify(['प्रशासनिक','administrative','शिकायत','complaint','सरकारी','government']),
    required_fields: withBase(['department_name','grievance_subject','grievance_details','concerned_officer','desired_action','timeline',G]),
    prompt_template: p('sdo', 'सामान्य प्रशासनिक शिकायत',
      'किस सरकारी विभाग/कार्यालय के विरुद्ध शिकायत है बताएं। शिकायत का पूर्ण कालानुक्रमिक विवरण दें। संबंधित अधिकारी/कर्मचारी का नाम और पद बताएं। अब तक की गई शिकायतों और उनके परिणाम का उल्लेख करें। स्पष्ट एवं कार्रवाई योग्य अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },

  // ═══════════════════════════════════════════════════════════════════
  // SP — 4 types
  // ═══════════════════════════════════════════════════════════════════

  {
    office_type: 'sp', name_hindi: 'FIR दर्ज न होने की शिकायत एस्कलेशन', name_english: 'FIR Non-Registration Escalation to SP',
    keywords: JSON.stringify(['FIR','एस्कलेशन','escalation','दर्ज नहीं','not registered','SP','पुलिस अधीक्षक']),
    required_fields: withBase(['police_station_name','complaint_date','officer_name','fir_subject','refusal_details','oral_written_refusal','witness_present',G]),
    prompt_template: p('sp', 'FIR दर्ज न होने की शिकायत एस्कलेशन',
      'कब और किस थाने में FIR हेतु शिकायत दी गई, FIR का विषय क्या था, और थाना अधिकारी (नाम और पद सहित) ने FIR दर्ज करने से क्यों इनकार किया (मौखिक या लिखित आदेश) इसका विस्तृत विवरण दें। BNSS/CrPC की धारा 154/173 का उल्लेख करें। FIR दर्ज करने का आदेश देने एवं संबंधित थाना अधिकारी के विरुद्ध अनुशासनात्मक कार्रवाई का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'sp', name_hindi: 'पुलिस अधिकारी के विरुद्ध शिकायत', name_english: 'Complaint Against Police Officer',
    keywords: JSON.stringify(['पुलिस','police','अधिकारी','officer','दुर्व्यवहार','misconduct','भ्रष्टाचार','corruption']),
    required_fields: withBase(['police_station_name','officer_name','officer_designation','incident_date','incident_details','witnesses','evidence',G]),
    prompt_template: p('sp', 'पुलिस अधिकारी के विरुद्ध शिकायत',
      'संबंधित पुलिस अधिकारी/कर्मचारी का पूरा नाम, पद और थाना बताएं। कब, कहाँ और क्या दुर्व्यवहार/कदाचार/भ्रष्टाचार हुआ इसका कालानुक्रमिक एवं विस्तृत विवरण दें। घटना के गवाहों के नाम और संपर्क दें। उपलब्ध सबूत (वीडियो, ऑडियो, फोटो, दस्तावेज़) का उल्लेख करें। दोषी अधिकारी के विरुद्ध विभागीय कार्रवाई एवं न्याय का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'sp', name_hindi: 'सुरक्षा हेतु आवेदन', name_english: 'Security / Protection Application',
    keywords: JSON.stringify(['सुरक्षा','security','protection','जान का खतरा','threat to life']),
    required_fields: withBase(['threat_type','threat_source','accused_name','accused_father_name','accused_village','threat_details','prior_complaints','urgency_level',G]),
    prompt_template: p('sp', 'सुरक्षा हेतु आवेदन',
      'किससे और क्यों जान-माल का खतरा है इसका विस्तृत विवरण दें। आरोपी/धमकी देने वाले की पूरी पहचान दें: नाम, पिता/पति का नाम (accused_father_name), गाँव (accused_village), और संबंध — प्रारूप में "[नाम], पिता/पति [पिता/पति का नाम], ग्राम [गाँव], थाना [थाना], जिला [जिला]"। अब तक की धमकियों और हमलों का कालानुक्रमिक वर्णन करें। पूर्व में दर्ज शिकायतों का उल्लेख करें। तत्काल पुलिस सुरक्षा प्रदान करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'sp', name_hindi: 'गुमशुदा व्यक्ति एस्कलेशन', name_english: 'Missing Person Escalation to SP',
    keywords: JSON.stringify(['गुमशुदा','missing','एस्कलेशन','escalation','तलाश','search','अपहरण','kidnapping']),
    required_fields: withBase(['police_station_name','missing_complaint_date','missing_person_name','missing_person_age','police_action_taken','escalation_reason','relation_to_missing',G]),
    prompt_template: p('sp', 'गुमशुदा व्यक्ति एस्कलेशन',
      'गुमशुदा व्यक्ति का नाम, आयु और आवेदक से संबंध बताएं। कब और किस थाने में गुमशुदगी रिपोर्ट दर्ज की गई और अब तक पुलिस ने क्या कार्रवाई की (FIR दर्ज, तलाशी, CCTV खंगालना, CDR विश्लेषण, पूछताछ) इसका विवरण दें। थाना स्तर पर कार्रवाई अपर्याप्त क्यों है बताएं। SP से विशेष टीम गठित कर त्वरित तलाशी अभियान चलाने और अपहरण की आशंका होने पर धारा 364 IPC/BNS के तहत प्राथमिकी दर्ज करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },

  // ═══════════════════════════════════════════════════════════════════
  // DC / DM — 5 types
  // ═══════════════════════════════════════════════════════════════════

  {
    office_type: 'dc', name_hindi: 'RTI आवेदन', name_english: 'RTI Application',
    keywords: JSON.stringify(['RTI','सूचना का अधिकार','right to information','information request']),
    required_fields: withBase(['department_name','information_requested','time_period','format_required','ipo_details',G]),
    prompt_template: pa('dc', 'RTI आवेदन',
      'सूचना का अधिकार अधिनियम 2005 की धारा 6 के अंतर्गत आवेदन है। किस विभाग/कार्यालय से, किस अवधि की, कौन-सी सूचना चाहिए इसका स्पष्ट और विशिष्ट विवरण दें। सूचना किस प्रारूप (प्रतिलिपि, PDF, निरीक्षण) में चाहिए बताएं। IPO/शुल्क का विवरण दें। निर्धारित 30 दिनों की अवधि में सूचना उपलब्ध कराने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'dc', name_hindi: 'जिला प्रशासन शिकायत', name_english: 'District Administration Grievance',
    keywords: JSON.stringify(['जिला','district','प्रशासन','administration','शिकायत','grievance']),
    required_fields: withBase(['department_name','grievance_subject','grievance_details','prior_actions','desired_resolution','urgency',G]),
    prompt_template: p('dc', 'जिला प्रशासन शिकायत',
      'किस विभाग/कार्यालय के विरुद्ध शिकायत है और शिकायत का विषय क्या है बताएं। समस्या का कालानुक्रमिक विवरण दें। अब तक किन-किन अधिकारियों से संपर्क किया और क्या परिणाम मिला इसका उल्लेख करें। निचले स्तर पर समाधान न होने का कारण बताएं। जिलाधिकारी महोदय से हस्तक्षेप कर समुचित समाधान कराने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'dc', name_hindi: 'मुआवजा दावा आवेदन', name_english: 'Compensation Claim Application',
    keywords: JSON.stringify(['मुआवजा','compensation','दावा','claim','क्षति','damage']),
    required_fields: withBase(['incident_type','incident_date','damage_details','estimated_loss','insurance_info','supporting_documents',G]),
    prompt_template: p('dc', 'मुआवजा दावा आवेदन',
      'किस घटना/आपदा (बाढ़, सूखा, ओलावृष्टि, आग, सड़क दुर्घटना, सरकारी परियोजना से क्षति आदि) से क्षति हुई इसका विवरण दें। घटना की तिथि और क्षति का विस्तृत ब्योरा (फसल, मकान, पशुधन, जान-माल) दें। अनुमानित आर्थिक हानि और बीमा की जानकारी दें। संलग्न प्रमाणों (फोटो, राजस्व रिपोर्ट, मेडिकल रिपोर्ट) का उल्लेख कर नियमानुसार मुआवजा राशि स्वीकृत करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'dc', name_hindi: 'आपदा राहत आवेदन', name_english: 'Disaster Relief Application',
    keywords: JSON.stringify(['आपदा','disaster','राहत','relief','बाढ़','flood','सूखा','drought','भूकंप','earthquake']),
    required_fields: withBase(['disaster_type','disaster_date','affected_area','damage_description','family_members_affected','immediate_needs','aadhar_last4',G]),
    prompt_template: p('dc', 'आपदा राहत आवेदन',
      'किस आपदा से कब और कहाँ प्रभावित हुए इसका विवरण दें। आपदा से हुई क्षति का विस्तृत ब्योरा (मकान क्षतिग्रस्त, फसल नष्ट, पशुधन हानि, विस्थापन) दें। प्रभावित परिवार के सदस्यों की संख्या और उनकी वर्तमान स्थिति बताएं। तत्कालीन आवश्यकताएं (भोजन, आश्रय, चिकित्सा, पेयजल) और दीर्घकालिक राहत (आवास, मुआवजा, पुनर्वास) का उल्लेख करें। आपदा राहत निधि से तत्काल सहायता प्रदान करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'dc', name_hindi: 'सामान्य लोक शिकायत', name_english: 'Public Grievance Redressal',
    keywords: JSON.stringify(['लोक शिकायत','public grievance','जन शिकायत','समाधान','redressal']),
    required_fields: withBase(['department_name','grievance_category','grievance_details','affected_parties','prior_escalation','prayer',G]),
    prompt_template: p('dc', 'सामान्य लोक शिकायत',
      'शिकायत की श्रेणी और संबंधित विभाग का नाम बताएं। समस्या का कालानुक्रमिक एवं विस्तृत विवरण दें। इस समस्या से कितने लोग/परिवार प्रभावित हैं बताएं। अब तक की गई शिकायतों का स्तर और परिणाम बताएं। जिलाधिकारी महोदय से जन शिकायत निवारण प्रणाली के तहत समाधान का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },

  // ═══════════════════════════════════════════════════════════════════
  // COURT — 2 types (with legal disclaimer)
  // ═══════════════════════════════════════════════════════════════════

  {
    office_type: 'court', name_hindi: 'शपथ पत्र प्रारूप', name_english: 'Affidavit Format',
    keywords: JSON.stringify(['शपथ पत्र','affidavit','हलफनामा','शपथ','oath']),
    required_fields: withBase(['deponent_name','deponent_father_name','deponent_age','deponent_address','statement_of_facts','purpose','court_name',G]),
    prompt_template: p('court', 'शपथ पत्र प्रारूप',
      'शपथकर्ता का पूरा विवरण और शपथ पत्र का प्रयोजन बताएं। तथ्यों का कथन क्रमांकित अनुच्छेदों (1, 2, 3...) में लिखें। प्रत्येक अनुच्छेद एक पृथक तथ्य का वर्णन करे। अंत में शपथ की पुष्टि का वाक्य ("मैं उपरोक्त कथनों की सत्यता की शपथ लेता/लेती हूँ...") और न्यायालय का नाम दें। हस्ताक्षर के लिए स्थान छोड़ें।'),
    requires_legal_disclaimer: 1, disclaimer_text: COURT_DISCLAIMER,
  },
  {
    office_type: 'court', name_hindi: 'सामान्य याचिका प्रारूप', name_english: 'Simple Petition Draft',
    keywords: JSON.stringify(['याचिका','petition','प्रार्थना पत्र','application','न्यायालय','court','दीवानी','civil']),
    required_fields: withBase(['petitioner_name','respondent_name','respondent_father_name','respondent_village','court_name','case_type','facts_of_case','legal_grounds','prayer_clause',G]),
    prompt_template: p('court', 'सामान्य याचिका प्रारूप',
      'याचिकाकर्ता का पूरा विवरण दें। प्रत्यर्थी (विपक्षी) की पूरी पहचान दें: नाम, पिता/पति का नाम (respondent_father_name) और गाँव (respondent_village) — प्रारूप में "[नाम], पिता/पति [पिता/पति का नाम], ग्राम [गाँव], थाना [थाना], जिला [जिला]"। न्यायालय का नाम और वाद का प्रकार बताएं। मामले के तथ्यों का कालानुक्रमिक एवं अनुच्छेदवार विवरण दें। याचिका के विधिक आधार बताएं। प्रार्थना खंड में स्पष्ट एवं विशिष्ट अनुरोध करें।'),
    requires_legal_disclaimer: 1, disclaimer_text: COURT_DISCLAIMER,
  },

  // ═══════════════════════════════════════════════════════════════════
  // BANK — 5 types (administrative)
  // ═══════════════════════════════════════════════════════════════════

  {
    office_type: 'bank', name_hindi: 'खाता स्थानांतरण आवेदन', name_english: 'Account Transfer Application',
    keywords: JSON.stringify(['खाता','account','स्थानांतरण','transfer','शाखा','branch']),
    required_fields: withBase(['bank_name','account_number','old_branch','new_branch','transfer_reason',G]),
    prompt_template: pa('bank', 'खाता स्थानांतरण आवेदन',
      'खाता धारक का पूरा विवरण और खाता संख्या स्पष्ट रूप से बताएं। वर्तमान शाखा (पुरानी) और जिस शाखा में स्थानांतरण चाहिए (नई) का नाम और पता दें। खाता स्थानांतरण का उचित कारण बताएं। खाते से जुड़ी सभी सुविधाएं (चेक बुक, डेबिट कार्ड, नेट बैंकिंग) नई शाखा में स्थानांतरित करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'bank', name_hindi: 'चेक बुक हेतु आवेदन', name_english: 'Cheque Book Request',
    keywords: JSON.stringify(['चेक','cheque','cheque book','चेक बुक','checkbook']),
    required_fields: withBase(['bank_name','account_number','branch_name','cheque_leaves',G]),
    prompt_template: pa('bank', 'चेक बुक हेतु आवेदन',
      'खाता धारक का नाम और खाता संख्या स्पष्ट रूप से बताएं। शाखा का नाम बताएं। कितने पत्तों (leaves) की चेक बुक चाहिए इसका उल्लेख करें। पुरानी चेक बुक समाप्त होने या नई आवश्यकता का कारण बताएं। शीघ्र चेक बुक जारी करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'bank', name_hindi: 'KYC अद्यतन आवेदन', name_english: 'KYC Update Application',
    keywords: JSON.stringify(['KYC','kyc','अद्यतन','update','पहचान','identity','पता','address']),
    required_fields: withBase(['bank_name','account_number','branch_name','update_details','document_type',G]),
    prompt_template: pa('bank', 'KYC अद्यतन आवेदन',
      'KYC (Know Your Customer) में क्या अद्यतन (update) करना है — पता परिवर्तन, मोबाइल नंबर, पहचान पत्र, या अन्य — स्पष्ट रूप से बताएं। संलग्न दस्तावेज़ों की सूची दें (आधार कार्ड, पैन कार्ड, पासपोर्ट आदि)। खाता संख्या और शाखा का नाम बताएं। KYC अद्यतन करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'bank', name_hindi: 'खाता बंद करने हेतु आवेदन', name_english: 'Account Closure Application',
    keywords: JSON.stringify(['बंद','close','closure','खाता बंद','account close']),
    required_fields: withBase(['bank_name','account_number','branch_name','closure_reason','balance_settlement',G]),
    prompt_template: pa('bank', 'खाता बंद करने हेतु आवेदन',
      'खाता धारक का नाम, खाता संख्या और शाखा का नाम स्पष्ट रूप से बताएं। खाता बंद करने का कारण बताएं (स्थानांतरण, अन्य बैंक में खाता, अब आवश्यकता नहीं आदि)। शेष राशि के निपटान का तरीका बताएं (नकद / DD / NEFT)। सभी संबंधित सुविधाएं (चेक बुक, डेबिट कार्ड) वापस करने और खाता बंद करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'bank', name_hindi: 'डुप्लीकेट पासबुक हेतु आवेदन', name_english: 'Duplicate Passbook Application',
    keywords: JSON.stringify(['पासबुक','passbook','डुप्लीकेट','duplicate','खोई','lost','गुम']),
    required_fields: withBase(['bank_name','account_number','branch_name','loss_reason','lost_date',G]),
    prompt_template: pa('bank', 'डुप्लीकेट पासबुक हेतु आवेदन',
      'खाता धारक का नाम, खाता संख्या और शाखा का नाम बताएं। पासबुक कब और कैसे खोई / क्षतिग्रस्त हुई इसका विवरण दें। पुरानी पासबुक को निरस्त कर डुप्लीकेट पासबुक जारी करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },

  // ═══════════════════════════════════════════════════════════════════
  // COLLEGE — 5 types (certificate/administrative)
  // ═══════════════════════════════════════════════════════════════════

  {
    office_type: 'college', name_hindi: 'बोनाफाइड प्रमाण पत्र आवेदन', name_english: 'Bonafide Certificate Application',
    keywords: JSON.stringify(['बोनाफाइड','bonafide','प्रमाण पत्र','certificate','प्रमाणपत्र']),
    required_fields: withBase(['college_name','course_name','roll_number','purpose','academic_year',G]),
    prompt_template: pa('college', 'बोनाफाइड प्रमाण पत्र आवेदन',
      'छात्र/छात्रा का पूरा नाम, कक्षा/पाठ्यक्रम और रोल नंबर बताएं। बोनाफाइड प्रमाण पत्र किस प्रयोजन हेतु चाहिए (छात्रवृत्ति, रेलवे कन्सेशन, बैंक खाता, अन्य) स्पष्ट रूप से बताएं। महाविद्यालय का नाम और शैक्षणिक वर्ष बताएं। शीघ्र प्रमाण पत्र जारी करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'college', name_hindi: 'स्थानांतरण प्रमाण पत्र आवेदन', name_english: 'Transfer Certificate Application',
    keywords: JSON.stringify(['TC','transfer','स्थानांतरण','transfer certificate','छोड़ना']),
    required_fields: withBase(['college_name','course_name','roll_number','transfer_reason','new_institution',G]),
    prompt_template: pa('college', 'स्थानांतरण प्रमाण पत्र आवेदन',
      'छात्र/छात्रा का नाम, पाठ्यक्रम और रोल नंबर बताएं। स्थानांतरण का कारण और नए संस्थान का नाम (यदि ज्ञात हो) बताएं। सभी बकाया शुल्क जमा होने की पुष्टि करें। स्थानांतरण प्रमाण पत्र (TC) एवं चरित्र प्रमाण पत्र जारी करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'college', name_hindi: 'चरित्र प्रमाण पत्र आवेदन', name_english: 'Character Certificate Application',
    keywords: JSON.stringify(['चरित्र','character','आचरण','conduct','प्रमाण पत्र']),
    required_fields: withBase(['college_name','course_name','roll_number','purpose',G]),
    prompt_template: pa('college', 'चरित्र प्रमाण पत्र आवेदन',
      'छात्र/छात्रा का नाम, पाठ्यक्रम और रोल नंबर बताएं। चरित्र प्रमाण पत्र के प्रयोजन का उल्लेख करें। महाविद्यालय में अध्ययन की अवधि और आचरण का संक्षिप्त विवरण दें। प्राचार्य से चरित्र प्रमाण पत्र जारी करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'college', name_hindi: 'शुल्क माफी/छात्रवृत्ति आवेदन', name_english: 'Fee Waiver / Scholarship Application',
    keywords: JSON.stringify(['शुल्क','fee','माफी','waiver','छात्रवृत्ति','scholarship','आर्थिक']),
    required_fields: withBase(['college_name','course_name','roll_number','family_income','reason','academic_performance',G]),
    prompt_template: pa('college', 'शुल्क माफी/छात्रवृत्ति आवेदन',
      'छात्र/छात्रा का नाम, पाठ्यक्रम, रोल नंबर और परिवार की वार्षिक आय बताएं। शुल्क माफी या छात्रवृत्ति की आवश्यकता का औचित्य एवं कारण बताएं। शैक्षणिक प्रदर्शन और पिछली कक्षाओं के अंकों का उल्लेख करें। संलग्न दस्तावेज़ों (आय प्रमाण पत्र, जाति प्रमाण पत्र, अंकसूची) की सूची दें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'college', name_hindi: 'डुप्लीकेट मार्कशीट आवेदन', name_english: 'Duplicate Marksheet Application',
    keywords: JSON.stringify(['मार्कशीट','marksheet','डुप्लीकेट','duplicate','अंकसूची','खोई']),
    required_fields: withBase(['college_name','course_name','roll_number','exam_year','loss_reason',G]),
    prompt_template: pa('college', 'डुप्लीकेट मार्कशीट आवेदन',
      'छात्र/छात्रा का नाम, पाठ्यक्रम, रोल नंबर और परीक्षा वर्ष बताएं। मूल मार्कशीट कब और कैसे खोई/क्षतिग्रस्त हुई इसका विवरण दें। आवश्यक शुल्क जमा करने की पुष्टि करें। डुप्लीकेट मार्कशीट जारी करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },

  // ═══════════════════════════════════════════════════════════════════
  // SCHOOL — 5 types (certificate/administrative)
  // ═══════════════════════════════════════════════════════════════════

  {
    office_type: 'school', name_hindi: 'बोनाफाइड प्रमाण पत्र आवेदन', name_english: 'Bonafide Certificate Application',
    keywords: JSON.stringify(['बोनाफाइड','bonafide','प्रमाण पत्र','certificate','school']),
    required_fields: withBase(['school_name','class_name','roll_number','purpose',G]),
    prompt_template: pa('school', 'बोनाफाइड प्रमाण पत्र आवेदन',
      'छात्र/छात्रा का नाम, कक्षा और रोल नंबर बताएं। बोनाफाइड प्रमाण पत्र किस प्रयोजन हेतु चाहिए (छात्रवृत्ति, रेलवे कन्सेशन, बैंक खाता, आधार अपडेट) बताएं। विद्यालय का नाम बताएं। प्रधानाध्यापक से प्रमाण पत्र जारी करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'school', name_hindi: 'स्थानांतरण प्रमाण पत्र (TC) आवेदन', name_english: 'Transfer Certificate (TC) Application',
    keywords: JSON.stringify(['TC','transfer','स्थानांतरण','school leaving','छोड़ना']),
    required_fields: withBase(['school_name','class_name','roll_number','transfer_reason','new_school',G]),
    prompt_template: pa('school', 'स्थानांतरण प्रमाण पत्र (TC) आवेदन',
      'छात्र/छात्रा का नाम, कक्षा और रोल नंबर बताएं। स्थानांतरण का कारण और नए विद्यालय का नाम (यदि ज्ञात हो) बताएं। सभी बकाया शुल्क जमा होने की पुष्टि करें। स्थानांतरण प्रमाण पत्र (TC) जारी करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'school', name_hindi: 'चरित्र प्रमाण पत्र आवेदन', name_english: 'Character Certificate Application',
    keywords: JSON.stringify(['चरित्र','character','आचरण','conduct','school']),
    required_fields: withBase(['school_name','class_name','roll_number','purpose',G]),
    prompt_template: pa('school', 'चरित्र प्रमाण पत्र आवेदन',
      'छात्र/छात्रा का नाम, कक्षा और रोल नंबर बताएं। चरित्र प्रमाण पत्र किस प्रयोजन हेतु चाहिए बताएं। विद्यालय में अध्ययन की अवधि और आचरण का विवरण दें। प्रधानाध्यापक से चरित्र प्रमाण पत्र जारी करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'school', name_hindi: 'अवकाश आवेदन', name_english: 'Leave Application',
    keywords: JSON.stringify(['अवकाश','leave','छुट्टी','absence','बीमार','त्यौहार']),
    required_fields: withBase(['school_name','class_name','roll_number','leave_reason','leave_duration','leave_dates',G]),
    prompt_template: pa('school', 'अवकाश आवेदन',
      'छात्र/छात्रा का नाम, कक्षा और रोल नंबर बताएं। अवकाश की तिथियाँ (से — तक) और दिनों की संख्या बताएं। अवकाश का स्पष्ट एवं उचित कारण (बीमारी, पारिवारिक कार्यक्रम, त्यौहार, चिकित्सा आदि) बताएं। अनुपस्थिति के दौरान पढ़ाई की पूर्ति का आश्वासन दें। अवकाश स्वीकृत करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'school', name_hindi: 'फीस माफी आवेदन', name_english: 'Fee Waiver Application',
    keywords: JSON.stringify(['फीस','fee','माफी','waiver','गरीब','आर्थिक','गरीबी']),
    required_fields: withBase(['school_name','class_name','roll_number','family_income','reason','father_occupation',G]),
    prompt_template: pa('school', 'फीस माफी आवेदन',
      'छात्र/छात्रा का नाम, कक्षा और रोल नंबर बताएं। परिवार की आर्थिक स्थिति, वार्षिक आय और पिता/अभिभावक का व्यवसाय बताएं। फीस माफी की आवश्यकता का औचित्य बताएं। शैक्षणिक प्रदर्शन का संक्षिप्त उल्लेख करें। संलग्न दस्तावेज़ों (आय प्रमाण पत्र, BPL कार्ड आदि) की सूची दें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },

  // ═══════════════════════════════════════════════════════════════════
  // PWD (लोक निर्माण विभाग) — 3 types
  // ═══════════════════════════════════════════════════════════════════

  {
    office_type: 'pwd', name_hindi: 'सड़क निर्माण/मरम्मत हेतु आवेदन', name_english: 'Road Construction / Repair Application',
    keywords: JSON.stringify(['सड़क','road','निर्माण','construction','मरम्मत','repair','PWD']),
    required_fields: withBase(['road_location','road_condition_details','road_type','estimated_length','community_benefit',G]),
    prompt_template: pa('pwd', 'सड़क निर्माण/मरम्मत हेतु आवेदन',
      'सड़क का स्थान (गाँव, पंचायत, ब्लॉक) स्पष्ट रूप से बताएं। सड़क की वर्तमान स्थिति का विस्तृत विवरण दें (गड्ढे, टूट-फूट, जलभराव, कटाव आदि)। सड़क का प्रकार (मुख्य मार्ग, ग्रामीण सड़क, संपर्क पथ) और अनुमानित लंबाई बताएं। सड़क निर्माण/मरम्मत से स्थानीय समुदाय को होने वाले लाभ बताएं। कार्यपालक अभियंता से शीघ्र सर्वेक्षण एवं निर्माण/मरम्मत कार्य स्वीकृत करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'pwd', name_hindi: 'सड़क क्षति शिकायत', name_english: 'Road Damage Complaint',
    keywords: JSON.stringify(['क्षति','damage','शिकायत','complaint','सड़क टूटी','गड्ढा']),
    required_fields: withBase(['road_location','damage_details','incident_impact','safety_risk','alternative_route',G]),
    prompt_template: p('pwd', 'सड़क क्षति शिकायत',
      'क्षतिग्रस्त सड़क का स्थान, क्षति का प्रकार और गंभीरता का विस्तृत वर्णन करें। क्षति के कारण (भारी वर्षा, ओवरलोड वाहन, खराब निर्माण गुणवत्ता) का उल्लेख करें। स्थानीय निवासियों और यातायात पर पड़ने वाले प्रभाव का विवरण दें। दुर्घटना का खतरा और सुरक्षा चिंताओं को रेखांकित करें। क्षति का निरीक्षण कर तत्काल मरम्मत कार्य प्रारंभ करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'pwd', name_hindi: 'पुल निर्माण हेतु आवेदन', name_english: 'Bridge Construction Application',
    keywords: JSON.stringify(['पुल','bridge','निर्माण','construction','नदी','नाला']),
    required_fields: withBase(['bridge_location','water_body_name','justification','affected_villages','current_crossing_method',G]),
    prompt_template: pa('pwd', 'पुल निर्माण हेतु आवेदन',
      'पुल के स्थान (नदी/नाले का नाम और निकटतम गाँव) का विवरण दें। वर्तमान में आवाजाही की स्थिति (पैदल, अस्थायी पुल, नाव, बरसात में बंद) बताएं। पुल से लाभान्वित होने वाले गाँवों और जनसंख्या का अनुमान दें। पुल निर्माण का औचित्य एवं आवश्यकता बताएं। कार्यपालक अभियंता से सर्वेक्षण कर पुल निर्माण स्वीकृत करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },

  // ═══════════════════════════════════════════════════════════════════
  // RCD (ग्रामीण कार्य विभाग) — 3 types
  // ═══════════════════════════════════════════════════════════════════

  {
    office_type: 'rcd', name_hindi: 'ग्रामीण सड़क निर्माण आवेदन', name_english: 'Rural Road Construction Application',
    keywords: JSON.stringify(['ग्रामीण','rural','सड़क','road','निर्माण','RCD','गाँव']),
    required_fields: withBase(['village_road_location','construction_justification','connecting_villages','estimated_distance','population_served',G]),
    prompt_template: pa('rcd', 'ग्रामीण सड़क निर्माण आवेदन',
      'प्रस्तावित सड़क का स्थान और जुड़ने वाले गाँवों के नाम स्पष्ट रूप से बताएं। अनुमानित दूरी और लाभान्वित जनसंख्या का उल्लेख करें। सड़क की आवश्यकता का औचित्य (कृषि उपज परिवहन, स्कूल/अस्पताल पहुँच, आपातकालीन सेवाएं) बताएं। ग्राम सभा/पंचायत के प्रस्ताव का उल्लेख करें। कार्यपालक अभियंता से सर्वेक्षण एवं स्वीकृति का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'rcd', name_hindi: 'ग्रामीण सड़क मरम्मत शिकायत', name_english: 'Rural Road Repair Complaint',
    keywords: JSON.stringify(['मरम्मत','repair','ग्रामीण','rural','सड़क','टूटी','RCD']),
    required_fields: withBase(['village_road_location','damage_details','last_repair_date','traffic_impact',G]),
    prompt_template: p('rcd', 'ग्रामीण सड़क मरम्मत शिकायत',
      'क्षतिग्रस्त ग्रामीण सड़क का स्थान और क्षति का प्रकार (गड्ढे, कटाव, धंसाव, पानी भराव) का विस्तृत वर्णन करें। अंतिम बार कब मरम्मत हुई थी बताएं। यातायात और ग्रामीणों के जीवन पर पड़ने वाले दुष्प्रभाव बताएं। क्षति का निरीक्षण कर तत्काल मरम्मत कार्य प्रारंभ करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'rcd', name_hindi: 'पुलिया निर्माण आवेदन', name_english: 'Culvert Construction Application',
    keywords: JSON.stringify(['पुलिया','culvert','निर्माण','नाला','drain','RCD']),
    required_fields: withBase(['culvert_location','water_flow_details','justification','agricultural_impact',G]),
    prompt_template: pa('rcd', 'पुलिया निर्माण आवेदन',
      'पुलिया के प्रस्तावित स्थान का विवरण दें (गाँव, खेत/सड़क का नाम)। नाले/जल प्रवाह का आकार और बरसात में जल स्तर बताएं। पुलिया की आवश्यकता एवं औचित्य (कृषि यातायात, गाँव संपर्क, जल निकासी) बताएं। कृषि और स्थानीय अर्थव्यवस्था पर पड़ने वाले सकारात्मक प्रभाव का उल्लेख करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },

  // ═══════════════════════════════════════════════════════════════════
  // BCD (भवन निर्माण विभाग) — 3 types
  // ═══════════════════════════════════════════════════════════════════

  {
    office_type: 'bcd', name_hindi: 'सरकारी भवन निर्माण आवेदन', name_english: 'Government Building Construction Application',
    keywords: JSON.stringify(['भवन','building','निर्माण','construction','सरकारी','government','BCD']),
    required_fields: withBase(['building_purpose','location','land_availability','justification','estimated_cost',G]),
    prompt_template: pa('bcd', 'सरकारी भवन निर्माण आवेदन',
      'प्रस्तावित भवन का उद्देश्य (स्कूल, अस्पताल, पंचायत भवन, आंगनवाड़ी आदि) स्पष्ट रूप से बताएं। स्थान का विवरण और भूमि की उपलब्धता बताएं। भवन की आवश्यकता का औचित्य और स्थानीय समुदाय को होने वाले लाभ बताएं। अनुमानित लागत और स्वीकृत बजट (यदि कोई हो) का उल्लेख करें। कार्यपालक अभियंता से सर्वेक्षण एवं निर्माण स्वीकृत करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'bcd', name_hindi: 'भवन मरम्मत आवेदन', name_english: 'Building Repair Application',
    keywords: JSON.stringify(['मरम्मत','repair','भवन','building','जीर्णोद्धार','renovation']),
    required_fields: withBase(['building_name','location','damage_details','building_age','safety_concern',G]),
    prompt_template: pa('bcd', 'भवन मरम्मत आवेदन',
      'भवन का नाम/प्रकार, स्थान और उम्र (कब बना था) बताएं। क्षति/क्षरण का विस्तृत विवरण (दीवारों में दरारें, छत का रिसाव, प्लास्टर गिरना, फर्श की क्षति) दें। सुरक्षा चिंताओं और उपयोगकर्ताओं पर पड़ने वाले प्रभाव का उल्लेख करें। शीघ्र निरीक्षण कर मरम्मत/जीर्णोद्धार कार्य स्वीकृत करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
  {
    office_type: 'bcd', name_hindi: 'निर्माण कार्य शिकायत', name_english: 'Construction Work Complaint',
    keywords: JSON.stringify(['निर्माण','construction','शिकायत','complaint','गुणवत्ता','quality','BCD']),
    required_fields: withBase(['construction_site_location','project_name','complaint_details','quality_issues','contractor_name',G]),
    prompt_template: p('bcd', 'निर्माण कार्य शिकायत',
      'निर्माण स्थल का स्थान और परियोजना का नाम बताएं। शिकायत का विस्तृत विवरण दें: खराब गुणवत्ता, घटिया सामग्री, विलंब, मानकों का उल्लंघन, अनियमितता। ठेकेदार का नाम (यदि ज्ञात हो) बताएं। साक्ष्य और गवाहों का उल्लेख करें। कार्यपालक अभियंता से निरीक्षण कर दोषियों के विरुद्ध कार्रवाई एवं गुणवत्ता सुनिश्चित करने का अनुरोध करें।'),
    requires_legal_disclaimer: 0, disclaimer_text: null,
  },
];
