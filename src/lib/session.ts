/**
 * Supabase Auth, on the browser side (brief §13).
 *
 * FRAME implements no authentication of its own. Supabase owns credentials,
 * email verification, password reset and OAuth; this module wraps it thinly so
 * the rest of the app deals in one `Session` shape and never imports the
 * Supabase client directly.
 *
 * In local development there is no Supabase project configured. `enabled` is
 * then false, every call is a no-op, and the app runs exactly as it did before
 * the beta: no sign-in, one implicit local user, work saved to SQLite (§16).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface FrameUser {
  id: string
  email: string
}

let client: SupabaseClient | null = null
let configured = false

/**
 * Configured from `/api/meta`, so the deployment's Supabase project is decided
 * by the server's environment rather than baked into the frontend bundle at
 * build time. Only the publishable key ever reaches the browser — the secret
 * key bypasses RLS and stays on the server.
 */
export function configureAuth(url: string | null, publishableKey: string | null): void {
  if (!url || !publishableKey || client) return
  client = createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  configured = true
  // Listeners may have subscribed before the client existed (the app mounts
  // before /api/meta answers), so they are held here and attached now.
  client.auth.onAuthStateChange((event, session) => {
    const changed = event === 'SIGNED_IN' || event === 'SIGNED_OUT'
      || (event === 'INITIAL_SESSION' && session !== null)
    if (!changed) return
    // Deferred: calling back into supabase-js inside this callback deadlocks.
    window.setTimeout(() => authListeners.forEach((fn) => fn()), 0)
  })
}

const authListeners = new Set<() => void>()

export const authEnabled = (): boolean => configured

/** The access token for the current session, or '' when signed out. */
export async function accessToken(): Promise<string> {
  if (!client) return ''
  const { data } = await client.auth.getSession()
  return data.session?.access_token ?? ''
}

export async function currentUser(): Promise<FrameUser | null> {
  if (!client) return null
  const { data } = await client.auth.getUser()
  return data.user ? { id: data.user.id, email: data.user.email ?? '' } : null
}

export interface FrameProfile extends FrameUser {
  name: string
  avatar: string
  /** How they sign in: 'email', 'google', … */
  provider: string
  createdAt: string
}

/** The signed-in user's account details, straight from Supabase Auth. */
export async function currentProfile(): Promise<FrameProfile | null> {
  if (!client) return null
  const { data } = await client.auth.getUser()
  const u = data.user
  if (!u) return null
  const md = (u.user_metadata ?? {}) as Record<string, string | undefined>
  return {
    id: u.id,
    email: u.email ?? '',
    name: md.full_name ?? md.name ?? '',
    avatar: md.avatar_url ?? md.picture ?? '',
    provider: String(u.app_metadata?.provider ?? 'email'),
    createdAt: u.created_at,
  }
}

/** Kept in Supabase user metadata — FRAME's own database is not involved. */
export async function updateDisplayName(name: string) {
  if (!client) return { ok: false as const, error: 'Sign-in is not configured.' }
  const { error } = await client.auth.updateUser({ data: { full_name: name.trim() } })
  return fail(error)
}

export async function changePassword(password: string) {
  if (!client) return { ok: false as const, error: 'Sign-in is not configured.' }
  const { error } = await client.auth.updateUser({ password })
  return fail(error)
}

export function onAuthChange(fn: () => void): () => void {
  authListeners.add(fn)
  return () => { authListeners.delete(fn) }
}

/** Supabase returns its own messages; they are already user-facing. */
const fail = (error: { message: string } | null) => (error ? { ok: false as const, error: error.message } : { ok: true as const })

export async function signIn(email: string, password: string) {
  if (!client) return { ok: false as const, error: 'Sign-in is not configured.' }
  const { error } = await client.auth.signInWithPassword({ email, password })
  return fail(error)
}

export async function signUp(email: string, password: string) {
  if (!client) return { ok: false as const, error: 'Sign-up is not configured.' }
  const { data, error } = await client.auth.signUp({
    email, password,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) return { ok: false as const, error: error.message }
  // With email confirmation on, there is no session until the link is clicked.
  return { ok: true as const, needsConfirmation: !data.session }
}

export async function signInWithGoogle() {
  if (!client) return { ok: false as const, error: 'Sign-in is not configured.' }
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  return fail(error)
}

export async function signOut(): Promise<void> {
  await client?.auth.signOut()
}
