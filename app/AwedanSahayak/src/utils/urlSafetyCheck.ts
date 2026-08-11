/**
 * URL Safety Analysis — offline heuristics only.
 * Never sends URLs to any external service.
 */

import { SUSPICIOUS_DOMAINS, SUSPICIOUS_KEYWORDS, URL_SHORTENERS } from './safetyWarningList';

export interface UrlCheckResult {
  riskLevel: 'low' | 'caution' | 'high';
  reasonsHindi: string[];
  details: {
    isValidFormat: boolean;
    isHttps: boolean;
    isIpAddress: boolean;
    isShortener: boolean;
    hasSuspiciousSubdomain: boolean;
    hasMisleadingSpelling: boolean;
    hasSuspiciousKeyword: boolean;
    isKnownScamDomain: boolean;
    isPunycode: boolean;
  };
}

export function analyzeUrl(input: string): UrlCheckResult {
  const reasons: string[] = [];
  const details = {
    isValidFormat: false,
    isHttps: false,
    isIpAddress: false,
    isShortener: false,
    hasSuspiciousSubdomain: false,
    hasMisleadingSpelling: false,
    hasSuspiciousKeyword: false,
    isKnownScamDomain: false,
    isPunycode: false,
  };

  const trimmed = input.trim();
  if (!trimmed) {
    return { riskLevel: 'high', reasonsHindi: ['कोई URL नहीं डाला गया।'], details };
  }

  // Parse URL
  let url: URL;
  try {
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    reasons.push('❌ अमान्य URL फॉर्मेट — सही URL डालें (जैसे https://example.com)।');
    return { riskLevel: 'high', reasonsHindi: reasons, details };
  }
  details.isValidFormat = true;

  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();

  // HTTPS check
  if (url.protocol === 'https:') {
    details.isHttps = true;
  } else {
    reasons.push('⚠️ यह HTTPS नहीं है — कनेक्शन सुरक्षित नहीं हो सकता।');
  }

  // IP address URL
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    details.isIpAddress = true;
    reasons.push('⚠️ IP एड्रेस का उपयोग — वैध वेबसाइटें आमतौर पर डोमेन नाम का उपयोग करती हैं।');
  }

  // URL shortener
  if (URL_SHORTENERS.some((s) => hostname === s || hostname.endsWith('.' + s))) {
    details.isShortener = true;
    reasons.push('⚠️ URL शॉर्टनर — असली गंतव्य छिपा हो सकता है।');
  }

  // Known scam domain
  if (SUSPICIOUS_DOMAINS.includes(hostname)) {
    details.isKnownScamDomain = true;
    reasons.push('🚨 यह डोमेन ज्ञात संदिग्ध डोमेन सूची में है।');
  }

  // Suspicious keywords in domain+path
  for (const kw of SUSPICIOUS_KEYWORDS) {
    if (hostname.includes(kw) || pathname.includes(kw)) {
      details.hasSuspiciousKeyword = true;
      reasons.push(`⚠️ संदिग्ध कीवर्ड: "${kw}" — स्कैम का संकेत हो सकता है।`);
      break; // one is enough
    }
  }

  // Suspicious subdomain (e.g., paytm.verify-xyz.com)
  const subdomainParts = hostname.split('.');
  if (subdomainParts.length > 3) {
    details.hasSuspiciousSubdomain = true;
    reasons.push('⚠️ अत्यधिक सबडोमेन — नकली/फिशिंग URL का संकेत हो सकता है।');
  }

  // Misleading spelling (e.g., paytmm.com, amaz0n.com, g00gle.com)
  if (/[0-9]/.test(hostname.replace(/^\d+\./, '')) && subdomainParts.length <= 3) {
    // Numbers in main domain (excluding IP) — could be lookalike
    const mainDomain = subdomainParts.slice(-2).join('.');
    if (/\d/.test(mainDomain.split('.')[0])) {
      details.hasMisleadingSpelling = true;
      reasons.push('⚠️ डोमेन में अंक — लुक-अलाइक/नकली डोमेन हो सकता है (जैसे g00gle.com)।');
    }
  }

  // Punycode / IDN check
  if (hostname.startsWith('xn--')) {
    details.isPunycode = true;
    reasons.push('⚠️ प्यूनीकोड डोमेन — अंतरराष्ट्रीय करैक्टर से बना डोमेन, लुक-अलाइक हमला संभव।');
  }

  // Determine risk level
  let riskLevel: 'low' | 'caution' | 'high';
  if (details.isKnownScamDomain || (!details.isValidFormat)) {
    riskLevel = 'high';
  } else if (reasons.length >= 3 || details.isIpAddress || details.isPunycode) {
    riskLevel = 'high';
  } else if (reasons.length >= 1) {
    riskLevel = 'caution';
  } else {
    riskLevel = 'low';
    reasons.push('✅ कोई स्पष्ट जोखिम नहीं मिला — फिर भी सावधानी बरतें।');
  }

  return { riskLevel, reasonsHindi: reasons, details };
}
