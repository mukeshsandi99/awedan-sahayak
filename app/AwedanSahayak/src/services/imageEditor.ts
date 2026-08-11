/**
 * Image Editor Service for Awedan Sahayak Scanner.
 *
 * Provides crop, rotate, filter, and adjustment operations using
 * expo-image-manipulator. Maintains edit history for undo/redo.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  applyFilter as nativeApplyFilter,
  applyAdjustments as nativeApplyAdjustments,
  applyPerspective as nativeApplyPerspective,
  autoEnhance as nativeAutoEnhance,
  removeShadows as nativeRemoveShadows,
  whitenBackground as nativeWhitenBackground,
  applyTextSharpen as nativeApplyTextSharpen,
  applyAdaptiveThreshold as nativeApplyAdaptiveThreshold,
  isNativeProcessorAvailable,
} from './nativeImageProcessor';
import type { DocumentCorners } from './nativeImageProcessor';

// ── Types ───────────────────────────────────────────────────────────

export type FilterName =
  | 'original' | 'auto' | 'color' | 'magicColor' | 'enhance'
  | 'bw' | 'grayscale' | 'blackWhite' | 'document' | 'soft' | 'highContrast'
  | 'photo' | 'idCard' | 'receipt' | 'passport';

export interface FilterPreset {
  name: FilterName;
  label: string;
  labelHi: string;
  matrix?: number[]; // 4x5 color matrix (20 floats) or undefined for non-matrix filters
}

export interface AdjustmentValues {
  brightness: number;   // -1 to 1, default 0
  contrast: number;     // -1 to 1, default 0
  sharpness: number;    // 0 to 1, default 0
  saturation: number;   // -1 to 1, default 0
  warmth: number;       // -1 to 1, default 0
  shadows: number;      // -1 to 1, default 0
  highlights: number;   // -1 to 1, default 0
  whitening: number;    // 0 to 1, default 0
  denoise: number;      // 0 to 1, default 0
}

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface EditAction {
  type: 'crop' | 'rotate' | 'filter' | 'adjust' | 'perspective';
  timestamp: number;
}

export interface EditorState {
  originalUri: string;
  workingUri: string;
  rotation: number; // 0, 90, 180, 270
  cropRect: CropRect | null;
  activeFilter: FilterName;
  adjustments: AdjustmentValues;
  history: EditAction[];
  historyIndex: number;
}

// ── Filter presets ──────────────────────────────────────────────────

export const FILTERS: Record<FilterName, FilterPreset> = {
  original:     { name: 'original',     label: 'मूल',           labelHi: 'Original',      matrix: undefined },
  auto:         { name: 'auto',         label: 'ऑटो',           labelHi: 'Auto',          matrix: undefined },
  color:        { name: 'color',        label: 'रंगीन',         labelHi: 'Color',         matrix: [1.1,0,0,0,-0.05, 0,1.1,0,0,-0.05, 0,0,1.1,0,-0.05, 0,0,0,1,0] },
  magicColor:   { name: 'magicColor',   label: 'मैजिक कलर',    labelHi: 'Magic Color',   matrix: [1.3,0,0,0,-0.15, 0,1.3,0,0,-0.15, 0,0,1.3,0,-0.15, 0,0,0,1,0] },
  bw:           { name: 'bw',           label: 'ब्लैक & वाइट', labelHi: 'B&W',           matrix: [0.33,0.59,0.11,0,0, 0.33,0.59,0.11,0,0, 0.33,0.59,0.11,0,0, 0,0,0,1,0] },
  blackWhite:   { name: 'blackWhite',   label: 'ब्लैक & वाइट', labelHi: 'B&W',           matrix: [0.33,0.59,0.11,0,0, 0.33,0.59,0.11,0,0, 0.33,0.59,0.11,0,0, 0,0,0,1,0] },
  grayscale:    { name: 'grayscale',    label: 'ग्रेस्केल',    labelHi: 'Grayscale',     matrix: [0.2126,0.7152,0.0722,0,0, 0.2126,0.7152,0.0722,0,0, 0.2126,0.7152,0.0722,0,0, 0,0,0,1,0] },
  document:     { name: 'document',     label: 'दस्तावेज़',    labelHi: 'Document',      matrix: [1.2,0,0,0,-0.1, 0,1.2,0,0,-0.1, 0,0,1.2,0,-0.1, 0,0,0,1,0] },
  soft:         { name: 'soft',         label: 'सॉफ्ट',        labelHi: 'Soft',          matrix: [0.9,0.05,0.05,0,0.05, 0.05,0.9,0.05,0,0.05, 0.05,0.05,0.9,0,0.05, 0,0,0,1,0] },
  highContrast: { name: 'highContrast', label: 'हाई कॉन्ट्रास्ट', labelHi: 'High Contrast', matrix: [1.5,0,0,0,-0.25, 0,1.5,0,0,-0.25, 0,0,1.5,0,-0.25, 0,0,0,1,0] },
  enhance:      { name: 'enhance',      label: 'एन्हांस',         labelHi: 'Enhance',        matrix: undefined },
  photo:        { name: 'photo',        label: 'फोटो',            labelHi: 'Photo',           matrix: [1.05,0,0,0,0, 0,1.05,0,0,0, 0,0,1.05,0,0, 0,0,0,1,0] },
  idCard:       { name: 'idCard',       label: 'आईडी कार्ड',      labelHi: 'ID Card',         matrix: [1.15,0,0,0,-0.05, 0,1.15,0,0,-0.05, 0,0,1.15,0,-0.05, 0,0,0,1,0] },
  receipt:      { name: 'receipt',      label: 'रसीद',            labelHi: 'Receipt',         matrix: [1.2,0,0,0,-0.1, 0,1.2,0,0,-0.1, 0,0,1.2,0,-0.1, 0,0,0,1,0] },
  passport:     { name: 'passport',     label: 'पासपोर्ट',        labelHi: 'Passport',        matrix: [1.1,0,0,0,-0.02, 0,1.1,0,0,-0.02, 0,0,1.1,0,-0.02, 0,0,0,1,0] },
};

export const DEFAULT_ADJUSTMENTS: AdjustmentValues = {
  brightness: 0, contrast: 0, sharpness: 0, saturation: 0,
  warmth: 0, shadows: 0, highlights: 0, whitening: 0, denoise: 0,
};

// ── Editor working dir (document directory, NOT cache — survives OS cleanup) ──

function editorCacheDir(): string {
  return FileSystem.documentDirectory + 'editor-working/';
}

async function ensureCacheDir(): Promise<void> {
  await FileSystem.makeDirectoryAsync(editorCacheDir(), { intermediates: true });
}

// ── Core operations ─────────────────────────────────────────────────

/** Apply a filter to an image using native processor with JS fallback. */
export async function applyFilter(
  uri: string,
  filterName: FilterName,
): Promise<string> {
  if (filterName === 'original') return uri;
  await ensureCacheDir();
  const baseName = uri.split('/').pop()?.split('.')[0] || 'img';
  const outUri = editorCacheDir() + `${baseName}_${filterName}.jpg`;

  // Try native processor first
  if (isNativeProcessorAvailable()) {
    try {
      let result: string | null = null;
      if (filterName === 'enhance') {
        result = await nativeAutoEnhance(uri);
      } else if (filterName === 'passport') {
        result = await nativeWhitenBackground(uri, 0.06);
      } else {
        const nativeFilterName = (filterName === 'bw' ? 'blackWhite' : filterName) as any;
        result = await nativeApplyFilter(uri, nativeFilterName);
      }
      if (result && result !== uri) {
        await FileSystem.moveAsync({ from: result, to: outUri });
        return outUri;
      }
    } catch { /* fall through to JS fallback */ }
  }

  // JS fallback using expo-image-manipulator (limited: resize/compress only)
  const existing = await FileSystem.getInfoAsync(outUri);
  if (existing.exists) return outUri;

  const cfg = filterConfigs[filterName];
  if (!cfg) return uri;
  const actions: any[] = [];
  if (cfg.resize !== 1) {
    const info = await getImageInfo(uri);
    if (info) {
      actions.push({ resize: { width: Math.round(info.width * cfg.resize) } });
    }
  }

  const r = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: cfg.compress,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  await FileSystem.moveAsync({ from: r.uri, to: outUri });
  return outUri;
}

