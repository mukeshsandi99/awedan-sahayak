# Awedan Sahayak (आवेदन सहायक)

> React Native mobile app that helps Indian citizens generate formal applications (आवेदन) for government offices — Thana, Block, BDO, CO, SDO, SP, DC Office, and Court.

## Architecture Overview

```
awedan-sahayak/
├── app/                    # React Native (Expo) app
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── common/     # Shared primitives (Button, Input, Card, etc.)
│   │   │   ├── forms/      # Form-specific components (fields, validators)
│   │   │   ├── ocr/        # Aadhar card scanner & OCR overlay
│   │   │   └── pdf/        # PDF preview & letterhead renderer
│   │   ├── screens/        # One file per screen, named after the screen
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── ApplicationDraftScreen.tsx
│   │   │   ├── OfficeDirectoryScreen.tsx
│   │   │   ├── AadharScanScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   ├── navigation/     # React Navigation config (stack, tab navigators)
│   │   ├── services/       # Business logic & API adapters
│   │   │   ├── aadhar.ts       # On-device OCR + data extraction (NEVER uploads)
│   │   │   ├── voice.ts        # Hindi speech-to-text integration
│   │   │   ├── application.ts  # Application drafting via Claude API
│   │   │   ├── pdf.ts          # PDF generation with letterhead format
│   │   │   ├── sharing.ts      # WhatsApp & general share intents
│   │   │   └── officeDb.ts     # Offline-first local office directory
│   │   ├── hooks/          # Custom React hooks
│   │   ├── store/          # State management (Context or Zustand)
│   │   ├── db/             # SQLite schema, migrations, queries
│   │   ├── utils/          # Pure utility functions (formatting, validation)
│   │   ├── constants/      # App-wide constants (office types, templates)
│   │   ├── types/          # TypeScript type definitions
│   │   └── assets/         # Static assets (images, fonts, letterhead template)
│   ├── App.tsx             # Root component
│   └── app.json            # Expo config
├── server/                 # Node.js/Express backend
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── controllers/    # Request processing logic
│   │   ├── services/       # Claude API integration, business logic
│   │   ├── middleware/      # Auth, rate limiting, error handling
│   │   ├── utils/          # Backend utilities
│   │   └── types/          # Shared TypeScript types
│   ├── package.json
│   └── tsconfig.json
├── shared/                 # Types & constants shared between app and server
│   └── types/              # Application template types, office enums, API contracts
├── docs/                   # Project documentation
├── CLAUDE.md               # This file
├── package.json            # Workspace root (monorepo tooling)
└── tsconfig.base.json      # Shared TypeScript config
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile App | React Native (Expo managed workflow) |
| Language | TypeScript (strict mode) |
| Local DB | SQLite (via `expo-sqlite` or `react-native-sqlite-storage`) |
| Backend | Node.js + Express (TypeScript) |
| AI Text Gen | Claude API (Anthropic) |
| Voice Input | Hindi speech-to-text (on-device or Google Speech API) |
| OCR | On-device text recognition (ML Kit / Tesseract) |
| PDF | `react-native-pdf` or server-side generation |
| Sharing | React Native Share API + WhatsApp intent |
| Navigation | React Navigation v6+ |
| State | React Context + useReducer, or Zustand |

## Naming Conventions

- **Files**: PascalCase for components/screens (`ApplicationDraftScreen.tsx`), camelCase for utilities/services (`aadhar.ts`, `voice.ts`), kebab-case for docs.
- **Components**: PascalCase, named export preferred over default export for non-screen components.
- **Functions**: camelCase, descriptive verb phrases (`extractAadharData`, `draftApplication`, `lookupOffice`).
- **Types/Interfaces**: PascalCase, prefixed with domain (`AadharData`, `OfficeRecord`, `ApplicationDraft`).
- **SQLite tables**: snake_case, plural (`office_records`, `application_drafts`, `aadhar_profiles`).
- **API routes**: kebab-case RESTful (`POST /api/applications/draft`, `GET /api/offices/search`).
- **Git branches**: kebab-case, prefixed (`feature/voice-input`, `fix/ocr-crash`, `docs/setup-guide`).

## Critical Privacy Constraint

**Aadhar data (scanned text, extracted fields, card images) must NEVER leave the device.** All OCR processing happens on-device. Aadhar fields are stored only in the local SQLite database. The backend receives only the sanitized application content needed for drafting — never raw Aadhar data. No analytics or logging service may capture Aadhar fields. This is a hard constraint for all feature work.

## Key Feature Flows

1. **Aadhar Scan → Auto-fill**: User scans Aadhar card → on-device OCR extracts name, address, DOB → fields pre-populate the application form.
2. **Voice → Draft**: User describes their issue in Hindi via voice → transcribed text + selected office type → Claude API drafts formal Hindi application.
3. **Draft → PDF → Share**: Approved draft → rendered in letterhead format as PDF → shared via WhatsApp or saved locally.
4. **Offline Directory**: Office database (Thana, Block, BDO, etc.) is bundled with the app and queryable offline. Periodic background sync when online.

## Development Notes

- Use Expo's managed workflow unless a native module requirement forces ejection.
- All user-facing text should default to Hindi (hi-IN), with English as fallback.
- Application templates should be stored as parameterized strings, not hardcoded — office type determines the template.
- Claude API calls go through the backend only (protect API key). The backend acts as a thin proxy: receives office type + user description, returns formatted application text.
- PDF letterhead format must include: sender details (from Aadhar), date, office address block, subject line, formal body, signature placeholder.
- Test on low-end Android devices — that's the primary user base. Keep bundle size small and animations minimal.
