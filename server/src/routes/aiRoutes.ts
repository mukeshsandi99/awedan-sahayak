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

export const aiRouter = Router();

// ── Dynamically load AI config ──────────────────────────────────────

async function getAiClient() {
  const { getActiveConfig } = await import('../services/aiService');
  const config = getActiveConfig();
  let Anthropic: any;
  try {
    const sdk = await import('@anthropic-ai/sdk');
    Anthropic = sdk.default ?? sdk.Anthropic;
  } catch {
    throw new Error('@anthropic-ai/sdk is not installed.');
  }
  const client = new Anthropic({
    apiKey: config.apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  });
  return { client, config };
}

async function callAi(systemPrompt: string, userMessage: string, maxTokens: number = 8000): Promise<string> {
  const { client, config } = await getAiClient();
  const response = await client.messages.create({
    model: config.model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
  if (typeof response.content === 'string') return response.content.replace(/\*\*/g, '').replace(/__/g, '');
  if (Array.isArray(response.content)) {
    return response.content
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

  const sysPrompt = `आप एक अनुभवी सरकारी आवेदन पत्र लेखक हैं। आपका कार्य उपयोगकर्ता द्वारा दिए गए विवरण के आधार पर एक औपचारिक हिंदी आवेदन पत्र (प्रार्थना पत्र) तैयार करना है।

संरचना नियम:
1. "सेवा में," से शुरू करें, फिर प्राप्तकर्ता का पदनाम और कार्यालय का नाम लिखें
2. "विषय:" में आवेदन के उद्देश्य का एक-पंक्ति सारांश दें
3. "महोदय," के बाद "सविनय निवेदन है कि..." से शुरू करें
4. आवेदक का पूरा परिचय (नाम, पिता/पति का नाम, गाँव, जिला) दें
5. समस्या या अनुरोध का विस्तृत वर्णन करें
6. स्पष्ट कार्रवाई योग्य अनुरोध के साथ समाप्त करें
7. "धन्यवाद" या "आभार" के साथ समाप्त करें और हस्ताक्षर/नाम/दिनांक दें

भाषा: शुद्ध, औपचारिक हिंदी। कोई मार्कडाउन नहीं, केवल सादा पाठ।`;

  const designation = recipientDesignation || 'संबंधित अधिकारी';
  const userMsg = `कार्यालय: ${officeName}
प्राप्तकर्ता पदनाम: ${designation}
आवेदन विवरण: ${customDescription}

प्रार्थी की जानकारी:
${Object.entries(formData).map(([k, v]) => `${k}: ${v}`).join('\n')}

कृपया एक संपूर्ण औपचारिक हिंदी आवेदन पत्र तैयार करें।`;

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
  const { originalText, correctionInstruction, originalFormData, applicationName, officeType } = req.body ?? {};

  if (!originalText || !correctionInstruction) {
    res.status(400).json({ error: 'Missing required fields: originalText, correctionInstruction' });
    return;
  }

  const sysPrompt = `आप एक हिंदी सरकारी आवेदन पत्र संपादक हैं। आपको एक मूल आवेदन पत्र और एक सुधार निर्देश दिया जाएगा। आपका कार्य:
1. दिए गए सुधार निर्देश के अनुसार आवेदन पत्र को संशोधित करें
2. केवल वही बदलें जो निर्देश में कहा गया है — बाकी सब वैसा ही रखें
3. मूल संरचना, स्वर और शैली को बनाए रखें
4. केवल संशोधित पाठ लौटाएं, कोई स्पष्टीकरण नहीं
5. कोई मार्कडाउन फॉर्मेटिंग न करें`;

  const userMsg = `मूल आवेदन पत्र:
--- START ---
${originalText}
--- END ---

सुधार निर्देश:
${correctionInstruction}

${applicationName ? `आवेदन प्रकार: ${applicationName}` : ''}
${officeType ? `कार्यालय प्रकार: ${officeType}` : ''}

केवल संशोधित आवेदन पत्र लौटाएं:`;

  try {
    const text = await callAi(sysPrompt, userMsg, Math.max(Math.min(originalText.length * 2, 8000), 4000));
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

  const sysPrompt = `आप एक वरिष्ठ सरकारी अधिकारी हैं जो आवेदन पत्रों की समीक्षा करते हैं। आपको एक हिंदी आवेदन पत्र दिया जाएगा। JSON प्रारूप में विस्तृत समीक्षा प्रदान करें।

निम्नलिखित JSON स्कीमा का पालन करें (केवल JSON लौटाएं, कोई अन्य पाठ नहीं):
{
  "overallScore": <0-100>,
  "acceptanceProbability": "<High/Medium/Low>",
  "scores": {
    "completeness": <0-100>,
    "clarity": <0-100>,
    "formality": <0-100>,
    "legalSoundness": <0-100>,
    "structure": <0-100>
  },
  "missingInformation": [
    {"label": "<field name>", "description": "<what is missing>", "priority": "<high/medium/low>"}
  ],
  "risks": [
    {"risk": "<risk name>", "description": "<why it's risky>", "severity": "<high/medium/low>"}
  ],
  "suggestions": [
    {"title": "<suggestion>", "description": "<details>", "autoFixPrompt": "<exact instruction to fix>"}
  ],
  "summary": "<2-3 line Hindi summary>"
}`;

  const userMsg = `आवेदन प्रकार: ${applicationName}
कार्यालय: ${officeType || 'N/A'}
${formData ? 'फॉर्म डेटा: ' + JSON.stringify(formData) : ''}

आवेदन पत्र:
--- START ---
${generatedText}
--- END ---

केवल JSON लौटाएं:`;

  try {
    const text = await callAi(sysPrompt, userMsg, 8000);
    // Parse JSON from AI response
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
    thana: 'थाना', block: 'तहसील/ब्लॉक', bdo: 'खंड विकास कार्यालय',
    co: 'सर्किल कार्यालय', sdo: 'अनुविभागीय कार्यालय', sp: 'पुलिस अधीक्षक कार्यालय',
    dc: 'जिला समाहरणालय', court: 'न्यायालय', bank: 'बैंक',
  };
  const officeName = officeLabels[officeType] || officeType;

  const sysPrompt = `आप भारतीय सरकारी कार्यालय प्रक्रियाओं के विशेषज्ञ हैं। JSON प्रारूप में सरकारी प्रक्रिया की जानकारी दें।

JSON स्कीमा:
{
  "submissionOffice": "<office name in Hindi>",
  "officerDesignation": "<officer designation>",
  "officeTiming": "<office hours>",
  "lunchTime": "<lunch break>",
  "thingsToCarry": ["<item 1>", "<item 2>", ...],
  "processTimeline": [
    {"step": 1, "title": "<step name>", "description": "<details>", "estimatedTime": "<duration>"}
  ],
  "requiredDocuments": [
    {"name": "<document>", "copies": "<number>", "reason": "<why needed>"}
  ],
  "estimatedTime": {"best": "<duration>", "average": "<duration>", "worst": "<duration>"},
  "commonMistakes": ["<mistake>", ...],
  "warnings": [{"message": "<warning>"}],
  "appealProcess": {"office": "<appeal office>", "whenToUse": "<condition>"},
  "faqs": [{"question": "<Q>", "answer": "<A>"}],
  "disclaimer": "<Hindi disclaimer>"
}

केवल JSON लौटाएं।`;

  const userMsg = `आवेदन प्रकार: ${applicationName}
कार्यालय: ${officeName} (${officeType})
${formData ? 'क्षेत्र: ' + [formData.state, formData.district, formData.police_station].filter(Boolean).join(', ') : ''}

केवल JSON लौटाएं:`;

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

  const sysPrompt = `आप भारतीय सरकारी प्रक्रिया मार्गदर्शक हैं। JSON प्रारूप में मार्गदर्शन दें।

JSON स्कीमा:
{
  "caseCategory": "<category in Hindi>",
  "confidence": <0-1>,
  "primaryOffice": "<office name>",
  "recipientDesignation": "<designation>",
  "submissionMethods": ["<method 1>", ...],
  "requiredDocuments": [
    {"name": "<doc>", "required": true/false, "reason": "<why>"}
  ],
  "submissionSteps": ["<step>", ...],
  "expectedProcess": ["<stage>", ...],
  "followUpAdvice": ["<advice>", ...],
  "escalationPath": [
    {"order": 1, "office": "<office>", "whenToUse": "<condition>"}
  ],
  "processTimeline": [
    {"order": 1, "title": "<stage>", "description": "<details>", "optional": false}
  ],
  "urgentSafety": {"isUrgent": false, "message": "", "actions": []},
  "disclaimer": "<disclaimer>"
}
केवल JSON लौटाएं।`;

  const locInfo = userLocation
    ? `स्थान: ${[userLocation.state, userLocation.district, userLocation.policeStation, userLocation.block].filter(Boolean).join(', ')}`
    : '';

  const userMsg = `आवेदन: ${applicationName} | कार्यालय: ${officeType}
${locInfo}
${formData ? 'फॉर्म फील्ड: ' + Object.keys(formData).join(', ') : ''}

केवल JSON लौटाएं:`;

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

  const sysPrompt = `आप एक AI निर्णय इंजन हैं। आवेदन पत्र का विश्लेषण कर JSON में निर्णय दें।

JSON स्कीमा:
{
  "readiness": "<READY/NEEDS_IMPROVEMENT/NOT_RECOMMENDED>",
  "readinessScore": <0-100>,
  "summary": "<Hindi summary>",
  "riskMatrix": [
    {"category": "<category>", "level": "<High/Medium/Low>", "description": "<details>"}
  ],
  "issues": [
    {"description": "<issue>", "fix": "<how to fix>", "priority": "<Critical/High/Medium/Low>"}
  ],
  "successPrediction": {
    "level": "<High/Medium/Low>",
    "confidence": <0-1>,
    "explanation": "<Hindi explanation>"
  },
  "checklist": {
    "beforeSubmission": ["<item>", ...],
    "atSubmission": ["<item>", ...],
    "afterSubmission": ["<item>", ...]
  }
}
केवल JSON लौटाएं।`;

  const userMsg = `आवेदन: ${applicationName} | कार्यालय: ${officeType || 'N/A'}

आवेदन पत्र:
--- START ---
${generatedText.substring(0, 3000)}
--- END ---

केवल JSON लौटाएं:`;

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
