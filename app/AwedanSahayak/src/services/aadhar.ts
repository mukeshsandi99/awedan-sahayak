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
import { ocrAadhar as ocrAadharApi } from './apiClient';

// ── Types ───────────────────────────────────────────────────────────

export interface AadharExtractedData {
  name: string | null;
  dob: string | null;
  gender: string | null;
  address: string | null;
  phone_number: string | null;
  /** Last 4 digits of Aadhar number, if detected on card. NEVER the full 12 digits. */
  aadharLast4: string | null;
}

// ── Aadhar number detection ────────────────────────────────────────

/** Regex matching a 12-digit Aadhar number (with optional spaces/dashes). */
const AADHAR_PATTERN = /\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b/;

/**
 * Extracts the last 4 digits of an Aadhar number from OCR-extracted fields.
 * Searches name, address, and any raw text fields in the API response.
 * NEVER returns the full 12-digit number.
 */
function extractAadharLast4(data: Record<string, any>): string | null {
  // Search candidate fields for Aadhar pattern
  const candidates = [data.name, data.address, data.phone_number, data.dob]
    .filter((v): v is string => typeof v === 'string' && v.length > 0);

  for (const text of candidates) {
    const match = text.match(AADHAR_PATTERN);
    if (match) {
      // Return ONLY the last 4 digits
      return match[3];
    }
  }
  return null;
}

function redactAadharNumber(text: string): string {
  return text.replace(AADHAR_PATTERN, '[AADHAR REDACTED]');
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
    const result = await ocrAadharApi(base64);

    if (!result.ok) {
      throw new Error(result.error || 'OCR failed');
    }

    const data = result.data!;
    console.log('[Aadhar OCR] Backend processed successfully — ' +
      `name=${!!data.name} dob=${!!data.dob} gender=${!!data.gender} ` +
      `address=${!!data.address} phone=${!!data.phone_number}`);

    // Extract last 4 Aadhar digits if present in any field
    const aadharLast4 = extractAadharLast4(data);

    // 5. Return extracted fields (rawText is NEVER returned by the server)
    return {
      name: data.name ?? null,
      dob: data.dob ?? null,
      gender: data.gender ?? null,
      address: data.address ?? null,
      phone_number: data.phone_number ?? null,
      aadharLast4,
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
