# Privacy Policy — Awedan Sahayak (आवेदन सहायक)

**Last Updated:** 2026-08-10
**App Version:** 1.1.0
**Package:** com.mmenterprises.awedansahayak

---

## 1. Introduction

Awedan Sahayak ("the App") helps Indian citizens generate formal applications
(आवेदन) for government offices. This Privacy Policy explains what data the App
collects, how it is used, and your rights.

**REQUIRES OWNER CONFIRMATION:** The developer should review this entire
document and confirm accuracy before publishing. Sections marked
`REQUIRES OWNER CONFIRMATION` need explicit verification.

---

## 2. Data Collection and Use

### 2.1 Camera & Photos

**What:** The App accesses your device camera to scan documents (Aadhaar cards,
handwritten text, barcodes).

**Why:** To capture document images for OCR (optical character recognition)
processing and PDF generation.

**Storage:** Scanned images are stored locally on your device in the App's
private storage. Images are NOT uploaded to any server unless you choose to
send them for AI-powered text cleanup (see Section 2.6).

**Source:** AndroidManifest.xml — `android.permission.CAMERA`

### 2.2 Microphone & Voice Input

**What:** The App accesses your device microphone for Hindi speech-to-text
voice input.

**Why:** To allow you to dictate application content in Hindi instead of typing.

**Storage:** Voice recordings are processed on-device by Google Speech
Recognition services. The App does NOT store or upload raw audio recordings.

**Source:** AndroidManifest.xml — `android.permission.RECORD_AUDIO`

### 2.3 Documents & User Content

**What:** You may scan identity documents (Aadhaar, PAN, driving license, etc.),
handwritten notes, and other personal documents.

**Why:** To extract text information (name, address, dates) for pre-filling
application forms, or to generate PDF copies.

**Storage:**
- All scanned images and generated PDFs are stored locally on your device
- Extracted text fields are stored in the App's local SQLite database
- **Aadhaar data (full 12-digit number, raw OCR text, raw card photos) is
  NEVER uploaded to any server** — this is confirmed by source code review
  of `src/services/aadhar.ts`, `src/services/apiClient.ts`, and
  `src/screens/DocumentScannerScreen.tsx`

**Source:** on-device OCR via `@dariyd/react-native-document-scanner`
(Google ML Kit Document Scanner)

### 2.4 Advertising & AdMob

**What:** The App displays advertisements via Google AdMob.

**Why:** To support the free tier of the App (first 5 applications are free).

**Data collected by AdMob SDK:**
- Advertising ID (AD_ID) — used for ad personalization and measurement
- Device information — for ad delivery
- Ad interaction data — impressions, clicks

**Opt-out:** Premium subscribers (monthly subscription) do NOT see ads.
The code confirms this in `src/services/ads/AdManager.ts` (isPremium() check).

**Source:**
- Merged manifest includes `com.google.android.gms.permission.AD_ID`
- AdMob SDK: `react-native-google-mobile-ads` v14.2.0
- Ad configuration: `src/services/ads/AdConfig.ts`

**REQUIRES OWNER CONFIRMATION:** The current AdMob App ID and ad unit IDs are
Google TEST IDs (`ca-app-pub-3940256099942544~3347511713`). Before publishing,
replace these with your REAL AdMob production IDs. As configured, the App will
display only test ads and collect no real ad revenue or user data through AdMob.

### 2.5 Firebase Analytics & Crash Reporting

**What:** The App uses Firebase services for analytics and crash reporting.

**Data collected:**
- App open/close events
- Screen views (screen name only)
- Application generation events (office type, AI provider, duration)
- OCR operations (success/failure, duration)
- Purchase events (product ID, success/failure)
- Ad impressions (ad type)
- Error/crash diagnostics (error message, category — NO personal data)

**What is NOT collected (confirmed by source code review):**
- NO personal identifying information (name, address, phone)
- NO Aadhaar data or numbers
- NO generated application text content
- NO raw OCR text
- NO API keys or secrets
- NO device location data

**Source:** `src/services/firebase/EventLogger.ts`, `src/services/firebase/CrashReporter.ts`,
`src/services/firebase/Firebase.ts`

**REQUIRES OWNER CONFIRMATION:** The current `google-services.json` contains
placeholder/project-template values (project_number: 000000000000, invalid
API key). Firebase services will gracefully fall back to no-op mode as
confirmed by `src/services/firebase/Firebase.ts`. Before publishing with
Firebase enabled, replace `google-services.json` with the real file from
your Firebase Console project.

