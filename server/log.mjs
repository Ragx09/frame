/**
 * Server logging (brief §34).
 *
 * Every request carries an id so a user-facing "please try again" can be tied
 * to the real cause in the log. What is logged is deliberately narrow:
 *
 *   logged      request id, user id, method, path, operation, provider, model,
 *               outcome, duration, token counts
 *   never       API keys, auth tokens, prompt bodies, the director's creative
 *               content, environment values, connection strings
 *
 * `redact()` is the backstop: anything that looks like a credential is scrubbed
 * before it can reach the output, even from a stack trace.
 */
import { randomUUID } from 'node:crypto'

export const newRequestId = () => randomUUID().slice(0, 8)

const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{8,}/g,            // Anthropic / OpenAI style
  /\bsk-or-[A-Za-z0-9_-]{8,}/g,         // OpenRouter
  /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
  /\bpostgres(?:ql)?:\/\/[^\s'"]+/gi,   // connection strings
  /\b(authorization|api[-_]?key|password|secret|token)\b\s*[:=]\s*\S+/gi,
]

/** Scrub anything credential-shaped out of a string bound for the log. */
export function redact(value) {
  let s = typeof value === 'string' ? value : String(value ?? '')
  for (const rx of SECRET_PATTERNS) s = s.replace(rx, '[redacted]')
  return s
}

const ts = () => new Date().toISOString()

export function logRequest({ id, method, path, userId, status, ms }) {
  console.log(`[frame] ${ts()} ${id} ${method} ${path} ${status} ${ms}ms${userId ? ` user=${userId}` : ''}`)
}

/** One line per AI request — the operational record behind brief §34/§35. */
export function logAI({ id, userId, operation, provider, model, mode, ok, ms, usage }) {
  const tokens = usage ? ` in=${usage.input ?? '?'} out=${usage.output ?? '?'}` : ''
  console.log(
    `[frame:ai] ${ts()} ${id} ${operation} provider=${provider} model=${model} mode=${mode} ` +
    `${ok ? 'ok' : 'fail'} ${ms}ms${tokens}${userId ? ` user=${userId}` : ''}`,
  )
}

/** The technical detail behind a user-facing error. Server-side only. */
export function logError({ id, method, path, err }) {
  const detail = err?.cause ?? err
  console.error(
    `[frame:error] ${ts()} ${id} ${method} ${path} ${redact(detail?.message ?? detail)}`,
    redact(detail?.stack ?? ''),
  )
}
