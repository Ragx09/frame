/**
 * FRAME prompt engine.
 *
 * PROMPT = PROJECT_RULES + GLOBAL_VISUAL_DNA + SCENE_DNA + WORLD_STATE
 *        + CHARACTER_STATE + PROP_STATE + SHOT_DESCRIPTION + CAMERA
 *        + COMPOSITION + LIGHTING + MOTION + EMOTION + NEGATIVE
 *
 * The layers are kept addressable so the UI can show WHY every part of the
 * prompt exists. The body is synthesised into coherent sentences rather than
 * concatenated as a database dump.
 */

const clean = (s) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[.;,]+$/, '')
    .trim()

const list = (...parts) => parts.map(clean).filter(Boolean)

const norm = (c) => c.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()

/** Lowercase a clause's leading capital so joined lists read as one sentence. */
const uncap = (c) => (/^[A-Z][a-z]/.test(c) ? c.charAt(0).toLowerCase() + c.slice(1) : c)

/** Does `haystack` contain `needle` as whole words? Both are already normalised. */
const contains = (haystack, needle) => {
  if (needle.length < 5) return false
  const i = haystack.indexOf(needle)
  if (i < 0) return false
  const before = i === 0 || haystack[i - 1] === ' '
  const after = i + needle.length === haystack.length || haystack[i + needle.length] === ' '
  return before && after
}

/**
 * Drop clauses already carried by an earlier sentence, and prefer the most
 * specific of any pair where one contains the other ("window light" gives way
 * to "single shaft of window light"). Without this the layered model produces
 * the concatenated-database-dump the prompt must never be.
 */
const dedupe = (parts, seen, lower = false) => {
  const clauses = []
  for (const part of parts)
    for (const c of String(part).split(',').map((x) => x.trim()).filter(Boolean))
      clauses.push(c)

  // within this list, a shorter clause fully contained in a longer one loses
  const kept = clauses.filter((c, i) =>
    !clauses.some((o, j) => j !== i && norm(o).length > norm(c).length && contains(norm(o), norm(c))))

  const out = []
  for (const c of kept) {
    const key = norm(c)
    if (!key || seen.has(key)) continue
    if ([...seen].some((k) => contains(key, k))) continue
    seen.add(key)
    out.push(lower ? uncap(c) : c)
  }
  return out
}
const join = (parts) => parts.join(', ')
const sentence = (s) => {
  const t = clean(s)
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1) + '.'
}
const splitLines = (s) =>
  String(s ?? '')
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean)

/** Build the addressable layer stack. */
export function buildLayers(ctx) {
  const { project, dna, vision, scene, sceneDna, shot, characters, locations, props } = ctx
  const layers = []
  const push = (key, label, source, text) => {
    // each layer is deduped against itself, but not against the other layers —
    // seeing the same value arrive from two sources is information, not noise
    const t = Array.isArray(text)
      ? join(dedupe(list(...text), new Set()))
      : clean(text)
    if (t) layers.push({ key, label, source, text: t })
  }

  push('project', 'Project rules', project?.name ?? 'Project', list(project?.format, vision?.genre, vision?.tone))
  if (dna) {
    push('global_dna', 'Global Visual DNA', `Visual DNA v${dna.version}`, [
      dna.film_character, dna.color, dna.contrast, dna.texture,
      dna.lighting, dna.atmosphere, dna.camera, dna.depth, dna.image_quality,
    ])
  }
  if (sceneDna) {
    push('scene_dna', `Scene DNA${sceneDna.mode === 'override' ? ' (override)' : ''}`,
      scene ? `Scene ${pad(scene.number)}` : 'Scene',
      [sceneDna.color, sceneDna.contrast, sceneDna.lighting, sceneDna.texture, sceneDna.camera, sceneDna.atmosphere, sceneDna.notes])
  }
  const loc = locations?.[0]
  if (loc) {
    push('world', 'World continuity', loc.name, [loc.architecture, loc.materials, loc.colors, loc.atmosphere])
  } else if (scene?.location_text) {
    push('world', 'World continuity', 'Scene location', scene.location_text)
  }
  for (const c of characters ?? []) {
    push(`character:${c.id}`, 'Character continuity', c.name || 'Character',
      [c.age && `${c.age}`, c.appearance, c.face, c.hair, c.body_type, c.distinctive, c.clothing])
  }
  for (const p of props ?? []) {
    push(`prop:${p.id}`, 'Object continuity', p.name || 'Prop', [p.description, p.material, p.color, p.age, p.condition])
  }
  push('shot', 'Shot description', shot?.title || `Shot ${pad(shot?.number)}`,
    [shot?.description, shot?.subject_primary, shot?.action, shot?.expression])
  push('camera', 'Camera', 'Shot', [shot?.shot_type, shot?.lens, shot?.camera_angle, shot?.camera_height, shot?.camera_movement])
  push('composition', 'Composition', 'Shot', [shot?.framing, shot?.composition, shot?.depth_of_field, shot?.focal_distance])
  push('lighting', 'Light', 'Shot', [shot?.light_source, shot?.light_direction, shot?.light_quality, shot?.color_temp, shot?.light_contrast])
  push('motion', 'Motion', 'Shot', [shot?.subject_motion, shot?.camera_motion, shot?.env_motion])
  push('emotion', 'Emotion', 'Shot', [shot?.emotion, shot?.energy, shot?.pacing])
  push('negative', 'Negative constraints', dna ? `Visual DNA v${dna.version}` : 'Project', dna?.avoid)
  return layers
}

