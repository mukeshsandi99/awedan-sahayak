/**
 * Icon asset generator for Awedan Sahayak (CommonJS).
 * Run: node scripts/generate-icons.cjs
 */

var fs = require('fs');
var path = require('path');

var sharp;
try { sharp = require('../server/node_modules/sharp'); } catch (e) {
  try { sharp = require('sharp'); } catch (e2) {
    console.error('sharp is not installed.');
    process.exit(1);
  }
}

var assetsDir = path.join(__dirname, '..', 'app', 'AwedanSahayak', 'assets');
var A = '#E17055';
var W = '#FFFFFF';

var fg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">' +
  '<rect x="22" y="16" width="62" height="74" rx="5" fill="' + W + '"/>' +
  '<rect x="32" y="34" width="34" height="4" rx="2" fill="' + A + '" opacity="0.55"/>' +
  '<rect x="32" y="44" width="44" height="3" rx="1.5" fill="' + A + '" opacity="0.35"/>' +
  '<rect x="32" y="52" width="38" height="3" rx="1.5" fill="' + A + '" opacity="0.3"/>' +
  '<rect x="32" y="60" width="42" height="3" rx="1.5" fill="' + A + '" opacity="0.25"/>' +
  '<rect x="32" y="68" width="32" height="3" rx="1.5" fill="' + A + '" opacity="0.2"/>' +
  '<rect x="32" y="76" width="36" height="3" rx="1.5" fill="' + A + '" opacity="0.18"/>' +
  '<g transform="rotate(-38, 80, 36)">' +
  '<rect x="74" y="16" width="7" height="44" rx="3.5" fill="' + W + '" stroke="' + A + '" stroke-width="1.5"/>' +
  '<polygon points="74,60 81,60 77.5,72" fill="' + A + '"/>' +
  '<rect x="76" y="20" width="3" height="36" rx="1.5" fill="' + A + '" opacity="0.4"/>' +
  '</g></svg>';

var bg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">' +
  '<rect width="108" height="108" rx="24" fill="' + A + '"/>' +
  '<circle cx="54" cy="54" r="48" fill="none" stroke="' + W + '" stroke-width="0.8" opacity="0.08"/>' +
  '<circle cx="54" cy="54" r="38" fill="none" stroke="' + W + '" stroke-width="0.6" opacity="0.06"/>' +
  '</svg>';

var mono = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">' +
  '<rect x="22" y="16" width="62" height="74" rx="5" fill="' + W + '"/>' +
  '<rect x="32" y="34" width="34" height="4" rx="2" fill="' + A + '" opacity="0.7"/>' +
  '<rect x="32" y="44" width="44" height="3" rx="1.5" fill="' + A + '" opacity="0.5"/>' +
  '<rect x="32" y="52" width="38" height="3" rx="1.5" fill="' + A + '" opacity="0.45"/>' +
  '<rect x="32" y="60" width="42" height="3" rx="1.5" fill="' + A + '" opacity="0.4"/>' +
  '<rect x="32" y="68" width="32" height="3" rx="1.5" fill="' + A + '" opacity="0.35"/>' +
  '<rect x="32" y="76" width="36" height="3" rx="1.5" fill="' + A + '" opacity="0.3"/>' +
  '<g transform="rotate(-38, 80, 36)">' +
  '<rect x="74" y="16" width="7" height="44" rx="3.5" fill="' + W + '" stroke="' + A + '" stroke-width="1.5"/>' +
  '<polygon points="74,60 81,60 77.5,72" fill="' + A + '"/>' +
  '</g></svg>';

var splash = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 288 288">' +
  '<rect width="288" height="288" rx="16" fill="#FFF8F0"/>' +
  '<g transform="translate(56, 24)">' +
  '<rect x="22" y="16" width="130" height="150" rx="10" fill="' + W + '" stroke="' + A + '" stroke-width="3"/>' +
  '<rect x="44" y="48" width="72" height="7" rx="3.5" fill="' + A + '" opacity="0.55"/>' +
  '<rect x="44" y="66" width="92" height="5" rx="2.5" fill="' + A + '" opacity="0.35"/>' +
  '<rect x="44" y="82" width="80" height="5" rx="2.5" fill="' + A + '" opacity="0.3"/>' +
  '<rect x="44" y="98" width="88" height="5" rx="2.5" fill="' + A + '" opacity="0.25"/>' +
  '<rect x="44" y="114" width="68" height="5" rx="2.5" fill="' + A + '" opacity="0.2"/>' +
  '<rect x="44" y="130" width="74" height="5" rx="2.5" fill="' + A + '" opacity="0.18"/>' +
  '<g transform="rotate(-38, 154, 66)">' +
  '<rect x="148" y="28" width="14" height="88" rx="7" fill="' + W + '" stroke="' + A + '" stroke-width="3"/>' +
  '<polygon points="148,116 162,116 155,140" fill="' + A + '"/>' +
  '<rect x="152" y="36" width="6" height="72" rx="3" fill="' + A + '" opacity="0.4"/>' +
  '</g></g>' +
  '<text x="144" y="240" text-anchor="middle" font-family="Noto Sans Devanagari, Mangal, sans-serif" font-size="28" font-weight="700" fill="' + A + '">आवेदन सहायक</text>' +
  '<text x="144" y="268" text-anchor="middle" font-family="Noto Sans Devanagari, Mangal, sans-serif" font-size="13" font-weight="400" fill="#999">बोलिए, आवेदन बन जाएगा</text>' +
  '<text x="144" y="284" text-anchor="middle" font-family="Noto Sans Devanagari, Mangal, sans-serif" font-size="9" font-weight="400" fill="#BBB">एम.एम. एंटरप्राइजेज द्वारा निर्मित | Created by M.M. Enterprises</text>' +
  '</svg>';

async function go() {
  console.log('Generating icons...\n');

  var items = [
    ['icon.png', 1024, fg],
    ['android-icon-foreground.png', 432, fg],
    ['android-icon-background.png', 432, bg],
    ['android-icon-monochrome.png', 432, mono],
    ['favicon.png', 48, fg],
  ];

  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var buf = await sharp(Buffer.from(it[2]))
      .resize(it[1], it[1], { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    var out = path.join(assetsDir, it[0]);
    fs.writeFileSync(out, buf);
    console.log('  OK  ' + it[0] + '  (' + it[1] + 'x' + it[1] + ', ' + (buf.length / 1024).toFixed(1) + 'KB)');
  }

  // Splash icon at larger size
  var sbuf = await sharp(Buffer.from(splash))
    .resize(1284, 1284, { fit: 'contain', background: { r: 255, g: 248, b: 240, alpha: 1 } })
    .png().toBuffer();
  var sOut = path.join(assetsDir, 'splash-icon.png');
  fs.writeFileSync(sOut, sbuf);
  console.log('  OK  splash-icon.png  (1284x1284, ' + (sbuf.length / 1024).toFixed(1) + 'KB)');

  console.log('\nDone! Assets in: ' + assetsDir);
}

go().catch(function(e) { console.error('Failed:', e); process.exit(1); });
