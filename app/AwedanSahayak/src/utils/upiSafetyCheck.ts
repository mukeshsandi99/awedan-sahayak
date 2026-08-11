/**
 * UPI Safety Analysis — offline heuristics only.
 * Never sends UPI IDs to any external service.
 */

import { isValidUpiId } from './validators';
import { SUSPICIOUS_UPI_HANDLES } from './safetyWarningList';

export interface UpiCheckResult {
  riskLevel: 'low' | 'caution' | 'high';
  reasonsHindi: string[];
  details: {
    isValidFormat: boolean;
    hasSuspiciousHandle: boolean;
    isCollectRequest: boolean;
  };
}

/** OTP/PIN/Screen-share keywords that should trigger warnings in any context. */
const CRITICAL_WARNING_KEYWORDS = ['otp', 'pin', 'upi pin', 'screen share', 'स्क्रीन शेयर', 'cv', 'cvv'];

export function analyzeUpiId(input: string, contextText?: string): UpiCheckResult {
  const reasons: string[] = [];
  const details = {
    isValidFormat: false,
    hasSuspiciousHandle: false,
    isCollectRequest: false,
  };

  const trimmed = input.trim();
  if (!trimmed) {
    return { riskLevel: 'high', reasonsHindi: ['कोई UPI ID नहीं डाली गई।'], details };
  }

  // Check if this is a collect request / payment request
  if (contextText && /collect|request|amount|राशि|भुगतान|पेमेंट/i.test(contextText)) {
    details.isCollectRequest = true;
    reasons.push('⚠️ यह UPI कलेक्ट रिक्वेस्ट/पेमेंट रिक्वेस्ट प्रतीत होता है — भेजने से पहले सुनिश्चित करें कि आप प्राप्तकर्ता को जानते हैं।');
  }

  // Valid UPI format
  if (!isValidUpiId(trimmed)) {
    reasons.push('❌ अमान्य UPI ID फॉर्मेट — सही UPI ID डालें (जैसे username@okhdfcbank)।');
    return { riskLevel: 'high', reasonsHindi: reasons, details };
  }
  details.isValidFormat = true;

  // Suspicious handle
  const handle = trimmed.split('@')[1]?.toLowerCase() ?? '';
  for (const kw of SUSPICIOUS_UPI_HANDLES) {
    if (handle.includes(kw)) {
      details.hasSuspiciousHandle = true;
      reasons.push(`⚠️ UPI हैंडल में संदिग्ध शब्द: "${kw}" — धोखाधड़ी का संकेत हो सकता है।`);
      break;
    }
  }

  // Check context for OTP/PIN/screen-share warnings
  if (contextText) {
    const ctx = contextText.toLowerCase();
    for (const kw of CRITICAL_WARNING_KEYWORDS) {
      if (ctx.includes(kw)) {
        reasons.push(`🚨 "${kw}" से संबंधित अनुरोध — कभी भी OTP, UPI PIN, CVV या स्क्रीन शेयर न करें!`);
        break;
      }
    }
  }

  // Always add this warning
  reasons.push('⚠️ अज्ञात UPI ID को पैसे न भेजें। केवल जाने-पहचाने व्यक्ति/व्यापारी को भुगतान करें।');

  // Risk level
  let riskLevel: 'low' | 'caution' | 'high';
  if (details.hasSuspiciousHandle) {
    riskLevel = 'high';
  } else if (details.isCollectRequest) {
    riskLevel = 'caution';
  } else {
    riskLevel = 'low';
    reasons.push('✅ UPI ID फॉर्मेट सही है। फिर भी अज्ञात व्यक्ति को पैसे न भेजें।');
  }

  return { riskLevel, reasonsHindi: reasons, details };
}

/** Analyze a mobile number for scam patterns. */
export function analyzeMobile(input: string): { riskLevel: 'low' | 'caution' | 'high'; reasonsHindi: string[] } {
  const trimmed = input.trim().replace(/[\s\-+]/g, '');
  const reasons: string[] = [];

  if (!trimmed || !/^\d{10,13}$/.test(trimmed)) {
    reasons.push('❌ अमान्य मोबाइल नंबर फॉर्मेट।');
    return { riskLevel: 'high', reasonsHindi: reasons };
  }

  reasons.push('✅ मोबाइल नंबर फॉर्मेट सही है।');
  reasons.push('⚠️ अज्ञात नंबर से OTP/लिंक/QR कोड प्राप्त होने पर सावधानी बरतें।');
  return { riskLevel: 'low', reasonsHindi: reasons };
}
