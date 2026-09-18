/**
 * OpenRouter provider — the hosted "FRAME Beta AI".
 *
 * OpenRouter speaks the OpenAI chat-completions shape, so this is a plain
 * `fetch` against one endpoint; no SDK is added for it. The model is never
 * hardcoded here — it arrives from `config.OPENROUTER_MODEL` (brief §5).
 *
 * The key is a parameter, never read from the environment in this file, so the
 * same implementation serves both the developer's hosted key and a beta user's
 * own OpenRouter key under BYOK.
 */
import { APP_URL, OPENROUTER_MODEL } from '../config.mjs'
import { aiError } from '../errors.mjs'
import {
  SYSTEM, structuredTurn, rewriteTurn, extractJson,
  MAX_TOKENS_STRUCTURED, MAX_TOKENS_REWRITE,
} from './prompts.mjs'

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const TIMEOUT_MS = 120_000

export function createOpenRouterProvider({ apiKey, model = OPENROUTER_MODEL, byok = false }) {
  if (!apiKey) return null

  async function call(turn, maxTokens, { json = false } = {}) {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS)
    let res
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        signal: ac.signal,
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          // Attribution headers OpenRouter uses for its dashboard. Public info only.
          ...(APP_URL ? { 'http-referer': APP_URL } : {}),
          'x-title': 'FRAME Beta',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: turn },
          ],
          ...(json ? { response_format: { type: 'json_object' } } : {}),
        }),
      })
    } catch (err) {
      // Network failure or timeout. The cause is logged by the caller, not sent.
      const e = aiError(0, { byok })
      e.cause = err
      throw e
    } finally {
      clearTimeout(timer)
    }

    if (!res.ok) {
      // Read and discard the body: it can quote the request, which may contain
      // the director's creative material. Only the status shapes the response.
      const detail = await res.text().catch(() => '')
      const e = aiError(res.status, { byok })
      e.cause = new Error(`openrouter ${res.status}: ${detail.slice(0, 500)}`)
      throw e
    }

    return res.json()
  }

  const textOf = (body) => String(body?.choices?.[0]?.message?.content ?? '')

  return {
    name: 'openrouter',
    model,

    async structured(task, context, schemaHint) {
      const body = await call(structuredTurn(task, context, schemaHint), MAX_TOKENS_STRUCTURED, { json: true })
      return { data: extractJson(textOf(body)), usage: usageOf(body) }
    },

    async rewrite(text, instruction, context = '') {
      const body = await call(rewriteTurn(text, instruction, context), MAX_TOKENS_REWRITE)
      return { text: textOf(body).trim(), usage: usageOf(body) }
    },

    async verify() {
      await call('Reply with the single word: ok', 16)
      return true
    },
  }
}

const usageOf = (body) =>
  body?.usage
    ? {
        input: body.usage.prompt_tokens ?? null,
        output: body.usage.completion_tokens ?? null,
        total: body.usage.total_tokens ?? null,
      }
    : null
