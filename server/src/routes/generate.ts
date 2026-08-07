/**
 * POST /api/generate-application
 *
 * Accepts form data and an application type, returns a Claude/DeepSeek-
 * generated formal Hindi legal application following the Awedan Sahayak
 * 7-part structural format.
 */

import { Router, Request, Response } from 'express';
import { AIRouter } from '../services/ai/AIRouter';
import { createLogger } from '../config/logger';
import { AIConfig } from '../services/ai/AIConfig';
import { aiLimiter } from '../middleware/rateLimit';

const log = createLogger('Generate');

// ── Error mapping ─────────────────────────────────────────────────────

/** Map AI error codes to HTTP status codes. */
function mapErrorToHttp(err: any): number {
  const code = err?.code ?? '';
  if (code === 'AI_TIMEOUT') return 504;
  if (code === 'AI_RATE_LIMITED') return 429;
  if (code === 'AI_INVALID_INPUT') return 400;
  if (code === 'AI_FACT_MISMATCH') return 422;
  if (code === 'AI_OUTPUT_INVALID') return 422;
  if (code === 'AI_ALL_PROVIDERS_FAILED') return 502;
  if (code === 'AI_INTERNAL_ERROR') return 500;
  if (err?.status === 429) return 429;
  if (err?.status >= 500) return 502;
  return 500;
}

/** Return a user-facing Hindi + English error message for a given code. */
function getErrorMessage(code: string): string {
  switch (code) {
    case 'AI_TIMEOUT':
      return 'समय समाप्त — सर्वर व्यस्त है। कृपया पुनः प्रयास करें। / Request timed out — server is busy. Please try again.';
    case 'AI_RATE_LIMITED':
      return 'बहुत अधिक अनुरोध — कृपया कुछ समय बाद प्रयास करें। / Too many requests — please try again later.';
    case 'AI_INVALID_INPUT':
      return 'अमान्य इनपुट — कृपया सभी आवश्यक फ़ील्ड भरें। / Invalid input — please fill all required fields.';
    case 'AI_FACT_MISMATCH':
      return 'तथ्य सत्यापन विफल — AI द्वारा तथ्य सही नहीं रखे गए। कृपया पुनः प्रयास करें। / Fact verification failed — please try again.';
    case 'AI_OUTPUT_INVALID':
      return 'AI से अपूर्ण उत्तर — कृपया पुनः प्रयास करें। / Incomplete AI response — please try again.';
    case 'AI_ALL_PROVIDERS_FAILED':
      return 'सभी AI सेवाएं अनुपलब्ध — कृपया बाद में प्रयास करें। / All AI services unavailable — please try later.';
    default:
      return 'आवेदन पत्र जनरेट करने में त्रुटि। / Failed to generate application.';
  }
}


export const generateRouter = Router();

// Apply AI rate limiter to all routes in this router
generateRouter.use(aiLimiter());

// ── Validation ─────────────────────────────────────────────────────

interface GenerateRequest {
  applicationName: string;
  officeType: string;
  promptTemplate: string;
  formData: Record<string, string>;
}

function validateGenerateRequest(body: any): { valid: true; data: GenerateRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }
  if (!body.applicationName || typeof body.applicationName !== 'string') {
    return { valid: false, error: 'Missing or invalid "applicationName" (string required).' };
  }
  if (!body.officeType || typeof body.officeType !== 'string') {
    return { valid: false, error: 'Missing or invalid "officeType" (string required).' };
  }
  if (!body.promptTemplate || typeof body.promptTemplate !== 'string') {
    return { valid: false, error: 'Missing or invalid "promptTemplate" (string required).' };
  }
  if (!body.formData || typeof body.formData !== 'object' || Array.isArray(body.formData)) {
    return { valid: false, error: 'Missing or invalid "formData" (object required).' };
  }
  return {
    valid: true,
    data: {
      applicationName: body.applicationName,
      officeType: body.officeType,
      promptTemplate: body.promptTemplate,
      formData: body.formData,
    },
  };
}

// ── Route handler ──────────────────────────────────────────────────

