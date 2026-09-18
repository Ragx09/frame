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
}

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

export function onAuthChange(fn: () => void): () => void {
  if (!client) return () => {}
  const { data } = client.auth.onAuthStateChange(() => fn())
  return () => data.subscription.unsubscribe()
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
