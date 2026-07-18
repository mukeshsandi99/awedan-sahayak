/**
 * AI Service for generating formal Hindi legal applications.
 *
 * Supports multiple LLM providers via the AI_PROVIDER environment variable.
 * Both Claude and DeepSeek use the same @anthropic-ai/sdk client since
 * DeepSeek offers an Anthropic-compatible Messages API endpoint.
 *
 * PRIVACY: No Aadhar data is ever sent to the API. Only the sanitized
 * form fields required for application drafting are transmitted.
 *
 * Environment variables:
 *   AI_PROVIDER        — "claude" (default) or "deepseek"
 *   ANTHROPIC_API_KEY  — Required when AI_PROVIDER=claude
 *   DEEPSEEK_API_KEY   — Required when AI_PROVIDER=deepseek
 */

// ── Types ───────────────────────────────────────────────────────────

export interface ApplicationDraftRequest {
  /** The prompt template with {{placeholders}}. */
  promptTemplate: string;
  /** Key-value pairs for template interpolation. */
  formData: Record<string, string>;
  /** Office type (thana, block, bdo, co, sdo, sp, dc, court). */
  officeType: string;
  /** Hindi name of the application type. */
  applicationName: string;
}

export interface ApplicationDraftResponse {
  /** The generated formal application text in Hindi. */
  generatedText: string;
  /** Which provider served this request. */
  provider: string;
  /** Which model was used. */
  model: string;
  /** Token usage metadata (if available). */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

type AIProvider = 'claude' | 'deepseek';

// ── Provider configuration ──────────────────────────────────────────

interface ProviderConfig {
  provider: AIProvider;
  apiKey: string;
  baseURL: string | undefined;
  model: string;
}

/** Reads the AI_PROVIDER env var and returns the matching config. */
function getProviderConfig(): ProviderConfig {
  const raw = (process.env.AI_PROVIDER ?? 'claude').toLowerCase().trim();

  if (raw === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error(
        'DEEPSEEK_API_KEY environment variable is required when AI_PROVIDER=deepseek. ' +
        'Get a key at https://platform.deepseek.com/api_keys',
      );
    }
    return {
      provider: 'deepseek',
      apiKey,
      baseURL: 'https://api.deepseek.com/anthropic',
      model: 'deepseek-v4-flash',
    };
  }

  // Default: Claude
  if (raw !== 'claude') {
    console.warn(`[AIService] Unknown AI_PROVIDER "${raw}", falling back to "claude".`);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is required when AI_PROVIDER=claude. ' +
      'Get a key at https://console.anthropic.com/',
    );
  }
  return {
    provider: 'claude',
    apiKey,
    baseURL: undefined, // Uses the default Anthropic endpoint
    model: 'claude-sonnet-5-20251001',
  };
}

// ── Provider config singleton (lazily resolved) ─────────────────────

let _config: ProviderConfig | null = null;

/**
 * Returns the current provider configuration. Cached after first read.
 * Call getProviderConfig() directly to bypass the cache.
 */
export function getActiveConfig(): ProviderConfig {
  if (!_config) {
    _config = getProviderConfig();
    console.log('[AIService] Provider initialized:');
    console.log(`  Provider:  ${_config.provider}`);
    console.log(`  Model:     ${_config.model}`);
    console.log(`  Base URL:  ${_config.baseURL ?? '(default Anthropic)'}`);
    console.log(`  API Key:   ${_config.apiKey ? '***configured***' : 'MISSING'}`);
  }
  return _config;
}

/** Resets the cached config (useful for testing). */
export function resetProviderConfig(): void {
  _config = null;
}

// ── Designation map ─────────────────────────────────────────────────

const DESIGNATIONS: Record<string, string> = {
  thana: 'थाना प्रभारी/थानाध्यक्ष महोदय',
  block: 'तहसीलदार/ब्लॉक अधिकारी महोदय',
  bdo: 'खंड विकास अधिकारी महोदय',
  co: 'सर्किल अधिकारी/राजस्व अधिकारी महोदय',
  sdo: 'अनुविभागीय अधिकारी महोदय',
  sp: 'पुलिस अधीक्षक महोदय',
  dc: 'जिलाधिकारी/जिला दंडाधिकारी महोदय',
  court: 'माननीय न्यायाधीश महोदय',
  bank: 'शाखा प्रबंधक महोदय',
  college: 'प्राचार्य महोदय',
  school: 'प्रधानाध्यापक/प्राचार्य महोदय',
  pwd: 'कार्यपालक अभियंता महोदय',
  rcd: 'कार्यपालक अभियंता महोदय',
  bcd: 'कार्यपालक अभियंता महोदय',
  custom: 'संबंधित अधिकारी महोदय',
};

