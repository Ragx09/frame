import { createServer } from 'node:http'
import { db, all, one, run, insert, patch, uid, now, snapshot } from './db.mjs'
import { composePrompt, flatten, continuityWarnings } from './prompt-engine.mjs'
import * as ai from './ai.mjs'
import { buildExport } from './export.mjs'

const PORT = Number(process.env.PORT ?? 8787)

/* --------------------------- tiny router --------------------------- */
const routes = []
const on = (method, pattern, handler) => {
  const keys = []
  const rx = new RegExp(
    '^' + pattern.replace(/:([a-zA-Z_]+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$',
  )
  routes.push({ method, rx, keys, handler })
}

const json = (res, code, body) => {
  const s = JSON.stringify(body ?? null)
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  res.end(s)
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  if (req.method === 'OPTIONS') return json(res, 204, null)
  const route = routes.find((r) => r.method === req.method && r.rx.test(url.pathname))
  if (!route) return json(res, 404, { error: 'not found', path: url.pathname })
  const m = url.pathname.match(route.rx)
  const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]))
  let body = null
  if (req.method !== 'GET') {
    const chunks = []
    for await (const c of req) chunks.push(c)
    const raw = Buffer.concat(chunks).toString('utf8')
    try { body = raw ? JSON.parse(raw) : {} } catch { return json(res, 400, { error: 'bad json' }) }
  }
  try {
    const out = await route.handler({ params, body, query: url.searchParams })
    json(res, 200, out ?? { ok: true })
  } catch (err) {
    console.error('[frame]', req.method, url.pathname, err)
    json(res, 500, { error: String(err?.message ?? err) })
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`[frame] api  http://127.0.0.1:${PORT}  provider=${ai.providerName()}`)
})

/* ----------------------------- meta -------------------------------- */
on('GET', '/api/meta', () => ({ provider: ai.providerName(), keyState: ai.keyState(), model: 'claude-opus-5', version: '0.1.0' }))

on('POST', '/api/settings/key', async ({ body }) => {
  ai.setKey(String(body?.key ?? '').trim())
  const ok = await ai.verify()
  return { provider: ai.providerName(), keyState: ai.keyState(), ok: ok.ok, error: ok.error }
})

/* --------------------------- projects ------------------------------ */
on('GET', '/api/projects', () => all('SELECT * FROM projects ORDER BY updated_at DESC'))

on('POST', '/api/projects', ({ body }) => {
  const id = uid()
  const ts = now()
  insert('projects', {
    id, name: body?.name?.trim() || 'Untitled Film',
    format: body?.format ?? 'cinematic brand film',
    created_at: ts, updated_at: ts,
  })
  insert('idea', { project_id: id, raw_text: '', updated_at: ts })
  insert('story', { project_id: id, updated_at: ts })
  insert('director_vision', { project_id: id, updated_at: ts })
  insert('visual_dna', {
    id: uid(), project_id: id, version: 1, is_current: 1, label: 'Initial',
    created_at: ts, updated_at: ts,
  })
  return one('SELECT * FROM projects WHERE id = ?', id)
})

on('GET', '/api/projects/:id', ({ params }) => projectBundle(params.id))

on('PATCH', '/api/projects/:id', ({ params, body }) => {
  patch('projects', 'id', params.id, body, { updated_at: now() })
  return one('SELECT * FROM projects WHERE id = ?', params.id)
})

on('DELETE', '/api/projects/:id', ({ params }) => {
  run('DELETE FROM projects WHERE id = ?', params.id)
  return { ok: true }
})

function projectBundle(id) {
  const project = one('SELECT * FROM projects WHERE id = ?', id)
  if (!project) throw new Error('project not found')
  const scenes = all('SELECT * FROM scenes WHERE project_id = ? ORDER BY sort', id)
  return {
    project,
    idea: one('SELECT * FROM idea WHERE project_id = ?', id),
    development: all('SELECT * FROM idea_development WHERE project_id = ? ORDER BY created_at DESC', id),
    story: one('SELECT * FROM story WHERE project_id = ?', id),
    vision: one('SELECT * FROM director_vision WHERE project_id = ?', id),
    dna: one('SELECT * FROM visual_dna WHERE project_id = ? AND is_current = 1', id),
    dnaVersions: all('SELECT id, version, label, is_current, created_at FROM visual_dna WHERE project_id = ? ORDER BY version DESC', id),
    characters: all('SELECT * FROM characters WHERE project_id = ? ORDER BY sort', id),
    locations: all('SELECT * FROM locations WHERE project_id = ? ORDER BY sort', id),
    props: all('SELECT * FROM props WHERE project_id = ? ORDER BY sort', id),
    scenes,
    sceneDna: all('SELECT * FROM scene_dna WHERE scene_id IN (SELECT id FROM scenes WHERE project_id = ?)', id),
    shots: all('SELECT * FROM shots WHERE project_id = ? ORDER BY sort', id),
    links: all(
      `SELECT * FROM entity_links WHERE (owner_type = 'scene' AND owner_id IN (SELECT id FROM scenes WHERE project_id = ?))
         OR (owner_type = 'shot' AND owner_id IN (SELECT id FROM shots WHERE project_id = ?))`, id, id),
    prompts: all('SELECT * FROM prompts WHERE shot_id IN (SELECT id FROM shots WHERE project_id = ?) AND is_current = 1', id),
    generations: all('SELECT id, shot_id, version, model, created_at, notes, status, selected, reason, media_mime, media_name FROM generations WHERE shot_id IN (SELECT id FROM shots WHERE project_id = ?) ORDER BY version', id),
    script: all('SELECT * FROM script_elements WHERE project_id = ? ORDER BY sort', id),
  }
}

