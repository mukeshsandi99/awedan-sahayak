/**
 * AI-powered application routes:
 *   POST /api/generate-custom-application
 *   POST /api/revise-application
 *   POST /api/review-application
 *   POST /api/government-workflow
 *   POST /api/process-guidance
 *   POST /api/decision-engine
 */

import { Router, Request, Response } from 'express';
import { buildProtectedBlock, findLostFacts, REPAIR_INSTRUCTION, isIdentityCritical } from '../services/factGuard';

export const aiRouter = Router();

// ── Fact block builder ──────────────────────────────────────────────

const FACT_LABELS: Record<string, string> = {
  applicant_name: '\u0928\u093E\u092E', father_name: '\u092A\u093F\u0924\u093E/\u092A\u0924\u093F \u0915\u093E \u0928\u093E\u092E',
  parent_spouse_name: '\u092A\u093F\u0924\u093E/\u092A\u0924\u093F \u0915\u093E \u0928\u093E\u092E',
  village: '\u0917\u093E\u0901\u0935', thana: '\u0925\u093E\u0928\u093E', district: '\u091C\u093F\u0932\u093E',
  state: '\u0930\u093E\u091C\u094D\u092F', mobile: '\u092E\u094B\u092C\u093E\u0907\u0932',
  phone: '\u092E\u094B\u092C\u093E\u0907\u0932', gender: '\u0932\u093F\u0902\u0917',
  age: '\u0906\u092F\u0941', dob: '\u091C\u0928\u094D\u092E \u0924\u093F\u0925\u093F',
  address: '\u092A\u0924\u093E', occupation: '\u0935\u094D\u092F\u0935\u0938\u093E\u092F',
  income: '\u0906\u092F', religion: '\u0927\u0930\u094D\u092E', caste: '\u091C\u093E\u0924\u093F',
};
function buildFactBlock(formData: Record<string, string>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(formData)) {
    if (value && String(value).trim()) {
      const label = FACT_LABELS[key] || key;
      lines.push(`${label}: ${String(value).trim()}`);
    }
  }
  return lines.join('\n');
}

// ── Unified AI call helper ─────────────────────────────────────────

async function callAi(systemPrompt: string, userMessage: string, maxTokens: number = 8000): Promise<string> {
  const { getActiveConfig } = await import('../services/aiService');
  const config = getActiveConfig();

  if (config.provider === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`DeepSeek API ${response.status}: ${errText.substring(0, 200)}`);
    }

    const data: any = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';
    return content.replace(/\*\*/g, '').replace(/__/g, '');
  }

  // Claude fallback via Anthropic SDK
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured for Claude fallback');

  const AnthropicModule = await import('@anthropic-ai/sdk');
  const Anthropic = AnthropicModule.default ?? AnthropicModule.Anthropic;
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: config.model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const content: any = response.content;
  if (typeof content === 'string') return content.replace(/\*\*/g, '').replace(/__/g, '');
  if (Array.isArray(content)) {
    return content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n')
      .replace(/\*\*/g, '').replace(/__/g, '');
  }
  return '';
}

// ── POST /api/generate-custom-application ───────────────────────────

