/**
 * AI provider abstraction — selection only.
 *
 *   AIProvider
 *   ├── openrouter   hosted "FRAME Beta AI", the developer's key (brief §5)
 *   ├── anthropic    a developer key locally, or a beta user's own key (BYOK)
 *   ├── structural   deterministic, local, no network, no key
 *   └── future providers — add a file under providers/ and a case in `build()`
 *
 * This module answers exactly one question: *which provider should serve this
 * request?* It performs no requests of its own, keeps no state beyond a cache
 * of the hosted client, and never touches the database. Enforcement of beta
 * limits, usage logging and the fallback to structural live one layer up, in
 * `assistant.mjs`.
 *
 * The structural helpers are re-exported so the rest of the server keeps its
 * single `import * as ai from './ai.mjs'`.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  OPENROUTER_API_KEY, OPENROUTER_MODEL,
  ANTHROPIC_API_KEY, ANTHROPIC_MODEL,
  hostedAvailable, cloudMode,
} from './config.mjs'
import { badRequest } from './errors.mjs'
import { createOpenRouterProvider } from './providers/openrouter.mjs'
import { createAnthropicProvider } from './providers/anthropic.mjs'

export * from './providers/structural.mjs'

/** Providers a user may bring a key for. Add here to extend BYOK (brief §8). */
export const BYOK_PROVIDERS = {
  anthropic: { label: 'Anthropic', prefix: 'sk-ant-', model: ANTHROPIC_MODEL },
  openrouter: { label: 'OpenRouter', prefix: 'sk-or-', model: OPENROUTER_MODEL },
}

/** Build a provider instance by name. The only place the map lives. */
function build(name, apiKey, { byok = false, model } = {}) {
  switch (name) {
    case 'openrouter': return createOpenRouterProvider({ apiKey, byok, ...(model ? { model } : {}) })
    case 'anthropic': return createAnthropicProvider({ apiKey, ...(model ? { model } : {}) })
    default: return null
  }
}

/** The hosted client is stateless and shared; build it once. */
let hostedCache = null
function hosted() {
  if (!hostedAvailable()) return null
  if (!hostedCache) hostedCache = build('openrouter', OPENROUTER_API_KEY)
  return hostedCache
}

/**
 * getAIProvider(request) — brief §7, in order:
 *
 *   1. the user asked for BYOK and supplied a usable key  → their provider
 *   2. otherwise                                          → hosted OpenRouter
 *   3. hosted unavailable                                 → structural
 *
 * `session.byok` is `{ provider, key }` as resolved by the auth layer; it is
 * never read from the request body here, and never logged.
 */
export function getAIProvider(session = {}) {
  const byok = session.byok
  if (byok?.provider && byok?.key) {
    const p = build(byok.provider, byok.key, { byok: true })
    if (p) return { provider: p, mode: 'byok', metered: false }
  }

  const h = hosted()
  if (h) return { provider: h, mode: 'hosted', metered: true }

  // Local development convenience: a developer's own Anthropic key still works
  // exactly as it did before the beta, and is never metered against the hosted
  // beta allowance because it is not the hosted key.
  const devKey = ANTHROPIC_API_KEY || localKey()
  const dev = devKey ? build('anthropic', devKey) : null
  if (dev) return { provider: dev, mode: 'local-key', metered: false }

  return { provider: null, mode: 'structural', metered: false }
}

/** What the current deployment offers, for `/api/meta`. Booleans only. */
export function capability() {
  return {
    hosted: hostedAvailable(),
    hostedModel: hostedAvailable() ? OPENROUTER_MODEL : null,
    localKey: Boolean(ANTHROPIC_API_KEY || localKey()),
    localKeyState: localKeyState(),
    byok: Object.entries(BYOK_PROVIDERS).map(([id, p]) => ({ id, label: p.label })),
  }
}

/**
 * Shape-check a user-supplied key before it is stored or used. This is a
 * typo guard, not a security control — the provider is the real authority.
 * The key itself is never included in the thrown message.
 */
export function assertKeyShape(providerId, key) {
  const spec = BYOK_PROVIDERS[providerId]
  if (!spec) throw badRequest('That AI provider is not supported.', 'bad_provider')
  const k = String(key ?? '').trim()
  if (k.length < 20) throw badRequest('That does not look like an API key.', 'bad_key')
  if (!k.startsWith(spec.prefix)) {
    throw badRequest(`An ${spec.label} key normally starts with "${spec.prefix}".`, 'bad_key')
  }
  return k
}

/** Show a key as `sk-ant-••••••••••••1234` — never the middle (brief §8). */
export function maskKey(key) {
  const k = String(key ?? '')
  if (k.length < 12) return '••••••••'
  const spec = Object.values(BYOK_PROVIDERS).find((p) => k.startsWith(p.prefix))
  const head = spec ? spec.prefix : k.slice(0, 6)
  return `${head}${'•'.repeat(12)}${k.slice(-4)}`
}

/** Verify a key really works before the UI claims the model is connected. */
export async function verifyKey(providerId, key) {
  const p = build(providerId, key, { byok: true })
  if (!p) return { ok: false, error: 'That AI provider is not supported.' }
  try {
    await p.verify()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err?.expose ? err.message : 'That key was rejected by the provider.' }
  }
}


/* ------------------------------------------------------------------ */
/* The legacy local developer key.                                     */
/*                                                                     */
/* Before the beta, FRAME stored one Anthropic key in                  */
/* `data/settings.json` on the developer's own machine. Brief §16 says */
/* local development must keep working, so that path is preserved      */
/* exactly — but only in local mode. In cloud mode it is inert: the    */
/* hosted key comes from the environment and a user's own key travels  */
/* per request and is never written to disk.                           */
/* ------------------------------------------------------------------ */

const SETTINGS = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'settings.json')

function localSettings() {
  if (cloudMode) return {}
  try { return JSON.parse(readFileSync(SETTINGS, 'utf8')) } catch { return {} }
}

const localKey = () => (cloudMode ? '' : localSettings().apiKey || '')

export function setLocalKey(key) {
  if (cloudMode) return
  mkdirSync(dirname(SETTINGS), { recursive: true })
  writeFileSync(SETTINGS, JSON.stringify({ apiKey: key || undefined }, null, 2))
}

export function localKeyState() {
  if (ANTHROPIC_API_KEY) return 'env'
  if (localKey()) return 'stored'
  return 'none'
}

export async function verifyLocalKey() {
  const key = ANTHROPIC_API_KEY || localKey()
  if (!key) return { ok: false, error: 'No key configured.' }
  return verifyKey('anthropic', key)
}
