/**
 * Icon asset generator for Awedan Sahayak.
 *
 * Uses sharp to render SVG icons to PNG at all required sizes.
 * Run: node scripts/generate-icons.mjs
 *
 * Dependencies: sharp (already in server/node_modules, or install globally)
 */

import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, '..', 'app', 'AwedanSahayak', 'assets');

// ── SVG designs ───────────────────────────────────────────────────────

const ACCENT = '#E17055';
const WHITE = '#FFFFFF';

/**
 * Main app icon (foreground + background combined).
 * Concept: Document/paper with pen element on warm orange background.
 * Used as the primary icon.png and for the adaptive foreground.
 */
const foregroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  <!-- Document body (white paper, offset slightly right) -->
  <rect x="22" y="16" width="62" height="74" rx="5" fill="${WHITE}"/>

  <!-- Horizontal rule lines on the paper (representing text/application content) -->
  <rect x="32" y="34" width="34" height="4" rx="2" fill="${ACCENT}" opacity="0.55"/>
  <rect x="32" y="44" width="44" height="3" rx="1.5" fill="${ACCENT}" opacity="0.35"/>
  <rect x="32" y="52" width="38" height="3" rx="1.5" fill="${ACCENT}" opacity="0.3"/>
  <rect x="32" y="60" width="42" height="3" rx="1.5" fill="${ACCENT}" opacity="0.25"/>
  <rect x="32" y="68" width="32" height="3" rx="1.5" fill="${ACCENT}" opacity="0.2"/>
  <rect x="32" y="76" width="36" height="3" rx="1.5" fill="${ACCENT}" opacity="0.18"/>

  <!-- Pen element (angled, writing on the paper) -->
  <g transform="rotate(-38, 80, 36)">
    <rect x="74" y="16" width="7" height="44" rx="3.5" fill="${WHITE}" stroke="${ACCENT}" stroke-width="1.5"/>
    <polygon points="74,60 81,60 77.5,72" fill="${ACCENT}"/>
    <rect x="76" y="20" width="3" height="36" rx="1.5" fill="${ACCENT}" opacity="0.4"/>
  </g>
</svg>`;

/** Adaptive icon background — solid branded color with subtle texture. */
const backgroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  <rect width="108" height="108" rx="24" fill="${ACCENT}"/>

  <!-- Subtle radial gradient-like concentric circles for depth -->
  <circle cx="54" cy="54" r="48" fill="none" stroke="${WHITE}" stroke-width="0.8" opacity="0.08"/>
  <circle cx="54" cy="54" r="38" fill="none" stroke="${WHITE}" stroke-width="0.6" opacity="0.06"/>
</svg>`;

/** Monochrome adaptive icon (used on Android for themed icons). */
const monochromeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  <!-- Same document + pen design, solid white on transparent -->
  <rect x="22" y="16" width="62" height="74" rx="5" fill="${WHITE}"/>
  <rect x="32" y="34" width="34" height="4" rx="2" fill="${ACCENT}" opacity="0.7"/>
  <rect x="32" y="44" width="44" height="3" rx="1.5" fill="${ACCENT}" opacity="0.5"/>
  <rect x="32" y="52" width="38" height="3" rx="1.5" fill="${ACCENT}" opacity="0.45"/>
  <rect x="32" y="60" width="42" height="3" rx="1.5" fill="${ACCENT}" opacity="0.4"/>
  <rect x="32" y="68" width="32" height="3" rx="1.5" fill="${ACCENT}" opacity="0.35"/>
  <rect x="32" y="76" width="36" height="3" rx="1.5" fill="${ACCENT}" opacity="0.3"/>
  <g transform="rotate(-38, 80, 36)">
    <rect x="74" y="16" width="7" height="44" rx="3.5" fill="${WHITE}" stroke="${ACCENT}" stroke-width="1.5"/>
    <polygon points="74,60 81,60 77.5,72" fill="${ACCENT}"/>
  </g>
