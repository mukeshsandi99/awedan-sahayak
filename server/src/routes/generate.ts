/**
 * POST /api/generate-application
 *
 * Accepts form data and an application type, returns a Claude/DeepSeek-
 * generated formal Hindi legal application following the Awedan Sahayak
 * 7-part structural format.
 */

import { Router, Request, Response } from 'express';
import { draftApplication } from '../services/aiService';

export const generateRouter = Router();

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
  console.log('[POST /generate-application] Received request.');

  const validation = validateGenerateRequest(req.body);
  if (!validation.valid) {
    console.log('[POST /generate-application] Validation failed:', validation.error);
    res.status(400).json({ error: validation.error });
    return;
  }

  const { applicationName, officeType, promptTemplate, formData } = validation.data;
  console.log(`[POST /generate-application] Type: ${applicationName} | Office: ${officeType}`);
  console.log(`[POST /generate-application] Form fields (${Object.keys(formData).length}):`, Object.keys(formData).join(', '));
  // Debug: print every field with its value (truncated for log readability)
  console.log('[POST /generate-application] === RECEIVED FORM DATA ===');
  for (const [k, v] of Object.entries(formData)) {
    const val = typeof v === 'string' ? v : JSON.stringify(v);
    console.log(`[POST /generate-application]   ${k}: "${val.substring(0, 100)}"`);
  }
  console.log('[POST /generate-application] === END FORM DATA ===');

  try {
    const result = await draftApplication({
      applicationName,
      officeType,
      promptTemplate,
      formData,
    });

    console.log(`[POST /generate-application] Success — ${result.generatedText.length} chars, ${result.provider}/${result.model}`);
    res.json({
      success: true,
      generatedText: result.generatedText,
      metadata: {
        provider: result.provider,
        model: result.model,
        usage: result.usage,
      },
    });
  } catch (err: any) {
    console.error('[POST /generate-application] Failed:', err.message);
    res.status(500).json({
      error: 'आवेदन पत्र जनरेट करने में त्रुटि। / Failed to generate application.',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});