aiRouter.post('/generate-custom-application', async (req: Request, res: Response) => {
  console.log('[POST /generate-custom-application] Received.');
  const { officeName, recipientDesignation, customDescription, formData } = req.body ?? {};

  if (!officeName || !customDescription || !formData) {
    res.status(400).json({ error: 'Missing required fields: officeName, customDescription, formData' });
    return;
  }

  const designation = recipientDesignation || '\u0938\u0902\u092C\u0902\u0927\u093F\u0924 \u0905\u0927\u093F\u0915\u093E\u0930\u0940';
  const factBlock = buildFactBlock(formData);

  const sysPrompt = '\u0906\u092A \u0939\u093F\u0902\u0926\u0940 \u0938\u0930\u0915\u093E\u0930\u0940 \u0906\u0935\u0947\u0926\u0928 \u092A\u0924\u094D\u0930 \u0932\u0947\u0916\u0915 \u0939\u0948\u0902\u0964 \u0928\u0940\u091A\u0947 "\u0905\u092A\u0930\u093F\u0935\u0930\u094D\u0924\u0928\u0940\u092F \u0924\u0925\u094D\u092F" \u092E\u0947\u0902 \u092A\u094D\u0930\u093E\u0930\u094D\u0925\u0940 \u0915\u0940 \u0938\u092D\u0940 \u091C\u093E\u0928\u0915\u093E\u0930\u0940 \u0926\u0940 \u0917\u0908 \u0939\u0948\u0964 \u0939\u0930 \u092E\u093E\u0928 \u0915\u094B \u091C\u094D\u092F\u094B\u0902 \u0915\u093E \u0924\u094D\u092F\u094B\u0902 \u0906\u0935\u0947\u0926\u0928 \u092E\u0947\u0902 \u0921\u093E\u0932\u0947\u0902\u0964 \u0915\u094B\u0908 \u0928\u093E\u092E, \u092A\u0924\u093E, \u0924\u093E\u0930\u0940\u0916, \u0930\u093E\u0936\u093F, \u0917\u093E\u0901\u0935, \u091C\u093F\u0932\u093E \u0928 \u092C\u0926\u0932\u0947\u0902\u0964 Dots, ??????, \u092F\u093E brackets \u0928 \u0932\u093F\u0916\u0947\u0902\u0964 \u091C\u094B \u0928\u0939\u0940\u0902 \u0926\u093F\u092F\u093E \u0917\u092F\u093E \u0909\u0938\u0947 \u091B\u094B\u0921\u093C \u0926\u0947\u0902\u0964 \u092E\u093E\u0930\u094D\u0915\u0921\u093E\u0909\u0928 \u0928\u0939\u0940\u0902, \u0915\u0947\u0935\u0932 \u0938\u093E\u0926\u093E \u092A\u093E\u0920\u0964';

  const userMsg = `\u092A\u094D\u0930\u093E\u092A\u094D\u0924\u0915\u0930\u094D\u0924\u093E: ${designation}, ${officeName}
\u0906\u0935\u0947\u0926\u0928 \u0915\u093E \u0935\u093F\u0935\u0930\u0923: ${customDescription}

\u0905\u092A\u0930\u093F\u0935\u0930\u094D\u0924\u0928\u0940\u092F \u0924\u0925\u094D\u092F \u2014 \u0907\u0928\u094D\u0939\u0947\u0902 \u0905\u0915\u094D\u0937\u0930\u0936\u0903 \u0906\u0935\u0947\u0926\u0928 \u092E\u0947\u0902 \u0921\u093E\u0932\u0947\u0902, \u092C\u0926\u0932\u0947\u0902 \u0928\u0939\u0940\u0902:
${factBlock}

\u090A\u092A\u0930 \u0926\u093F\u090F \u0917\u090F \u0938\u092D\u0940 \u0924\u0925\u094D\u092F\u094B\u0902 \u0915\u094B \u091C\u094D\u092F\u094B\u0902 \u0915\u093E \u0924\u094D\u092F\u094B\u0902 \u0930\u0916\u0924\u0947 \u0939\u0941\u090F \u090F\u0915 \u0938\u0902\u092A\u0942\u0930\u094D\u0923 \u0914\u092A\u091A\u093E\u0930\u093F\u0915 \u0939\u093F\u0902\u0926\u0940 \u0906\u0935\u0947\u0926\u0928 \u092A\u0924\u094D\u0930 \u0932\u093F\u0916\u0947\u0902\u0964`;

  try {
    const text = await callAi(sysPrompt, userMsg, 8000);
    const { getActiveConfig } = await import('../services/aiService');
    const config = getActiveConfig();
    res.json({
      success: true,
      generatedText: text,
      metadata: { provider: config.provider, model: config.model, isCustom: true },
    });
  } catch (err: any) {
    console.error('[POST /generate-custom-application] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate custom application.' });
  }
});

// ── POST /api/revise-application ────────────────────────────────────