/* ------------------------ simple singletons ------------------------ */
for (const [route, table] of [['idea', 'idea'], ['story', 'story'], ['vision', 'director_vision']]) {
  on('PATCH', `/api/projects/:id/${route}`, ({ params, body }) => {
    const prev = one(`SELECT * FROM ${table} WHERE project_id = ?`, params.id)
    if (!prev) insert(table, { project_id: params.id, ...body, updated_at: now() })
    else patch(table, 'project_id', params.id, body, { updated_at: now() })
    run('UPDATE projects SET updated_at = ? WHERE id = ?', now(), params.id)
    return one(`SELECT * FROM ${table} WHERE project_id = ?`, params.id)
  })
  on('POST', `/api/projects/:id/${route}/snapshot`, ({ params, body }) => {
    const row = one(`SELECT * FROM ${table} WHERE project_id = ?`, params.id)
    snapshot(params.id, table, params.id, row, body?.label ?? '')
    return { ok: true }
  })
}

/* --------------------------- visual DNA ---------------------------- */
on('PATCH', '/api/dna/:id', ({ params, body }) => {
  const row = one('SELECT * FROM visual_dna WHERE id = ?', params.id)
  if (!row) throw new Error('visual dna not found')
  if (row.locked && !body?._force) throw new Error('Visual DNA is locked')
  patch('visual_dna', 'id', params.id, body, { updated_at: now() })
  return one('SELECT * FROM visual_dna WHERE id = ?', params.id)
})

/** Fork the current DNA into a new version — never mutate history. */
on('POST', '/api/projects/:id/dna/version', ({ params, body }) => {
  const cur = one('SELECT * FROM visual_dna WHERE project_id = ? AND is_current = 1', params.id)
  const next = (one('SELECT MAX(version) v FROM visual_dna WHERE project_id = ?', params.id)?.v ?? 0) + 1
  const id = uid()
  insert('visual_dna', {
    ...cur, ...(body?.fields ?? {}), id, version: next, is_current: 1, locked: 0,
    label: body?.label ?? `v${next}`, created_at: now(), updated_at: now(),
  })
  run('UPDATE visual_dna SET is_current = 0 WHERE project_id = ? AND id != ?', params.id, id)
  return one('SELECT * FROM visual_dna WHERE id = ?', id)
})

on('POST', '/api/projects/:id/dna/:dnaId/activate', ({ params }) => {
  run('UPDATE visual_dna SET is_current = 0 WHERE project_id = ?', params.id)
  run('UPDATE visual_dna SET is_current = 1 WHERE id = ?', params.dnaId)
  return one('SELECT * FROM visual_dna WHERE id = ?', params.dnaId)
})

on('GET', '/api/dna/:id/impact', ({ params }) => {
  const row = one('SELECT project_id FROM visual_dna WHERE id = ?', params.id)
  const shots = all(
    `SELECT s.id, s.number, s.title, sc.number scene_number, sc.title scene_title
       FROM shots s JOIN scenes sc ON sc.id = s.scene_id
      WHERE s.project_id = ? ORDER BY s.sort`, row.project_id)
  return { count: shots.length, shots }
})

/* --------------------------- world bible --------------------------- */
const WORLD = { character: 'characters', location: 'locations', prop: 'props' }
for (const [kind, table] of Object.entries(WORLD)) {
  on('POST', `/api/projects/:id/${table}`, ({ params, body }) => {
    const id = uid()
    const sort = (one(`SELECT MAX(sort) s FROM ${table} WHERE project_id = ?`, params.id)?.s ?? 0) + 1
    insert(table, { id, project_id: params.id, sort, updated_at: now(), ...body })
    return one(`SELECT * FROM ${table} WHERE id = ?`, id)
  })
  on('PATCH', `/api/${table}/:eid`, ({ params, body }) => {
    const row = one(`SELECT * FROM ${table} WHERE id = ?`, params.eid)
    if (row?.locked && !body?._force && !('locked' in body)) throw new Error(`${row.name || kind} is locked`)
    patch(table, 'id', params.eid, body, { updated_at: now() })
    return one(`SELECT * FROM ${table} WHERE id = ?`, params.eid)
  })
  on('DELETE', `/api/${table}/:eid`, ({ params }) => {
    run(`DELETE FROM ${table} WHERE id = ?`, params.eid)
    run('DELETE FROM entity_links WHERE entity_type = ? AND entity_id = ?', kind, params.eid)
    return { ok: true }
  })
}

