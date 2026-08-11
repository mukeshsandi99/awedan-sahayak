/**
 * documentScanner.ts — Guarded loader for the native ML Kit Document Scanner.
 *
 * Uses @dariyd/react-native-document-scanner which provides:
 *   - Google ML Kit Document Scanner on Android
 *   - Apple VisionKit on iOS
 *   - TurboModule + old-architecture compat via autolinking
 *
 * SAFETY: The native module is loaded dynamically via require() inside
 * try/catch. If the module is missing (e.g. running in Expo Go, or a
 * build without the native code), the app continues to function and
 * falls back to camera + gallery picker.
 *
 * NEVER import this module at the top level of a screen that's rendered
 * unconditionally — always use the guard functions before calling.
 */

import type {
  ScanResult,
  ScanOptions,
  ImageObject,
} from '@dariyd/react-native-document-scanner';

// ── Re-export types for consumers ────────────────────────────────────

export type { ScanResult, ScanOptions, ImageObject };

// ── Module cache ─────────────────────────────────────────────────────

let ScannerModule: any = null;
let moduleLoadAttempted = false;

/**
 * Attempts to load the native scanner module exactly once.
 * Returns the module or null if unavailable.
 */
function getScannerModule(): any {
  if (moduleLoadAttempted) return ScannerModule;
  moduleLoadAttempted = true;

  try {
    // Dynamic require — metro won't crash if the native code is absent.
    // The package index.js already handles the TurboModule vs old-arch
    // fallback internally.
    ScannerModule = require('@dariyd/react-native-document-scanner');
    console.log('[DocumentScanner] Native module loaded successfully.');
  } catch (e: any) {
    console.warn(
      '[DocumentScanner] Native module NOT available:',
      e?.message ?? String(e),
    );
    ScannerModule = null;
  }

  return ScannerModule;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Returns true if the native ML Kit document scanner is available.
 * Safe to call at any time — does not throw.
 */
export function isNativeScannerAvailable(): boolean {
  return getScannerModule() !== null;
}

/**
 * Launches the native ML Kit document scanner.
 *
 * The native UI provides:
 *   - Automatic edge detection
 *   - Automatic perspective correction
 *   - Page review before capture
 *   - Multi-page capture support
 *   - Crop adjustment
 *
 * @param options — Scanner configuration
 * @param options.quality — Image quality 0–1 (default 0.9)
 * @param options.includeBase64 — If true, each image includes base64 data
 * @returns ScanResult with images array, or null if module unavailable
 *
 * @example
 * ```ts
 * const result = await launchNativeScanner({ quality: 0.9 });
 * if (!result) {
 *   // Module not available — fall back to camera
 *   return;
 * }
 * if (result.didCancel) {
 *   // User cancelled
 *   return;
 * }
 * if (result.error) {
 *   console.error(result.errorMessage);
 *   return;
 * }
 * // result.images is ImageObject[] — each has .uri, .width, .height, etc.
 * ```
 */
export async function launchNativeScanner(
  options: ScanOptions = {},
): Promise<ScanResult | null> {
  const mod = getScannerModule();
  if (!mod) {
    console.warn(
      '[DocumentScanner] launchNativeScanner called but module is not available.',
    );
    return null;
  }

  // Default options tuned for document quality
  const opts: ScanOptions = {
    quality: options.quality ?? 0.9,
    includeBase64: options.includeBase64 ?? false,
    includeExif: options.includeExif ?? false,
    includeLocationExif: options.includeLocationExif ?? false,
  };

  try {
    console.log('[DocumentScanner] Launching native scanner...');
    const result: ScanResult = await mod.launchScanner(opts);
    console.log(
      '[DocumentScanner] Scanner result:',
      result.didCancel
        ? 'cancelled'
        : result.error
          ? `error: ${result.errorMessage}`
          : `${result.images?.length ?? 0} pages`,
    );
    return result;
  } catch (e: any) {
    console.error('[DocumentScanner] Scanner crashed:', e?.message);
    return {
      error: true,
      errorMessage: e?.message ?? 'Unknown scanner error',
    };
  }
}
