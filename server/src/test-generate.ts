/**
 * Quick test script: generates a मारपीट की शिकायत application
 * using the configured AI provider and prints the result.
 *
 * Run: npx tsx src/test-generate.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { draftApplication } from './services/aiService';

const SAMPLE_FORM_DATA: Record<string, string> = {
  applicant_name: 'सीमा देवी',
  father_husband_name: 'राम प्रसाद',
  village: 'हटकोना',
  post: 'हटकोना',
  thana: 'कटकमसांडी',
  district: 'हजारीबाग',
  state: 'झारखंड',
  incident_date: '04 जुलाई 2026',
  incident_time: 'रात लगभग 9 बजे',
  incident_details:
    'कल रात लगभग 9 बजे, जब आवेदिका अपने घर में थी, तभी पड़ोस में रहने वाला रमेश कुमार पिता सुरेश कुमार, ग्राम हटकोना, थाना कटकमसांडी, जिला हजारीबाग आया और बिना किसी कारण के गाली-गलौज करने लगा। जब आवेदिका ने विरोध किया तो रमेश कुमार ने लाठी से आवेदिका के सिर और बाएँ हाथ पर वार किया, जिससे गंभीर चोट आई।',
  accused_names: 'रमेश कुमार पिता सुरेश कुमार, ग्राम हटकोना',
  injury_details: 'सिर में चोट, बाएँ हाथ में सूजन और खरोंच',
  weapons_used: 'लाठी',
  medical_report: 'सामुदायिक स्वास्थ्य केंद्र कटकमसांडी से उपचार कराया गया, मेडिकल रिपोर्ट संलग्न',
  witnesses: 'गाँव के ही रहने वाले सुनील कुमार पिता महेश कुमार एवं किरण देवी पति राजेश कुमार घटना के समय उपस्थित थे',
  gender: 'female',
  location: 'ग्राम हटकोना, आवेदिका का निजी आवास',
};

const PROMPT_TEMPLATE = `आवेदन प्रकार: मारपीट की शिकायत (thana कार्यालय)

महत्वपूर्ण निर्देश:
यह एक मारपीट (Assault) की शिकायत है। नीचे दिए गए सभी तथ्यों को एक प्रवाहमय कालानुक्रमिक नैरेटिव अनुच्छेद में ढालें। बुलेट पॉइंट न बनाएं।

घटना का वर्णन करते समय:
- आरोपी कब, कहाँ और कैसे आया
- क्या शब्द कहे गए (गाली-गलौज का उल्लेख)
- मारपीट कैसे शुरू हुई और किस हथियार से हुई
- कहाँ-कहाँ चोट आई
- किन गवाहों ने देखा
- चिकित्सीय उपचार कहाँ कराया गया

सिस्टम प्रॉम्प्ट में वर्णित 7-भाग संरचना का सख्ती से पालन करें।
आवेदिका महिला है, इसलिए निवासिन, भवदीया, रहूँगी, आपकी आभारी आदि स्त्रीलिंग रूपों का प्रयोग करें।

प्रार्थना: आरोपी के विरुद्ध प्राथमिकी दर्ज कर विधिक कार्रवाई की जाए।

——— नीचे दिए गए फॉर्म डेटा का ही प्रयोग करें, कोई अन्य नाम/स्थान न बनाएं ———

{{applicant_name}}
{{father_husband_name}}
{{village}}
{{thana}}
{{district}}
{{incident_date}}
{{incident_time}}
{{incident_details}}
{{accused_names}}
{{injury_details}}
{{weapons_used}}
{{medical_report}}
{{witnesses}}
{{gender}}`;

async function main() {
  console.log('Generating application...\n');

  try {
    const result = await draftApplication({
      applicationName: 'मारपीट की शिकायत',
      officeType: 'thana',
      promptTemplate: PROMPT_TEMPLATE,
      formData: SAMPLE_FORM_DATA,
    });

    console.log('═══════════════════════════════════════════');
    console.log('        GENERATED APPLICATION TEXT');
    console.log('═══════════════════════════════════════════\n');
    console.log(result.generatedText);
    console.log('\n═══════════════════════════════════════════');
    console.log(`Provider: ${result.provider} | Model: ${result.model}`);
    if (result.usage) {
      console.log(`Tokens: ${result.usage.inputTokens} in / ${result.usage.outputTokens} out`);
    }
    console.log('═══════════════════════════════════════════');
  } catch (err: any) {
    console.error('FAILED:', err.message);
    process.exit(1);
  }
}

main();