/* ----------------------------- scenes ------------------------------ */
on('POST', '/api/projects/:id/scenes', ({ params, body }) => {
  const id = uid()
  const n = (one('SELECT MAX(number) n FROM scenes WHERE project_id = ?', params.id)?.n ?? 0) + 1
  insert('scenes', { id, project_id: params.id, number: n, sort: n, title: body?.title ?? '', updated_at: now(), ...body })
  insert('scene_dna', { scene_id: id, updated_at: now() })
  return one('SELECT * FROM scenes WHERE id = ?', id)
})

on('PATCH', '/api/scenes/:sid', ({ params, body }) => {
  patch('scenes', 'id', params.sid, body, { updated_at: now() })
  return one('SELECT * FROM scenes WHERE id = ?', params.sid)
})

on('DELETE', '/api/scenes/:sid', ({ params }) => {
  run('DELETE FROM scenes WHERE id = ?', params.sid)
  return { ok: true }
})

on('PATCH', '/api/scenes/:sid/dna', ({ params, body }) => {
  const row = one('SELECT * FROM scene_dna WHERE scene_id = ?', params.sid)
  if (!row) insert('scene_dna', { scene_id: params.sid, ...body, updated_at: now() })
  else patch('scene_dna', 'scene_id', params.sid, body, { updated_at: now() })
  return one('SELECT * FROM scene_dna WHERE scene_id = ?', params.sid)
})

/* ------------------------------ shots ------------------------------ */
on('POST', '/api/scenes/:sid/shots', ({ params, body }) => {
  const scene = one('SELECT * FROM scenes WHERE id = ?', params.sid)
  const id = uid()
  const n = (one('SELECT MAX(number) n FROM shots WHERE project_id = ?', scene.project_id)?.n ?? 0) + 1
  const sort = (one('SELECT MAX(sort) s FROM shots WHERE scene_id = ?', params.sid)?.s ?? 0) + 1
  insert('shots', {
    id, project_id: scene.project_id, scene_id: params.sid, number: n, sort,
    time_of_day: scene.time_of_day ?? '', updated_at: now(), ...body,
  })
  // inherit whatever the scene already establishes
  for (const l of all('SELECT * FROM entity_links WHERE owner_type = ? AND owner_id = ?', 'scene', params.sid)) {
    insert('entity_links', { id: uid(), owner_type: 'shot', owner_id: id, entity_type: l.entity_type, entity_id: l.entity_id })
  }
  return one('SELECT * FROM shots WHERE id = ?', id)
})

on('PATCH', '/api/shots/:shid', ({ params, body }) => {
  patch('shots', 'id', params.shid, body, { updated_at: now() })
  return one('SELECT * FROM shots WHERE id = ?', params.shid)
})

on('DELETE', '/api/shots/:shid', ({ params }) => {
  run('DELETE FROM shots WHERE id = ?', params.shid)
  run('DELETE FROM entity_links WHERE owner_type = ? AND owner_id = ?', 'shot', params.shid)
  return { ok: true }
})

on('POST', '/api/shots/:shid/duplicate', ({ params }) => {
  const src = one('SELECT * FROM shots WHERE id = ?', params.shid)
  const id = uid()
  const n = (one('SELECT MAX(number) n FROM shots WHERE project_id = ?', src.project_id)?.n ?? 0) + 1
  insert('shots', { ...src, id, number: n, sort: src.sort + 0.5, title: `${src.title} (alt)`, status: 'draft', updated_at: now() })
  for (const l of all('SELECT * FROM entity_links WHERE owner_type = ? AND owner_id = ?', 'shot', params.shid)) {
    insert('entity_links', { id: uid(), owner_type: 'shot', owner_id: id, entity_type: l.entity_type, entity_id: l.entity_id })
  }
  resequence(src.scene_id)
  return one('SELECT * FROM shots WHERE id = ?', id)
})

on('POST', '/api/scenes/:sid/reorder', ({ params, body }) => {
  ;(body?.ids ?? []).forEach((id, i) => run('UPDATE shots SET sort = ?, scene_id = ? WHERE id = ?', i + 1, params.sid, id))
  resequence(params.sid)
  return { ok: true }
})