/** Jurisdictional unit label for each office type — used in header, body, and footer. */
const LOCATION_LABEL: Record<string, string> = {
  thana: 'थाना',
  block: 'तहसील',
  bdo: 'प्रखंड',
  co: 'अंचल',
  sdo: 'अनुविभाग',
  sp: 'थाना',
  dc: 'जिला',
  court: 'न्यायालय',
  bank: 'शाखा',
  college: 'संस्थान',
  school: 'विद्यालय',
  pwd: 'मंडल',
  rcd: 'मंडल',
  bcd: 'मंडल',
  custom: 'कार्यालय',
};

// ── System prompt builder ───────────────────────────────────────────

/**
 * Builds the full system prompt combining the style guide rules with
 * office-specific formatting instructions. Provider-agnostic — works
 * identically for Claude, DeepSeek, or any Anthropic-compatible API.
 */
export function buildSystemPrompt(officeType: string, applicationName: string): string {
  const designation = DESIGNATIONS[officeType] ?? 'संबंधित अधिकारी महोदय';
  const locLabel = LOCATION_LABEL[officeType] ?? 'थाना';

  return `आप एक अनुभवी सरकारी आवेदन पत्र लेखक (Government Application Draftsman) हैं। आपका कार्य भारतीय नागरिकों के लिए औपचारिक हिंदी में सरकारी कार्यालयों हेतु आवेदन पत्र (प्रार्थना पत्र) तैयार करना है।

## महत्वपूर्ण नियम (CRITICAL RULES)

आपको निम्नलिखित 7-भाग संरचना का सख्ती से पालन करना है। नीचे {{double_curly_braces}} में दिए गए प्रत्येक placeholder को आपको उपयोगकर्ता के फॉर्म डेटा से वास्तविक मानों से बदलना अनिवार्य है। कोई भी {{placeholder}} raw नहीं छोड़ना है। यदि कोई मान उपलब्ध न हो, तो "............." लिखें।

### भाग 1: हैडर (सेवा में)
सेवा में,
${designation},
${locLabel}–{{police_station_or_block}},
जिला–{{district}},
राज्य–{{state}}।

### भाग 2: विषय (Subject)
"विषय:" से प्रारंभ करें। एक पूर्ण वाक्य में समस्या और अनुरोधित कार्रवाई दोनों का सारांश दें। यह आवेदन के प्रकार के अनुरूप होना चाहिए।

### भाग 3: प्रारंभिक कथन
"महोदय," के बाद नई पंक्ति में लिखें:
"सविनय निवेदन है कि मैं {{name}}, {{parent_name}}, ग्राम–{{village}}, ${locLabel}–{{police_station}}, जिला–{{district}} की निवासी/का निवासी हूँ।"
निवासी (पुरुष) या निवासिन (महिला) का चयन आवेदक के लिंग के अनुसार करें।

### भाग 4: घटना विवरण (Narrative Body — सबसे महत्वपूर्ण)
- बुलेट पॉइंट या नंबर का उपयोग न करें
- पूर्ण वर्णनात्मक अनुच्छेद लिखें जो घटना का कालानुक्रमिक विवरण दे
- प्रत्येक व्यक्ति का पहली बार उल्लेख करते समय उसका पूरा नाम, पिता/पति का नाम और गाँव अवश्य लिखें
- तिथियाँ, समय और स्थान का उल्लेख कथा के भीतर स्वाभाविक रूप से करें
- "प्रार्थी", "उक्त", "अभियुक्तगण", "संलग्न" जैसे औपचारिक विधिक शब्दों का प्रयोग करें
- केवल प्रदान किए गए तथ्यों का वर्णन करें, कोई नई जानकारी न गढ़ें
- लगभग 200-400 शब्दों का एक प्रवाहमय अनुच्छेद लिखें

### भाग 5: समापन अनुरोध
"अतः श्रीमान/महोदय से सविनय/विनम्र निवेदन है कि..." से प्रारंभ करें। स्पष्ट, विशिष्ट और कार्रवाई योग्य अनुरोध करें। "की जाए", "किया जाए", "प्रदान किया जाए" जैसे औपचारिक क्रिया रूपों का प्रयोग करें।

### भाग 6: आभार
"इसके लिए मैं सदैव {{gender_gratitude_term}} रहूँगा/रहूँगी।"

### भाग 7: पाद लेख (Footer)
दिनांक: {{date}}
स्थान: {{place}}

                            {{valediction}},

                            {{applicant_name}}
                            {{parent_name}}
                            ग्राम–{{village}},
                            ${locLabel}–{{police_station}},
                            जिला–{{district}}
                            मोबाइल: {{applicant_phone}}

## लिंग-आधारित व्याकरण (Gender-Aware Grammar)

आवेदक के लिंग (पुरुष/महिला/अन्य) के अनुसार ये शब्द बदलें:
- पुरुष → निवासी, भवदीय, रहूँगा, था, आपका आभारी, मेरा
- महिला → निवासिन, भवदीया, रहूँगी, थी, आपकी आभारी, मेरी
- अन्य → प्रार्थी (लिंग-तटस्थ), निवासी, भवदीय, रहेगा

## नैरेटिव गुणवत्ता नियम

1. **संश्लेषण करें, सूची न बनाएं** — फॉर्म के अलग-अलग फील्ड से जानकारी लेकर एक प्रवाहमय कथा अनुच्छेद बनाएं
2. **पूर्ण पहचान** — प्रत्येक व्यक्ति का उल्लेख करते समय नाम + पिता/पति का नाम + गाँव दें
3. **औपचारिक विधिक शब्दावली** — प्रार्थी, उक्त, उपरोक्त, अभियुक्तगण, संलग्न, प्रेषित
4. **पूर्ण वाक्य** — कोई खंडित वाक्य या बुलेट पॉइंट नहीं
5. **सम्मानजनक स्वर** — प्राधिकार के प्रति सम्मान, तथ्यात्मक, उचित तात्कालिकता के साथ
6. **तथ्य न गढ़ें** — केवल प्रदान की गई जानकारी का वर्णन करें। कोई जानकारी उपलब्ध न हो तो उसे छोड़ दें, अनुमान न लगाएं
7. **आरोपी/विपक्षी की पूर्ण पहचान (ACCUSED IDENTIFICATION — अत्यंत महत्वपूर्ण)** — जब भी किसी आरोपी, अभियुक्त, विपक्षी, अतिक्रमणकर्ता, प्रत्यर्थी, या संदिग्ध का उल्लेख करें, उसका पूरा नाम, पिता/पति का नाम, और गाँव अवश्य लिखें। प्रारूप: "[नाम], पिता/पति [पिता/पति का नाम], ग्राम [गाँव], ${locLabel} {{police_station}}, जिला {{district}}"। उदाहरण: "रमेश कुमार, पिता सुरेश कुमार, ग्राम हटकोना, ${locLabel} कटकमसांडी, जिला हजारीबाग"। फॉर्म डेटा से आरोपी का नाम, पिता/पति का नाम और गाँव लें। ${locLabel} और जिला {{police_station}} और {{district}} placeholder का प्रयोग करें — ये स्वतः भरे जाएँगे।
8. **{{placeholders}} का सही प्रयोग** — भाग 1, 3, 6 और 7 में दिए गए सभी {{placeholders}} (जैसे {{office_name}}, {{district}}, {{name}}, {{date}} आदि) को अपने आउटपुट में ठीक वैसे ही शामिल करें जैसे वे लिखे हैं। इन्हें बदलें नहीं — ये स्वचालित रूप से सही मानों से बदल दिए जाएँगे। केवल नैरेटिव (भाग 4) और समापन अनुरोध (भाग 5) में फॉर्म डेटा से वास्तविक जानकारी भरें।

## आवेदन का प्रकार
यह आवेदन "${applicationName}" प्रकार का है। कार्यालय प्रकार: ${officeType}।
संबोधन हेतु उपयुक्त पदनाम: ${designation}।

कोई मार्कडाउन फॉर्मेटिंग (जैसे ** या __) का उपयोग न करें, केवल सादा टेक्स्ट में उत्तर दें।

उपरोक्त सभी नियमों का पालन करते हुए, नीचे दिए गए फॉर्म डेटा के आधार पर एक संपूर्ण, औपचारिक, हिंदी आवेदन पत्र तैयार करें। केवल आवेदन पत्र का पाठ दें, कोई अन्य टिप्पणी या व्याख्या नहीं।`;
}