aiRouter.post('/revise-application', async (req: Request, res: Response) => {
  console.log('[POST /revise-application] Received.');
  const { originalText, correctionInstruction, originalFormData, formData } = req.body ?? {};

  if (!originalText || !correctionInstruction) {
    res.status(400).json({ error: 'Missing required fields: originalText, correctionInstruction' });
    return;
  }

  const protectedFormData = originalFormData ?? formData ?? {};
  const factBlock = buildProtectedBlock(protectedFormData);

  const sysPrompt = '\u0906\u092A \u0939\u093F\u0902\u0926\u0940 \u0938\u0930\u0915\u093E\u0930\u0940 \u0906\u0935\u0947\u0926\u0928 \u092A\u0924\u094D\u0930 \u0938\u0902\u092A\u093E\u0926\u0915 \u0939\u0948\u0902\u0964 \u092E\u0942\u0932 \u0906\u0935\u0947\u0926\u0928 \u092E\u0947\u0902 \u0926\u093F\u090F \u0917\u090F \u0938\u092D\u0940 \u0928\u093E\u092E, \u092A\u0924\u0947, \u0924\u093E\u0930\u0940\u0916\u0947\u0902, \u0930\u093E\u0936\u093F\u092F\u093E\u0901 \u0914\u0930 \u0924\u0925\u094D\u092F\u094B\u0902 \u0915\u094B \u091C\u094D\u092F\u094B\u0902 \u0915\u093E \u0924\u094D\u092F\u094B\u0902 \u0930\u0916\u0947\u0902\u0964 \u0915\u0947\u0935\u0932 \u0938\u0941\u0927\u093E\u0930 \u0928\u093F\u0930\u094D\u0926\u0947\u0936 \u092E\u0947\u0902 \u0915\u0939\u0940 \u0917\u0908 \u092C\u093E\u0924\u0947\u0902 \u092C\u0926\u0932\u0947\u0902\u0964 \u092C\u093E\u0915\u0940 \u0938\u092C \u091C\u094D\u092F\u094B\u0902 \u0915\u093E \u0924\u094D\u092F\u094B\u0902 \u0930\u0916\u0947\u0902\u0964 \u0915\u0947\u0935\u0932 \u0938\u0902\u0936\u094B\u0927\u093F\u0924 \u092A\u093E\u0920 \u0932\u094C\u091F\u093E\u090F\u0902, \u0915\u094B\u0908 \u0938\u094D\u092A\u0937\u094D\u091F\u0940\u0915\u0930\u0923 \u0928\u0939\u0940\u0902\u0964 \u092E\u093E\u0930\u094D\u0915\u0921\u093E\u0909\u0928 \u0928\u0939\u0940\u0902\u0964';

  const userMsg = `\u092E\u0942\u0932 \u0906\u0935\u0947\u0926\u0928 \u092A\u0924\u094D\u0930:
--- START ---
${originalText}
--- END ---

\u0938\u0941\u0927\u093E\u0930 \u0928\u093F\u0930\u094D\u0926\u0947\u0936:
${correctionInstruction}
${factBlock ? '\n\u0905\u092A\u0930\u093F\u0935\u0930\u094D\u0924\u0928\u0940\u092F \u0924\u0925\u094D\u092F \u2014 \u0907\u0928\u094D\u0939\u0947\u0902 \u0928 \u092C\u0926\u0932\u0947\u0902:\n' + factBlock : ''}

\u0915\u0947\u0935\u0932 \u0938\u0902\u0936\u094B\u0927\u093F\u0924 \u0906\u0935\u0947\u0926\u0928 \u092A\u0924\u094D\u0930 \u0932\u094C\u091F\u093E\u090F\u0902:`;

  try {
    let text = await callAi(sysPrompt, userMsg, Math.max(Math.min(originalText.length * 2, 8000), 4000));
    // Validate protected facts survived revision
    let finalText = text;
    const lostFacts = findLostFacts(originalText, finalText, protectedFormData, correctionInstruction);
    if (lostFacts.length > 0) {
      console.log('[revise] ' + lostFacts.length + ' protected fact(s) lost: ' + lostFacts.slice(0, 5).join(', '));
      if (isIdentityCritical(lostFacts)) {
        const repairMsg = REPAIR_INSTRUCTION + '\n\n' + userMsg;
        try {
          const repaired = await callAi(sysPrompt, repairMsg, Math.max(Math.min(originalText.length * 2, 8000), 4000));
          const stillLost = findLostFacts(originalText, repaired, protectedFormData, correctionInstruction);
          if (stillLost.length < lostFacts.length) {
            finalText = repaired;
            console.log('[revise] Repair recovered ' + (lostFacts.length - stillLost.length) + ' facts');
          }
        } catch (e) { /* repair failed, keep original text */ }
      }
    }
    const { getActiveConfig } = await import('../services/aiService');
    const config = getActiveConfig();
    res.json({
      success: true,
      generatedText: text,
      metadata: { provider: config.provider, model: config.model },
    });
  } catch (err: any) {
    console.error('[POST /revise-application] Error:', err.message);
    res.status(500).json({ error: 'Failed to revise application.' });
  }
});

