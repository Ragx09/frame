import { composePrompt, flatten } from './prompt-engine.mjs'

const pad = (n) => String(n ?? 0).padStart(2, '0')
const slug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled'

const section = (title, body) => (body?.trim() ? `## ${title}\n\n${body.trim()}\n\n` : '')

/** Produce the full production package as a flat path → contents map. */
export function buildExport(b) {
  const files = {}
  const { project, story, vision, dna, characters, locations, props, scenes, sceneDna, shots, links, script } = b

  files['README.md'] =
    `# ${project.name}\n\n${project.logline ?? ''}\n\n` +
    `Status: ${project.status}\nFormat: ${project.format}\n` +
    `Scenes: ${scenes.length}\nShots: ${shots.length}\n`

  files['story/story.md'] =
    `# Story — ${project.name}\n\n` +
    section('Premise', story?.premise) + section('Logline', story?.logline) +
    section('Beginning', story?.beginning) + section('Middle', story?.middle) +
    section('Ending', story?.ending) + section('Characters', story?.characters) +
    section('Conflict', story?.conflict) + section('Theme', story?.theme) +
    section('Emotional Journey', story?.emotional_journey) +
    section('Message', story?.message) + section('Visual Motifs', story?.visual_motifs)

  files['story/script.md'] = script.map(scriptLine).join('\n')

  files['visual/director-vision.md'] =
    `# Director's Vision\n\n` +
    section('Genre', vision?.genre) + section('Tone', vision?.tone) +
    section('Emotional Journey', vision?.emotional_journey) + section('Pacing', vision?.pacing) +
    section('Camera Philosophy', vision?.camera_philosophy) +
    section('Performance Direction', vision?.performance_direction) +
    section('Editing Philosophy', vision?.editing_philosophy)

  files['visual/visual-dna.md'] =
    `# Global Visual DNA — v${dna?.version ?? 1}\n\n` +
    section('Film / Image Character', dna?.film_character) + section('Color', dna?.color) +
    section('Contrast', dna?.contrast) + section('Texture', dna?.texture) +
    section('Lighting', dna?.lighting) + section('Atmosphere', dna?.atmosphere) +
    section('Camera', dna?.camera) + section('Depth', dna?.depth) +
    section('Image Quality', dna?.image_quality) + section('Avoid', dna?.avoid)

  for (const c of characters) {
    files[`world/characters/${slug(c.name)}.md`] =
      `# ${c.name}\n\n` + section('Age', c.age) + section('Gender', c.gender) +
      section('Appearance', c.appearance) + section('Face', c.face) + section('Hair', c.hair) +
      section('Clothing', c.clothing) + section('Body Type', c.body_type) +
      section('Distinctive Features', c.distinctive) + section('Personality', c.personality) +
      section('Performance Direction', c.performance) + section('Continuity Notes', c.continuity)
  }
  for (const l of locations) {
    files[`world/locations/${slug(l.name)}.md`] =
      `# ${l.name}\n\n` + section('Architecture', l.architecture) + section('Geography', l.geography) +
      section('Materials', l.materials) + section('Colors', l.colors) + section('Weather', l.weather) +
      section('Time Characteristics', l.time_characteristics) + section('Lighting', l.lighting) +
      section('Atmosphere', l.atmosphere)
  }
  for (const p of props) {
    files[`world/props/${slug(p.name)}.md`] =
      `# ${p.name}\n\n` + section('Description', p.description) + section('Material', p.material) +
      section('Color', p.color) + section('Age', p.age) + section('Condition', p.condition) +
      section('Dimensions', p.dimensions)
  }

  const linked = (ownerId, kind, table) =>
    links.filter((l) => l.owner_id === ownerId && l.entity_type === kind)
      .map((l) => table.find((e) => e.id === l.entity_id)).filter(Boolean)

  for (const sc of scenes) {
    const dir = `scenes/scene-${pad(sc.number)}`
    const sd = sceneDna.find((d) => d.scene_id === sc.id)
    files[`${dir}/scene.md`] =
      `# Scene ${pad(sc.number)} — ${sc.title}\n\n` +
      section('Location', sc.location_text || locations.find((l) => l.id === sc.location_id)?.name) +
      section('Time', sc.time_of_day) + section('Duration', sc.duration) +
      section('Story Purpose', sc.story_purpose) + section('Emotional Purpose', sc.emotional_purpose) +
      section('Description', sc.description) +
      section('Scene DNA', [sd?.color, sd?.lighting, sd?.atmosphere, sd?.texture, sd?.camera, sd?.contrast, sd?.notes].filter(Boolean).join('\n'))

    for (const sh of shots.filter((s) => s.scene_id === sc.id)) {
      const ctx = {
        project, vision, dna, scene: sc, sceneDna: sd, shot: sh,
        characters: linked(sh.id, 'character', characters),
        locations: linked(sh.id, 'location', locations),
        props: linked(sh.id, 'prop', props),
      }
      const built = composePrompt(ctx)
      files[`${dir}/shot-${pad(sh.number)}.md`] =
        `# Shot ${pad(sh.number)} — ${sh.title}\n\n` +
        section('Duration', sh.duration) + section('Purpose', sh.purpose) +
        section('Description', sh.description) +
        section('Camera', [sh.shot_type, sh.lens, sh.camera_angle, sh.camera_height, sh.camera_movement].filter(Boolean).join(', ')) +
        section('Composition', [sh.framing, sh.composition, sh.depth_of_field].filter(Boolean).join(', ')) +
        section('Light', [sh.light_source, sh.light_direction, sh.light_quality, sh.color_temp].filter(Boolean).join(', ')) +
        section('Motion', [sh.subject_motion, sh.camera_motion, sh.env_motion].filter(Boolean).join(', ')) +
        section('Emotion', [sh.emotion, sh.energy, sh.pacing].filter(Boolean).join(', '))
      files[`prompts/shot-${pad(sh.number)}.txt`] = flatten(built)
    }
  }

  files['prompts/_all-prompts.txt'] = Object.entries(files)
    .filter(([p]) => p.startsWith('prompts/shot-'))
    .map(([p, c]) => `===== ${p} =====\n${c}\n`).join('\n')

  return { files }
}

function scriptLine(el) {
  const t = el.text ?? ''
  switch (el.type) {
    case 'scene_heading': return `\n${t.toUpperCase()}\n`
    case 'character': return `\n${' '.repeat(20)}${t.toUpperCase()}`
    case 'parenthetical': return `${' '.repeat(16)}${t}`
    case 'dialogue': return `${' '.repeat(10)}${t}`
    case 'transition': return `\n${' '.repeat(50)}${t.toUpperCase()}\n`
    case 'note': return `[[ ${t} ]]`
    default: return `\n${t}`
  }
}