/**
 * Builds a dynamic system prompt for the custom/blank application mode.
 * Unlike buildSystemPrompt(), the designation and location label come
 * from user-provided free text rather than predefined office-type maps.
 *
 * @param officeName            Free-text office name, e.g. "जिला कल्याण पदाधिकारी"
 * @param recipientDesignation  Optional free-text designation, e.g. "महोदय"
 */
export function buildCustomSystemPrompt(
  officeName: string,
  recipientDesignation?: string | null,
): string {
  const designation = recipientDesignation?.trim()
    ? `${recipientDesignation.trim()} महोदय`
    : 'संबंधित अधिकारी महोदय';

  const officeForHeader = officeName.trim();

  return `आप एक अनुभवी सरकारी आवेदन पत्र लेखक (Government Application Draftsman) हैं। आपका कार्य भारतीय नागरिकों के लिए औपचारिक हिंदी में किसी भी सरकारी कार्यालय हेतु आवेदन पत्र (प्रार्थना पत्र) तैयार करना है।

## महत्वपूर्ण नियम (CRITICAL RULES)

आपको निम्नलिखित 7-भाग संरचना का सख्ती से पालन करना है। नीचे {{double_curly_braces}} में दिए गए प्रत्येक placeholder को आपको उपयोगकर्ता के फॉर्म डेटा से वास्तविक मानों से बदलना अनिवार्य है। कोई भी {{placeholder}} raw नहीं छोड़ना है। यदि कोई मान उपलब्ध न हो, तो "............." लिखें।

### भाग 1: हैडर (सेवा में)
सेवा में,
${designation},
${officeForHeader},
जिला–{{district}},
राज्य–{{state}}।

### भाग 2: विषय (Subject)
"विषय:" से प्रारंभ करें। उपयोगकर्ता द्वारा बताई गई समस्या और अनुरोधित कार्रवाई दोनों का एक पूर्ण वाक्य में सारांश दें।

### भाग 3: प्रारंभिक कथन
"महोदय," के बाद नई पंक्ति में लिखें:
"सविनय निवेदन है कि मैं {{name}}, {{parent_name}}, ग्राम–{{village}}, कार्यालय–{{police_station_or_block}}, जिला–{{district}} की निवासी/का निवासी हूँ।"
निवासी (पुरुष) या निवासिन (महिला) का चयन आवेदक के लिंग के अनुसार करें।

### भाग 4: घटना विवरण (Narrative Body — सबसे महत्वपूर्ण)
- बुलेट पॉइंट या नंबर का उपयोग न करें
- पूर्ण वर्णनात्मक अनुच्छेद लिखें जो उपयोगकर्ता द्वारा बताई गई समस्या का कालानुक्रमिक विवरण दे
- प्रत्येक व्यक्ति का पहली बार उल्लेख करते समय उसका पूरा नाम, पिता/पति का नाम और गाँव अवश्य लिखें
- तिथियाँ, समय और स्थान का उल्लेख कथा के भीतर स्वाभाविक रूप से करें
- "प्रार्थी", "उक्त", "अभियुक्तगण", "संलग्न" जैसे औपचारिक विधिक शब्दों का प्रयोग करें
- केवल प्रदान किए गए तथ्यों का वर्णन करें, कोई नई जानकारी न गढ़ें
- लगभग 200-400 शब्दों का एक प्रवाहमय अनुच्छेद लिखें
- **महत्वपूर्ण**: उपयोगकर्ता ने "custom_description" फील्ड में अपनी पूरी समस्या/अनुरोध अपने शब्दों में लिखा है। उपयोगकर्ता ने बातचीत के अंदाज में या अव्यवस्थित तरीके से जानकारी दी हो सकती है — आपको उसे एक सुसंगत, औपचारिक, कालानुक्रमिक नैरेटिव में व्यवस्थित करना है। कोई नई जानकारी न गढ़ें, केवल दी गई जानकारी का पुनर्गठन करें।

### भाग 5: समापन अनुरोध
"अतः श्रीमान/महोदय से सविनय/विनम्र निवेदन है कि..." से प्रारंभ करें। स्पष्ट, विशिष्ट और कार्रवाई योग्य अनुरोध करें। "की जाए", "किया जाए", "प्रदान किया जाए" जैसे औपचारिक क्रिया रूपों का प्रयोग करें। अनुरोध उपयोगकर्ता द्वारा बताई गई समस्या के अनुरूप होना चाहिए।

### भाग 6: आभार
"इसके लिए मैं सदैव {{gender_gratitude_term}} रहूँगा/रहूँगी।"

### भाग 7: पाद लेख (Footer)
दिनांक: {{date}}
स्थान: {{place}}

                            {{valediction}},

                            {{applicant_name}}
                            {{parent_name}}
                            ग्राम–{{village}},
                            कार्यालय–{{police_station_or_block}},
                            जिला–{{district}}
                            मोबाइल: {{applicant_phone}}

## लिंग-आधारित व्याकरण (Gender-Aware Grammar)

आवेदक के लिंग (पुरुष/महिला/अन्य) के अनुसार ये शब्द बदलें:
- पुरुष → निवासी, भवदीय, रहूँगा, था, आपका आभारी, मेरा
- महिला → निवासिन, भवदीया, रहूँगी, थी, आपकी आभारी, मेरी
- अन्य → प्रार्थी (लिंग-तटस्थ), निवासी, भवदीय, रहेगा

## नैरेटिव गुणवत्ता नियम

1. **संश्लेषण करें, सूची न बनाएं** — फॉर्म के अलग-अलग फील्ड से जानकारी लेकर एक प्रवाहमय कथा अनुच्छेद बनाएं
2. **पूर्ण पहचान** — प्रत्येक व्यक्ति का उल्लेख करते समय नाम + पिता/पति का नाम + गाँव दें
3. **औपचारिक विधिक शब्दावली** — प्रार्थी, उक्त, उपरोक्त, अभियुक्तगण, संलग्न, प्रेषित
4. **पूर्ण वाक्य** — कोई खंडित वाक्य या बुलेट पॉइंट नहीं
5. **सम्मानजनक स्वर** — प्राधिकार के प्रति सम्मान, तथ्यात्मक, उचित तात्कालिकता के साथ
6. **तथ्य न गढ़ें** — केवल प्रदान की गई जानकारी का वर्णन करें। कोई जानकारी उपलब्ध न हो तो उसे छोड़ दें, अनुमान न लगाएं
7. **{{placeholders}} का सही प्रयोग** — भाग 1, 3, 6 और 7 में दिए गए सभी {{placeholders}} को अपने आउटपुट में ठीक वैसे ही शामिल करें जैसे वे लिखे हैं। इन्हें बदलें नहीं — ये स्वचालित रूप से सही मानों से बदल दिए जाएँगे।

## कार्यालय की जानकारी
यह आवेदन "${officeName}" कार्यालय के लिए है।
संबोधन हेतु उपयुक्त पदनाम: ${designation}।

कोई मार्कडाउन फॉर्मेटिंग (जैसे ** या __) का उपयोग न करें, केवल सादा टेक्स्ट में उत्तर दें।

उपरोक्त सभी नियमों का पालन करते हुए, नीचे दिए गए फॉर्म डेटा के आधार पर एक संपूर्ण, औपचारिक, हिंदी आवेदन पत्र तैयार करें। केवल आवेदन पत्र का पाठ दें, कोई अन्य टिप्पणी या व्याख्या नहीं।`;
}