// ── POST /api/review-application ────────────────────────────────────

aiRouter.post('/review-application', async (req: Request, res: Response) => {
  console.log('[POST /review-application] Received.');
  const { generatedText, applicationName, officeType, formData } = req.body ?? {};

  if (!generatedText || !applicationName) {
    res.status(400).json({ error: 'Missing required fields: generatedText, applicationName' });
    return;
  }

  const sysPrompt = '\u0906\u092A \u090F\u0915 \u0935\u0930\u093F\u0937\u094D\u0920 \u0938\u0930\u0915\u093E\u0930\u0940 \u0905\u0927\u093F\u0915\u093E\u0930\u0940 \u0939\u0948\u0902 \u091C\u094B \u0906\u0935\u0947\u0926\u0928 \u092A\u0924\u094D\u0930\u094B\u0902 \u0915\u0940 \u0938\u092E\u0940\u0915\u094D\u0937\u093E \u0915\u0930\u0924\u0947 \u0939\u0948\u0902\u0964 \u0906\u092A\u0915\u094B \u090F\u0915 \u0939\u093F\u0902\u0926\u0940 \u0906\u0935\u0947\u0926\u0928 \u092A\u0924\u094D\u0930 \u0926\u093F\u092F\u093E \u091C\u093E\u090F\u0917\u093E\u0964 JSON \u092A\u094D\u0930\u093E\u0930\u0942\u092A \u092E\u0947\u0902 \u0935\u093F\u0938\u094D\u0924\u0943\u0924 \u0938\u092E\u0940\u0915\u094D\u0937\u093E \u092A\u094D\u0930\u0926\u093E\u0928 \u0915\u0930\u0947\u0902\u0964\n\n' +
    '\u0928\u093F\u092E\u094D\u0928\u0932\u093F\u0916\u093F\u0924 JSON \u0938\u094D\u0915\u0940\u092E\u093E \u0915\u093E \u092A\u093E\u0932\u0928 \u0915\u0930\u0947\u0902 (\u0915\u0947\u0935\u0932 JSON \u0932\u094C\u091F\u093E\u090F\u0902, \u0915\u094B\u0908 \u0905\u0928\u094D\u092F \u092A\u093E\u0920 \u0928\u0939\u0940\u0902):\n' +
    '{\n  "overallScore": <0-100>,\n  "acceptanceProbability": "<High/Medium/Low>",\n  "scores": {\n    "completeness": <0-100>,\n    "clarity": <0-100>,\n    "formality": <0-100>,\n    "legalSoundness": <0-100>,\n    "structure": <0-100>\n  },\n  "missingInformation": [\n    {"label": "<field name>", "description": "<what is missing>", "priority": "<high/medium/low>"}\n  ],\n  "risks": [\n    {"risk": "<risk name>", "description": "<why it is risky>", "severity": "<high/medium/low>"}\n  ],\n  "suggestions": [\n    {"title": "<suggestion>", "description": "<details>", "autoFixPrompt": "<exact instruction to fix>"}\n  ],\n  "summary": "<2-3 line Hindi summary>"\n}';

  const userMsg = `\u0906\u0935\u0947\u0926\u0928 \u092A\u094D\u0930\u0915\u093E\u0930: ${applicationName}
\u0915\u093E\u0930\u094D\u092F\u093E\u0932\u092F: ${officeType || 'N/A'}
${formData ? '\u092B\u0949\u0930\u094D\u092E \u0921\u0947\u091F\u093E: ' + JSON.stringify(formData) : ''}

\u0906\u0935\u0947\u0926\u0928 \u092A\u0924\u094D\u0930:
--- START ---
${generatedText}
--- END ---

\u0915\u0947\u0935\u0932 JSON \u0932\u094C\u091F\u093E\u090F\u0902:`;

  try {
    const text = await callAi(sysPrompt, userMsg, 8000);
    let review: any;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      review = jsonMatch ? JSON.parse(jsonMatch[0]) : { overallScore: 50, summary: 'Review unavailable.', error: 'Could not parse AI response' };
    } catch {
      review = { overallScore: 50, summary: 'Review parse error.', error: 'JSON parse failed' };
    }
    const { getActiveConfig } = await import('../services/aiService');
    const config = getActiveConfig();
    res.json({ success: true, review, metadata: { provider: config.provider, model: config.model } });
  } catch (err: any) {
    console.error('[POST /review-application] Error:', err.message);
    res.status(500).json({ error: 'Failed to review application.' });
  }
});

