/**
 * AI provider abstraction.
 *
 *   AIProvider ├── generate  ├── rewrite  ├── analyze  ├── suggest  └── structured
 *
 * Two implementations ship today:
 *   - "anthropic"  real model calls, used when a key is resolvable
 *   - "structural" deterministic, local, no network. It does honest structural
 *                  work (segmenting, extracting, reformatting) and never
 *                  pretends to be a model.
 * The UI always shows which one answered.
 */
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODEL = 'claude-opus-5'
const SETTINGS = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'settings.json')

function settings() {
  try { return JSON.parse(readFileSync(SETTINGS, 'utf8')) } catch { return {} }
}

/** Store the key locally so the workspace keeps working across restarts. */
export function setKey(key) {
  mkdirSync(dirname(SETTINGS), { recursive: true })
  writeFileSync(SETTINGS, JSON.stringify({ apiKey: key || undefined }, null, 2))
  client = null
}

function credential() {
  return process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || settings().apiKey || null
}

let client = null
function anthropic() {
  if (client) return client
  const key = credential()
  if (!key) return null
  try {
    client = new Anthropic({ apiKey: key })
    return client
  } catch {
    return null
  }
}

export function providerName() {
  return credential() ? 'anthropic' : 'structural'
}

export function keyState() {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return 'env'
  if (settings().apiKey) return 'stored'
  return 'none'
}

/** Confirm a key actually works before the UI claims the model is connected. */
export async function verify() {
  const c = anthropic()
  if (!c) return { ok: false, error: 'No key configured.' }
  try {
    await c.messages.create({
      model: MODEL, max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
    })
    return { ok: true }
  } catch (err) {
    client = null
    return { ok: false, error: String(err?.message ?? err).slice(0, 300) }
  }
}

const SYSTEM = `You are the creative development assistant inside FRAME, a film
development workspace. The user is the director; you never take over the creative
decisions. You suggest, structure and clarify — concisely, in the user's own
register. Never invent facts about the film that the director has not implied.
Write plainly: no marketing adjectives, no "cinematic masterpiece" filler.`

/** Ask for JSON matching a shape. Returns null when no model is available. */
export async function structured(task, context, schemaHint) {
  const c = providerName() === 'anthropic' ? anthropic() : null
  if (!c) return null
  const res = await c.messages.create({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `${task}\n\nPROJECT CONTEXT:\n${context}\n\nRespond with JSON only, matching:\n${schemaHint}`,
      },
    ],
  })
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    return JSON.parse(m[0])
  } catch {
    return null
  }
}

export async function rewrite(text, instruction, context = '') {
  const c = providerName() === 'anthropic' ? anthropic() : null
  if (!c) return null
  const res = await c.messages.create({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    messages: [
      { role: 'user', content: `${instruction}\n\nCONTEXT:\n${context}\n\nTEXT:\n${text}\n\nReturn only the rewritten text.` },
    ],
  })
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
}

/* ------------------------------------------------------------------ */
/* Structural fallback — deterministic, local, no model.               */
/* ------------------------------------------------------------------ */

const sentences = (t) =>
  String(t ?? '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

const VISUAL = /\b(dawn|dusk|night|morning|light|sun|shadow|colou?r|green|copper|tree|house|room|window|smoke|steam|water|sea|rain|fire|grain|texture|bottle|still|village|coast)\w*/gi
const FEELING = /\b(nostalg\w+|wonder|pride|grief|joy|mystery|melanchol\w+|intima\w+|quiet|warm|cold|ancient|modern|sacred|tender|fear|loss|hope)\w*/gi

export function structuralIdea(raw) {
  const sents = sentences(raw)
  const visual = [...new Set((raw.match(VISUAL) ?? []).map((s) => s.toLowerCase()))]
  const feeling = [...new Set((raw.match(FEELING) ?? []).map((s) => s.toLowerCase()))]
  const questions = []
  if (!/\bend\w*|final\w*|last\b/i.test(raw)) questions.push('How does it end?')
  if (!feeling.length) questions.push('What should the audience feel at the close?')
  if (!/\bwho\b|\bhe\b|\bshe\b|\bthey\b|\bman\b|\bwoman\b|\bboy\b|\bgirl\b/i.test(raw))
    questions.push('Who do we follow through this?')
  questions.push('What is the one image the film is built around?')
  return {
    central_idea: sents[0] ?? '',
    premise: sents.slice(0, 2).join(' '),
    theme: feeling.slice(0, 3).join(', '),
    emotional_direction: feeling.join(' → '),
    conflict: '',
    ending: sents.length > 2 ? sents[sents.length - 1] : '',
    questions: questions.join('\n'),
    visual_motifs: visual.slice(0, 12).join(', '),
    _source: 'structural',
  }
}

/** Split prose into screenplay elements — structural, not authored. */
export function structuralScript(text) {
  const out = []
  for (const line of String(text ?? '').split(/\n+/)) {
    const t = line.trim()
    if (!t) continue
    if (/^(INT|EXT|INT\.\/EXT)[\s.]/i.test(t)) out.push({ type: 'scene_heading', text: t.toUpperCase() })
    else if (/^(CUT TO|FADE (IN|OUT)|DISSOLVE)/i.test(t)) out.push({ type: 'transition', text: t.toUpperCase() })
    else if (/^[A-Z][A-Z \t.'-]{1,30}$/.test(t)) out.push({ type: 'character', text: t })
    else if (/^\(.*\)$/.test(t)) out.push({ type: 'parenthetical', text: t })
    else out.push({ type: 'action', text: t })
  }
  return out
}
