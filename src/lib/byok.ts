/**
 * "Bring your own key" storage (brief §8, §9).
 *
 * The key lives in this browser and nowhere else. FRAME has no encrypted
 * server-side key store and the brief is explicit that the beta must not
 * invent a cryptographic system for one, so the honest arrangement is:
 *
 *   · the key is held in this browser's localStorage
 *   · it travels on the requests that use it, as a header
 *   · the server reads it, calls the provider, and drops it
 *   · it is never persisted server-side, logged, or put in an export
 *
 * The user is told all of this in Settings rather than having to infer it.
 */

const KEY = 'frame.byok'

export type ByokProvider = 'anthropic' | 'openrouter'

export interface Byok {
  provider: ByokProvider
  key: string
  masked: string
  savedAt: string
}

/** Never throws: private mode and blocked storage must not break the app. */
export function loadByok(): Byok | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Byok
    return parsed?.provider && parsed?.key ? parsed : null
  } catch {
    return null
  }
}

export function saveByok(b: Byok): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(b))
  } catch {
    /* storage unavailable — the key simply will not persist across reloads */
  }
}

export function clearByok(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to do */
  }
}

/**
 * The headers that carry the key. Returned as a fresh object each time so a
 * caller cannot accidentally hold a long-lived reference to the key.
 */
export function byokHeaders(): Record<string, string> {
  const b = loadByok()
  if (!b) return {}
  return { 'x-frame-byok-provider': b.provider, 'x-frame-byok-key': b.key }
}
