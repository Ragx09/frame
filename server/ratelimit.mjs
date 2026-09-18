/**
 * Abuse prevention for the AI endpoints (brief §12).
 *
 * A fixed-window counter held in process memory. That is the right size for a
 * beta on a single Node instance, and it is deliberately not Redis: the project
 * does not use Redis, and §12 says not to introduce it for this.
 *
 * If the beta ever runs more than one instance, replace `hits` with a shared
 * store — the interface (`check(key)`) is the only thing callers depend on.
 */
import { tooMany } from './errors.mjs'

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = Number(process.env.AI_RATE_LIMIT_PER_MINUTE ?? 12)

const hits = new Map()

/** Drop expired windows so the map cannot grow without bound. */
function sweep(nowMs) {
  for (const [k, v] of hits) if (nowMs > v.resets) hits.delete(k)
}

let lastSweep = 0

/**
 * Count one request against `key`. Throws 429 when the window is exhausted.
 * The message says when to retry and nothing about how the limiter works.
 */
export function check(key) {
  const nowMs = Date.now()
  if (nowMs - lastSweep > WINDOW_MS) { sweep(nowMs); lastSweep = nowMs }

  const slot = hits.get(key)
  if (!slot || nowMs > slot.resets) {
    hits.set(key, { count: 1, resets: nowMs + WINDOW_MS })
    return
  }
  slot.count++
  if (slot.count > MAX_PER_WINDOW) {
    const secs = Math.ceil((slot.resets - nowMs) / 1000)
    throw tooMany(`Too many requests. Try again in ${secs}s.`, 'rate_limited')
  }
}

/** Test seam — also used by the dev server on restart. */
export function reset() { hits.clear() }
