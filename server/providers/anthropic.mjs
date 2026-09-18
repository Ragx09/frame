/**
 * Anthropic provider — the original FRAME assistant, now one implementation
 * behind the interface rather than the whole of `ai.mjs`.
 *
 * Used for a developer key in local development, and for a beta user's own
 * Anthropic key under BYOK. The key is passed in by the caller; this module
 * never reads the environment and never persists anything.
 */
import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_MODEL } from '../config.mjs'
import {
  SYSTEM, structuredTurn, rewriteTurn, extractJson,
  MAX_TOKENS_STRUCTURED, MAX_TOKENS_REWRITE,
} from './prompts.mjs'

const textOf = (res) =>
  res.content.filter((b) => b.type === 'text').map((b) => b.text).join('')

export function createAnthropicProvider({ apiKey, model = ANTHROPIC_MODEL }) {
  if (!apiKey) return null
  let client
  try {
    client = new Anthropic({ apiKey })
  } catch {
    return null
  }

  const call = (turn, maxTokens) =>
    client.messages.create({
      model,
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      system: SYSTEM,
      messages: [{ role: 'user', content: turn }],
    })

  return {
    name: 'anthropic',
    model,

    async structured(task, context, schemaHint) {
      const res = await call(structuredTurn(task, context, schemaHint), MAX_TOKENS_STRUCTURED)
      return { data: extractJson(textOf(res)), usage: usageOf(res) }
    },

    async rewrite(text, instruction, context = '') {
      const res = await call(rewriteTurn(text, instruction, context), MAX_TOKENS_REWRITE)
      return { text: textOf(res).trim(), usage: usageOf(res) }
    },

    async verify() {
      await client.messages.create({
        model, max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
      })
      return true
    },
  }
}

const usageOf = (res) =>
  res?.usage
    ? { input: res.usage.input_tokens ?? null, output: res.usage.output_tokens ?? null }
    : null
