const API='https://awedan-sahayak-api.onrender.com', T='awedan-sahayak-mobile-app-2026';
const F={applicationName:'T',officeType:'thana',promptTemplate:'T',formData:{applicant_name:'संतोष यादव',father_name:'मुंशी यादव',village:'होरिया',thana:'पदमा',district:'हजारीबाग',state:'झारखंड',mobile:'1234567890',accused_name:'रंजीत यादव, अनूप यादव, पोखन यादव, खिरोधर यादव, मोहन यादव, प्रेम यादव, नकुल यादव, अजय यादव',accused_father_name:'स्वर्गीय राजकुमार यादव, स्वर्गीय राजकुमार यादव, स्वर्गीय तिलक यादव, स्वर्गीय तिलक यादव, स्वर्गीय तिलक यादव, स्वर्गीय तिलक यादव, प्रेम यादव, सिविल यादव',accused_village:'नवादी',custom_description:'रंजीत यादव, अनूप यादव दोनों के पिता स्वर्गीय राजकुमार यादव। पोखन यादव, खिरोधर यादव, मोहन यादव, प्रेम यादव चारों के पिता स्वर्गीय तिलक यादव। नकुल यादव पिता प्रेम यादव। अजय यादव पिता सिविल यादव। सभी ग्राम नवादी, पोस्ट कुट्टी पीसी, थाना पदमा, जिला हजारीबाग, झारखंड के निवासी हैं। पूरे परिवार के साथ मारपीट, गाली-गलौज, पहले भी गाली-गलौज, लगातार धमकाते मारते-पीटते रहते हैं, दबंग किस्म के लोग।',khata_number:'96',plot_number:'1267',ownership:'मेरा हक हिस्सा का है'}};
const E=[['रंजीत यादव','राजकुमार यादव'],['अनूप यादव','राजकुमार यादव'],['पोखन यादव','तिलक यादव'],['खिरोधर यादव','तिलक यादव'],['मोहन यादव','तिलक यादव'],['प्रेम यादव','तिलक यादव'],['नकुल यादव','प्रेम यादव'],['अजय यादव','सिविल यादव']];
(async()=>{
let s=0,tx=0,p=0,f=0;
while(s<20){try{const d=await(await fetch(API+'/api/generate-application',{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':T},body:JSON.stringify(F)})).json();
if(!d?.generatedText||d.error){tx++;await new Promise(r=>setTimeout(r,3e3));continue}
const v=d.metadata._validation||{},re=v.relationshipErrors??-1,fc=v.forbiddenCritical??-1,cc=v.criticalFailuresCount??-1,vs=v.finalValidationStatus??'?',fb=d.metadata.fallbackUsed;
const tx2=d.generatedText,rm=E.filter(([n,fn])=>tx2.includes(n)&&tx2.includes(fn)).length;
const prop=tx2.includes('होरिया')&&tx2.includes('96')&&tx2.includes('1267')&&(tx2.includes('हक')||tx2.includes('हिस्सा'));
const ok=re===0&&fc===0&&cc===0&&vs==='PASS'&&rm===8&&prop;
s++;ok?p++:f++;
console.log('Run '+String(s).padStart(2)+': '+(ok?'✅':'❌')+' | rel='+rm+'/8 err='+re+' fc='+fc+' cc='+cc+' fb='+fb+' '+vs);
if(!ok){console.log('  FAIL: relMatch='+rm+'/8 prop='+prop+' textLen='+tx2.length);if(v.factDiff)console.log('  '+v.factDiff)}
if(s<20)await new Promise(r=>setTimeout(r,3e3))}catch(e){tx++;await new Promise(r=>setTimeout(r,5e3))}}
console.log('\n'+p+'/20 PASS | retries: '+tx);
console.log(p===20?'✅ 20/20 LIVE PASS':'❌ '+f+' FAILED');
})();