// ── Template interpolation ──────────────────────────────────────────

/**
 * Replaces {{placeholders}} in the prompt template with actual
 * form data values. Missing values keep their placeholder visible
 * so the model knows the field was expected but not provided.
 */
export function interpolateTemplate(
  template: string,
  formData: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = formData[key];
    if (value && value.trim().length > 0) return value.trim();
    return `({{${key}}})`;
  });
}

// ── Field name aliases ──────────────────────────────────────────────

/**
 * Maps placeholder names used in the system prompt to actual form field
 * keys. The system prompt uses some generic names like {{name}}, {{village}}
 * while the app's form data uses specific keys like applicant_name, village.
 *
 * When a placeholder doesn't match any form field directly, these aliases
 * provide fallback lookups.
 */
const FIELD_ALIASES: Record<string, string[]> = {
  name: ['applicant_name', 'deponent_name', 'petitioner_name', 'missing_person_name', 'child_name'],
  parent_name: ['parent_spouse_name', 'father_name', 'father_husband_name', 'deponent_father_name'],
  parent_type: ['relation_to_missing', 'relation_to_deceased'],
  village: ['village', 'village_panchayat'],
  police_station: ['police_station_name', 'thana_name', 'thana', 'location'],
  police_station_or_block: ['police_station_name', 'thana_name', 'thana', 'block', 'location'],
  district: ['district'],
  state: ['state'],
  applicant_phone: ['applicant_phone', 'phone', 'mobile'],
  applicant_address: ['applicant_address', 'address', 'deponent_address'],
  // Accused/opposing party field variants (all map to the same {{placeholders}})
  accused_name: ['accused_name', 'accused_names', 'opposing_party', 'opposing_party_name', 'encroacher_name', 'respondent_name'],
  accused_father_name: ['accused_father_name', 'accused_father', 'encroacher_father_name', 'opposing_party_father_name', 'respondent_father_name'],
  accused_village: ['accused_village', 'encroacher_village', 'opposing_party_village', 'respondent_village'],
  office_name: [], // filled from officeType mapping below
  date: [],         // auto-generated
  place: [],        // derived from district + village
  gender: [],       // derived from form context
  gender_gratitude_term: [], // derived
  valediction: [],  // derived from gender
};