const filterConfigs: Record<FilterName, { resize: number; compress: number }> = {
  original:     { resize: 1.0, compress: 1.0 },
  auto:         { resize: 1.0, compress: 0.85 },
  color:        { resize: 1.0, compress: 0.80 },
  magicColor:   { resize: 1.0, compress: 0.70 },
  bw:           { resize: 0.5, compress: 0.45 },
  blackWhite:   { resize: 0.5, compress: 0.45 },
  grayscale:    { resize: 0.7, compress: 0.60 },
  document:     { resize: 1.0, compress: 0.75 },
  soft:         { resize: 0.9, compress: 0.82 },
  highContrast: { resize: 1.0, compress: 0.55 },
  enhance:      { resize: 1.0, compress: 0.80 },
  photo:        { resize: 1.0, compress: 0.85 },
  idCard:       { resize: 1.0, compress: 0.80 },
  receipt:      { resize: 1.0, compress: 0.70 },
  passport:     { resize: 1.0, compress: 0.85 },
};

async function getImageInfo(uri: string) {
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    // Quick JPEG dimension parser
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
      let i = 2;
      while (i < bytes.length - 1) {
        if (bytes[i] !== 0xFF) return null;
        const marker = bytes[i + 1];
        i += 2;
        if ((marker >= 0xC0 && marker <= 0xC2)) {
          return { width: (bytes[i + 3] << 8) | bytes[i + 4], height: (bytes[i + 5] << 8) | bytes[i + 6] };
        }
        if (i + 1 >= bytes.length) return null;
        i += (bytes[i] << 8) | bytes[i + 1];
      }
    }
  } catch {}
  return null;
}