generateRouter.post('/generate-application', async (req: Request, res: Response) => {
  log.info('[POST /generate-application] Received request.');

  const validation = validateGenerateRequest(req.body);
  if (!validation.valid) {
    log.info('[POST /generate-application] Validation failed:', validation.error);
    res.status(400).json({ error: validation.error });
    return;
  }

  const { applicationName, officeType, promptTemplate, formData } = validation.data;
  log.info(`[POST /generate-application] Type: ${applicationName} | Office: ${officeType}`);
  log.info(`[POST /generate-application] Form fields (${Object.keys(formData).length}):`, Object.keys(formData).join(', '));
  // Debug: print every field with its value (truncated for log readability)
  log.info('[POST /generate-application] === RECEIVED FORM DATA ===');
  for (const [k, v] of Object.entries(formData)) {
    const val = typeof v === 'string' ? v : JSON.stringify(v);
    log.info(`[POST /generate-application]   ${k}: "${val.substring(0, 100)}"`);
  }
  log.info('[POST /generate-application] === END FORM DATA ===');

  try {
    const result = await AIRouter.generateApplication({
      applicationName,
      officeType,
      promptTemplate,
      formData,
    });

    log.info(`[POST /generate-application] Success — ${result.generatedText.length} chars, ${result.provider}/${result.model} (fallback=${result.fallbackUsed})`);
    res.json({
      success: true,
      generatedText: result.generatedText,
      metadata: {
        provider: result.provider,
        model: result.model,
        usage: result.usage,
        fallbackUsed: result.fallbackUsed,
        durationMs: result.durationMs,
      },
    });
  } catch (err: any) {
    const errorCode = err.code ?? 'AI_UNKNOWN';
    const statusCode = mapErrorToHttp(err);
    const errorDetail = {
      code: errorCode,
      message: err.message?.substring(0, 200) ?? 'Unknown error',
      stack: err.stack?.substring(0, 500) ?? undefined,
      statusCode,
      timeout: errorCode === 'AI_TIMEOUT' ? AIConfig.totalTimeoutMs : undefined,
      provider: err.provider ?? undefined,
      timestamp: new Date().toISOString(),
    };

    log.error(
      '[POST /generate-application] FAILED | code=' + errorCode + ' http=' + statusCode + ' | ' +
      'msg="' + (err.message || '').substring(0, 120) + '" | ' +
      'stack="' + (err.stack || '').substring(0, 200) + '"',
    );

    res.status(statusCode).json({
      error: getErrorMessage(errorCode),
      code: errorCode,
      detail: process.env.NODE_ENV === 'development' ? errorDetail : { code: errorCode },
    });
  }
});

// ── Custom application generation ─────────────────────────────────────

interface CustomGenerateRequest {
  officeName: string;
  recipientDesignation?: string | null;
  customDescription: string;
  formData: Record<string, string>;
}

function validateCustomGenerateRequest(body: any): { valid: true; data: CustomGenerateRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }
  if (!body.officeName || typeof body.officeName !== 'string' || !body.officeName.trim()) {
    return { valid: false, error: 'Missing or invalid "officeName" (non-empty string required).' };
  }
  if (body.recipientDesignation !== undefined && body.recipientDesignation !== null && typeof body.recipientDesignation !== 'string') {
    return { valid: false, error: 'Invalid "recipientDesignation" (string or null expected).' };
  }
  if (!body.customDescription || typeof body.customDescription !== 'string' || !body.customDescription.trim()) {
    return { valid: false, error: 'Missing or invalid "customDescription" (non-empty string required).' };
  }
  if (!body.formData || typeof body.formData !== 'object' || Array.isArray(body.formData)) {
    return { valid: false, error: 'Missing or invalid "formData" (object required).' };
  }
  return {
    valid: true,
    data: {
      officeName: body.officeName.trim(),
      recipientDesignation: body.recipientDesignation?.trim() || null,
      customDescription: body.customDescription.trim(),
      formData: body.formData,
    },
  };
}

generateRouter.post('/generate-custom-application', async (req: Request, res: Response) => {
  log.info('[POST /generate-custom-application] Received request.');

  const validation = validateCustomGenerateRequest(req.body);
  if (!validation.valid) {
    log.info('[POST /generate-custom-application] Validation failed:', validation.error);
    res.status(400).json({ error: validation.error });
    return;
  }

  const { officeName, recipientDesignation, customDescription, formData } = validation.data;

  // Merge custom_description into formData so the AI sees it
  const enrichedFormData = {
    ...formData,
    custom_description: customDescription,
  };

  log.info(`[POST /generate-custom-application] Office: ${officeName} | Designation: ${recipientDesignation || '(none)'}`);
  log.info(`[POST /generate-custom-application] Description length: ${customDescription.length} chars`);
  log.info(`[POST /generate-custom-application] Identity fields (${Object.keys(formData).length}):`, Object.keys(formData).join(', '));

  try {
    const result = await AIRouter.generateCustomApplication({
      officeName,
      recipientDesignation,
      formData: enrichedFormData,
    });

    log.info(`[POST /generate-custom-application] Success — ${result.generatedText.length} chars, ${result.provider}/${result.model} (fallback=${result.fallbackUsed})`);
    res.json({
      success: true,
      generatedText: result.generatedText,
      metadata: {
        provider: result.provider,
        model: result.model,
        usage: result.usage,
        isCustom: true,
        fallbackUsed: result.fallbackUsed,
        durationMs: result.durationMs,
      },
    });
  } catch (err: any) {
    const errorCode = err.code ?? 'AI_UNKNOWN';
    const statusCode = mapErrorToHttp(err);

    log.error(
      '[POST /generate-custom-application] FAILED | code=' + errorCode + ' http=' + statusCode + ' | ' +
      'msg="' + (err.message || '').substring(0, 120) + '" | ' +
      'stack="' + (err.stack || '').substring(0, 200) + '"',
    );

    res.status(statusCode).json({
      error: getErrorMessage(errorCode),
      code: errorCode,
      detail: process.env.NODE_ENV === 'development'
        ? { code: errorCode, message: err.message?.substring(0, 200), statusCode, timestamp: new Date().toISOString() }
        : { code: errorCode },
    });
  }
});