// ── POST /api/government-workflow ───────────────────────────────────

aiRouter.post('/government-workflow', async (req: Request, res: Response) => {
  console.log('[POST /government-workflow] Received.');
  const { applicationName, officeType, generatedText, formData } = req.body ?? {};

  if (!applicationName || !officeType) {
    res.status(400).json({ error: 'Missing required fields: applicationName, officeType' });
    return;
  }

  const officeLabels: Record<string, string> = {
    thana: '\u0925\u093E\u0928\u093E', block: '\u0924\u0939\u0938\u0940\u0932/\u092C\u094D\u0932\u0949\u0915', bdo: '\u0916\u0902\u0921 \u0935\u093F\u0915\u093E\u0938 \u0915\u093E\u0930\u094D\u092F\u093E\u0932\u092F',
    co: '\u0938\u0930\u094D\u0915\u093F\u0932 \u0915\u093E\u0930\u094D\u092F\u093E\u0932\u092F', sdo: '\u0905\u0928\u0941\u0935\u093F\u092D\u093E\u0917\u0940\u092F \u0915\u093E\u0930\u094D\u092F\u093E\u0932\u092F', sp: '\u092A\u0941\u0932\u093F\u0938 \u0905\u0927\u0940\u0915\u094D\u0937\u0915 \u0915\u093E\u0930\u094D\u092F\u093E\u0932\u092F',
    dc: '\u091C\u093F\u0932\u093E \u0938\u092E\u093E\u0939\u0930\u0923\u093E\u0932\u092F', court: '\u0928\u094D\u092F\u093E\u092F\u093E\u0932\u092F', bank: '\u092C\u0948\u0902\u0915',
  };
  const officeName = officeLabels[officeType] || officeType;

  const sysPrompt = '\u0906\u092A \u092D\u093E\u0930\u0924\u0940\u092F \u0938\u0930\u0915\u093E\u0930\u0940 \u0915\u093E\u0930\u094D\u092F\u093E\u0932\u092F \u092A\u094D\u0930\u0915\u094D\u0930\u093F\u092F\u093E\u0913\u0902 \u0915\u0947 \u0935\u093F\u0936\u0947\u0937\u091C\u094D\u091E \u0939\u0948\u0902\u0964 JSON \u092A\u094D\u0930\u093E\u0930\u0942\u092A \u092E\u0947\u0902 \u0938\u0930\u0915\u093E\u0930\u0940 \u092A\u094D\u0930\u0915\u094D\u0930\u093F\u092F\u093E \u0915\u0940 \u091C\u093E\u0928\u0915\u093E\u0930\u0940 \u0926\u0947\u0902\u0964\n\n' +
    'JSON \u0938\u094D\u0915\u0940\u092E\u093E:\n' +
    '{\n  "submissionOffice": "<office name in Hindi>",\n  "officerDesignation": "<officer designation>",\n  "officeTiming": "<office hours>",\n  "lunchTime": "<lunch break>",\n  "thingsToCarry": ["<item 1>", "<item 2>", ...],\n  "processTimeline": [\n    {"step": 1, "title": "<step name>", "description": "<details>", "estimatedTime": "<duration>"}\n  ],\n  "requiredDocuments": [\n    {"name": "<document>", "copies": "<number>", "reason": "<why needed>"}\n  ],\n  "estimatedTime": {"best": "<duration>", "average": "<duration>", "worst": "<duration>"},\n  "commonMistakes": ["<mistake>", ...],\n  "warnings": [{"message": "<warning>"}],\n  "appealProcess": {"office": "<appeal office>", "whenToUse": "<condition>"},\n  "faqs": [{"question": "<Q>", "answer": "<A>"}],\n  "disclaimer": "<Hindi disclaimer>"\n}\n\n' +
    '\u0915\u0947\u0935\u0932 JSON \u0932\u094C\u091F\u093E\u090F\u0902\u0964';

  const userMsg = `\u0906\u0935\u0947\u0926\u0928 \u092A\u094D\u0930\u0915\u093E\u0930: ${applicationName}
\u0915\u093E\u0930\u094D\u092F\u093E\u0932\u092F: ${officeName} (${officeType})
${formData ? '\u0915\u094D\u0937\u0947\u0924\u094D\u0930: ' + [formData.state, formData.district, formData.police_station].filter(Boolean).join(', ') : ''}

\u0915\u0947\u0935\u0932 JSON \u0932\u094C\u091F\u093E\u090F\u0902:`;

  try {
    const text = await callAi(sysPrompt, userMsg, 8000);
    let workflow: any;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      workflow = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Could not parse' };
    } catch {
      workflow = { error: 'JSON parse failed' };
    }
    res.json({ success: true, workflow });
  } catch (err: any) {
    console.error('[POST /government-workflow] Error:', err.message);
    res.status(500).json({ error: 'Failed to get workflow.' });
  }
});

