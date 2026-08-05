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
import { aiLimiter } from '../middleware/rateLimit';

const log = createLogger('Generate');

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

    log.info(`[POST /generate-application] Success — ${result.generatedText.length} chars, ${result.provider}/${result.model} (fallback=${result.fallbackUsed}, repair=${result.repairApplied ?? false}, qScore=${result.qualityScore ?? 'N/A'})`);
    res.json({
      success: true,
      generatedText: result.generatedText,
      metadata: {
        provider: result.provider,
        model: result.model,
        usage: result.usage,
        fallbackUsed: result.fallbackUsed,
        durationMs: result.durationMs,
        qualityScore: result.qualityScore,
        repairApplied: result.repairApplied ?? false,
        refinementAvailable: result.refinementAvailable ?? false,
      },
    });
  } catch (err: any) {
    log.error('[POST /generate-application] Failed:', err.message);
    res.status(500).json({
      error: 'आवेदन पत्र जनरेट करने में त्रुटि। / Failed to generate application.',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
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

    log.info(`[POST /generate-custom-application] Success — ${result.generatedText.length} chars, ${result.provider}/${result.model} (fallback=${result.fallbackUsed}, repair=${result.repairApplied ?? false})`);
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
        qualityScore: result.qualityScore,
        repairApplied: result.repairApplied ?? false,
        refinementAvailable: result.refinementAvailable ?? false,
      },
    });
  } catch (err: any) {
    log.error('[POST /generate-custom-application] Failed:', err.message);
    res.status(500).json({
      error: 'आवेदन पत्र जनरेट करने में त्रुटि। / Failed to generate application.',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});
