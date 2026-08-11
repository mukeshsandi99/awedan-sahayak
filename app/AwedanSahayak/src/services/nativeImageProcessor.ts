/**
 * NativeImageProcessor — Typed JS wrapper for the Android native module.
 *
 * Uses NativeModules (old bridge) for reliable registration.
 * Falls back gracefully if the native module is unavailable.
 */

import { NativeModules, Platform } from 'react-native';

export type Point = { x: number; y: number };

export type DocumentCorners = {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
};

export type EdgeDetectionResult = {
  corners: DocumentCorners;
  imageWidth: number;
  imageHeight: number;
  confidence: number;
};

export type FilterName =
  | 'original' | 'auto' | 'color' | 'magicColor'
  | 'grayscale' | 'blackWhite' | 'document' | 'soft' | 'highContrast';

export type AdjustmentValues = {
  brightness: number;
  contrast: number;
  sharpness: number;
  saturation: number;
  warmth: number;
  shadows: number;
  highlights: number;
  backgroundWhitening: number;
  denoise: number;
};

export type PerspectiveResult = {
  uri: string;
  width: number;
  height: number;
  processingMs: number;
};

// ── Guarded native module access ────────────────────────────────────

const Native: any = Platform.OS === 'android'
  ? NativeModules.NativeImageProcessor
  : null;

export function isNativeProcessorAvailable(): boolean {
  return Native != null;
}

function requireNative() {
  if (!Native) throw new Error('NativeImageProcessor not available on this platform/build.');
  return Native;
}

// ── Public API ──────────────────────────────────────────────────────

export async function detectEdges(
  imageUri: string,
  maxPreviewDimension: number = 1200,
): Promise<EdgeDetectionResult | null> {
  if (!Native) return null;
  try {
    const r = await Native.detectEdges(imageUri, maxPreviewDimension);
    return {
      corners: {
        topLeft: r.topLeft as Point,
        topRight: r.topRight as Point,
        bottomRight: r.bottomRight as Point,
        bottomLeft: r.bottomLeft as Point,
      },
      imageWidth: r.imageWidth as number,
      imageHeight: r.imageHeight as number,
      confidence: r.confidence as number,
    };
  } catch {
    return null;
  }
}

export async function applyPerspective(
  imageUri: string,
  corners: DocumentCorners,
  outputQuality: number = 92,
  maxOutputDimension: number = 0,
): Promise<PerspectiveResult | null> {
  if (!Native) return null;
  try {
    const flatCorners: number[] = [
      corners.topLeft.x, corners.topLeft.y,
      corners.topRight.x, corners.topRight.y,
      corners.bottomRight.x, corners.bottomRight.y,
      corners.bottomLeft.x, corners.bottomLeft.y,
    ];
    const r = await Native.applyPerspective(imageUri, flatCorners, outputQuality, maxOutputDimension);
    return r as PerspectiveResult;
  } catch {
    return null;
  }
}

export async function applyFilter(
  imageUri: string,
  filterName: FilterName,
  options?: Partial<AdjustmentValues>,
): Promise<string | null> {
  if (!Native || filterName === 'original') return imageUri;
  try {
    return await Native.applyFilter(imageUri, filterName, options ?? {});
  } catch {
    return null;
  }
}

export async function applyAdjustments(
  imageUri: string,
  adjustments: AdjustmentValues,
): Promise<string | null> {
  if (!Native) return null;
  try {
    return await Native.applyAdjustments(imageUri, adjustments);
  } catch {
    return null;
  }
}

export async function createPreview(
  imageUri: string,
  maxDimension: number = 1200,
): Promise<string | null> {
  if (!Native) return null;
  try {
    return await Native.createPreview(imageUri, maxDimension);
  } catch {
    return null;
  }
}

export async function cleanupTemporaryFiles(): Promise<void> {
  if (!Native) return;
  try { await Native.cleanupTemporaryFiles(); } catch { /* ignore */ }
}

// ── Professional enhancement pipeline ─────────────────────────────

export async function autoEnhance(imageUri: string): Promise<string | null> {
  if (!Native) return null;
  try { return await Native.autoEnhance(imageUri); } catch { return null; }
}

export async function removeShadows(imageUri: string): Promise<string | null> {
  if (!Native) return null;
  try { return await Native.removeShadows(imageUri); } catch { return null; }
}

export async function whitenBackground(imageUri: string, strength: number = 0.12): Promise<string | null> {
  if (!Native) return null;
  try { return await Native.whitenBackground(imageUri, strength); } catch { return null; }
}

export async function applyTextSharpen(imageUri: string): Promise<string | null> {
  if (!Native) return null;
  try { return await Native.applyTextSharpen(imageUri); } catch { return null; }
}

export async function autoStraighten(imageUri: string): Promise<string | null> {
  if (!Native) return null;
  try { return await Native.autoStraighten(imageUri); } catch { return null; }
}

export async function applyAdaptiveThreshold(
  imageUri: string, blockSize: number = 31, c: number = 12,
): Promise<string | null> {
  if (!Native) return null;
  try { return await Native.applyAdaptiveThreshold(imageUri, blockSize, c); } catch { return null; }
}
