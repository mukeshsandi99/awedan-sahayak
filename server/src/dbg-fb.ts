import { extractProtectedFacts } from './services/ai/ProtectedFacts';
import { validateRelationships } from './services/ai/RelationshipValidator';
import { generateFallbackApplication } from './services/ai/FallbackGenerator';

const fd: Record<string,string> = {
  applicant_name: 'संतोष यादव', father_name: 'मुंशी यादव', village: 'होरिया',
  thana: 'पदमा', district: 'हजारीबाग', state: 'झारखंड', mobile: '1234567890',
  accused_name: 'रंजीत यादव, अनूप यादव, पोखन यादव, खिरोधर यादव, मोहन यादव, प्रेम यादव, नकुल यादव, अजय यादव',
  accused_father_name: 'स्वर्गीय राजकुमार यादव, स्वर्गीय राजकुमार यादव, स्वर्गीय तिलक यादव, स्वर्गीय तिलक यादव, स्वर्गीय तिलक यादव, स्वर्गीय तिलक यादव, प्रेम यादव, सिविल यादव',
  accused_village: 'नवादी',
  custom_description: 'रंजीत यादव, अनूप यादव दोनों के पिता स्वर्गीय राजकुमार यादव। पोखन यादव, खिरोधर यादव, मोहन यादव, प्रेम यादव चारों के पिता स्वर्गीय तिलक यादव। नकुल यादव पिता प्रेम यादव। अजय यादव पिता सिविल यादव। सभी ग्राम नवादी, पोस्ट कुट्टी पीसी, थाना पदमा, जिला हजारीबाग, झारखंड के निवासी हैं। पूरे परिवार के साथ मारपीट, गाली-गलौज, पहले भी गाली-गलौज, लगातार धमकाते मारते-पीटते रहते हैं, दबंग किस्म के लोग।',
  khata_number: '96', plot_number: '1267', ownership: 'मेरा हक हिस्सा का है',
};

const facts = extractProtectedFacts(fd);
const fb = generateFallbackApplication({
  facts, officeType: 'thana',
  applicationName: 'T',
  userDescription: fd.custom_description,
});

console.log('FB length:', fb.length);
const result = validateRelationships(facts, fb);
console.log('Errors:', result.errors.length);
for (const e of result.errors) {
  console.log('  [' + e.type + ']', e.person, ':', e.detail?.substring(0, 120));
}