### 2.6 Server/API Communication

**What:** The App communicates with a backend API at
`https://awedan-sahayak-api.onrender.com` for:
- AI-powered application text generation
- OCR text cleanup
- Purchase receipt verification

**Data sent to server:**
- Application generation: office type, user's description, form fields
  (name, address, dates as provided by user)
- OCR cleanup: extracted text from scanned documents (sent ONLY when user
  initiates cleanup)
- Billing verification: Google Play purchase tokens (encrypted in transit
  via HTTPS)

**Data NOT sent to server:**
- Raw document images (unless user explicitly chooses to send for cleanup)
- Full Aadhaar numbers (12 digits)
- Raw Aadhaar card photos

**All API communication uses HTTPS.** No HTTP (cleartext) endpoints exist in
release builds. Source: `src/services/apiClient.ts`, release manifest.

### 2.7 Purchases & Billing

**What:** The App offers:
- Monthly subscription (₹149/month) via Google Play Billing
- One-time credit purchase (₹11) via Google Play Billing

**Data collected:**
- Purchase tokens are verified server-side via the backend API
- Purchase state is stored locally on-device
- Google Play handles all payment processing — the App does NOT collect
  or store payment card details

**Source:** `src/services/iap.ts`, `src/services/usageTracker.ts`

**REQUIRES OWNER CONFIRMATION:** IAP product IDs must be created in Google
Play Console before purchases can be tested or processed.

---

## 3. Data Retention

- **Scanned documents/images:** Stored locally on-device until you delete them
  (via the App's history screen or device file manager)
- **Generated applications:** Stored locally in SQLite until you delete them
- **Application form data:** Stored locally in SQLite
- **Purchase/subscription state:** Stored locally until app uninstall
- **No server-side user data storage** — the backend API processes requests
  and returns responses but does NOT maintain user accounts or long-term
  data storage for user content

**REQUIRES OWNER CONFIRMATION:** Verify the backend API's actual data retention
policy (code at `awedan-sahayak-api.onrender.com` was NOT reviewed in this audit).

---

## 4. Third-Party Services

The App integrates the following third-party SDKs:

| SDK | Purpose | Privacy Policy |
|-----|---------|---------------|
| Google AdMob | Advertising | https://policies.google.com/privacy |
| Firebase (Analytics, Crashlytics, Performance) | Analytics/Crash reporting | https://firebase.google.com/support/privacy |
| Google ML Kit (via Document Scanner) | On-device OCR | https://developers.google.com/ml-kit/terms |
| Google Play Billing | In-app purchases | https://payments.google.com/payments/apis-secure/get_legal_document?ldo=0&ldt=privacynotice |
| Google Speech Recognition | Hindi voice-to-text | https://policies.google.com/privacy |
| Expo | App framework | https://expo.dev/privacy |
| Render.com | Backend hosting | https://render.com/privacy |

---

## 5. Data Sharing

The App does NOT share user data with third parties beyond:
- The SDKs listed in Section 4 (for their stated purposes)
- The backend API at `awedan-sahayak-api.onrender.com` (for AI text generation
  and purchase verification)

No user data is sold.

---

## 6. User Rights & Deletion

You can delete your data by:
- Clearing the App's storage in Android Settings → Apps → AwedanSahayak → Storage → Clear Data
- Deleting individual scanned documents and generated applications within the App
- Uninstalling the App (removes all local data)

**Contact for privacy inquiries:**

**REQUIRES OWNER CONFIRMATION:** The developer must provide a contact email
address for privacy-related inquiries before publishing.
Replace the placeholder below:

> Email: [DEVELOPER EMAIL — TO BE PROVIDED]

---

## 7. Children's Privacy

The App is NOT directed at children under 13. We do not knowingly collect
personal information from children.

---

## 8. Changes to This Policy

This privacy policy may be updated. Changes will be reflected in the App
and on the associated listing page on Google Play.

---

## 9. Compliance Notes

**Evidence basis:** This privacy policy was drafted based on source code
inspection of the Awedan Sahayak React Native app (build 49), including:
- AndroidManifest.xml declarations
- JavaScript/TypeScript source code
- npm package dependencies
- Gradle build configuration
- Merged release manifest

**Sections requiring owner review:** Sections marked `REQUIRES OWNER
CONFIRMATION` need verification by the app developer/owner before this
policy can be considered final and accurate.

---

*Policy generated by Build 50 production configuration audit.*
*Do not submit to Google Play without owner review.*