// ── POST /api/process-guidance ──────────────────────────────────────

aiRouter.post('/process-guidance', async (req: Request, res: Response) => {
  console.log('[POST /process-guidance] Received.');
  const { applicationName, officeType, generatedText, formData, userLocation } = req.body ?? {};

  if (!applicationName || !officeType) {
    res.status(400).json({ error: 'Missing required fields: applicationName, officeType' });
    return;
  }

  const sysPrompt = '\u0906\u092A \u092D\u093E\u0930\u0924\u0940\u092F \u0938\u0930\u0915\u093E\u0930\u0940 \u092A\u094D\u0930\u0915\u094D\u0930\u093F\u092F\u093E \u092E\u093E\u0930\u094D\u0917\u0926\u0930\u094D\u0936\u0915 \u0939\u0948\u0902\u0964 JSON \u092A\u094D\u0930\u093E\u0930\u0942\u092A \u092E\u0947\u0902 \u092E\u093E\u0930\u094D\u0917\u0926\u0930\u094D\u0936\u0928 \u0926\u0947\u0902\u0964\n\n' +
    'JSON \u0938\u094D\u0915\u0940\u092E\u093E:\n' +
    '{\n  "caseCategory": "<category in Hindi>",\n  "confidence": <0-1>,\n  "primaryOffice": "<office name>",\n  "recipientDesignation": "<designation>",\n  "submissionMethods": ["<method 1>", ...],\n  "requiredDocuments": [\n    {"name": "<doc>", "required": true/false, "reason": "<why>"}\n  ],\n  "submissionSteps": ["<step>", ...],\n  "expectedProcess": ["<stage>", ...],\n  "followUpAdvice": ["<advice>", ...],\n  "escalationPath": [\n    {"order": 1, "office": "<office>", "whenToUse": "<condition>"}\n  ],\n  "processTimeline": [\n    {"order": 1, "title": "<stage>", "description": "<details>", "optional": false}\n  ],\n  "urgentSafety": {"isUrgent": false, "message": "", "actions": []},\n  "disclaimer": "<disclaimer>"\n}\n' +
    '\u0915\u0947\u0935\u0932 JSON \u0932\u094C\u091F\u093E\u090F\u0902\u0964';

  const locInfo = userLocation
    ? `\u0938\u094D\u0925\u093E\u0928: ${[userLocation.state, userLocation.district, userLocation.policeStation, userLocation.block].filter(Boolean).join(', ')}`
    : '';

  const userMsg = `\u0906\u0935\u0947\u0926\u0928: ${applicationName} | \u0915\u093E\u0930\u094D\u092F\u093E\u0932\u092F: ${officeType}
${locInfo}
${formData ? '\u092B\u0949\u0930\u094D\u092E \u092B\u0940\u0932\u094D\u0921: ' + Object.keys(formData).join(', ') : ''}

\u0915\u0947\u0935\u0932 JSON \u0932\u094C\u091F\u093E\u090F\u0902:`;

  try {
    const text = await callAi(sysPrompt, userMsg, 8000);
    let guidance: any;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      guidance = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Could not parse' };
    } catch {
      guidance = { error: 'JSON parse failed' };
    }
    res.json({ success: true, guidance });
  } catch (err: any) {
    console.error('[POST /process-guidance] Error:', err.message);
    res.status(500).json({ error: 'Failed to get guidance.' });
  }
});