/** Apply adjustment values to an image using native processor with JS fallback. */
export async function applyAdjustments(
  uri: string,
  adjustments: AdjustmentValues,
): Promise<string> {
  await ensureCacheDir();
  const baseName = uri.split('/').pop()?.split('.')[0] || 'img';
  const outUri = editorCacheDir() + `${baseName}_adj.jpg`;

  // Try native processor first — applies real brightness/contrast/saturation etc.
  if (isNativeProcessorAvailable()) {
    try {
      const nativeAdj = {
        brightness: adjustments.brightness,
        contrast: adjustments.contrast,
        sharpness: adjustments.sharpness,
        saturation: adjustments.saturation,
        warmth: adjustments.warmth,
        shadows: adjustments.shadows,
        highlights: adjustments.highlights,
        backgroundWhitening: adjustments.whitening,
        denoise: adjustments.denoise,
      };
      const result = await nativeApplyAdjustments(uri, nativeAdj);
      if (result && result !== uri) {
        await FileSystem.moveAsync({ from: result, to: outUri });
        return outUri;
      }
    } catch { /* fall through to JS fallback */ }
  }

  // JS fallback: copy only (expo-image-manipulator lacks brightness/contrast APIs)
  await FileSystem.copyAsync({ from: uri, to: outUri });
  return outUri;
}

