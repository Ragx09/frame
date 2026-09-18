/**
 * Two kinds of error exist in this server, and the difference is the whole
 * point of brief §22:
 *
 *   AppError  — something the user did or asked for. Its message is written
 *               for them and is safe to send.
 *   anything else — a bug, a provider failure, a database failure. The user
 *               gets a fixed sentence; the detail goes to the server log only.
 *
 * Nothing that reaches the client is ever derived from a caught exception's
 * own message, so stack traces, provider payloads, connection strings and
 * filesystem paths cannot leak through the error path.
 */

export class AppError extends Error {
  /** @param {number} status @param {string} message user-safe @param {string} [code] */
  constructor(status, message, code = '') {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.expose = true
  }
}

export const badRequest = (msg, code) => new AppError(400, msg, code)
export const unauthorized = (msg = 'Sign in to continue.', code = 'unauthenticated') =>
  new AppError(401, msg, code)
export const forbidden = (msg = 'You do not have access to that.', code = 'forbidden') =>
  new AppError(403, msg, code)
export const notFound = (msg = 'Not found.', code = 'not_found') => new AppError(404, msg, code)
export const tooMany = (msg, code = 'rate_limited') => new AppError(429, msg, code)

/** The single sentence the user sees when something genuinely broke. */
export const GENERIC = 'FRAME couldn\u2019t complete that request. Please try again.'

/**
 * Map a provider failure onto a short, user-safe reason (brief §22) without
 * ever echoing the provider's own text. Only the HTTP status is consulted.
 */
export function aiError(status, { byok = false } = {}) {
  if (status === 401 || status === 403) {
    return new AppError(502, byok
      ? 'Your API key was rejected. Check it in Settings.'
      : 'AI provider temporarily unavailable.', 'ai_auth')
  }
  if (status === 429) {
    return new AppError(502, 'AI provider is rate limiting requests. Try again in a moment.', 'ai_busy')
  }
  if (status === 402) {
    return new AppError(502, byok
      ? 'Your API account is out of credit.'
      : 'AI provider temporarily unavailable.', 'ai_credit')
  }
  return new AppError(502, 'AI provider temporarily unavailable.', 'ai_unavailable')
}