/** Renumber every shot in the film to its current board order. Explicit only. */
on('POST', '/api/projects/:id/renumber', ({ params }) => {
  const scenes = all('SELECT id FROM scenes WHERE project_id = ? ORDER BY sort', params.id)
  let n = 0
  for (const sc of scenes)
    for (const sh of all('SELECT id FROM shots WHERE scene_id = ? ORDER BY sort', sc.id))
      run('UPDATE shots SET number = ? WHERE id = ?', ++n, sh.id)
  scenes.forEach((sc, i) => run('UPDATE scenes SET number = ? WHERE id = ?', i + 1, sc.id))
  return { renumbered: n }
})

function resequence(sceneId) {
  all('SELECT id FROM shots WHERE scene_id = ? ORDER BY sort', sceneId)
    .forEach((r, i) => run('UPDATE shots SET sort = ? WHERE id = ?', i + 1, r.id))
}

/* ---------------------------- entity links ------------------------- */
on('POST', '/api/links', ({ body }) => {
  const exists = one(
    'SELECT id FROM entity_links WHERE owner_type = ? AND owner_id = ? AND entity_type = ? AND entity_id = ?',
    body.owner_type, body.owner_id, body.entity_type, body.entity_id)
  if (exists) return exists
  const id = uid()
  insert('entity_links', { id, ...body })
  return { id }
})

on('DELETE', '/api/links/:lid', ({ params }) => {
  run('DELETE FROM entity_links WHERE id = ?', params.lid)
  return { ok: true }
})

/* --------------------------- prompt engine ------------------------- */
function shotContext(shotId) {
  const shot = one('SELECT * FROM shots WHERE id = ?', shotId)
  if (!shot) throw new Error('shot not found')
  const scene = one('SELECT * FROM scenes WHERE id = ?', shot.scene_id)
  const links = all('SELECT * FROM entity_links WHERE owner_type = ? AND owner_id = ?', 'shot', shotId)
  const pick = (kind, table) =>
    links.filter((l) => l.entity_type === kind)
      .map((l) => one(`SELECT * FROM ${table} WHERE id = ?`, l.entity_id))
      .filter(Boolean)
  const locations = pick('location', 'locations')
  if (!locations.length && scene?.location_id) {
    const l = one('SELECT * FROM locations WHERE id = ?', scene.location_id)
    if (l) locations.push(l)
  }
  return {
    project: one('SELECT * FROM projects WHERE id = ?', shot.project_id),
    vision: one('SELECT * FROM director_vision WHERE project_id = ?', shot.project_id),
    dna: one('SELECT * FROM visual_dna WHERE project_id = ? AND is_current = 1', shot.project_id),
    scene,
    sceneDna: one('SELECT * FROM scene_dna WHERE scene_id = ?', shot.scene_id),
    shot,
    characters: pick('character', 'characters'),
    locations,
    props: pick('prop', 'props'),
  }
}

on('GET', '/api/shots/:shid/prompt', ({ params }) => {
  const ctx = shotContext(params.shid)
  const built = composePrompt(ctx)
  const stored = one('SELECT * FROM prompts WHERE shot_id = ? AND is_current = 1', params.shid)
  const prev = one('SELECT * FROM shots WHERE scene_id = ? AND sort < ? ORDER BY sort DESC LIMIT 1', ctx.shot.scene_id, ctx.shot.sort)
  return {
    ...built,
    flat: flatten(built),
    stored,
    versions: all('SELECT id, version, hand_edited, created_at FROM prompts WHERE shot_id = ? ORDER BY version DESC', params.shid),
    warnings: continuityWarnings(ctx.shot, prev, ctx.characters),
    context: {
      dnaVersion: ctx.dna?.version ?? null,
      sceneNumber: ctx.scene?.number ?? null,
      characters: ctx.characters.map((c) => ({ id: c.id, name: c.name, locked: c.locked })),
      locations: ctx.locations.map((l) => ({ id: l.id, name: l.name, locked: l.locked })),
      props: ctx.props.map((p) => ({ id: p.id, name: p.name, locked: p.locked })),
    },
  }
})

on('POST', '/api/shots/:shid/prompt', ({ params, body }) => {
  const ctx = shotContext(params.shid)
  const built = composePrompt(ctx)
  const version = (one('SELECT MAX(version) v FROM prompts WHERE shot_id = ?', params.shid)?.v ?? 0) + 1
  const id = uid()
  run('UPDATE prompts SET is_current = 0 WHERE shot_id = ?', params.shid)
  insert('prompts', {
    id, shot_id: params.shid, version, is_current: 1,
    body: body?.body ?? built.body,
    negative: body?.negative ?? built.negative,
    layers_json: JSON.stringify(built.layers),
    hand_edited: body?.body ? 1 : 0,
    created_at: now(),
  })
  if (one('SELECT status FROM shots WHERE id = ?', params.shid)?.status === 'draft')
    run('UPDATE shots SET status = ? WHERE id = ?', 'ready', params.shid)
  return one('SELECT * FROM prompts WHERE id = ?', id)
})

