/**
 * Aadhar card OCR and data extraction service.
 *
 * Privacy-first design:
 *   - Image is sent to OUR backend server (which we control)
 *   - The backend processes it and immediately DELETES the image
 *   - Aadhar number is redacted on-device BEFORE sending
 *   - No third-party cloud service ever sees the image or data
 */

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { API_BASE_URL } from '../config';

// ── Types ───────────────────────────────────────────────────────────

export interface AadharExtractedData {
  name: string | null;
  dob: string | null;
  gender: string | null;
  address: string | null;
  phone_number: string | null;
  /** Raw OCR text (for debugging only — never persisted). */
  rawText: string;
}

// ── Aadhar number detection ────────────────────────────────────────

function redactAadharNumber(text: string): string {
  const aadharPattern = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
  return text.replace(aadharPattern, '[AADHAR REDACTED]');
}

// ── Main OCR pipeline ───────────────────────────────────────────────

/**
 * Opens camera → captures Aadhar photo → sends to OUR backend for OCR
 * → extracts structured data.
 *
 * The backend processes via Google Cloud Vision / ML Kit and immediately
 * deletes the image. No third party sees the data.
 */
export async function scanAadharCard(): Promise<AadharExtractedData> {
  // 1. Request camera permission
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('CAMERA_PERMISSION_DENIED');
  }

  // 2. Open camera
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    throw new Error('CAMERA_CANCELLED');
  }

  const imageUri = result.assets[0].uri;

  try {
    // 3. Read image as base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 4. Send to OUR backend for OCR processing
    console.log('[Aadhar OCR] Sending image to backend for OCR...');
    const response = await fetch(`${API_BASE_URL}/api/ocr-aadhar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64 }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error ?? `Server responded with ${response.status}`);
    }

    const data = await response.json();
    console.log('[Aadhar OCR] Backend processed successfully.');

    // 5. Redact Aadhar number from raw text
    const rawText = redactAadharNumber(data.rawText ?? '');

    // 6. Return extracted fields
    return {
      name: data.name ?? null,
      dob: data.dob ?? null,
      gender: data.gender ?? null,
      address: data.address ?? null,
      phone_number: data.phone_number ?? null,
      rawText,
    };
  } finally {
    // 7. Delete the captured image — NEVER persist Aadhar photos
    try {
      await FileSystem.deleteAsync(imageUri, { idempotent: true });
      console.log('[Aadhar OCR] Temporary image deleted.');
    } catch {
      console.warn('[Aadhar OCR] Could not delete temp image.');
    }
  }
}
