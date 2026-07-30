/**
 * fetchWithTimeout — wrapper around fetch() that rejects with a clear
 * timeout error after `timeoutMs` milliseconds.
 *
 * React Native's `fetch` does not support a timeout parameter.
 * Without this, slow/dead connections (including Render free-tier
 * cold starts) cause an infinite spinner with no error feedback.
 *
 * Usage:
 *   const response = await fetchWithTimeout(url, options, 45_000);
 */

export class FetchTimeoutError extends Error {
  public readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    const seconds = Math.round(timeoutMs / 1000);
    super(
      `सर्वर से कनेक्ट होने में बहुत समय लग गया (${seconds} सेकंड से अधिक)। ` +
        'कृपया अपना इंटरनेट कनेक्शन जाँचें और पुनः प्रयास करें।\n\n' +
        `Server did not respond within ${seconds} seconds. ` +
        'Please check your connection and try again.',
    );
    this.name = 'FetchTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Fetch with a configurable timeout.
 *
 * @param url     - The URL to fetch.
 * @param options - Standard RequestInit (method, headers, body, etc.).
 * @param timeoutMs - Timeout in milliseconds (default: 45 000).
 * @returns The fetch Response (must still be consumed — e.g. .json()).
 * @throws  FetchTimeoutError if the request does not complete within timeoutMs.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 45_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    // AbortController throws an AbortError (DOMException) or a regular Error
    // with name === 'AbortError' depending on the JS engine.
    const isAbort =
      err?.name === 'AbortError' ||
      err?.name === 'FetchTimeoutError' ||
      (err instanceof DOMException && err.name === 'AbortError');

    if (isAbort) {
      throw new FetchTimeoutError(timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export default fetchWithTimeout;