on('POST', '/api/prompts/:pid/restore', ({ params }) => {
  const p = one('SELECT * FROM prompts WHERE id = ?', params.pid)
  run('UPDATE prompts SET is_current = 0 WHERE shot_id = ?', p.shot_id)
  run('UPDATE prompts SET is_current = 1 WHERE id = ?', params.pid)
  return p
})

/* --------------------------- generations --------------------------- */
on('POST', '/api/shots/:shid/generations', ({ params, body }) => {
  const version = (one('SELECT MAX(version) v FROM generations WHERE shot_id = ?', params.shid)?.v ?? 0) + 1
  const id = uid()
  const prompt = one('SELECT * FROM prompts WHERE shot_id = ? AND is_current = 1', params.shid)
  insert('generations', {
    id, shot_id: params.shid, version, created_at: now(),
    prompt_snapshot: prompt ? `${prompt.body}${prompt.negative ? `\n\nAvoid: ${prompt.negative}.` : ''}` : '',
    ...body,
  })
  return one('SELECT id, shot_id, version, model, created_at, notes, status, selected, reason, media_mime, media_name FROM generations WHERE id = ?', id)
})

on('PATCH', '/api/generations/:gid', ({ params, body }) => {
  const g = one('SELECT shot_id FROM generations WHERE id = ?', params.gid)
  if (body?.selected) {
    run('UPDATE generations SET selected = 0 WHERE shot_id = ?', g.shot_id)
    run('UPDATE shots SET status = ? WHERE id = ?', 'selected', g.shot_id)
  }
  patch('generations', 'id', params.gid, body)
  return one('SELECT id, shot_id, version, model, created_at, notes, status, selected, reason, media_mime, media_name FROM generations WHERE id = ?', params.gid)
})

on('DELETE', '/api/generations/:gid', ({ params }) => {
  run('DELETE FROM generations WHERE id = ?', params.gid)
  return { ok: true }
})

on('GET', '/api/generations/:gid/media', ({ params }) =>
  one('SELECT media, media_mime, media_name FROM generations WHERE id = ?', params.gid))

/* ---------------------------- references --------------------------- */
on('GET', '/api/refs/:ownerType/:ownerId', ({ params }) =>
  all('SELECT * FROM refs WHERE owner_type = ? AND owner_id = ? ORDER BY created_at', params.ownerType, params.ownerId))

on('POST', '/api/refs', ({ body }) => {
  const id = uid()
  insert('refs', { id, created_at: now(), ...body })
  return one('SELECT * FROM refs WHERE id = ?', id)
})

on('DELETE', '/api/refs/:rid', ({ params }) => {
  run('DELETE FROM refs WHERE id = ?', params.rid)
  return { ok: true }
})

/* ------------------------------ script ----------------------------- */
on('PUT', '/api/projects/:id/script', ({ params, body }) => {
  run('DELETE FROM script_elements WHERE project_id = ?', params.id)
  ;(body?.elements ?? []).forEach((el, i) =>
    insert('script_elements', { id: el.id ?? uid(), project_id: params.id, sort: i + 1, type: el.type, text: el.text ?? '' }))
  run('UPDATE projects SET updated_at = ? WHERE id = ?', now(), params.id)
  return all('SELECT * FROM script_elements WHERE project_id = ? ORDER BY sort', params.id)
})

/* ---------------------------- versioning ---------------------------
   Creative work is never destroyed. Anything editable can be snapshotted,
   compared field by field, and restored — restoring snapshots first, so the
   restore itself is undoable. */

const VERSIONED = {
  story: { table: 'story', key: 'project_id' },
  director_vision: { table: 'director_vision', key: 'project_id' },
  idea: { table: 'idea', key: 'project_id' },
  visual_dna: { table: 'visual_dna', key: 'id' },
  scene: { table: 'scenes', key: 'id' },
  shot: { table: 'shots', key: 'id' },
  script: { table: null, key: null },
}

const HIDDEN = new Set(['id', 'project_id', 'scene_id', 'updated_at', 'created_at', 'sort', 'is_current'])

function readEntity(type, id) {
  if (type === 'script')
    return { elements: all('SELECT id, type, text FROM script_elements WHERE project_id = ? ORDER BY sort', id) }
  const spec = VERSIONED[type]
  if (!spec?.table) throw new Error(`cannot version "${type}"`)
  return one(`SELECT * FROM ${spec.table} WHERE ${spec.key} = ?`, id)
}

function projectOf(type, id) {
  if (type === 'script' || VERSIONED[type]?.key === 'project_id') return id
  const row = readEntity(type, id)
  return row?.project_id ?? id
}

/* Routes are matched in registration order, and `/versions/:a/:b` would shadow
   `/versions/:vid/compare` — so the literal-suffix routes are declared first. */

