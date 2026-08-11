# Google Play Data Safety Worksheet — Awedan Sahayak

**Prepared:** 2026-08-10 (Build 50 Audit)
**Package:** com.mmenterprises.awedansahayak
**Version:** 1.1.0 (versionCode 2)

---

## Instructions

This worksheet maps the Google Play Console Data Safety form to actual
app behavior verified from source code. Use this to fill the Data Safety
section in Google Play Console.

**DO NOT submit this worksheet to Google.** Transfer the information to
the Play Console Data Safety form.

---

## Data Types

### Location

| Field | Value |
|-------|-------|
| Collected? | **NO** |
| Shared? | **NO** |
| Evidence | No location permissions declared. No location SDKs found in `package.json` or source code. |

### Personal Information — Name

| Field | Value |
|-------|-------|
| Collected? | **YES** |
| Shared? | See API communication notes |
| Purpose | App functionality (pre-filling application forms) |
| Required/Optional | Required for application generation |
| Ephemeral? | NO — stored in local SQLite database |
| Evidence | `src/screens/ApplicationFormScreen.tsx` collects user name as form field. Sent to backend API for application generation. Also extracted from Aadhaar OCR. |
| Owner confirmation? | No — confirmed from source |

### Personal Information — Email Address

| Field | Value |
|-------|-------|
| Collected? | **YES** |
| Shared? | See API communication notes |
| Purpose | App functionality (application forms) |
| Required/Optional | Optional |
| Ephemeral? | NO — stored in local SQLite |
| Evidence | `src/utils/validators.ts` includes email validation |
| Owner confirmation? | No — confirmed from source |

### Personal Information — Phone Number

| Field | Value |
|-------|-------|
| Collected? | **YES** |
| Shared? | See API communication notes |
| Purpose | App functionality (application forms) |
| Required/Optional | Required for application generation |
| Ephemeral? | NO — stored in local SQLite |
| Evidence | `src/utils/validators.ts` includes Indian phone validation (`^[6-9]\d{9}$`). Extracted from Aadhaar OCR. |
| Owner confirmation? | No — confirmed from source |

### Personal Information — Address

| Field | Value |
|-------|-------|
| Collected? | **YES** |
| Shared? | See API communication notes |
| Purpose | App functionality (application forms, Aadhaar auto-fill) |
| Required/Optional | Required for application generation |
| Ephemeral? | NO — stored in local SQLite |
| Evidence | Extracted from Aadhaar OCR, stored in form fields. `src/services/aadhar.ts`. |
| Owner confirmation? | No — confirmed from source |

### Personal Information — Date of Birth

| Field | Value |
|-------|-------|
| Collected? | **YES** |
| Shared? | See API communication notes |
| Purpose | App functionality (application forms) |
| Required/Optional | Optional |
| Ephemeral? | NO — stored in local SQLite |
| Evidence | Aadhaar OCR extracts DOB. Form fields include date field. |
| Owner confirmation? | No — confirmed from source |

### Personal Information — Gender

| Field | Value |
|-------|-------|
| Collected? | **YES** |
| Shared? | See API communication notes |
| Purpose | App functionality (Aadhaar auto-fill) |
| Required/Optional | Optional |
| Ephemeral? | NO — stored in local SQLite |
| Evidence | Aadhaar OCR extracts gender. |
| Owner confirmation? | No — confirmed from source |

### Personal Information — Other (Aadhaar details, government ID data)

| Field | Value |
|-------|-------|
| Collected? | **YES** (on-device OCR) |
| Shared? | **NO** (confirmed by source — Aadhaar data never leaves device) |
| Purpose | Auto-filling application forms |
| Required/Optional | Optional (user chooses whether to scan Aadhaar) |
| Ephemeral? | NO — extracted fields stored in local SQLite; scanned images in local storage |
| Evidence | `src/services/aadhar.ts`, `src/screens/DocumentScannerScreen.tsx`. The app uses on-device ML Kit OCR. `src/services/apiClient.ts` does NOT include any Aadhaar upload endpoint. |
| Owner confirmation? | No — confirmed from source. **Critical privacy constraint is enforced in code.** |

### Financial Information — Payment Info

| Field | Value |
|-------|-------|
| Collected? | **NO** |
| Shared? | N/A |
| Evidence | Google Play Billing handles all payment processing. App does not collect credit card or UPI details. `src/services/iap.ts` handles only purchase tokens. |
| Owner confirmation? | No — confirmed from source |

### Financial Information — Purchase History

| Field | Value |
|-------|-------|
| Collected? | **YES** |
| Shared? | Purchase tokens sent to backend API for verification |
| Purpose | App functionality (verify subscription/credit purchases) |
| Required/Optional | Required for paid features |
| Ephemeral? | NO — purchase status stored locally |
| Evidence | `src/services/iap.ts`, `src/services/usageTracker.ts` |
| Owner confirmation? | No — confirmed from source |

### Photos and Videos

