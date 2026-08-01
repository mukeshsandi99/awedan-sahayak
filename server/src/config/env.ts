/**
 * Environment Validation Module
 *
 * Validates ALL required environment variables at server startup.
 * Missing variables cause a clear, immediate error — no silent failures.
 *
 * SECURITY: Never prints secret values. Only prints presence/absence.
 *
 * Usage (in index.ts, BEFORE any other imports that read env vars):
 *   import { validateEnv, getEnvConfig } from './config/env';
 *   validateEnv();
 *   const env = getEnvConfig();
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface EnvConfig {
  /** Which AI provider is configured ('claude' | 'deepseek'). */
  aiProvider: string;
  /** Anthropic API key (present and non-empty). */
  anthropicApiKey: string;
  /** DeepSeek API key (present and non-empty). */
  deepseekApiKey: string;
  /** Google Cloud Vision API key for OCR. */
  googleVisionApiKey: string;
  /** Shared secret for app-to-server API authentication. */
  appApiSecret: string;
  /** Server port number. */
  port: number;
  /** Runtime environment: 'development' | 'production' | 'staging'. */
  nodeEnv: 'development' | 'production' | 'staging';
  /** Whether the current environment is production. */
  isProduction: boolean;
}

// ── Required variables ──────────────────────────────────────────────────

interface RequiredVar {
  key: string;
  /** Human-readable description for error messages. */
  label: string;
  /** URL where the user can obtain this key/value. */
  docsUrl?: string;
  /** If true, missing in production is fatal; in dev it's a warning. */
  devOptional?: boolean;
}

const REQUIRED_VARS: RequiredVar[] = [
  {
    key: 'ANTHROPIC_API_KEY',
    label: 'Anthropic API Key',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    key: 'DEEPSEEK_API_KEY',
    label: 'DeepSeek API Key',
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    key: 'GOOGLE_VISION_API_KEY',
    label: 'Google Cloud Vision API Key',
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
    devOptional: true, // Optional in dev — OCR will return 500 gracefully
  },
  {
    key: 'APP_API_SECRET',
    label: 'App API Secret (shared secret for authentication)',
    devOptional: true, // Optional in dev — auth is disabled without it
  },
];

const ALLOWED_NODE_ENVS = ['development', 'production', 'staging'] as const;

// ── Cache ───────────────────────────────────────────────────────────────

let _config: EnvConfig | null = null;

// ── Validation ──────────────────────────────────────────────────────────

/**
 * Validates all required environment variables.
 *
 * Call this ONCE at the very start of index.ts, BEFORE any other module
 * that reads process.env (dotenv should already be loaded by then).
 *
 * @throws {Error} if any REQUIRED variable is missing in production or
 *                 if NODE_ENV is invalid.
 */
