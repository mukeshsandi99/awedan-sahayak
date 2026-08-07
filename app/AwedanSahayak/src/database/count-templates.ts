import { APPLICATION_TYPE_SEEDS } from './seed';
import { NEW_TEMPLATES } from './seed-expansion';

const orig = APPLICATION_TYPE_SEEDS;
const exp = NEW_TEMPLATES;
const all = [...orig, ...exp];
console.log('Original:', orig.length);
console.log('Expansion:', exp.length);
console.log('Raw total:', all.length);

const seen = new Map<string, string[]>();
for (const t of all) {
  const k = t.office_type + '|' + t.name_hindi;
  if (!seen.has(k)) seen.set(k, []);
  seen.get(k)!.push(t.name_hindi);
}
const dupes = [...seen.entries()].filter(([, v]) => v.length > 1);
console.log('Hindi dupes:', dupes.length);
dupes.forEach(d => console.log('  DUPE:', d[0]));

const seenE = new Map<string, string[]>();
for (const t of all) {
  const k = t.office_type + '|' + (t.name_english || '').trim();
  if (!k.split('|')[1]) continue;
  if (!seenE.has(k)) seenE.set(k, []);
  seenE.get(k)!.push(t.name_english!);
}
const eDupes = [...seenE.entries()].filter(([, v]) => v.length > 1);
console.log('English dupes:', eDupes.length);
eDupes.forEach(d => console.log('  DUPE:', d[0]));

const driving = all.filter(t => t.name_hindi.includes('ड्राइविंग') || t.name_hindi.includes('ड्राइविंग'));
console.log('\nDriving licence templates:', driving.length);
driving.forEach(d => console.log('  ', d.office_type, d.name_hindi));

const phase9d = exp.filter(t => {
  const n = t.name_hindi;
  return n.includes('ड्राइविंग') || n.includes('फसल नुकसान मुआवजा') ||
    n.includes('फसल बीमा') || n.includes('जमीन पर अवैध') ||
    n.includes('गलत बिजली बिल') || n.includes('बिजली बिल भुगतान') ||
    n.includes('वृद्धावस्था') || n.includes('विधवा पेंशन') ||
    n.includes('पुलिस कार्रवाई RTI') || n.includes('दोषपूर्ण उत्पाद');
});
console.log('\nPhase 9D new additions:', phase9d.length);
phase9d.forEach(t => console.log('  ', t.office_type, t.name_hindi));