| Field | Value |
|-------|-------|
| Collected? | **YES** |
| Shared? | Optionally — user can send document images for AI-powered text cleanup |
| Purpose | Document scanning, OCR, PDF generation |
| Required/Optional | Required for scanning features |
| Ephemeral? | NO — stored in local app storage |
| Evidence | `android.permission.CAMERA` in manifest. Scanned images saved locally via `expo-file-system`. Server upload is opt-in only (OCR cleanup). |
| Owner confirmation? | No — confirmed from source |

### Audio — Voice Recordings

| Field | Value |
|-------|-------|
| Collected? | **YES** (processed on-device, not stored as files) |
| Shared? | **YES** — sent to Google Speech Recognition for transcription |
| Purpose | Hindi voice-to-text for application form input |
| Required/Optional | Optional |
| Ephemeral? | YES — processed in real-time, not stored as audio files |
| Evidence | `android.permission.RECORD_AUDIO`, `src/hooks/useVoiceInput.ts`, `expo-speech-recognition` package. |
| Owner confirmation? | No — confirmed from source |

### Files and Documents

| Field | Value |
|-------|-------|
| Collected? | **YES** |
| Shared? | Optionally — user can share generated PDFs via WhatsApp or other apps |
| Purpose | Application generation, document scanning, PDF export |
| Required/Optional | Required for core app function |
| Ephemeral? | NO — stored in local app storage |
| Evidence | Generated PDFs/RTFs stored locally. Sharing via `expo-sharing` and `src/utils/shareUtils.ts`. |
| Owner confirmation? | No — confirmed from source |

### App Activity — App Interactions

| Field | Value |
|-------|-------|
| Collected? | **YES** (Firebase Analytics — if Firebase is configured) |
| Shared? | Sent to Firebase/Google |
| Purpose | Analytics (usage measurement, crash reporting) |
| Required/Optional | Automatic |
| Ephemeral? | NO — processed by Firebase |
| Evidence | `src/services/firebase/EventLogger.ts` logs: app open, screen views, generation events, OCR events, purchase events, ad impressions. No PII in events. |
| Owner confirmation? | Will only be active if real google-services.json is provided |

### App Activity — Crash Logs / Diagnostics

| Field | Value |
|-------|-------|
| Collected? | **YES** (Firebase Crashlytics — if Firebase is configured) |
| Shared? | Sent to Firebase/Google |
| Purpose | Crash reporting and diagnostics |
| Required/Optional | Automatic |
| Ephemeral? | NO — processed by Firebase |
| Evidence | `src/services/firebase/CrashReporter.ts` explicitly strips PII keys before sending. Only error type, location, sanitized message. |
| Owner confirmation? | Will only be active if real google-services.json is provided |

### Device or Other IDs — Advertising ID

| Field | Value |
|-------|-------|
| Collected? | **YES** (by Google AdMob SDK) |
| Shared? | **YES** — shared with Google AdMob ad network |
| Purpose | Advertising (ad delivery, measurement, personalization) |
| Required/Optional | Automatic (unless user is premium subscriber — ads are skipped for subscribers) |
| Ephemeral? | NO — managed by Google Play Services |
| Evidence | Merged release manifest includes `com.google.android.gms.permission.AD_ID` and `android.permission.ACCESS_ADSERVICES_AD_ID`. Added automatically by AdMob SDK. |
| Owner confirmation? | No — confirmed from build output. Must disclose in Play Console. |

---

## Summary for Play Console Data Safety Form

### Data Collected and Shared

| Data Type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Name | ✅ | ✅ (API only) | App functionality |
| Email | ✅ | ✅ (API only) | App functionality |
| Phone Number | ✅ | ✅ (API only) | App functionality |
| Address | ✅ | ✅ (API only) | App functionality |
| Date of Birth | ✅ | ✅ (API only) | App functionality |
| Gender | ✅ | ✅ (API only) | App functionality |
| Government ID data (Aadhaar) | ✅ | ❌ NOT shared | App functionality |
| Purchase History | ✅ | ✅ (API verification) | App functionality |
| Photos | ✅ | Optional | App functionality |
| Voice Recordings | ✅ | ✅ (Google Speech) | App functionality |
| Files/Documents | ✅ | Optional | App functionality |
| App Interactions | ✅* | ✅* (Firebase) | Analytics |
| Crash Diagnostics | ✅* | ✅* (Firebase) | Analytics |
| Advertising ID | ✅ | ✅ (Google AdMob) | Advertising |

\* Only active if real Firebase configuration is provided.

### Encryption in Transit

**YES** — All API communication uses HTTPS. Firebase and AdMob SDKs use
encrypted protocols. No HTTP endpoints in release builds.

### Data Deletion

Users can delete data by clearing app storage or uninstalling.
No web-based account deletion flow (the app has no user accounts).

---

*Worksheet generated from Build 50 source code audit.*
*Cross-reference with actual Play Console form before submission.*
