/**
 * The per-request assistant — provider selection, beta accounting and honest
 * reporting of who actually answered, in one place.
 *
 * Routes never touch a provider directly. They call `structured()` or
 * `rewrite()` and get back:
 *
 *   { data | text, source, note }
 *
 * `source` is the provider that really answered, so the UI's "which one
 * answered?" label stays truthful once there is more than one of them.
 * `data`/`text` being null is the existing signal to fall back to the
 * structural pass, so every call site's fallback logic is unchanged.
 *
 * Failure policy, resolving brief §7 against §22:
 *   · BYOK failure   → thrown. The user owns that key and must be told.
 *   · hosted failure → degrade to structural with a note. A provider outage
 *                      should not stop the director working.
 */
import { getAIProvider } from './ai.mjs'
import { assertWithinLimit, record } from './usage.mjs'
import { logAI } from './log.mjs'
import { AppError } from './errors.mjs'

const STRUCTURAL = { source: 'structural', data: null, text: null }

export function assistantFor(session, requestId = '-') {
  const { provider, mode, metered } = getAIProvider(session)
  const userId = session?.user?.id ?? null

  async function call(operation, fn) {
    if (!provider) return { ...STRUCTURAL, note: null }

    // Metered work is refused *before* the provider is contacted (brief §11).
    if (metered && userId) await assertWithinLimit(userId)

    const started = Date.now()
    try {
      const out = await fn(provider)
      const ms = Date.now() - started
      logAI({ id: requestId, userId, operation, provider: provider.name, model: provider.model, mode, ok: true, ms, usage: out.usage })
      if (userId) {
        await record({
          userId, operation, provider: provider.name, model: provider.model,
          metered, success: true, usage: out.usage, durationMs: ms,
        })
      }
      return { ...out, source: provider.name, note: null }
    } catch (err) {
      const ms = Date.now() - started
      logAI({ id: requestId, userId, operation, provider: provider.name, model: provider.model, mode, ok: false, ms })
      if (userId) {
        await record({
          userId, operation, provider: provider.name, model: provider.model,
          metered, success: false, usage: null, durationMs: ms,
        })
      }
      // A beta-limit refusal is the user's answer, not a provider failure.
      if (err instanceof AppError && err.code === 'beta_limit') throw err
      if (mode === 'byok') throw err
      err.degraded = true
      throw err
    }
  }

  /** Run `fn`, and on a non-BYOK provider failure fall back to structural. */
  async function tolerant(operation, fn) {
    try {
      return await call(operation, fn)
    } catch (err) {
      if (!err?.degraded) throw err
      return {
        ...STRUCTURAL,
        note: 'The AI provider was unavailable, so this is FRAME\u2019s local structural pass instead.',
        cause: err.cause ?? err,
      }
    }
  }

  return {
    mode,
    source: provider?.name ?? 'structural',
    model: provider?.model ?? null,
    metered,
    available: Boolean(provider),

    structured: (operation, task, context, schemaHint) =>
      tolerant(operation, (p) => p.structured(task, context, schemaHint)),

    rewrite: (operation, text, instruction, context = '') =>
      tolerant(operation, (p) => p.rewrite(text, instruction, context)),
  }
}