// ── POST /api/decision-engine ───────────────────────────────────────

aiRouter.post('/decision-engine', async (req: Request, res: Response) => {
  console.log('[POST /decision-engine] Received.');
  const { applicationName, officeType, generatedText, formData } = req.body ?? {};

  if (!generatedText || !applicationName) {
    res.status(400).json({ error: 'Missing required fields: generatedText, applicationName' });
    return;
  }

  const sysPrompt = '\u0906\u092A \u090F\u0915 AI \u0928\u093F\u0930\u094D\u0923\u092F \u0907\u0902\u091C\u0928 \u0939\u0948\u0902\u0964 \u0906\u0935\u0947\u0926\u0928 \u092A\u0924\u094D\u0930 \u0915\u093E \u0935\u093F\u0936\u094D\u0932\u0947\u0937\u0923 \u0915\u0930 JSON \u092E\u0947\u0902 \u0928\u093F\u0930\u094D\u0923\u092F \u0926\u0947\u0902\u0964\n\n' +
    'JSON \u0938\u094D\u0915\u0940\u092E\u093E:\n' +
    '{\n  "readiness": "<READY/NEEDS_IMPROVEMENT/NOT_RECOMMENDED>",\n  "readinessScore": <0-100>,\n  "summary": "<Hindi summary>",\n  "riskMatrix": [\n    {"category": "<category>", "level": "<High/Medium/Low>", "description": "<details>"}\n  ],\n  "issues": [\n    {"description": "<issue>", "fix": "<how to fix>", "priority": "<Critical/High/Medium/Low>"}\n  ],\n  "successPrediction": {\n    "level": "<High/Medium/Low>",\n    "confidence": <0-1>,\n    "explanation": "<Hindi explanation>"\n  },\n  "checklist": {\n    "beforeSubmission": ["<item>", ...],\n    "atSubmission": ["<item>", ...],\n    "afterSubmission": ["<item>", ...]\n  }\n}\n' +
    '\u0915\u0947\u0935\u0932 JSON \u0932\u094C\u091F\u093E\u090F\u0902\u0964';

  const userMsg = `\u0906\u0935\u0947\u0926\u0928: ${applicationName} | \u0915\u093E\u0930\u094D\u092F\u093E\u0932\u092F: ${officeType || 'N/A'}

\u0906\u0935\u0947\u0926\u0928 \u092A\u0924\u094D\u0930:
--- START ---
${generatedText.substring(0, 3000)}
--- END ---

\u0915\u0947\u0935\u0932 JSON \u0932\u094C\u091F\u093E\u090F\u0902:`;

  try {
    const text = await callAi(sysPrompt, userMsg, 8000);
    let decision: any;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      decision = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Could not parse' };
    } catch {
      decision = { error: 'JSON parse failed' };
    }
    res.json({ success: true, decision });
  } catch (err: any) {
    console.error('[POST /decision-engine] Error:', err.message);
    res.status(500).json({ error: 'Failed to analyze.' });
  }
});