</svg>`;

/**
 * Splash screen icon — large centered version of the mark on cream bg.
 * The splash should show:
 *   - The document+pen icon centered (larger, ~180px visual)
 *   - App name below: "आवेदन सहायक"
 *   - Tagline: "बोलिए, आवेदन बन जाएगा"
 */

const splashIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 288 288">
  <rect width="288" height="288" rx="16" fill="#FFF8F0"/>

  <!-- Document + pen icon (centered, larger) -->
  <g transform="translate(56, 40)">
    <rect x="22" y="16" width="130" height="150" rx="10" fill="${WHITE}" stroke="${ACCENT}" stroke-width="3"/>
    <rect x="44" y="48" width="72" height="7" rx="3.5" fill="${ACCENT}" opacity="0.55"/>
    <rect x="44" y="66" width="92" height="5" rx="2.5" fill="${ACCENT}" opacity="0.35"/>
    <rect x="44" y="82" width="80" height="5" rx="2.5" fill="${ACCENT}" opacity="0.3"/>
    <rect x="44" y="98" width="88" height="5" rx="2.5" fill="${ACCENT}" opacity="0.25"/>
    <rect x="44" y="114" width="68" height="5" rx="2.5" fill="${ACCENT}" opacity="0.2"/>
    <rect x="44" y="130" width="74" height="5" rx="2.5" fill="${ACCENT}" opacity="0.18"/>

    <!-- Pen -->
    <g transform="rotate(-38, 154, 66)">
      <rect x="148" y="28" width="14" height="88" rx="7" fill="${WHITE}" stroke="${ACCENT}" stroke-width="3"/>
      <polygon points="148,116 162,116 155,140" fill="${ACCENT}"/>
      <rect x="152" y="36" width="6" height="72" rx="3" fill="${ACCENT}" opacity="0.4"/>
    </g>
  </g>

  <!-- App name in Devanagari -->
  <text x="144" y="238" text-anchor="middle"
        font-family="'Noto Sans Devanagari', 'Mangal', sans-serif"
        font-size="28" font-weight="700" fill="${ACCENT}">
    आवेदन सहायक
  </text>

  <!-- Tagline -->
  <text x="144" y="266" text-anchor="middle"
        font-family="'Noto Sans Devanagari', 'Mangal', sans-serif"
        font-size="13" font-weight="400" fill="#999">
    बोलिए, आवेदन बन जाएगा
  </text>
</svg>`;

// ── Generate PNGs ─────────────────────────────────────────────────────

const SIZES = {
  'icon.png': 1024,
  'android-icon-foreground.png': 432,   // 108dp × 4 (xxxhdpi)
  'android-icon-background.png': 432,
  'android-icon-monochrome.png': 432,
  'splash-icon.png': 288,
  'favicon.png': 48,
};

async function generate() {
  console.log('Generating icon assets...\n');

  for (const [filename, size] of Object.entries(SIZES)) {
    let svg;

    if (filename === 'android-icon-background.png') {
      svg = backgroundSvg;
    } else if (filename === 'android-icon-monochrome.png') {
      svg = monochromeSvg;
    } else if (filename === 'splash-icon.png') {
      svg = splashIconSvg;
      // Splash icon uses a different design — skip resize, render at native size
      const buf = await sharp(Buffer.from(svg)).png().toBuffer();
      const outPath = join(assetsDir, filename);
      const { writeFileSync } = await import('fs');
      writeFileSync(outPath, buf);
      console.log(`  ✅ ${filename}  (${buf.length} bytes)`);
      continue;
    } else {
      svg = foregroundSvg;
    }

    const buf = await sharp(Buffer.from(svg))
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const outPath = join(assetsDir, filename);
    const { writeFileSync } = await import('fs');
    writeFileSync(outPath, buf);
    console.log(`  ✅ ${filename}  (${size}×${size}, ${(buf.length / 1024).toFixed(1)}KB)`);
  }

  console.log('\n✨ All icon assets generated in:', assetsDir);
}

generate().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
