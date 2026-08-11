/**
 * Centralized API Client for Awedan Sahayak.
 *
 * All backend API requests MUST go through this module.
 *
 * SECURITY LIMITATION:
 *   The X-App-Token is a static shared secret bundled in the mobile app.
 *   It provides BASIC ABUSE PROTECTION but is NOT complete user
 *   authentication — mobile app secrets can be reverse-engineered.
 */

import { API_BASE_URL } from '../config';
import { fetchWithTimeout, FetchTimeoutError } from '../utils/fetchWithTimeout';

// This value MUST match APP_API_SECRET on the server.
const APP_TOKEN: string = 'awedan-sahayak-mobile-app-2026';

// ── Types ────────────────────────────────────────────────────────────

export interface ApiRequestOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT = 45_000;

function buildHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-App-Token': APP_TOKEN,
    ...extraHeaders,
  };
}

function normaliseError(err: any): string {
  if (err instanceof FetchTimeoutError) {
    return err.message;
  }
  if (err?.message?.includes('Network request failed') || err?.message?.includes('network')) {
    return (
      'नेटवर्क त्रुटि। कृपया इंटरनेट कनेक्शन जाँचें।\n' +
      'Network error. Please check your internet connection.'
    );
  }
  return (
    'सर्वर त्रुटि। कृपया बाद में पुनः प्रयास करें।\n' +
    'Server error. Please try again later.'
  );
}

// ── Core POST function ───────────────────────────────────────────────

export async function apiPost<T = any>(
  path: string,
  body: Record<string, any>,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${path}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: buildHeaders(options.headers),
        body: JSON.stringify(body),
      },
      timeoutMs,
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const serverError = data?.error ?? '';
      return {
        ok: false,
        status: response.status,
        data: null,
        error: serverError || `Server responded with ${response.status}`,
      };
    }

    return { ok: true, status: response.status, data: data as T, error: '' };
  } catch (err: any) {
    return { ok: false, status: 0, data: null, error: normaliseError(err) };
  }
}

// ── Typed API helpers ────────────────────────────────────────────────

export async function generateApplication(
  applicationName: string,
  officeType: string,
  promptTemplate: string,
  formData: Record<string, string>,
): Promise<ApiResponse<{ generatedText: string; metadata?: any }>> {
  return apiPost('/api/generate-application', {
    applicationName, officeType, promptTemplate, formData,
  });
}

export async function generateCustomApplication(
  officeName: string,
  recipientDesignation: string | null,
  customDescription: string,
  formData: Record<string, string>,
): Promise<ApiResponse<{ generatedText: string; metadata?: any }>> {
  return apiPost('/api/generate-custom-application', {
    officeName, recipientDesignation, customDescription, formData,
  });
}

export async function ocrAadhar(
  imageBase64: string,
): Promise<ApiResponse<{
  name: string | null; dob: string | null; gender: string | null;
  address: string | null; phone_number: string | null;
}>> {
  return apiPost('/api/ocr-aadhar', { imageBase64 }, { timeoutMs: 30_000 });
}

export async function scanDocument(
  imageBase64: string,
): Promise<ApiResponse<{ rawText: string }>> {
  return apiPost('/api/scan-document', { imageBase64 }, { timeoutMs: 45_000 });
}

export async function cleanupOcr(
  rawText: string,
): Promise<ApiResponse<{ cleanedText: string; provider: string }>> {
  return apiPost('/api/cleanup-ocr', { rawText }, { timeoutMs: 30_000 });
}

/**
 * Revise an existing application using AI.
 * @param originalText - The application text to revise
 * @param correctionInstruction - What to do: 'grammar' | 'shorten' | 'expand' | 'review' | custom instruction
 * @param formData - Protected form facts (name, address, dates, etc.) that must not be altered
 */
export async function reviseApplication(
  originalText: string,
  correctionInstruction: string,
  formData?: Record<string, any>,
): Promise<ApiResponse<{ generatedText: string; metadata?: any }>> {
  return apiPost('/api/revise-application', {
    originalText,
    correctionInstruction,
    formData,
  }, { timeoutMs: 90_000 });
}
