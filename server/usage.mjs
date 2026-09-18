/**
 * Beta usage limit and AI usage log (brief §11, §35).
 *
 * The hosted OpenRouter key is the developer's, so hosted requests are counted
 * per user per UTC day and refused past `BETA_DAILY_AI_LIMIT`. This is a
 * counter, not a billing system — there are no credits, no balances and no
 * prices anywhere in it.
 *
 * What does NOT count against the allowance:
 *   · BYOK requests      — the user is paying their own provider
 *   · structural results — local, deterministic, free
 *   · failed requests    — a provider error should not cost the user a turn
 */
import { BETA_DAILY_AI_LIMIT } from './config.mjs'
import { all, one, insert, uid, now } from './db.mjs'
import { tooMany } from './errors.mjs'

/** The limit window. UTC so it does not move with the user's timezone. */
export const today = () => new Date().toISOString().slice(0, 10)

export const LIMIT_MESSAGE =
  'Beta AI limit reached. Try again later or use your own API key.'

/** How many metered, successful hosted requests this user has made today. */
export async function usedToday(userId) {
  const row = await one(
    'SELECT COUNT(*) AS n FROM ai_usage WHERE user_id = ? AND day = ? AND metered = 1 AND success = 1',
    userId, today(),
  )
  return Number(row?.n ?? 0)
}

export async function usageSummary(userId) {
  const used = await usedToday(userId)
  return { used, limit: BETA_DAILY_AI_LIMIT, remaining: Math.max(0, BETA_DAILY_AI_LIMIT - used), day: today() }
}

/**
 * Called before a hosted request is made. Throws rather than letting the
 * provider be called at all — brief §11 requires that no provider call happens
 * once the limit is reached.
 */
export async function assertWithinLimit(userId) {
  if (BETA_DAILY_AI_LIMIT === 0) return // 0 disables the limit entirely
  const used = await usedToday(userId)
  if (used >= BETA_DAILY_AI_LIMIT) throw tooMany(LIMIT_MESSAGE, 'beta_limit')
}

/** Record one AI request. Operation and provider only — never the prompt. */
export async function record({
  userId, operation, provider, model, metered, success, usage, durationMs,
}) {
  await insert('ai_usage', {
    id: uid(),
    user_id: userId,
    day: today(),
    operation,
    provider,
    model: model ?? '',
    metered: metered ? 1 : 0,
    success: success ? 1 : 0,
    input_tokens: usage?.input ?? null,
    output_tokens: usage?.output ?? null,
    duration_ms: durationMs ?? null,
    created_at: now(),
  })
}

/** Recent hosted activity, for the developer's beta monitoring. */
export async function recentUsage(limit = 100) {
  return all(
    'SELECT day, operation, provider, model, metered, success, input_tokens, output_tokens, duration_ms, created_at' +
    ' FROM ai_usage ORDER BY created_at DESC LIMIT ?', limit,
  )
}
