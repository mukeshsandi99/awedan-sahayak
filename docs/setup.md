# Awedan Sahayak (आवेदन सहायक) — Setup Guide

## Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- **Expo CLI** (`npm install -g expo-cli`) — or use `npx expo`
- **Expo Go app** on your Android/iOS device (for development testing)
- **API Keys** (see below)

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd awedan-sahayak

# 2. Install server dependencies
cd server
cp .env.example .env
# Edit .env and add your API keys (see API Keys section below)
npm install

# 3. Start the backend server
npm run dev
# Server starts on http://localhost:3000

# 4. In a new terminal, install app dependencies
cd ../app/AwedanSahayak
npm install

# 5. Configure the API base URL
# Edit src/config.ts and set API_BASE_URL:
#   - USB + adb reverse: http://localhost:3000
#   - WiFi (same network): http://<YOUR_LAN_IP>:3000
#   - Production: https://awedan-sahayak-api.onrender.com

# 6. Start the Expo app
npx expo start

# 7. Scan the QR code with Expo Go on your phone
```

## API Keys Required

| Key | Purpose | Get it from |
|-----|---------|------------|
| `ANTHROPIC_API_KEY` | Claude AI for Hindi application drafting | https://console.anthropic.com/ |
| `DEEPSEEK_API_KEY` | Alternative: DeepSeek AI (cheaper) | https://platform.deepseek.com/api_keys |
| `GOOGLE_VISION_API_KEY` | OCR for Aadhar card & handwriting scanning | https://console.cloud.google.com/ (enable Vision API) |

Set these in `server/.env`. At minimum, you need ONE of `ANTHROPIC_API_KEY` or `DEEPSEEK_API_KEY`.

## Development Setup

### Android (recommended for testing)

```bash
# Forward localhost to Android device via USB
adb reverse tcp:3000 tcp:3000
```

Then set `API_BASE_URL` to `http://localhost:3000` in `app/AwedanSahayak/src/config.ts`.

### WiFi (no USB)

Find your computer's LAN IP address and set `API_BASE_URL` to `http://<YOUR_IP>:3000`.

### Production

The app ships with `API_BASE_URL` set to the Render.com deployment. Change this in `src/config.ts` for your own deployment.

## Project Structure

```
awedan-sahayak/
├── app/AwedanSahayak/    # React Native (Expo) app
│   ├── src/
│   │   ├── screens/      # One file per screen
│   │   ├── navigation/   # Stack + Tab navigators
│   │   ├── database/     # SQLite schema, migrations, seed data
│   │   ├── services/     # Aadhar OCR, PDF, RTF export
│   │   ├── hooks/        # useVoiceInput hook
│   │   ├── constants/    # Theme (colors, fonts, spacing)
│   │   └── types/        # Database row types
│   └── App.tsx           # Root component
├── server/               # Node.js/Express backend
│   └── src/
│       ├── routes/        # API route handlers
│       └── services/      # Claude/DeepSeek integration
├── shared/types/         # Types shared between app and server
└── docs/                 # Documentation
```

## Testing the Backend

```bash
cd server
npx tsx src/test-generate.ts
```

This generates a sample application using the configured AI provider and prints the result.

## Deployment

The server is configured for Render.com via `render.yaml`:

```bash
# Deploy to Render
# 1. Push to GitHub
# 2. Connect repo in Render dashboard
# 3. Render auto-detects render.yaml (Blueprint)
# 4. Set environment variables in Render dashboard
```