/** Field-by-field diff between a stored snapshot and what is on screen now. */
on('GET', '/api/versions/:vid/compare', ({ params }) => {
  const v = one('SELECT * FROM versions WHERE id = ?', params.vid)
  if (!v) throw new Error('version not found')
  const past = JSON.parse(v.snapshot ?? '{}') ?? {}
  const current = readEntity(v.entity_type, v.entity_id) ?? {}

  if (v.entity_type === 'script') {
    const a = past.elements ?? []
    const b = current.elements ?? []
    const rows = []
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const was = a[i] ? `${a[i].type}: ${a[i].text}` : ''
      const now_ = b[i] ? `${b[i].type}: ${b[i].text}` : ''
      if (was !== now_) rows.push({ field: `line ${i + 1}`, was, now: now_ })
    }
    return { version: v, fields: rows }
  }

  const keys = [...new Set([...Object.keys(past), ...Object.keys(current)])].filter((k) => !HIDDEN.has(k))
  const fields = keys
    .map((k) => ({ field: k, was: String(past[k] ?? ''), now: String(current[k] ?? '') }))
    .filter((f) => f.was !== f.now)
  return { version: v, fields }
})

on('POST', '/api/versions/:vid/restore', ({ params }) => {
  const v = one('SELECT * FROM versions WHERE id = ?', params.vid)
  if (!v) throw new Error('version not found')
  const past = JSON.parse(v.snapshot ?? '{}') ?? {}

  // the state being replaced becomes a version of its own — restore is undoable
  snapshot(v.project_id, v.entity_type, v.entity_id, readEntity(v.entity_type, v.entity_id), 'before restore')

  if (v.entity_type === 'script') {
    run('DELETE FROM script_elements WHERE project_id = ?', v.entity_id)
    ;(past.elements ?? []).forEach((el, i) =>
      insert('script_elements', { id: uid(), project_id: v.entity_id, sort: i + 1, type: el.type, text: el.text ?? '' }))
    return { ok: true }
  }

  const spec = VERSIONED[v.entity_type]
  const body = { ...past }
  for (const k of ['id', 'project_id', 'scene_id']) delete body[k]
  patch(spec.table, spec.key, v.entity_id, body, { updated_at: now() })
  return { ok: true }
})

on('DELETE', '/api/versions/:vid', ({ params }) => {
  run('DELETE FROM versions WHERE id = ?', params.vid)
  return { ok: true }
})

on('GET', '/api/versions/:type/:eid', ({ params }) =>
  all('SELECT id, label, created_at FROM versions WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
    params.type, params.eid))

on('POST', '/api/versions/:type/:eid', ({ params, body }) => {
  const row = readEntity(params.type, params.eid)
  snapshot(projectOf(params.type, params.eid), params.type, params.eid, row, body?.label ?? '')
  return { ok: true }
})

/* ------------------------------- AI -------------------------------- */
on('POST', '/api/projects/:id/ai/develop-idea', async ({ params }) => {
  const idea = one('SELECT * FROM idea WHERE project_id = ?', params.id)
  const raw = idea?.raw_text ?? ''
  if (!raw.trim()) throw new Error('There is no idea text to develop yet.')
  let dev = await ai.structured(
    'Read the director\'s raw idea dump and develop it. Do not replace their idea — clarify it.',
    raw,
    '{ "central_idea": "", "premise": "", "theme": "", "emotional_direction": "", "conflict": "", "ending": "", "questions": "", "visual_motifs": "" }',
  )
  const source = dev ? 'anthropic' : 'structural'
  if (!dev) dev = ai.structuralIdea(raw)
  const id = uid()
  insert('idea_development', { id, project_id: params.id, source, created_at: now(), ...dev })
  return { ...one('SELECT * FROM idea_development WHERE id = ?', id), source }
})

on('POST', '/api/ai/rewrite', async ({ body }) => {
  const out = await ai.rewrite(body?.text ?? '', body?.instruction ?? 'Rewrite.', body?.context ?? '')
  if (out == null) return { text: null, source: 'structural', message: 'No model key configured — connect one in Settings to use rewrite.' }
  return { text: out, source: 'anthropic' }
})

on('POST', '/api/projects/:id/ai/script-from-story', ({ params }) => {
  const story = one('SELECT * FROM story WHERE project_id = ?', params.id)
  const text = [story?.beginning, story?.middle, story?.ending].filter(Boolean).join('\n\n')
  const els = ai.structuralScript(text)
  return { elements: els, source: 'structural' }
})

/* --------------------- contextual assistant ------------------------
   The assistant always answers about a specific shot, with the whole film
   in view: story, vision, DNA, scene DNA, world entities and neighbours. */