/**
 * Resolves a placeholder key to its actual value from form data,
 * checking the key directly first, then trying all aliases.
 */
function resolveFieldValue(key: string, formData: Record<string, string>): string | null {
  // Direct match
  if (formData[key] && formData[key].trim().length > 0) {
    return formData[key].trim();
  }

  // Try aliases
  const aliases = FIELD_ALIASES[key];
  if (aliases) {
    for (const alias of aliases) {
      if (formData[alias] && formData[alias].trim().length > 0) {
        return formData[alias].trim();
      }
    }
  }

  return null;
}

// ── Office name mapping ─────────────────────────────────────────────

const OFFICE_NAMES: Record<string, string> = {
  thana: 'थाना प्रभारी/थानाध्यक्ष',
  block: 'तहसीलदार/ब्लॉक अधिकारी',
  bdo: 'खंड विकास अधिकारी',
  co: 'सर्किल अधिकारी/राजस्व अधिकारी',
  sdo: 'अनुविभागीय अधिकारी',
  sp: 'पुलिस अधीक्षक',
  dc: 'जिलाधिकारी/जिला दंडाधिकारी',
  court: 'माननीय न्यायाधीश',
  custom: 'उपयोगकर्ता द्वारा निर्दिष्ट कार्यालय',
};

// ── Post-generation interpolation ───────────────────────────────────