export function validateEnv(): void {
  const nodeEnv = (process.env.NODE_ENV ?? 'development').toLowerCase();
  const isProduction = nodeEnv === 'production';

  // 1. Validate NODE_ENV
  if (!ALLOWED_NODE_ENVS.includes(nodeEnv as any)) {
    throw new Error(
      `Invalid NODE_ENV="${nodeEnv}". Must be one of: ${ALLOWED_NODE_ENVS.join(', ')}. ` +
        'Set NODE_ENV in server/.env.',
    );
  }

  // 2. Validate AI_PROVIDER
  const aiProvider = (process.env.AI_PROVIDER ?? 'claude').toLowerCase();
  if (!['claude', 'deepseek'].includes(aiProvider)) {
    throw new Error(
      `Unknown AI_PROVIDER="${aiProvider}". Must be "claude" or "deepseek".`,
    );
  }

  // 3. Validate all required keys
  const missing: string[] = [];
  const missingDev: string[] = [];

  for (const { key, label, docsUrl, devOptional } of REQUIRED_VARS) {
    const value = process.env[key];
    const isSet = typeof value === 'string' && value.trim().length > 0;

    if (!isSet) {
      if (isProduction || !devOptional) {
        missing.push(`  • ${label} (${key})${docsUrl ? `\n    → Get it at: ${docsUrl}` : ''}`);
      } else {
        missingDev.push(`  • ${label} (${key}) — optional in dev, required in production`);
      }
    }
  }

  // 4. Check cross-dependency: at least one AI key must match the provider
  if (aiProvider === 'claude' && !process.env.ANTHROPIC_API_KEY) {
    missing.push(
      `  • ANTHROPIC_API_KEY is required when AI_PROVIDER="${aiProvider}"\n` +
      '    → Get it at: https://console.anthropic.com/settings/keys',
    );
  }
  if (aiProvider === 'deepseek' && !process.env.DEEPSEEK_API_KEY) {
    missing.push(
      `  • DEEPSEEK_API_KEY is required when AI_PROVIDER="${aiProvider}"\n` +
      '    → Get it at: https://platform.deepseek.com/api_keys',
    );
  }

  // 5. Report findings
  if (missingDev.length > 0 && !isProduction) {
    console.warn('[EnvValidator] ⚠️  Optional variables missing (dev only):');
    for (const m of missingDev) console.warn(m);
    console.warn('');
  }

  if (missing.length > 0) {
    const header = isProduction
      ? '╔══════════════════════════════════════════════╗\n' +
        '║  ❌ PRODUCTION STARTUP FAILED                ║\n' +
        '╠══════════════════════════════════════════════╣\n' +
        '║  Required environment variables are missing: ║\n' +
        '╚══════════════════════════════════════════════╝'
      : '❌ Required environment variables are missing:';

    const footer =
      '\n\n📋 Copy server/.env.example to server/.env and fill in the values:\n' +
      '   cp server/.env.example server/.env';

    throw new Error(`${header}\n\n${missing.join('\n\n')}${footer}`);
  }

  // 6. Warn about defaults being used
  if (!process.env.APP_API_SECRET && !isProduction) {
    console.warn(
      '[EnvValidator] ⚠️  APP_API_SECRET not set — API authentication is DISABLED.\n' +
      '    The server will accept requests from any client.\n' +
      '    Set APP_API_SECRET in server/.env to enable authentication.',
    );
  }

  // 7. Success summary (no secrets printed!)
  console.log('[EnvValidator] ✅ Environment validated successfully.');
  console.log(`  NODE_ENV:    ${nodeEnv}`);
  console.log(`  AI_PROVIDER: ${aiProvider}`);
  console.log(`  API Keys:    ANTHROPIC=${process.env.ANTHROPIC_API_KEY ? '✅' : '❌'}  DEEPSEEK=${process.env.DEEPSEEK_API_KEY ? '✅' : '❌'}  VISION=${process.env.GOOGLE_VISION_API_KEY ? '✅' : '❌'}`);
  console.log(`  APP_API_SECRET: ${process.env.APP_API_SECRET ? '✅' : '⚠️  NOT SET (auth disabled)'}`);
  console.log('');
}

// ── Config accessor ─────────────────────────────────────────────────────

/**
 * Returns the validated environment configuration.
 * Must be called AFTER validateEnv().
 */
export function getEnvConfig(): EnvConfig {
  if (_config) return _config;

  const nodeEnv = (process.env.NODE_ENV ?? 'development').toLowerCase() as EnvConfig['nodeEnv'];

  _config = {
    aiProvider: (process.env.AI_PROVIDER ?? 'claude').toLowerCase(),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
    deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',
    googleVisionApiKey: process.env.GOOGLE_VISION_API_KEY ?? '',
    appApiSecret: process.env.APP_API_SECRET ?? '',
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv,
    isProduction: nodeEnv === 'production',
  };

  return _config;
}

/**
 * Returns whether API authentication is enabled.
 * True only when APP_API_SECRET is configured AND NODE_ENV is production.
 */
export function isAuthEnabled(): boolean {
  const config = getEnvConfig();
  return config.isProduction && config.appApiSecret.length > 0;
}

export default validateEnv;
