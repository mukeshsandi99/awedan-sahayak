# Awedan Sahayak — API Documentation

**Base URL:** `http://localhost:3000` (dev) / `https://awedan-sahayak-api.onrender.com` (production)

## Authentication

Currently, the API is unauthenticated. All endpoints are publicly accessible. Rate limiting and authentication should be added before production launch.

---

## `GET /api/health`

Health check endpoint.

**Response** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2026-07-07T12:00:00.000Z"
}
```

---

## `POST /api/generate-application`

Generates a formal Hindi legal application using the configured AI provider (Claude or DeepSeek).

**Request Body**
```json
{
  "applicationName": "मारपीट की शिकायत",
  "officeType": "thana",
  "promptTemplate": "...",
  "formData": {
    "applicant_name": "सीमा देवी",
    "village": "हटकोना",
    "thana": "कटकमसांडी",
    "district": "हजारीबाग",
    "state": "झारखंड",
    "incident_date": "04 जुलाई 2026",
    "incident_details": "..."
  }
}
```

**Response** `200 OK`
```json
{
  "success": true,
  "generatedText": "सेवा में,\nथाना प्रभारी/थानाध्यक्ष महोदय...",
  "metadata": {
    "provider": "claude",
    "model": "claude-sonnet-5-20251001",
    "usage": { "inputTokens": 1200, "outputTokens": 600 }
  }
}
```

**Error** `400/500`
```json
{
  "error": "आवेदन पत्र जनरेट करने में त्रुटि।",
  "detail": "API key missing"
}
```

## `POST /api/ocr-aadhar`

Extracts structured data (name, DOB, gender, address) from an Aadhar card photo using Google Cloud Vision.

**Request Body**
```json
{
  "imageBase64": "/9j/4AAQSkZJRg..."
}
```

**Response** `200 OK`
```json
{
  "name": "मुकेश कुमार केशरी",
  "dob": "21/02/2001",
  "gender": "पुरुष",
  "address": "ग्राम मनार, पोस्ट ढौठवा, थाना कटकमसांडी, हजारीबाग, झारखण्ड",
  "phone_number": "9876543210",
  "rawText": "भारत सरकार\nमुकेश कुमार केशरी\nजन्म तिथि: 21/02/2001\n..."
}
```

**Edge cases:**
- If a field can't be extracted, it returns `null`
- Aadhar number (12 digits) is automatically redacted from `rawText`
- Images are preprocessed (grayscale, sharpen, resize) before OCR

## `POST /api/scan-document`

OCR for handwritten documents (applications, letters). Uses a handwriting-optimized preprocessing pipeline.

**Request Body**
```json
{
  "imageBase64": "/9j/4AAQSkZJRg..."
}
```

**Response** `200 OK`
```json
{
  "rawText": "सेवा में,\nथाना प्रभारी महोदय..."
}
```

## `POST /api/cleanup-ocr`

Sends OCR text to the configured AI provider for conservative typo/error correction. Only fixes clear OCR errors — does NOT rewrite or change meaning.

**Request Body**
```json
{
  "rawText": "सेवा मे,\nथानाअधिक्षक..."
}
```

**Response** `200 OK`
```json
{
  "cleanedText": "सेवा में,\nथानाध्यक्ष...",
  "provider": "claude"
}
```

## Error Response Format

All errors follow this structure:

```json
{
  "error": "<Hindi + English error message>",
  "detail": "<technical detail (development mode only)>"
}
```

## Rate Limiting & Production Notes

- No rate limiting is implemented yet
- No authentication/authorization
- Max request body size: 10MB (for OCR image uploads)
- The AI provider has its own rate limits and costs
- All OCR images are processed and immediately deleted — nothing is stored