/**
 * After the AI generates the application text, this function fills in
 * any remaining {{placeholders}} that the AI left unreplaced.
 *
 * The AI's system prompt contains template placeholders like
 * {{office_name}}, {{district}}, {{applicant_name}}, etc.
 * The AI is expected to fill them, but often leaves them as-is —
 * especially for fields it has no data for (derived fields like date,
 * place, gender-based terms) or fields with naming mismatches.
 *
 * This function:
 * 1. Resolves field values from formData with alias support
 * 2. Fills derived fields (date, place, gender-based terms, office_name)
 * 3. Reports any placeholders that still couldn't be resolved
 */
function postInterpolate(
  generatedText: string,
  formData: Record<string, string>,
  officeType: string,
): { text: string; unresolved: string[] } {
  const unresolved: string[] = [];

  const text = generatedText.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    // Try to resolve from form data (with aliases)
    const value = resolveFieldValue(key, formData);
    if (value) return value;

    // Derived fields
    if (key === 'office_name' || key === 'office_name_hindi') {
      return OFFICE_NAMES[officeType] ?? 'संबंधित अधिकारी';
    }
    if (key === 'date') {
      // Today's date in Hindi format: "05 जुलाई 2026"
      const now = new Date();
      const hindiMonths = [
        'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
        'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर',
      ];
      return `${now.getDate().toString().padStart(2, '0')} ${hindiMonths[now.getMonth()]} ${now.getFullYear()}`;
    }
    if (key === 'place') {
      const district = resolveFieldValue('district', formData);
      const village = resolveFieldValue('village', formData);
      if (village && district) return `${village}, ${district}`;
      if (district) return district;
      if (village) return village;
      return 'ग्राम/जिला';
    }
    if (key === 'gender' || key === 'gender_gratitude_term' || key === 'valediction') {
      // Try to infer gender from form data
      const gender = resolveFieldValue('gender', formData)?.toLowerCase() ?? '';
      const isFemale = gender === 'female' || gender === 'महिला' || gender === 'स्त्री';
      if (key === 'gender') return isFemale ? 'स्त्री' : 'पुरुष';
      if (key === 'gender_gratitude_term') return isFemale ? 'आपकी आभारी' : 'आपका आभारी';
      if (key === 'valediction') return isFemale ? 'भवदीया' : 'भवदीय';
    }

    // Not resolved — log for debugging
    unresolved.push(key);
    return `({{${key}}})`;
  });

  return { text, unresolved };
}

/**
 * Validates that no unreplaced {{placeholders}} remain in the final output.
 * Logs a warning for each unresolved placeholder so the root cause
 * (missing form field, naming mismatch) can be diagnosed.
 */
export function validateNoPlaceholders(generatedText: string): string[] {
  const matches = generatedText.match(/\{\{(\w+)\}\}/g);
  if (matches && matches.length > 0) {
    const unique = [...new Set(matches)];
    console.warn(`[AIService] ⚠️ ${unique.length} unresolved placeholder(s) in final output:`);
    unique.forEach((p) => console.warn(`  - ${p}`));
    return unique;
  }
  console.log('[AIService] ✅ All placeholders resolved.');
  return [];
}

