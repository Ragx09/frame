/**
 * Identity (brief §13).
 *
 * FRAME does not implement authentication. Supabase Auth owns credentials,
 * sessions, email verification and OAuth; this module does exactly one thing:
 * turn the `Authorization: Bearer <access token>` header a signed-in browser
 * sends into a `{ id, email }` we can hang project ownership off.
 *
 * Local development has no Supabase and no sign-in. It runs as a single
 * implicit local user so every route can assume a session exists and the
 * pre-beta workflow (`npm run dev`, open the app, start writing) is unchanged.
 */
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, cloudMode } from './config.mjs'
import { all, one, insert, run, uid, now } from './db.mjs'
import { unauthorized } from './errors.mjs'
import { BYOK_PROVIDERS } from './ai.mjs'

/** The one identity local development runs as. Never used in cloud mode. */
export const LOCAL_USER = { id: 'local', email: 'local@frame', local: true }

/* A client with the publishable key only — it is used solely to ask Supabase
   "whose token is this?". The secret key is never needed for that and so is
   never loaded here. */
const supabase = cloudMode
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null

/** Short-lived cache so a burst of requests is one token verification. */
const tokenCache = new Map()
const TOKEN_TTL_MS = 60_000

function cached(token) {
  const hit = tokenCache.get(token)
  if (!hit) return null
  if (Date.now() > hit.expires) { tokenCache.delete(token); return null }
  return hit.user
}

function remember(token, user) {
  if (tokenCache.size > 500) tokenCache.clear()
  tokenCache.set(token, { user, expires: Date.now() + TOKEN_TTL_MS })
}

const bearer = (req) => {
  const h = req.headers.authorization ?? ''
  return h.startsWith('Bearer ') ? h.slice(7).trim() : ''
}

/**
 * Resolve the session for a request. Returns `null` for an anonymous caller
 * rather than throwing — the demo and the landing page are public, and each
 * route decides for itself whether it requires a user.
 */
export async function sessionFor(req) {
  const byok = byokFrom(req)

  if (!cloudMode) return { user: LOCAL_USER, byok, anonymous: false, local: true }

  const token = bearer(req)
  if (!token) return { user: null, byok, anonymous: true, local: false }

  const hit = cached(token)
  if (hit) return { user: hit, byok, anonymous: false, local: false }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return { user: null, byok, anonymous: true, local: false }

  const user = { id: data.user.id, email: data.user.email ?? '' }
  remember(token, user)
  await touchUser(user)
  return { user, byok, anonymous: false, local: false }
}

/** First authenticated request creates the local mirror row. */
async function touchUser(user) {
  const existing = await one('SELECT id FROM users WHERE id = ?', user.id)
  if (existing) {
    await run('UPDATE users SET last_seen_at = ?, email = ? WHERE id = ?', now(), user.email, user.id)
  } else {
    await insert('users', { id: user.id, email: user.email, created_at: now(), last_seen_at: now() })
  }
}

/**
 * A user's own API key, sent per request and never stored server-side.
 *
 * Brief §9: FRAME has no encrypted server-side key storage and is explicitly
 * not to invent a cryptographic system for the beta, so a BYOK key lives in
 * the user's own browser and travels on the request that uses it. It is read
 * here, handed to the provider, and dropped. It is never written to the
 * database, never logged, never echoed back and never included in an export.
 */
function byokFrom(req) {
  const provider = String(req.headers['x-frame-byok-provider'] ?? '').trim().toLowerCase()
  const key = String(req.headers['x-frame-byok-key'] ?? '').trim()
  if (!provider || !key || !BYOK_PROVIDERS[provider]) return null
  return { provider, key }
}

/** Require a signed-in user. Local development always satisfies this. */
export function requireUser(session) {
  if (!session?.user) throw unauthorized()
  return session.user
}

/** Ensure the local mirror row exists for the implicit local user. */
export async function ensureLocalUser() {
  if (cloudMode) return
  const existing = await one('SELECT id FROM users WHERE id = ?', LOCAL_USER.id)
  if (!existing) {
    await insert('users', { id: LOCAL_USER.id, email: LOCAL_USER.email, created_at: now(), last_seen_at: now() })
  }
}

/** Adopt any pre-beta project that has no owner, so upgrading in place works. */
export async function adoptOwnerlessProjects() {
  if (cloudMode) return
  const orphans = await all('SELECT id FROM projects WHERE owner_id IS NULL')
  for (const p of orphans) await run('UPDATE projects SET owner_id = ? WHERE id = ?', LOCAL_USER.id, p.id)
  return orphans.length
}
