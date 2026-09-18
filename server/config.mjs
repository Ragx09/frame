/**
 * All environment configuration in one place.
 *
 * Nothing else in the server reads `process.env` for these values, so there is
 * exactly one line to look at when asking "what is this deployment doing?", and
 * exactly one place a secret can be read from. `publicMeta()` is the only shape
 * that is ever allowed to reach the browser — see the test at the bottom of
 * `DEPLOYMENT.md`.
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const envFile = join(here, '..', '.env')

// Node 24 loads .env natively — no dotenv dependency needed.
if (existsSync(envFile)) {
  try { process.loadEnvFile(envFile) } catch { /* malformed .env is not fatal */ }
}

const str = (k, fallback = '') => String(process.env[k] ?? fallback).trim()
const num = (k, fallback) => {
  const v = Number(process.env[k])
  return Number.isFinite(v) && v >= 0 ? v : fallback
}

export const env = str('NODE_ENV', 'development')
export const isProd = env === 'production'
export const isDev = !isProd

export const PORT = num('PORT', 8787)

/** In production, bind all interfaces so a container can route to us. */
export const HOST = str('HOST', isProd ? '0.0.0.0' : '127.0.0.1')

/** Public origin of the deployed frontend. Drives CORS and auth redirects. */
export const APP_URL = str('APP_URL').replace(/\/+$/, '')

/* ----------------------------- hosted AI ---------------------------- */

export const OPENROUTER_API_KEY = str('OPENROUTER_API_KEY')
/** Defaults to the model this project already ran on, namespaced for OpenRouter. */
export const OPENROUTER_MODEL = str('OPENROUTER_MODEL', 'anthropic/claude-opus-5')

/** The model the Anthropic provider uses — for BYOK and for local development. */
export const ANTHROPIC_MODEL = str('ANTHROPIC_MODEL', 'claude-opus-5')

/** A developer key for local work. Never offered to beta users. */
export const ANTHROPIC_API_KEY = str('ANTHROPIC_API_KEY') || str('ANTHROPIC_AUTH_TOKEN')

export const hostedAvailable = () => Boolean(OPENROUTER_API_KEY)

/* -------------------------------- beta ------------------------------ */

export const BETA_DAILY_AI_LIMIT = num('BETA_DAILY_AI_LIMIT', 20)
export const PUBLIC_FEEDBACK_URL = str('PUBLIC_FEEDBACK_URL')

/* ------------------------------ supabase ---------------------------- */

export const SUPABASE_URL = str('SUPABASE_URL').replace(/\/+$/, '')

/** Publishable ("anon") key — safe in the browser, subject to RLS. */
export const SUPABASE_PUBLISHABLE_KEY =
  str('SUPABASE_PUBLISHABLE_KEY') || str('SUPABASE_ANON_KEY')

/** Secret ("service_role") key — bypasses RLS. Server only. Never serialised. */
export const SUPABASE_SECRET_KEY =
  str('SUPABASE_SECRET_KEY') || str('SUPABASE_SERVICE_ROLE_KEY')

/** Direct Postgres connection string, for the data layer and migrations. */
export const DATABASE_URL = str('DATABASE_URL')

/** Cloud mode is on only when we can both authenticate and persist. */
export const cloudMode = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && DATABASE_URL)

export const VERSION = '0.2.0-beta'

/**
 * The only configuration shape allowed to cross to the browser.
 * Booleans and public URLs only — never a key, never a connection string.
 */
export function publicMeta() {
  return {
    version: VERSION,
    beta: true,
    mode: cloudMode ? 'cloud' : 'local',
    hostedAI: hostedAvailable(),
    hostedModel: hostedAvailable() ? OPENROUTER_MODEL : null,
    dailyLimit: BETA_DAILY_AI_LIMIT,
    feedbackUrl: PUBLIC_FEEDBACK_URL || null,
    supabaseUrl: cloudMode ? SUPABASE_URL : null,
    supabaseKey: cloudMode ? SUPABASE_PUBLISHABLE_KEY : null,
  }
}
