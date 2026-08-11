/**
 * CoordinateMapper — Original-image ↔ screen coordinate conversion.
 *
 * Handles: portrait, landscape, contain mode, letterboxing, rotation.
 * Source of truth is always original-image pixel coordinates.
 */

import { Dimensions, Image } from 'react-native';

export interface Point {
  x: number;
  y: number;
}

export interface ImageLayout {
  /** Offset from container left where image pixels start (letterbox) */
  offsetX: number;
  /** Offset from container top where image pixels start (letterbox) */
  offsetY: number;
  /** Displayed width of image content in screen points */
  displayWidth: number;
  /** Displayed height of image content in screen points */
  displayHeight: number;
  /** Natural image width in pixels */
  naturalWidth: number;
  /** Natural image height in pixels */
  naturalHeight: number;
  /** Container width */
  containerWidth: number;
  /** Container height */
  containerHeight: number;
}

/**
 * Compute the image display layout for contain mode within a container.
 * Call this after Image.getSize succeeds.
 */
export function computeImageLayout(
  naturalWidth: number,
  naturalHeight: number,
  containerWidth: number,
  containerHeight: number,
  rotation: number = 0,
): ImageLayout {
  // If rotated 90 or 270, swap natural dimensions for layout calc
  const rotated = rotation === 90 || rotation === 270;
  const nw = rotated ? naturalHeight : naturalWidth;
  const nh = rotated ? naturalWidth : naturalHeight;

  const imageAspect = nw / nh;
  const containerAspect = containerWidth / containerHeight;

  let displayWidth: number;
  let displayHeight: number;

  if (imageAspect > containerAspect) {
    // Image is wider — letterbox top/bottom
    displayWidth = containerWidth;
    displayHeight = containerWidth / imageAspect;
  } else {
    // Image is taller — letterbox left/right
    displayHeight = containerHeight;
    displayWidth = containerHeight * imageAspect;
  }

  const offsetX = (containerWidth - displayWidth) / 2;
  const offsetY = (containerHeight - displayHeight) / 2;

  return {
    offsetX,
    offsetY,
    displayWidth,
    displayHeight,
    naturalWidth,
    naturalHeight,
    containerWidth,
    containerHeight,
  };
}

/**
 * Convert a point from screen coordinates to original-image coordinates.
 */
export function screenToImage(
  screenX: number,
  screenY: number,
  layout: ImageLayout,
  rotation: number = 0,
): Point {
  // Remove letterbox offset
  let relX = screenX - layout.offsetX;
  let relY = screenY - layout.offsetY;

  // Clamp to display area
  relX = Math.max(0, Math.min(relX, layout.displayWidth));
  relY = Math.max(0, Math.min(relY, layout.displayHeight));

  // Normalise to 0–1 within display area
  const nx = relX / layout.displayWidth;
  const ny = relY / layout.displayHeight;

  // Map to natural dimensions, accounting for rotation
  let imgX: number;
  let imgY: number;

  switch (rotation) {
    case 90:
      imgX = ny * layout.naturalWidth;
      imgY = (1 - nx) * layout.naturalHeight;
      break;
    case 180:
      imgX = (1 - nx) * layout.naturalWidth;
      imgY = (1 - ny) * layout.naturalHeight;
      break;
    case 270:
      imgX = (1 - ny) * layout.naturalWidth;
      imgY = nx * layout.naturalHeight;
      break;
    default: // 0
      imgX = nx * layout.naturalWidth;
      imgY = ny * layout.naturalHeight;
  }

  return { x: Math.round(imgX), y: Math.round(imgY) };
}

/**
 * Convert a point from original-image coordinates to screen coordinates.
 */
export function imageToScreen(
  imageX: number,
  imageY: number,
  layout: ImageLayout,
  rotation: number = 0,
): Point {
  // Normalise to 0–1 within natural image
  const nx = imageX / layout.naturalWidth;
  const ny = imageY / layout.naturalHeight;

  let displayNX: number;
  let displayNY: number;

  switch (rotation) {
    case 90:
      displayNX = 1 - ny;
      displayNY = nx;
      break;
    case 180:
      displayNX = 1 - nx;
      displayNY = 1 - ny;
      break;
    case 270:
      displayNX = ny;
      displayNY = 1 - nx;
      break;
    default: // 0
      displayNX = nx;
      displayNY = ny;
  }

  return {
    x: layout.offsetX + displayNX * layout.displayWidth,
    y: layout.offsetY + displayNY * layout.displayHeight,
  };
}

/**
 * Get natural image dimensions. Returns null on failure.
 */
export function getImageDimensions(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null),
    );
  });
}

/**
 * Default corners for full-page (full image area).
 */
export function fullPageCorners(layout: ImageLayout): {
  topLeft: Point; topRight: Point; bottomRight: Point; bottomLeft: Point;
} {
  const pad = 0.05; // 5% margin
  const x0 = layout.naturalWidth * pad;
  const y0 = layout.naturalHeight * pad;
  const x1 = layout.naturalWidth * (1 - pad);
  const y1 = layout.naturalHeight * (1 - pad);
  return {
    topLeft: { x: x0, y: y0 },
    topRight: { x: x1, y: y0 },
    bottomRight: { x: x1, y: y1 },
    bottomLeft: { x: x0, y: y1 },
  };
}