// ── AI API call ─────────────────────────────────────────────────────

/**
 * Sends the application drafting request to the configured AI provider.
 *
 * Uses the @anthropic-ai/sdk client for both Claude and DeepSeek
 * (DeepSeek provides an Anthropic-compatible Messages API at
 * https://api.deepseek.com/anthropic).
 *
 * Before using:
 * 1. npm install @anthropic-ai/sdk
 * 2. Set AI_PROVIDER, ANTHROPIC_API_KEY, and/or DEEPSEEK_API_KEY
 *
 * @throws If the required API key is missing or the API call fails.
 */
export async function draftApplication(
  request: ApplicationDraftRequest,
): Promise<ApplicationDraftResponse> {
  const { promptTemplate, formData, officeType, applicationName } = request;
  const config = getActiveConfig();

  const systemPrompt = buildSystemPrompt(officeType, applicationName);

  // Build the user message: interpolate the template, then append ALL
  // form data fields so the AI can see every value — especially the
  // base identity fields (village, thana, district, etc.) that may not
  // have explicit {{placeholders}} in the prompt_template.
  const interpolated = interpolateTemplate(promptTemplate, formData);

  // Append a complete "प्रार्थी की जानकारी" (Applicant Info) section
  // with every form field, keyed by their Hindi labels for the AI.
  const applicantInfoLines: string[] = [];
  for (const [key, value] of Object.entries(formData)) {
    if (value && value.trim().length > 0) {
      applicantInfoLines.push(`${key}: ${value.trim()}`);
    }
  }
  const applicantInfoBlock = applicantInfoLines.length > 0
    ? `\n\n─── प्रार्थी की संपूर्ण जानकारी (Applicant's Complete Information) ───\n${applicantInfoLines.join('\n')}`
    : '';

  const userMessage = interpolated + applicantInfoBlock;

  console.log(`[AIService] Drafting with ${config.provider} (${config.model})...`);
  console.log(`[AIService] System prompt: ${systemPrompt.length} chars`);
  console.log(`[AIService] Form fields received (${Object.keys(formData).length}):`, Object.keys(formData).join(', '));
  console.log(`[AIService] Form data values:`, JSON.stringify(formData, null, 2));
  console.log(`[AIService] User message total: ${userMessage.length} chars`);
  console.log(`[AIService] User preview:  ${userMessage.substring(0, 300)}...`);

  // Dynamically import the Anthropic SDK (avoids crash if not installed)
  let Anthropic: any;
  try {
    const sdk = await import('@anthropic-ai/sdk');
    Anthropic = sdk.default ?? sdk.Anthropic;
  } catch {
    throw new Error(
      '@anthropic-ai/sdk is not installed. Run: npm install @anthropic-ai/sdk',
    );
  }

  const client = new Anthropic({
    apiKey: config.apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  });

  try {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    let text: string;
    if (typeof response.content === 'string') {
      text = response.content;
    } else if (Array.isArray(response.content)) {
      text = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
    } else {
      text = '';
    }

    // Safety net: strip any residual markdown bold/italic markers
    text = text.replace(/\*\*/g, '').replace(/__/g, '');

    console.log(`[AIService] AI generated ${text.length} chars.`);

    // ── Post-generation interpolation ────────────────────────────
    // The AI's system prompt contains template placeholders like
    // {{office_name}}, {{district}}, {{applicant_name}}, etc.
    // The AI may leave these as-is — we fill them here from formData.
    const postResult = postInterpolate(text, formData, officeType);
    text = postResult.text;

    if (postResult.unresolved.length > 0) {
      console.warn(
        `[AIService] ⚠️ ${postResult.unresolved.length} placeholder(s) could not be resolved:`,
        postResult.unresolved,
      );
      console.warn('[AIService] These fields are missing from the form data. Check FIELD_ALIASES if they should map to existing form keys.');
    }

    // ── Final validation ─────────────────────────────────────────
    const remaining = validateNoPlaceholders(text);
    if (remaining.length > 0) {
      console.warn(
        '[AIService] ⚠️ Final output still contains unresolved placeholders.',
        'This may indicate missing form fields or a naming mismatch.',
      );
    }

    console.log(`[AIService] Final output: ${text.length} chars.`);

    return {
      generatedText: text,
      provider: config.provider,
      model: config.model,
      usage: response.usage ? {
        inputTokens: response.usage.input_tokens ?? 0,
        outputTokens: response.usage.output_tokens ?? 0,
      } : undefined,
    };
  } catch (err: any) {
    const status = err?.status ?? 'unknown';
    const message = err?.error?.message ?? err?.message ?? String(err);
    console.error(`[AIService] API error (${status}): ${message}`);
    throw new Error(
      `AI provider error (${config.provider}, HTTP ${status}): ${message}`,
    );
  }
}