function narrative(ctx, prev, next) {
  const { project, vision, dna, scene, sceneDna, shot, characters, locations, props } = ctx
  const f = (label, v) => (String(v ?? '').trim() ? `${label}: ${String(v).replace(/\s+/g, ' ').trim()}` : null)
  const story = one('SELECT * FROM story WHERE project_id = ?', project.id)
  return [
    `FILM: ${project.name} (${project.format})`,
    f('LOGLINE', story?.logline),
    f('THEME', story?.theme),
    f('TONE', vision?.tone),
    f('PACING', vision?.pacing),
    f('CAMERA PHILOSOPHY', vision?.camera_philosophy),
    f('EDITING PHILOSOPHY', vision?.editing_philosophy),
    '',
    `GLOBAL VISUAL DNA v${dna?.version ?? 1}`,
    f('  film character', dna?.film_character), f('  color', dna?.color),
    f('  contrast', dna?.contrast), f('  texture', dna?.texture),
    f('  lighting', dna?.lighting), f('  camera', dna?.camera),
    f('  avoid', dna?.avoid),
    '',
    `SCENE ${String(scene?.number ?? 0).padStart(2, '0')} — ${scene?.title ?? ''}`,
    f('  purpose', scene?.story_purpose), f('  emotion', scene?.emotional_purpose),
    f('  scene dna', [sceneDna?.color, sceneDna?.lighting, sceneDna?.atmosphere].filter(Boolean).join('; ')),
    '',
    'WORLD IN THIS SHOT',
    ...characters.map((c) => `  ${c.name}${c.locked ? ' [LOCKED]' : ''}: ${[c.age, c.appearance, c.hair, c.clothing, c.distinctive].filter(Boolean).join(', ')}`),
    ...locations.map((l) => `  ${l.name}${l.locked ? ' [LOCKED]' : ''}: ${[l.architecture, l.materials, l.lighting].filter(Boolean).join(', ')}`),
    ...props.map((p) => `  ${p.name}${p.locked ? ' [LOCKED]' : ''}: ${[p.description, p.material, p.condition].filter(Boolean).join(', ')}`),
    '',
    prev ? `PREVIOUS SHOT ${String(prev.number).padStart(2, '0')}: ${prev.title} — ${prev.description} (${[prev.shot_type, prev.lens, prev.camera_movement].filter(Boolean).join(', ')})` : 'PREVIOUS SHOT: none — this opens the scene',
    next ? `NEXT SHOT ${String(next.number).padStart(2, '0')}: ${next.title} — ${next.description}` : 'NEXT SHOT: none — this closes the scene',
    '',
    `CURRENT SHOT ${String(shot.number).padStart(2, '0')} — ${shot.title}`,
    f('  description', shot.description),
    f('  camera', [shot.shot_type, shot.lens, shot.camera_angle, shot.camera_movement].filter(Boolean).join(', ')),
    f('  light', [shot.light_source, shot.light_direction, shot.light_quality, shot.color_temp].filter(Boolean).join(', ')),
    f('  emotion', [shot.emotion, shot.energy, shot.pacing].filter(Boolean).join(', ')),
  ].filter((l) => l !== null).join('\n')
}

/** Does a proposed change collide with something the director has locked? */
function lockConflicts(text, ctx) {
  const t = String(text ?? '').toLowerCase()
  const out = []
  const attrs = {
    character: [['appearance', /appearance|look|face|features/], ['hair', /hair|hairstyle|haircut/],
      ['clothing', /cloth|shirt|wardrobe|costume|dress|outfit/], ['age', /\bage\b|younger|older/]],
    location: [['architecture', /architect|building|wall|roof/], ['materials', /material|stone|wood|metal/],
      ['lighting', /light|lamp|window|lit\b/]],
    prop: [['description', /shape|form|design/], ['material', /material|copper|brass|metal|wood/],
      ['condition', /condition|polish|new|shiny|worn/]],
  }
  for (const [kind, table] of [['character', 'characters'], ['location', 'locations'], ['prop', 'props']]) {
    for (const e of ctx[table === 'characters' ? 'characters' : table === 'locations' ? 'locations' : 'props']) {
      if (!e.locked) continue
      const named = e.name && t.includes(String(e.name).toLowerCase())
      for (const [field, rx] of attrs[kind]) {
        if (named && rx.test(t)) out.push({ entity: e.name, entityId: e.id, kind, field })
      }
    }
  }
  return out
}

on('POST', '/api/shots/:shid/ai/ask', async ({ params, body }) => {
  const ctx = shotContext(params.shid)
  const prev = one('SELECT * FROM shots WHERE scene_id = ? AND sort < ? ORDER BY sort DESC LIMIT 1', ctx.shot.scene_id, ctx.shot.sort)
  const next = one('SELECT * FROM shots WHERE scene_id = ? AND sort > ? ORDER BY sort ASC LIMIT 1', ctx.shot.scene_id, ctx.shot.sort)
  const question = String(body?.question ?? '').trim()
  if (!question) throw new Error('Ask something first.')

  const context = narrative(ctx, prev, next)
  const answer = await ai.rewrite(
    question,
    `Answer the director's question about this shot. You have the whole film in view.
Be concrete and brief — this is a working note, not an essay. Suggest; never assume the change is made.
Anything marked [LOCKED] is a fixed creative constraint: say so rather than proposing a change to it.`,
    context,
  )

  if (answer == null) {
    return {
      answer: null, source: 'structural', context,
      message: 'No model key configured. The full context the assistant would see is shown below — connect a key in Settings to ask questions of it.',
      conflicts: [],
    }
  }
  return { answer, source: 'anthropic', conflicts: lockConflicts(answer, ctx), context: null }
})