const pad = (n) => String(n ?? 0).padStart(2, '0')

/** Synthesise the layer stack into a coherent production prompt. */
export function composePrompt(ctx) {
  const layers = buildLayers(ctx)
  const { dna, sceneDna, scene, shot, characters, locations, props } = ctx
  const out = []

  // 1 — the frame itself: shot size, lens, subject, action, place, time.
  const seen = new Set()
  const take = (...parts) => dedupe(list(...parts), seen, true)

  const subject = clean(shot?.subject_primary) || clean(characters?.[0]?.name) || clean(props?.[0]?.name)
  const place = clean(locations?.[0]?.name) || clean(scene?.location_text)
  const frame = list(shot?.shot_type, shot?.lens && `${shot.lens} lens`).join(', ')
  let opener = ''
  if (frame && subject) opener = `${frame} of ${subject}`
  else if (subject) opener = subject
  else if (frame) opener = frame
  if (shot?.action) opener += `${opener ? ', ' : ''}${clean(shot.action)}`
  if (place) opener += ` in ${place}`
  const when = list(shot?.time_of_day || scene?.time_of_day, shot?.weather).join(', ')
  if (when) opener += `, ${when}`
  if (opener) out.push(sentence(opener))

  // 2 — what the description adds beyond the mechanical frame.
  if (shot?.description) out.push(sentence(shot.description))

  // 3 — who is in it, carried from the world bible.
  for (const c of characters ?? []) {
    const look = dedupe(list(c.age, c.body_type, c.hair, c.face, c.clothing, c.distinctive), new Set())
    if (look.length) out.push(sentence(`${c.name || 'The character'}: ${join(look)}`))
  }
  for (const p of props ?? []) {
    const look = dedupe(list(p.description, p.material, p.color, p.age, p.condition), new Set())
    if (look.length) out.push(sentence(`${p.name || 'The object'}: ${join(look)}`))
  }

  // 4 — how the camera behaves.
  const cam = take(shot?.camera_movement, shot?.camera_angle, shot?.camera_height, shot?.framing, shot?.composition,
    shot?.depth_of_field && `${clean(shot.depth_of_field)} depth of field`)
  if (cam.length) out.push(sentence(`Camera: ${join(cam)}`))

  // 5 — light, merging scene DNA with the shot's own sources. Bare enum values
  // ("side", "high") are named so the sentence reads as direction, not adjective.
  const light = take(
    shot?.light_source,
    sceneDna?.lighting,
    shot?.light_direction && `${clean(shot.light_direction)} light`,
    shot?.light_quality,
    shot?.color_temp && `${clean(shot.color_temp)} in temperature`,
    shot?.light_contrast && `${clean(shot.light_contrast)} contrast`,
  )
  if (light.length) out.push(sentence(`Lit by ${join(light)}`))

  // 6 — air and movement.
  const air = take(shot?.atmosphere, sceneDna?.atmosphere, shot?.background, shot?.subject_motion, shot?.env_motion)
  if (air.length) out.push(sentence(join(air)))

  // 7 — emotional register.
  const feel = take(
    shot?.emotion,
    shot?.expression,
    shot?.energy && `${clean(shot.energy)} energy`,
    shot?.pacing && `${clean(shot.pacing)} pacing`,
  )
  if (feel.length) out.push(sentence(`The moment reads ${join(feel)}`))

  // 8 — the photographic character the whole film shares.
  const scenePalette = sceneDna?.mode === 'override'
    ? [sceneDna.color, sceneDna.contrast, sceneDna.texture, sceneDna.camera]
    : [dna?.color, sceneDna?.color, dna?.contrast, sceneDna?.contrast, dna?.texture, sceneDna?.texture]
  const look = take(dna?.film_character, ...scenePalette, dna?.lighting, dna?.depth, dna?.image_quality)
  if (look.length) out.push(sentence(`Rendered as ${join(look)}`))

  const negative = splitLines(dna?.avoid).join(', ')
  return { layers, body: out.join('\n\n'), negative }
}

/** Flat text the user copies into Higgsfield. */
export function flatten({ body, negative }) {
  return negative ? `${body}\n\nAvoid: ${negative}.` : body
}

/** Obvious continuity gaps between a shot and the one before it. */
export function continuityWarnings(shot, prevShot, characters) {
  const warn = []
  if (!characters?.length && /\b(he|she|they|man|woman|boy|girl|grandfather|hand)\b/i.test(shot?.description ?? '')) {
    warn.push({ level: 'warn', text: 'Shot describes a person but no character is attached — continuity cannot be inherited.' })
  }
  for (const c of characters ?? []) {
    if (!clean(c.clothing)) warn.push({ level: 'warn', text: `${c.name || 'Character'} has no wardrobe defined; clothing will drift between shots.` })
    if (!clean(c.face) && !clean(c.appearance)) warn.push({ level: 'error', text: `${c.name || 'Character'} has no appearance defined; faces will not stay consistent.` })
  }
  if (prevShot && clean(prevShot.time_of_day) && clean(shot.time_of_day) &&
      clean(prevShot.time_of_day).toLowerCase() !== clean(shot.time_of_day).toLowerCase()) {
    warn.push({ level: 'warn', text: `Time of day changes from "${prevShot.time_of_day}" to "${shot.time_of_day}" against the previous shot.` })
  }
  if (!clean(shot.lens)) warn.push({ level: 'info', text: 'No lens specified — the frame will be interpreted freely.' })
  if (!clean(shot.light_source)) warn.push({ level: 'info', text: 'No light source specified — only inherited lighting applies.' })
  return warn
}
