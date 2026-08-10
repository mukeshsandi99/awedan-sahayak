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
import { extractProtectedFacts } from '../services/ai/ProtectedFacts';
import { validateRelationships } from '../services/ai/RelationshipValidator';
import { detectForbiddenInventions, checkOwnershipSafety, checkAllegationSafety } from '../services/ai/ForbiddenDetector';
import { computeFactDiff, sanitizeForProduction } from '../services/ai/FactDiff';
import { generateFallbackApplication } from '../services/ai/FallbackGenerator';

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

    // ═══════════════════════════════════════════════════════════════════
    // FINAL SAFETY GATE — Run before sending ANY text to user
    // ═══════════════════════════════════════════════════════════════════
    const safetyFacts = extractProtectedFacts(formData);
    const safetyRel = validateRelationships(safetyFacts, result.generatedText);
    const safetyForbidden = detectForbiddenInventions(result.generatedText, safetyFacts.allegations);
    const safetyOwnership = checkOwnershipSafety(result.generatedText, safetyFacts.ownershipBasis || '');
    const safetyAllegation = checkAllegationSafety(result.generatedText, safetyFacts.allegations);
    const safetyDiff = computeFactDiff(safetyFacts, result.generatedText, safetyRel, safetyForbidden, safetyOwnership.safe, safetyAllegation.safe);

    const validationMeta = {
      protectedPeopleCount: safetyFacts.people.length,
      allegationsCount: safetyFacts.allegations.length,
      allegationsSource: safetyFacts.allegations.length > 0 ? 'extracted' : 'EMPTY',
      relationshipErrors: safetyRel.errors.length,
      forbiddenFindings: safetyForbidden.findings.length,
      forbiddenCritical: safetyForbidden.findings.filter(f => f.severity === 'CRITICAL').length,
      criticalFailuresCount: safetyDiff.missing + safetyDiff.changed + safetyDiff.invented,
      repairAttempted: result.repairApplied ?? false,
      fallbackApplied: result.fallbackUsed,
      finalValidationStatus: safetyDiff.status,
      factDiff: sanitizeForProduction(safetyDiff),
    };

    // If the final gate fails AND fallback wasn't already used, force fallback
    let finalText = result.generatedText;
    let finalFallbackUsed = result.fallbackUsed;
    let finalRepairApplied = result.repairApplied ?? false;

    if (safetyDiff.status === 'FAIL' && !result.fallbackUsed) {
      log.warn(`[SAFETY GATE] Unsafe AI text detected — forcing deterministic fallback. ${sanitizeForProduction(safetyDiff)}`);
      finalText = generateFallbackApplication({
        facts: safetyFacts,
        officeType,
        applicationName,
        userDescription: formData['custom_description'] || formData['incident_details'] || '',
      });
      finalFallbackUsed = true;
      finalRepairApplied = false;

      // Re-validate fallback
      const fbRel = validateRelationships(safetyFacts, finalText);
      const fbForbidden = detectForbiddenInventions(finalText, safetyFacts.allegations);
      const fbDiff = computeFactDiff(safetyFacts, finalText, fbRel, fbForbidden, true, true);
      if (fbDiff.status !== 'PASS') {
        log.error(`[SAFETY GATE] CRITICAL: Even fallback failed validation! ${sanitizeForProduction(fbDiff)}`);
      }
      validationMeta.fallbackApplied = true;
      validationMeta.finalValidationStatus = fbDiff.status;
    }

    log.info(`[POST /generate-application] ${validationMeta.factDiff}`);

    res.json({
      success: true,
      generatedText: finalText,
      metadata: {
        buildSha: '93ba4a9',
        provider: result.provider,
        model: result.model,
        usage: result.usage,
        fallbackUsed: finalFallbackUsed,
        durationMs: result.durationMs,
        qualityScore: result.qualityScore,
        repairApplied: finalRepairApplied,
        refinementAvailable: result.refinementAvailable ?? false,
        _validation: validationMeta,
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
// REMOVED: Duplicate /generate-custom-application handler.
// This route is now served exclusively by aiRoutes.ts which uses a simpler
// direct callAi() approach consistent with all other AI auxiliary routes
// (revise, review, government-workflow, process-guidance, decision-engine).
// The removed AIRouter-based version added postInterpolate + fact validation
// that introduced instability with DeepSeek v4-flash.
