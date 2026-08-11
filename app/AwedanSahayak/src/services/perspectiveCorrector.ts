/**
 * Perspective Correction PoC — JS wrapper for the native PerspectiveModule.
 *
 * Calls Android's Matrix.setPolyToPoly for true perspective (projective) transform.
 * Zero external dependencies — uses only android.graphics.Matrix.
 */

import { requireNativeModule } from 'expo-modules-core';

// The native module registered in MainApplication.kt
const PerspectiveNative = requireNativeModule('PerspectiveModule');

export interface DocumentCorners {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
}

/**
 * Apply perspective correction to a document image.
 *
 * @param imageUri  Local file URI of the source image
 * @param corners   Four corners of the document in image-pixel coordinates
 * @returns         File URI of the corrected (flattened) JPEG, or null on failure
 */
export async function applyPerspectiveCorrection(
  imageUri: string,
  corners: DocumentCorners,
): Promise<string | null> {
  try {
    const floatCorners: number[] = [
      corners.topLeft.x, corners.topLeft.y,
      corners.topRight.x, corners.topRight.y,
      corners.bottomRight.x, corners.bottomRight.y,
      corners.bottomLeft.x, corners.bottomLeft.y,
    ];
    const result: string = await PerspectiveNative.applyPerspectiveCorrection(
      imageUri,
      floatCorners,
    );
    return result;
  } catch (e: any) {
    console.error('Perspective correction failed:', e?.message);
    return null;
  }
}