// ── Custom application drafting ─────────────────────────────────────────

export interface CustomApplicationDraftRequest {
  /** Free-text office name (e.g. "जिला कल्याण पदाधिकारी"). */
  officeName: string;
  /** Optional free-text recipient designation. */
  recipientDesignation?: string | null;
  /** Key-value form data (identity fields + custom_description). */
  formData: Record<string, string>;
}

/**
 * Drafts a custom/blank application using a dynamically-built system prompt.
 * Takes user-provided office name and designation instead of looking them up
 * from predefined office-type maps. Still applies the full 7-part structure
 * and gender-aware grammar.
 */
export async function draftCustomApplication(
  request: CustomApplicationDraftRequest,
): Promise<ApplicationDraftResponse> {
  const { officeName, recipientDesignation, formData } = request;
  const config = getActiveConfig();

  const systemPrompt = buildCustomSystemPrompt(officeName, recipientDesignation ?? null);

  // Build user message: append ALL form data so the AI can see every value
  const applicantInfoLines: string[] = [];
  for (const [key, value] of Object.entries(formData)) {
    if (value && value.trim().length > 0) {
      applicantInfoLines.push(`${key}: ${value.trim()}`);
    }
  }
  const applicantInfoBlock = applicantInfoLines.length > 0
    ? `\n\n─── प्रार्थी की संपूर्ण जानकारी (Applicant's Complete Information) ───\n${applicantInfoLines.join('\n')}`
    : '';

  const userMessage = `कृपया निम्नलिखित जानकारी के आधार पर एक औपचारिक हिंदी आवेदन पत्र तैयार करें:\n\nनोट: "custom_description" फील्ड में उपयोगकर्ता ने अपनी पूरी समस्या/अनुरोध अपने शब्दों में लिखा है। इसी के आधार पर नैरेटिव (भाग 4) और समापन अनुरोध (भाग 5) तैयार करें।${applicantInfoBlock}`;

  console.log(`[AIService] Drafting custom application with ${config.provider} (${config.model})...`);
  console.log(`[AIService] Office: ${officeName}, Designation: ${recipientDesignation ?? '(not provided)'}`);
  console.log(`[AIService] Custom system prompt: ${systemPrompt.length} chars`);
  console.log(`[AIService] User message: ${userMessage.length} chars`);

  // Dynamically import the Anthropic SDK
  let Anthropic: any;
  try {
    const sdk = await import('@anthropic-ai/sdk');
    Anthropic = sdk.default ?? sdk.Anthropic;
  } catch {
    throw new Error(
      '@anthropic-ai/sdk is not installed. Run: npm install @anthropic-ai/sdk',
    );
  }

  const client = new Anthropic({
    apiKey: config.apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  });

  try {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    let text: string;
    if (typeof response.content === 'string') {
      text = response.content;
    } else if (Array.isArray(response.content)) {
      text = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
    } else {
      text = '';
    }

    // Safety net: strip any residual markdown bold/italic markers
    text = text.replace(/\*\*/g, '').replace(/__/g, '');

    console.log(`[AIService] Custom AI generated ${text.length} chars.`);

    // Post-generation interpolation using 'custom' office type
    const postResult = postInterpolate(text, formData, 'custom');
    text = postResult.text;

    if (postResult.unresolved.length > 0) {
      console.warn(
        `[AIService] ⚠️ ${postResult.unresolved.length} placeholder(s) unresolved in custom output:`,
        postResult.unresolved,
      );
    }

    const remaining = validateNoPlaceholders(text);
    if (remaining.length > 0) {
      console.warn(
        '[AIService] ⚠️ Final custom output still contains unresolved placeholders.',
      );
    }

    console.log(`[AIService] Final custom output: ${text.length} chars.`);

    return {
      generatedText: text,
      provider: config.provider,
      model: config.model,
      usage: response.usage ? {
        inputTokens: response.usage.input_tokens ?? 0,
        outputTokens: response.usage.output_tokens ?? 0,
      } : undefined,
    };
  } catch (err: any) {
    const status = err?.status ?? 'unknown';
    const message = err?.error?.message ?? err?.message ?? String(err);
    console.error(`[AIService] Custom API error (${status}): ${message}`);
    throw new Error(
      `AI provider error (${config.provider}, HTTP ${status}): ${message}`,
    );
  }
}