/** Apply perspective correction using native processor. Copies result to permanent directory. */
export async function applyPerspective(
  uri: string,
  corners: DocumentCorners,
  sessionId?: string,
): Promise<string> {
  if (!isNativeProcessorAvailable()) throw new Error('Native processor not available for perspective correction');

  const result = await nativeApplyPerspective(uri, corners);
  if (!result) throw new Error('Perspective correction failed');
  if (!result.uri) throw new Error('Perspective returned no output URI');

  // Verify native output exists BEFORE attempting any copy
  const srcInfo = await FileSystem.getInfoAsync(result.uri);
  if (!srcInfo.exists) {
    throw new Error(
      `Perspective output file not found at: ${result.uri}. ` +
      `Input was: ${uri}. This is a native processor error — the corrected image was not written.`
    );
  }
  if ((srcInfo as any).size === 0) {
    throw new Error(`Perspective output file is empty: ${result.uri}`);
  }

  // Copy from cache to permanent scans directory
  const dir = FileSystem.documentDirectory + 'digital-locker/scans/';
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const sessionTag = sessionId || `s${Date.now()}`;
  const dest = dir + `persp-${sessionTag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
  await FileSystem.copyAsync({ from: result.uri, to: dest });

  // Verify destination
  const destInfo = await FileSystem.getInfoAsync(dest);
  if (!destInfo.exists) throw new Error('Perspective copy to permanent storage failed');

  // Clean up the temp file AFTER successful copy
  FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
  return dest;
}

/** Rotate an image. Returns new URI. */
export async function rotateImage(
  uri: string,
  degrees: 90 | 180 | 270,
): Promise<string> {
  await ensureCacheDir();
  const baseName = uri.split('/').pop()?.split('.')[0] || 'img';
  const outUri = editorCacheDir() + `${baseName}_rot${degrees}.jpg`;

  const existing = await FileSystem.getInfoAsync(outUri);
  if (existing.exists) return outUri;

  const r = await ImageManipulator.manipulateAsync(uri, [{ rotate: degrees }], {
    compress: 0.92, format: ImageManipulator.SaveFormat.JPEG,
  });
  await FileSystem.moveAsync({ from: r.uri, to: outUri });
  return outUri;
}

/** Crop an image to a rectangle. Returns new URI. */
export async function cropImage(
  uri: string,
  crop: CropRect,
): Promise<string> {
  await ensureCacheDir();
  const baseName = uri.split('/').pop()?.split('.')[0] || 'img';
  const outUri = editorCacheDir() + `${baseName}_crop.jpg`;

  const existing = await FileSystem.getInfoAsync(outUri);
  if (existing.exists) return outUri;

  const r = await ImageManipulator.manipulateAsync(uri, [{
    crop: {
      originX: Math.round(crop.originX),
      originY: Math.round(crop.originY),
      width: Math.round(crop.width),
      height: Math.round(crop.height),
    },
  }], { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG });
  await FileSystem.moveAsync({ from: r.uri, to: outUri });
  return outUri;
}

/** Resize to a max dimension, preserving aspect ratio. */
export async function resizeImage(
  uri: string,
  maxDim: number,
): Promise<string> {
  await ensureCacheDir();
  const baseName = uri.split('/').pop()?.split('.')[0] || 'img';
  const outUri = editorCacheDir() + `${baseName}_r${maxDim}.jpg`;
  const existing = await FileSystem.getInfoAsync(outUri);
  if (existing.exists) return outUri;

  const r = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  await FileSystem.moveAsync({ from: r.uri, to: outUri });
  return outUri;
}

// ── Undo/Redo helpers ───────────────────────────────────────────────

export function canUndo(state: EditorState): boolean {
  return state.historyIndex > 0;
}

export function canRedo(state: EditorState): boolean {
  return state.historyIndex < state.history.length;
}

// ── Save final edited image ─────────────────────────────────────────

/**
 * Save the edited image to the permanent scans directory.
 * Does NOT overwrite the original.
 */
export async function saveEditedImage(
  workingUri: string,
  originalUri: string,
  sessionId?: string,
): Promise<string> {
  const dir = FileSystem.documentDirectory + 'digital-locker/scans/';
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const ext = 'jpg';
  const sessionTag = sessionId || `s${Date.now()}`;
  const dest = dir + `edited-${sessionTag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  await FileSystem.copyAsync({ from: workingUri, to: dest });
  return dest;
}

// ── Professional enhancement operations ───────────────────────────

export async function enhanceImage(uri: string): Promise<string | null> {
  if (!isNativeProcessorAvailable()) return null;
  return nativeAutoEnhance(uri);
}

export async function removeShadowsFromImage(uri: string): Promise<string | null> {
  if (!isNativeProcessorAvailable()) return null;
  return nativeRemoveShadows(uri);
}

export async function whitenImageBackground(uri: string, strength: number = 0.12): Promise<string | null> {
  if (!isNativeProcessorAvailable()) return null;
  return nativeWhitenBackground(uri, strength);
}

export async function sharpenImageText(uri: string): Promise<string | null> {
  if (!isNativeProcessorAvailable()) return null;
  return nativeApplyTextSharpen(uri);
}

export async function thresholdImage(uri: string, blockSize: number = 31, c: number = 12): Promise<string | null> {
  if (!isNativeProcessorAvailable()) return null;
  return nativeApplyAdaptiveThreshold(uri, blockSize, c);
}
