/**
 * The structural provider — deterministic, local, no network, no key.
 *
 * It does honest structural work (segmenting, extracting, reformatting) on the
 * director's own words and never pretends to be a model. It is the floor the
 * product stands on: every AI feature degrades to this rather than to an error,
 * so FRAME is never wholly dependent on an external service (brief §7).
 *
 * Moved verbatim out of the old single-file `ai.mjs` — behaviour is unchanged.
 */

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

/**
 * Split a story (or an existing script) into scene proposals — structural, not
 * authored. Script scene headings are real structure, so they win; without a
 * script the story's own paragraph breaks are the only honest seam available.
 */
export function structuralScenes(story, scriptElements = []) {
  const headings = scriptElements.filter((e) => e.type === 'scene_heading')
  if (headings.length) {
    return headings.map((h, i) => {
      const next = scriptElements.find((e) => e.sort > h.sort && e.type === 'scene_heading')
      const body = scriptElements
        .filter((e) => e.sort > h.sort && (!next || e.sort < next.sort) && e.type === 'action')
        .map((e) => e.text)
      const parsed = parseSlug(h.text)
      return {
        title: parsed.place || `Scene ${i + 1}`,
        location_text: parsed.place,
        time_of_day: parsed.time,
        description: body.join(' '),
        story_purpose: '',
        emotional_purpose: '',
      }
    })
  }
  const blocks = [story?.beginning, story?.middle, story?.ending]
    .flatMap((part) => String(part ?? '').split(/\n\s*\n/))
    .map((t) => t.trim())
    .filter(Boolean)
  return blocks.map((t) => ({
    title: headline(t),
    location_text: '',
    time_of_day: '',
    description: t,
    story_purpose: '',
    emotional_purpose: '',
  }))
}

/** "INT. DISTILLERY - DAWN" → { place, time } */
function parseSlug(text) {
  const t = String(text ?? '').replace(/^(INT\.\/EXT|INT|EXT)[\s.]+/i, '').trim()
  const m = t.split(/\s+[-–—]\s+/)
  return { place: titleCase(m[0] ?? ''), time: (m[1] ?? '').toLowerCase() }
}

const titleCase = (s) =>
  String(s ?? '').toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).trim()

/** First few words of a block, for a provisional title. */
const headline = (t) => String(t ?? '').split(/\s+/).slice(0, 6).join(' ').replace(/[.,;:]$/, '')

/**
 * One shot proposal per sentence of the scene. Camera, light and emotion are
 * left empty on purpose — inventing them would be authoring, not structuring.
 */
export function structuralShots(scene) {
  const source = [scene?.description, scene?.story_purpose].filter(Boolean).join(' ')
  return sentences(source).map((s) => ({
    title: headline(s),
    description: s,
    action: '',
    subject_primary: '',
    purpose: '',
    shot_type: '', lens: '', camera_angle: '', camera_movement: '',
    light_source: '', emotion: '',
  }))
}
