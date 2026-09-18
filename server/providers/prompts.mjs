/**
 * The system prompt and the JSON-extraction rule, shared by every model-backed
 * provider so that switching provider changes *who answers*, never *what was
 * asked*. Brief §6: the existing prompt/context design is deliberate and is not
 * to be varied per provider.
 */

export const SYSTEM = `You are the creative development assistant inside FRAME, a film
development workspace. The user is the director; you never take over the creative
decisions. You suggest, structure and clarify — concisely, in the user's own
register. Never invent facts about the film that the director has not implied.
Write plainly: no marketing adjectives, no "cinematic masterpiece" filler.`

/** The user turn for a structured (JSON) request. */
export const structuredTurn = (task, context, schemaHint) =>
  `${task}\n\nPROJECT CONTEXT:\n${context}\n\nRespond with JSON only, matching:\n${schemaHint}`

/** The user turn for a rewrite request. */
export const rewriteTurn = (text, instruction, context) =>
  `${instruction}\n\nCONTEXT:\n${context}\n\nTEXT:\n${text}\n\nReturn only the rewritten text.`

/** Pull the first JSON object out of a model reply. Returns null, never throws. */
export function extractJson(text) {
  const m = String(text ?? '').match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    return JSON.parse(m[0])
  } catch {
    return null
  }
}

export const MAX_TOKENS_STRUCTURED = 8000
export const MAX_TOKENS_REWRITE = 4000