on('POST', '/api/shots/:shid/ai/alternatives', async ({ params }) => {
  const ctx = shotContext(params.shid)
  const prev = one('SELECT * FROM shots WHERE scene_id = ? AND sort < ? ORDER BY sort DESC LIMIT 1', ctx.shot.scene_id, ctx.shot.sort)
  const out = await ai.structured(
    `Propose three alternative camera approaches to this shot. Keep the Visual DNA and the
director's camera philosophy intact — vary only the framing, lens, movement and angle.
For each, say in one line what it changes emotionally.`,
    narrative(ctx, prev, null),
    '{ "options": [ { "shot_type": "", "lens": "", "camera_angle": "", "camera_movement": "", "framing": "", "why": "" } ] }',
  )
  if (!out?.options) {
    return { options: null, source: 'structural', message: 'No model key configured — connect one in Settings for alternatives.' }
  }
  return { options: out.options, source: 'anthropic' }
})

/** Split one shot into two, carrying continuity across. Brief §22. */
on('POST', '/api/shots/:shid/split', ({ params }) => {
  const src = one('SELECT * FROM shots WHERE id = ?', params.shid)
  if (!src) throw new Error('shot not found')
  const id = uid()
  const n = (one('SELECT MAX(number) n FROM shots WHERE project_id = ?', src.project_id)?.n ?? 0) + 1
  insert('shots', {
    ...src, id, number: n, sort: src.sort + 0.5, status: 'draft',
    title: `${src.title || 'Shot'} (b)`, description: '', action: '',
    updated_at: now(),
  })
  run('UPDATE shots SET title = ? WHERE id = ?', `${src.title || 'Shot'} (a)`, src.id)
  for (const l of all('SELECT * FROM entity_links WHERE owner_type = ? AND owner_id = ?', 'shot', params.shid))
    insert('entity_links', { id: uid(), owner_type: 'shot', owner_id: id, entity_type: l.entity_type, entity_id: l.entity_id })
  resequence(src.scene_id)
  return one('SELECT * FROM shots WHERE id = ?', id)
})

/* ----------------------------- search ------------------------------ */
on('GET', '/api/projects/:id/search', ({ params, query }) => {
  const q = String(query.get('q') ?? '').trim().toLowerCase()
  if (q.length < 2) return { results: [] }
  const hit = (text) => String(text ?? '').toLowerCase().includes(q)
  const results = []
  const add = (kind, id, label, where, sceneId) => results.push({ kind, id, label, where, sceneId })

  for (const c of all('SELECT * FROM characters WHERE project_id = ?', params.id))
    if ([c.name, c.appearance, c.personality, c.clothing, c.distinctive].some(hit)) add('character', c.id, c.name, 'Characters')
  for (const l of all('SELECT * FROM locations WHERE project_id = ?', params.id))
    if ([l.name, l.architecture, l.atmosphere, l.materials].some(hit)) add('location', l.id, l.name, 'Locations')
  for (const p of all('SELECT * FROM props WHERE project_id = ?', params.id))
    if ([p.name, p.description, p.material].some(hit)) add('prop', p.id, p.name, 'Props')
  for (const s of all('SELECT * FROM scenes WHERE project_id = ? ORDER BY sort', params.id))
    if ([s.title, s.description, s.story_purpose, s.emotional_purpose].some(hit))
      add('scene', s.id, `Scene ${String(s.number).padStart(2, '0')} — ${s.title}`, 'Scenes', s.id)
  for (const s of all('SELECT * FROM shots WHERE project_id = ? ORDER BY sort', params.id))
    if ([s.title, s.description, s.action, s.purpose, s.subject_primary].some(hit))
      add('shot', s.id, `Shot ${String(s.number).padStart(2, '0')} — ${s.title}`, 'Shot Board', s.scene_id)
  for (const p of all('SELECT p.*, s.number, s.scene_id FROM prompts p JOIN shots s ON s.id = p.shot_id WHERE s.project_id = ? AND p.is_current = 1', params.id))
    if (hit(p.body)) add('prompt', p.shot_id, `Prompt for shot ${String(p.number).padStart(2, '0')}`, 'Prompt Lab', p.scene_id)

  return { results: results.slice(0, 40) }
})

/* ----------------------------- export ------------------------------ */
on('GET', '/api/projects/:id/export', ({ params }) => buildExport(projectBundle(params.id)))
