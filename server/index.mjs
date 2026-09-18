import { createServer } from 'node:http'
import { all, one, run, insert, patch, uid, now, snapshot, tx, ping } from './db.mjs'
import { composePrompt, flatten, continuityWarnings } from './prompt-engine.mjs'
import * as ai from './ai.mjs'
import { buildExport } from './export.mjs'
import * as cfg from './config.mjs'
import { assistantFor } from './assistant.mjs'
import { sessionFor, requireUser, ensureLocalUser, adoptOwnerlessProjects, LOCAL_USER } from './auth.mjs'
import { resolveProject, loadProject, assertAccess } from './access.mjs'
import * as usage from './usage.mjs'
import * as ratelimit from './ratelimit.mjs'
import { AppError, GENERIC, badRequest, forbidden, notFound } from './errors.mjs'
import { newRequestId, logRequest, logError } from './log.mjs'
import { ensureDemoProject } from './demo.mjs'

/* --------------------------- tiny router --------------------------- */
const routes = []

/**
 * `opts.public` opts a route out of requiring a signed-in user. Everything
 * else requires one in cloud mode, so a route added without thinking about
 * auth is closed rather than open (brief §28).
 */
const on = (method, pattern, handler, opts = {}) => {
  const keys = []
  const rx = new RegExp(
    '^' + pattern.replace(/:([a-zA-Z_]+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$',
  )
  routes.push({ method, rx, keys, handler, opts })
}

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

/* ------------------------------- CORS ------------------------------ */
/**
 * Brief §29. A private, credential-bearing API must not answer `*`. In
 * production the only allowed origin is the deployed frontend; in development
 * the Vite dev server is allowed too, because that is the whole local workflow.
 */
const ALLOWED_ORIGINS = new Set([
  ...(cfg.APP_URL ? [cfg.APP_URL] : []),
  ...(cfg.isDev ? ['http://localhost:5180', 'http://127.0.0.1:5180'] : []),
])

function corsHeaders(origin) {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type, authorization, x-frame-byok-provider, x-frame-byok-key',
    'access-control-max-age': '600',
    vary: 'origin',
  }
}

const json = (res, code, body, extra = {}) => {
  const s = JSON.stringify(body ?? null)
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra })
  res.end(s)
}

/** 1 MB of JSON is far more than any FRAME request needs; refuse the rest. */
const MAX_BODY_BYTES = 1024 * 1024 * 8 // references are base64 images

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > MAX_BODY_BYTES) throw badRequest('That upload is too large.', 'body_too_large')
    chunks.push(c)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    throw badRequest('Malformed request.', 'bad_json')
  }
}

const server = createServer(async (req, res) => {
  const started = Date.now()
  const requestId = newRequestId()
  const url = new URL(req.url, 'http://x')
  const cors = corsHeaders(req.headers.origin)

  if (req.method === 'OPTIONS') return json(res, 204, null, cors)

  /* ----------------------- health (brief §33) ---------------------- */
  if (url.pathname === '/health') return json(res, 200, { ok: true, service: 'frame' }, cors)
  if (url.pathname === '/health/ai') {
    // Configuration only — this must never call the provider (brief §33).
    return json(res, 200, {
      ok: true,
      service: 'frame',
      hosted: cfg.hostedAvailable(),
      mode: cfg.cloudMode ? 'cloud' : 'local',
    }, cors)
  }

  const route = routes.find((r) => r.method === req.method && r.rx.test(url.pathname))
  if (!route) return json(res, 404, { error: 'Not found.' }, cors)

  const m = url.pathname.match(route.rx)
  const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]))

  let status = 200
  try {
    const body = req.method === 'GET' ? null : await readBody(req)
    const session = await sessionFor(req)

    /* Ownership is resolved centrally, before the handler, so no route can
       forget it and a route added tomorrow is covered too (brief §28). */
    const projectId = await resolveProject(url.pathname, params)
    const project = await loadProject(projectId)
    const write = WRITE_METHODS.has(req.method)

    /* The demo film is readable by anyone, including before sign-in, and
       writable by nobody (brief §18). That is the only anonymous path into
       project data; everything else needs a user. */
    const demoRead = Boolean(project?.is_demo) && !write

    if (!route.opts.public && !demoRead) requireUser(session)
    await assertAccess({ session, projectId, project, write })

    const out = await route.handler({
      params, body, query: url.searchParams, session, requestId, projectId,
    })
    json(res, 200, out ?? { ok: true }, cors)
  } catch (err) {
    status = err instanceof AppError ? err.status : 500
    logError({ id: requestId, method: req.method, path: url.pathname, err })
    /* Brief §22: only a message we wrote ourselves is ever sent. */
    const payload = err instanceof AppError
      ? { error: err.message, code: err.code || undefined, requestId }
      : { error: GENERIC, requestId }
    json(res, status, payload, cors)
  } finally {
    logRequest({
      id: requestId, method: req.method, path: url.pathname,
      status, ms: Date.now() - started,
    })
  }
})

await ensureLocalUser()
await adoptOwnerlessProjects()

/* The demo film is seeded once, at boot. A failure here is logged and
   tolerated: a missing sample is not a reason for the API not to start. */
let demoProjectId = null
try {
  demoProjectId = await ensureDemoProject()
} catch (err) {
  console.error('[frame] demo seed failed:', err?.message ?? err)
}

server.listen(cfg.PORT, cfg.HOST, () => {
  console.log(
    `[frame] api  http://${cfg.HOST}:${cfg.PORT}  ` +
    `env=${cfg.env} mode=${cfg.cloudMode ? 'cloud' : 'local'} ` +
    `hostedAI=${cfg.hostedAvailable() ? cfg.OPENROUTER_MODEL : 'off'}`,
  )
})

/* ----------------------------- meta --------------------------------
   Public, because the landing page and the demo are reached before anyone
   signs in. It carries booleans, public URLs and the caller's own usage —
   never a key, a model credential or an environment value (brief §9, §22). */
on('GET', '/api/meta', async ({ session }) => {
  const asst = assistantFor(session)
  return {
    ...cfg.publicMeta(),
    capability: ai.capability(),
    user: session.user ? { id: session.user.id, email: session.user.email } : null,
    local: Boolean(session.local),
    // the provider that would answer this caller right now. Named `aiMode`
    // rather than `mode` so it cannot shadow the deployment mode above.
    provider: asst.source,
    aiMode: asst.mode,
    model: asst.model,
    metered: asst.metered,
    usage: session.user ? await usage.usageSummary(session.user.id) : null,
  }
}, { public: true })

/** Verify a user's own key. It is checked and discarded — never stored. */
on('POST', '/api/settings/byok/verify', async ({ body }) => {
  const provider = String(body?.provider ?? '').trim().toLowerCase()
  const key = ai.assertKeyShape(provider, body?.key)
  const result = await ai.verifyKey(provider, key)
  // The masked form is derived here so the browser never has to build it.
  return { ok: result.ok, error: result.error, masked: result.ok ? ai.maskKey(key) : null, provider }
})

/**
 * The legacy local developer key (`data/settings.json`). Local development
 * only — in cloud mode the hosted key is the developer's and a user's own key
 * travels per request instead (brief §9), so there is nothing to store here.
 */
on('POST', '/api/settings/key', async ({ body }) => {
  if (cfg.cloudMode) throw forbidden('Use "bring your own key" in Settings.', 'byok_only')
  ai.setLocalKey(String(body?.key ?? '').trim())
  const ok = await ai.verifyLocalKey()
  return { keyState: ai.localKeyState(), ok: ok.ok, error: ok.error }
})

/* ------------------------------ beta -------------------------------- */
on('GET', '/api/beta/usage', async ({ session }) => usage.usageSummary(session.user.id))

/** Where the landing page's "try the demo" button goes. Public by design. */
on('GET', '/api/demo', async () => {
  const demo = await one('SELECT id, name FROM projects WHERE is_demo = 1')
  return { id: demo?.id ?? demoProjectId, name: demo?.name ?? null }
}, { public: true })

/** Feedback (brief §21). Used only when no PUBLIC_FEEDBACK_URL is configured. */
on('POST', '/api/feedback', async ({ session, body }) => {
  const text = String(body?.body ?? '').trim()
  if (!text) throw badRequest('Write something first.', 'empty_feedback')
  if (text.length > 4000) throw badRequest('That is longer than the feedback box accepts.', 'feedback_too_long')
  const category = ['bug', 'feature', 'general'].includes(body?.category) ? body.category : 'general'
  await insert('feedback', {
    id: uid(), user_id: session.user?.id ?? null, category, body: text,
    app_version: cfg.VERSION, created_at: now(),
  })
  return { ok: true }
}, { public: true })

/* --------------------------- projects ------------------------------ */
/** A user sees their own films, plus the read-only demo film. */
on('GET', '/api/projects', async ({ session }) => {
  if (!cfg.cloudMode) return await all('SELECT * FROM projects ORDER BY updated_at DESC')
  return await all(
    'SELECT * FROM projects WHERE owner_id = ? OR is_demo = 1 ORDER BY is_demo, updated_at DESC',
    session.user.id,
  )
})

on('POST', '/api/projects', async ({ body, session }) => {
  const id = uid()
  const ts = now()
  await insert('projects', {
    id,
    owner_id: session.user?.id ?? LOCAL_USER.id,
    is_demo: 0,
    name: body?.name?.trim() || 'Untitled Film',
    format: body?.format ?? 'cinematic brand film',
    created_at: ts, updated_at: ts,
  })
  await insert('idea', { project_id: id, raw_text: '', updated_at: ts })
  await insert('story', { project_id: id, updated_at: ts })
  await insert('director_vision', { project_id: id, updated_at: ts })
  await insert('visual_dna', {
    id: uid(), project_id: id, version: 1, is_current: 1, label: 'Initial',
    created_at: ts, updated_at: ts,
  })
  return await one('SELECT * FROM projects WHERE id = ?', id)
})

on('GET', '/api/projects/:id', async ({ params }) => await projectBundle(params.id))

on('PATCH', '/api/projects/:id', async ({ params, body }) => {
  // Ownership and demo status are set by the server, never by the client.
  const { owner_id, is_demo, ...safe } = body ?? {}
  await patch('projects', 'id', params.id, safe, { updated_at: now() })
  return await one('SELECT * FROM projects WHERE id = ?', params.id)
})

on('DELETE', '/api/projects/:id', async ({ params }) => {
  await run('DELETE FROM projects WHERE id = ?', params.id)
  return { ok: true }
})

async function projectBundle(id) {
  const project = await one('SELECT * FROM projects WHERE id = ?', id)
  if (!project) throw notFound('That film no longer exists.')
  const scenes = await all('SELECT * FROM scenes WHERE project_id = ? ORDER BY sort', id)
  return {
    project,
    idea: await one('SELECT * FROM idea WHERE project_id = ?', id),
    development: await all('SELECT * FROM idea_development WHERE project_id = ? ORDER BY created_at DESC', id),
    story: await one('SELECT * FROM story WHERE project_id = ?', id),
    vision: await one('SELECT * FROM director_vision WHERE project_id = ?', id),
    dna: await one('SELECT * FROM visual_dna WHERE project_id = ? AND is_current = 1', id),
    dnaVersions: await all('SELECT id, version, label, is_current, created_at FROM visual_dna WHERE project_id = ? ORDER BY version DESC', id),
    characters: await all('SELECT * FROM characters WHERE project_id = ? ORDER BY sort', id),
    locations: await all('SELECT * FROM locations WHERE project_id = ? ORDER BY sort', id),
    props: await all('SELECT * FROM props WHERE project_id = ? ORDER BY sort', id),
    scenes,
    sceneDna: await all('SELECT * FROM scene_dna WHERE scene_id IN (SELECT id FROM scenes WHERE project_id = ?)', id),
    shots: await all('SELECT * FROM shots WHERE project_id = ? ORDER BY sort', id),
    links: await all(
      `SELECT * FROM entity_links WHERE (owner_type = 'scene' AND owner_id IN (SELECT id FROM scenes WHERE project_id = ?))
         OR (owner_type = 'shot' AND owner_id IN (SELECT id FROM shots WHERE project_id = ?))`, id, id),
    prompts: await all('SELECT * FROM prompts WHERE shot_id IN (SELECT id FROM shots WHERE project_id = ?) AND is_current = 1', id),
    generations: await all('SELECT id, shot_id, version, model, created_at, notes, status, selected, reason, media_mime, media_name FROM generations WHERE shot_id IN (SELECT id FROM shots WHERE project_id = ?) ORDER BY version', id),
    script: await all('SELECT * FROM script_elements WHERE project_id = ? ORDER BY sort', id),
  }
}

/* ------------------------ simple singletons ------------------------ */
for (const [route, table] of [['idea', 'idea'], ['story', 'story'], ['vision', 'director_vision']]) {
  on('PATCH', `/api/projects/:id/${route}`, async ({ params, body }) => {
    const prev = await one(`SELECT * FROM ${table} WHERE project_id = ?`, params.id)
    if (!prev) await insert(table, { project_id: params.id, ...body, updated_at: now() })
    else await patch(table, 'project_id', params.id, body, { updated_at: now() })
    await run('UPDATE projects SET updated_at = ? WHERE id = ?', now(), params.id)
    return await one(`SELECT * FROM ${table} WHERE project_id = ?`, params.id)
  })
  on('POST', `/api/projects/:id/${route}/snapshot`, async ({ params, body }) => {
    const row = await one(`SELECT * FROM ${table} WHERE project_id = ?`, params.id)
    await snapshot(params.id, table, params.id, row, body?.label ?? '')
    return { ok: true }
  })
}

/* --------------------------- visual DNA ---------------------------- */
on('PATCH', '/api/dna/:id', async ({ params, body }) => {
  const row = await one('SELECT * FROM visual_dna WHERE id = ?', params.id)
  if (!row) throw notFound('That Visual DNA version no longer exists.')
  if (row.locked && !body?._force) throw badRequest('This Visual DNA is locked. Unlock it to edit.', 'locked')
  await patch('visual_dna', 'id', params.id, body, { updated_at: now() })
  return await one('SELECT * FROM visual_dna WHERE id = ?', params.id)
})

/** Fork the current DNA into a new version — never mutate history. */
on('POST', '/api/projects/:id/dna/version', async ({ params, body }) => {
  const cur = await one('SELECT * FROM visual_dna WHERE project_id = ? AND is_current = 1', params.id)
  const next = ((await one('SELECT MAX(version) v FROM visual_dna WHERE project_id = ?', params.id))?.v ?? 0) + 1
  const id = uid()
  await insert('visual_dna', {
    ...cur, ...(body?.fields ?? {}), id, version: next, is_current: 1, locked: 0,
    label: body?.label ?? `v${next}`, created_at: now(), updated_at: now(),
  })
  await run('UPDATE visual_dna SET is_current = 0 WHERE project_id = ? AND id != ?', params.id, id)
  return await one('SELECT * FROM visual_dna WHERE id = ?', id)
})

on('POST', '/api/projects/:id/dna/:dnaId/activate', async ({ params }) => {
  await run('UPDATE visual_dna SET is_current = 0 WHERE project_id = ?', params.id)
  await run('UPDATE visual_dna SET is_current = 1 WHERE id = ?', params.dnaId)
  return await one('SELECT * FROM visual_dna WHERE id = ?', params.dnaId)
})

on('GET', '/api/dna/:id/impact', async ({ params }) => {
  const row = await one('SELECT project_id FROM visual_dna WHERE id = ?', params.id)
  const shots = await all(
    `SELECT s.id, s.number, s.title, sc.number scene_number, sc.title scene_title
       FROM shots s JOIN scenes sc ON sc.id = s.scene_id
      WHERE s.project_id = ? ORDER BY s.sort`, row.project_id)
  return { count: shots.length, shots }
})

/* --------------------------- world bible --------------------------- */
const WORLD = { character: 'characters', location: 'locations', prop: 'props' }
for (const [kind, table] of Object.entries(WORLD)) {
  on('POST', `/api/projects/:id/${table}`, async ({ params, body }) => {
    const id = uid()
    const sort = ((await one(`SELECT MAX(sort) s FROM ${table} WHERE project_id = ?`, params.id))?.s ?? 0) + 1
    await insert(table, { id, project_id: params.id, sort, updated_at: now(), ...body })
    return await one(`SELECT * FROM ${table} WHERE id = ?`, id)
  })
  on('PATCH', `/api/${table}/:eid`, async ({ params, body }) => {
    const row = await one(`SELECT * FROM ${table} WHERE id = ?`, params.eid)
    if (row?.locked && !body?._force && !('locked' in body))
      throw badRequest(`${row.name || kind} is locked. Unlock it to edit.`, 'locked')
    await patch(table, 'id', params.eid, body, { updated_at: now() })
    return await one(`SELECT * FROM ${table} WHERE id = ?`, params.eid)
  })
  on('DELETE', `/api/${table}/:eid`, async ({ params }) => {
    await run(`DELETE FROM ${table} WHERE id = ?`, params.eid)
    await run('DELETE FROM entity_links WHERE entity_type = ? AND entity_id = ?', kind, params.eid)
    return { ok: true }
  })
}

/* ----------------------------- scenes ------------------------------ */
/** Create one scene, appended to the film. Shared by the manual route and AI apply. */
async function createScene(projectId, body = {}) {
  const id = uid()
  const n = ((await one('SELECT MAX(number) n FROM scenes WHERE project_id = ?', projectId))?.n ?? 0) + 1
  await insert('scenes', { id, project_id: projectId, number: n, sort: n, title: body?.title ?? '', updated_at: now(), ...body })
  await insert('scene_dna', { scene_id: id, updated_at: now() })
  return await one('SELECT * FROM scenes WHERE id = ?', id)
}

on('POST', '/api/projects/:id/scenes', async ({ params, body }) => await createScene(params.id, body))

on('PATCH', '/api/scenes/:sid', async ({ params, body }) => {
  await patch('scenes', 'id', params.sid, body, { updated_at: now() })
  return await one('SELECT * FROM scenes WHERE id = ?', params.sid)
})

on('DELETE', '/api/scenes/:sid', async ({ params }) => {
  await run('DELETE FROM scenes WHERE id = ?', params.sid)
  return { ok: true }
})

on('PATCH', '/api/scenes/:sid/dna', async ({ params, body }) => {
  const row = await one('SELECT * FROM scene_dna WHERE scene_id = ?', params.sid)
  if (!row) await insert('scene_dna', { scene_id: params.sid, ...body, updated_at: now() })
  else await patch('scene_dna', 'scene_id', params.sid, body, { updated_at: now() })
  return await one('SELECT * FROM scene_dna WHERE scene_id = ?', params.sid)
})

/* ------------------------------ shots ------------------------------ */
/** Create one shot at the end of a scene, inheriting the scene's world links. */
async function createShot(sceneId, body = {}) {
  const scene = await one('SELECT * FROM scenes WHERE id = ?', sceneId)
  if (!scene) throw notFound('That scene no longer exists.')
  const id = uid()
  const n = ((await one('SELECT MAX(number) n FROM shots WHERE project_id = ?', scene.project_id))?.n ?? 0) + 1
  const sort = ((await one('SELECT MAX(sort) s FROM shots WHERE scene_id = ?', sceneId))?.s ?? 0) + 1
  await insert('shots', {
    id, project_id: scene.project_id, scene_id: sceneId, number: n, sort,
    time_of_day: scene.time_of_day ?? '', updated_at: now(), ...body,
  })
  // inherit whatever the scene already establishes
  for (const l of await all('SELECT * FROM entity_links WHERE owner_type = ? AND owner_id = ?', 'scene', sceneId)) {
    await insert('entity_links', { id: uid(), owner_type: 'shot', owner_id: id, entity_type: l.entity_type, entity_id: l.entity_id })
  }
  return await one('SELECT * FROM shots WHERE id = ?', id)
}

on('POST', '/api/scenes/:sid/shots', async ({ params, body }) => await createShot(params.sid, body))

on('PATCH', '/api/shots/:shid', async ({ params, body }) => {
  await patch('shots', 'id', params.shid, body, { updated_at: now() })
  return await one('SELECT * FROM shots WHERE id = ?', params.shid)
})

on('DELETE', '/api/shots/:shid', async ({ params }) => {
  await run('DELETE FROM shots WHERE id = ?', params.shid)
  await run('DELETE FROM entity_links WHERE owner_type = ? AND owner_id = ?', 'shot', params.shid)
  return { ok: true }
})

on('POST', '/api/shots/:shid/duplicate', async ({ params }) => {
  const src = await one('SELECT * FROM shots WHERE id = ?', params.shid)
  const id = uid()
  const n = ((await one('SELECT MAX(number) n FROM shots WHERE project_id = ?', src.project_id))?.n ?? 0) + 1
  await insert('shots', { ...src, id, number: n, sort: src.sort + 0.5, title: `${src.title} (alt)`, status: 'draft', updated_at: now() })
  for (const l of await all('SELECT * FROM entity_links WHERE owner_type = ? AND owner_id = ?', 'shot', params.shid)) {
    await insert('entity_links', { id: uid(), owner_type: 'shot', owner_id: id, entity_type: l.entity_type, entity_id: l.entity_id })
  }
  await resequence(src.scene_id)
  return await one('SELECT * FROM shots WHERE id = ?', id)
})

on('POST', '/api/scenes/:sid/reorder', async ({ params, body }) => {
  const ids = Array.isArray(body?.ids) ? body.ids : []
  for (const [i, id] of ids.entries())
    await run('UPDATE shots SET sort = ?, scene_id = ? WHERE id = ?', i + 1, params.sid, id)
  await resequence(params.sid)
  return { ok: true }
})

/** Renumber every shot in the film to its current board order. Explicit only. */
on('POST', '/api/projects/:id/renumber', async ({ params }) => {
  const scenes = await all('SELECT id FROM scenes WHERE project_id = ? ORDER BY sort', params.id)
  let n = 0
  for (const sc of scenes)
    for (const sh of await all('SELECT id FROM shots WHERE scene_id = ? ORDER BY sort', sc.id))
      await run('UPDATE shots SET number = ? WHERE id = ?', ++n, sh.id)
  for (const [i, sc] of scenes.entries())
    await run('UPDATE scenes SET number = ? WHERE id = ?', i + 1, sc.id)
  return { renumbered: n }
})

async function resequence(sceneId) {
  const rows = await all('SELECT id FROM shots WHERE scene_id = ? ORDER BY sort', sceneId)
  for (const [i, r] of rows.entries())
    await run('UPDATE shots SET sort = ? WHERE id = ?', i + 1, r.id)
}

/* ---------------------------- entity links ------------------------- */
on('POST', '/api/links', async ({ body }) => {
  const exists = await one(
    'SELECT id FROM entity_links WHERE owner_type = ? AND owner_id = ? AND entity_type = ? AND entity_id = ?',
    body.owner_type, body.owner_id, body.entity_type, body.entity_id)
  if (exists) return exists
  const id = uid()
  await insert('entity_links', { id, ...body })
  return { id }
})

on('DELETE', '/api/links/:lid', async ({ params }) => {
  await run('DELETE FROM entity_links WHERE id = ?', params.lid)
  return { ok: true }
})

/* --------------------------- prompt engine ------------------------- */
async function shotContext(shotId) {
  const shot = await one('SELECT * FROM shots WHERE id = ?', shotId)
  if (!shot) throw notFound('That shot no longer exists.')
  const scene = await one('SELECT * FROM scenes WHERE id = ?', shot.scene_id)
  const links = await all('SELECT * FROM entity_links WHERE owner_type = ? AND owner_id = ?', 'shot', shotId)
  const pick = async (kind, table) => {
    const rows = await Promise.all(links.filter((l) => l.entity_type === kind)
      .map((l) => one(`SELECT * FROM ${table} WHERE id = ?`, l.entity_id)))
    return rows.filter(Boolean)
  }
  const locations = await pick('location', 'locations')
  if (!locations.length && scene?.location_id) {
    const l = await one('SELECT * FROM locations WHERE id = ?', scene.location_id)
    if (l) locations.push(l)
  }
  return {
    project: await one('SELECT * FROM projects WHERE id = ?', shot.project_id),
    vision: await one('SELECT * FROM director_vision WHERE project_id = ?', shot.project_id),
    dna: await one('SELECT * FROM visual_dna WHERE project_id = ? AND is_current = 1', shot.project_id),
    scene,
    sceneDna: await one('SELECT * FROM scene_dna WHERE scene_id = ?', shot.scene_id),
    shot,
    characters: await pick('character', 'characters'),
    locations,
    props: await pick('prop', 'props'),
  }
}

on('GET', '/api/shots/:shid/prompt', async ({ params }) => {
  const ctx = await shotContext(params.shid)
  const built = composePrompt(ctx)
  const stored = await one('SELECT * FROM prompts WHERE shot_id = ? AND is_current = 1', params.shid)
  const prev = await one('SELECT * FROM shots WHERE scene_id = ? AND sort < ? ORDER BY sort DESC LIMIT 1', ctx.shot.scene_id, ctx.shot.sort)
  return {
    ...built,
    flat: flatten(built),
    stored,
    versions: await all('SELECT id, version, hand_edited, created_at FROM prompts WHERE shot_id = ? ORDER BY version DESC', params.shid),
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

on('POST', '/api/shots/:shid/prompt', async ({ params, body }) => {
  const ctx = await shotContext(params.shid)
  const built = composePrompt(ctx)
  const version = ((await one('SELECT MAX(version) v FROM prompts WHERE shot_id = ?', params.shid))?.v ?? 0) + 1
  const id = uid()
  await run('UPDATE prompts SET is_current = 0 WHERE shot_id = ?', params.shid)
  await insert('prompts', {
    id, shot_id: params.shid, version, is_current: 1,
    body: body?.body ?? built.body,
    negative: body?.negative ?? built.negative,
    layers_json: JSON.stringify(built.layers),
    hand_edited: body?.body ? 1 : 0,
    created_at: now(),
  })
  if ((await one('SELECT status FROM shots WHERE id = ?', params.shid))?.status === 'draft')
    await run('UPDATE shots SET status = ? WHERE id = ?', 'ready', params.shid)
  return await one('SELECT * FROM prompts WHERE id = ?', id)
})

on('POST', '/api/prompts/:pid/restore', async ({ params }) => {
  const p = await one('SELECT * FROM prompts WHERE id = ?', params.pid)
  await run('UPDATE prompts SET is_current = 0 WHERE shot_id = ?', p.shot_id)
  await run('UPDATE prompts SET is_current = 1 WHERE id = ?', params.pid)
  return p
})

/* --------------------------- generations --------------------------- */
on('POST', '/api/shots/:shid/generations', async ({ params, body }) => {
  const version = ((await one('SELECT MAX(version) v FROM generations WHERE shot_id = ?', params.shid))?.v ?? 0) + 1
  const id = uid()
  const prompt = await one('SELECT * FROM prompts WHERE shot_id = ? AND is_current = 1', params.shid)
  await insert('generations', {
    id, shot_id: params.shid, version, created_at: now(),
    prompt_snapshot: prompt ? `${prompt.body}${prompt.negative ? `\n\nAvoid: ${prompt.negative}.` : ''}` : '',
    ...body,
  })
  return await one('SELECT id, shot_id, version, model, created_at, notes, status, selected, reason, media_mime, media_name FROM generations WHERE id = ?', id)
})

on('PATCH', '/api/generations/:gid', async ({ params, body }) => {
  const g = await one('SELECT shot_id FROM generations WHERE id = ?', params.gid)
  if (body?.selected) {
    await run('UPDATE generations SET selected = 0 WHERE shot_id = ?', g.shot_id)
    await run('UPDATE shots SET status = ? WHERE id = ?', 'selected', g.shot_id)
  }
  await patch('generations', 'id', params.gid, body)
  return await one('SELECT id, shot_id, version, model, created_at, notes, status, selected, reason, media_mime, media_name FROM generations WHERE id = ?', params.gid)
})

on('DELETE', '/api/generations/:gid', async ({ params }) => {
  await run('DELETE FROM generations WHERE id = ?', params.gid)
  return { ok: true }
})

on('GET', '/api/generations/:gid/media', async ({ params }) =>
  await one('SELECT media, media_mime, media_name FROM generations WHERE id = ?', params.gid))

/* ---------------------------- references --------------------------- */
on('GET', '/api/refs/:ownerType/:ownerId', async ({ params }) =>
  await all('SELECT * FROM refs WHERE owner_type = ? AND owner_id = ? ORDER BY created_at', params.ownerType, params.ownerId))

on('POST', '/api/refs', async ({ body }) => {
  const id = uid()
  await insert('refs', { id, created_at: now(), ...body })
  return await one('SELECT * FROM refs WHERE id = ?', id)
})

on('DELETE', '/api/refs/:rid', async ({ params }) => {
  await run('DELETE FROM refs WHERE id = ?', params.rid)
  return { ok: true }
})

/* ------------------------------ script ----------------------------- */
on('PUT', '/api/projects/:id/script', async ({ params, body }) => {
  await run('DELETE FROM script_elements WHERE project_id = ?', params.id)
  const els = Array.isArray(body?.elements) ? body.elements : []
  for (const [i, el] of els.entries())
    await insert('script_elements', { id: el.id ?? uid(), project_id: params.id, sort: i + 1, type: el.type, text: el.text ?? '' })
  await run('UPDATE projects SET updated_at = ? WHERE id = ?', now(), params.id)
  return await all('SELECT * FROM script_elements WHERE project_id = ? ORDER BY sort', params.id)
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

async function readEntity(type, id) {
  if (type === 'script')
    return { elements: await all('SELECT id, type, text FROM script_elements WHERE project_id = ? ORDER BY sort', id) }
  const spec = VERSIONED[type]
  if (!spec?.table) throw badRequest('That cannot be versioned.', 'not_versionable')
  return await one(`SELECT * FROM ${spec.table} WHERE ${spec.key} = ?`, id)
}

async function projectOf(type, id) {
  if (type === 'script' || VERSIONED[type]?.key === 'project_id') return id
  const row = await readEntity(type, id)
  return row?.project_id ?? id
}

/* Routes are matched in registration order, and `/versions/:a/:b` would shadow
   `/versions/:vid/compare` — so the literal-suffix routes are declared first. */

/** Field-by-field diff between a stored snapshot and what is on screen now. */
on('GET', '/api/versions/:vid/compare', async ({ params }) => {
  const v = await one('SELECT * FROM versions WHERE id = ?', params.vid)
  if (!v) throw notFound('That snapshot no longer exists.')
  const past = JSON.parse(v.snapshot ?? '{}') ?? {}
  const current = await readEntity(v.entity_type, v.entity_id) ?? {}

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

on('POST', '/api/versions/:vid/restore', async ({ params }) => {
  const v = await one('SELECT * FROM versions WHERE id = ?', params.vid)
  if (!v) throw notFound('That snapshot no longer exists.')
  const past = JSON.parse(v.snapshot ?? '{}') ?? {}

  // the state being replaced becomes a version of its own — restore is undoable
  await snapshot(v.project_id, v.entity_type, v.entity_id, await readEntity(v.entity_type, v.entity_id), 'before restore')

  if (v.entity_type === 'script') {
    await run('DELETE FROM script_elements WHERE project_id = ?', v.entity_id)
    const past_els = Array.isArray(past.elements) ? past.elements : []
    for (const [i, el] of past_els.entries())
      await insert('script_elements', { id: uid(), project_id: v.entity_id, sort: i + 1, type: el.type, text: el.text ?? '' })
    return { ok: true }
  }

  const spec = VERSIONED[v.entity_type]
  const body = { ...past }
  for (const k of ['id', 'project_id', 'scene_id']) delete body[k]
  await patch(spec.table, spec.key, v.entity_id, body, { updated_at: now() })
  return { ok: true }
})

on('DELETE', '/api/versions/:vid', async ({ params }) => {
  await run('DELETE FROM versions WHERE id = ?', params.vid)
  return { ok: true }
})

on('GET', '/api/versions/:type/:eid', async ({ params }) =>
  await all('SELECT id, label, created_at FROM versions WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
    params.type, params.eid))

on('POST', '/api/versions/:type/:eid', async ({ params, body }) => {
  const row = await readEntity(params.type, params.eid)
  await snapshot(await projectOf(params.type, params.eid), params.type, params.eid, row, body?.label ?? '')
  return { ok: true }
})

/* ------------------------------- AI --------------------------------
   Every model-backed endpoint goes through `aiGate`: it applies the abuse
   rate limit (brief §12) and returns the assistant for this caller, which in
   turn applies the beta allowance and records what was spent (§11, §35). */
const aiGate = (session, requestId) => {
  ratelimit.check(session.user?.id ?? 'anonymous')
  return assistantFor(session, requestId)
}

/** The line the UI shows when there is no model configured at all. */
const structuralNote = (asst, whenNoKey) => (asst.available ? null : whenNoKey)

on('POST', '/api/projects/:id/ai/develop-idea', async ({ params, session, requestId }) => {
  const asst = aiGate(session, requestId)
  const idea = await one('SELECT * FROM idea WHERE project_id = ?', params.id)
  const raw = idea?.raw_text ?? ''
  if (!raw.trim()) throw badRequest('There is no idea text to develop yet.', 'no_idea')
  const res = await asst.structured(
    'develop-idea',
    'Read the director\'s raw idea dump and develop it. Do not replace their idea — clarify it.',
    raw,
    '{ "central_idea": "", "premise": "", "theme": "", "emotional_direction": "", "conflict": "", "ending": "", "questions": "", "visual_motifs": "" }',
  )
  const source = res.data ? res.source : 'structural'
  const dev = res.data ?? ai.structuralIdea(raw)
  const id = uid()
  await insert('idea_development', { id, project_id: params.id, source, created_at: now(), ...dev })
  return { ...(await one('SELECT * FROM idea_development WHERE id = ?', id)), source, note: res.note }
})

on('POST', '/api/ai/rewrite', async ({ body, session, requestId }) => {
  const asst = aiGate(session, requestId)
  const res = await asst.rewrite('rewrite', body?.text ?? '', body?.instruction ?? 'Rewrite.', body?.context ?? '')
  if (res.text == null) {
    return {
      text: null, source: 'structural',
      message: res.note ?? structuralNote(asst, 'No AI is configured — rewrite needs a model. Add your own key in Settings.'),
    }
  }
  return { text: res.text, source: res.source, note: res.note }
})

on('POST', '/api/projects/:id/ai/script-from-story', async ({ params }) => {
  const story = await one('SELECT * FROM story WHERE project_id = ?', params.id)
  const text = [story?.beginning, story?.middle, story?.ending].filter(Boolean).join('\n\n')
  const els = ai.structuralScript(text)
  return { elements: els, source: 'structural' }
})

/* ------------------- story → scenes → shots ------------------------
   Both endpoints are two-phase. A POST with no body PROPOSES and writes
   nothing; a POST carrying `apply` writes exactly the rows the director
   approved, after they have edited them. Nothing is ever created behind
   the director's back — the same rule the rest of FRAME follows. */

/** Only these columns may come back from a proposal. */
const SCENE_FIELDS = ['title', 'location_text', 'time_of_day', 'duration',
  'story_purpose', 'emotional_purpose', 'description']
const SCENE_DNA_FIELDS = ['color', 'lighting', 'contrast', 'texture', 'camera', 'atmosphere', 'notes']
const SHOT_FIELDS = ['title', 'duration', 'purpose', 'description', 'subject_primary',
  'subject_secondary', 'action', 'expression', 'shot_type', 'lens', 'camera_height',
  'camera_angle', 'camera_movement', 'depth_of_field', 'framing', 'composition',
  'light_source', 'light_direction', 'light_quality', 'color_temp', 'light_contrast',
  'weather', 'time_of_day', 'atmosphere', 'background',
  'subject_motion', 'camera_motion', 'env_motion', 'emotion', 'energy', 'pacing']

const MAX_APPLY = 40

/** Keep only known text fields, so a stray key can never reach the database. */
const take = (row, fields) => {
  const out = {}
  for (const k of fields) {
    const v = row?.[k]
    if (v != null && String(v).trim()) out[k] = String(v).trim()
  }
  return out
}

/** Of the names a proposal claims, keep only those that exist in the world bible. */
async function knownEntities(projectId, names) {
  if (!Array.isArray(names)) return []
  const out = []
  for (const n of names) if (await findEntity(projectId, n)) out.push(n)
  return out
}

/** Match a proposed name against the world bible. Exact names only — never fuzzy. */
async function findEntity(projectId, name) {
  const n = String(name ?? '').trim().toLowerCase()
  if (!n) return null
  for (const [kind, table] of [['character', 'characters'], ['location', 'locations'], ['prop', 'props']]) {
    const hit = await all(`SELECT id, name FROM ${table} WHERE project_id = ?`, projectId)
      .find((e) => String(e.name ?? '').trim().toLowerCase() === n)
    if (hit) return { kind, id: hit.id }
  }
  return null
}

async function linkAll(ownerType, ownerId, projectId, names) {
  for (const name of names ?? []) {
    const hit = await findEntity(projectId, name)
    if (!hit) continue
    const exists = await one(
      'SELECT id FROM entity_links WHERE owner_type = ? AND owner_id = ? AND entity_type = ? AND entity_id = ?',
      ownerType, ownerId, hit.kind, hit.id)
    if (exists) continue
    await insert('entity_links', { id: uid(), owner_type: ownerType, owner_id: ownerId, entity_type: hit.kind, entity_id: hit.id })
  }
}

const fmt = (label, v) => (String(v ?? '').trim() ? `${label}: ${String(v).replace(/\s+/g, ' ').trim()}` : null)

/** The whole film as the model needs to see it to break a story into scenes. */
async function filmContext(projectId) {
  const project = await one('SELECT * FROM projects WHERE id = ?', projectId)
  const story = await one('SELECT * FROM story WHERE project_id = ?', projectId)
  const vision = await one('SELECT * FROM director_vision WHERE project_id = ?', projectId)
  const dna = await one('SELECT * FROM visual_dna WHERE project_id = ? AND is_current = 1', projectId)
  const script = await all('SELECT * FROM script_elements WHERE project_id = ? ORDER BY sort', projectId)
  const worldCharacters = await all('SELECT name FROM characters WHERE project_id = ? ORDER BY sort', projectId)
  const worldLocations = await all('SELECT name, architecture FROM locations WHERE project_id = ? ORDER BY sort', projectId)
  const worldProps = await all('SELECT name FROM props WHERE project_id = ? ORDER BY sort', projectId)
  const existingScenes = await all('SELECT number, title, description FROM scenes WHERE project_id = ? ORDER BY sort', projectId)
  return [
    `FILM: ${project.name} (${project.format})`,
    fmt('LOGLINE', story?.logline), fmt('PREMISE', story?.premise), fmt('THEME', story?.theme),
    fmt('CONFLICT', story?.conflict), fmt('EMOTIONAL JOURNEY', story?.emotional_journey),
    fmt('VISUAL MOTIFS', story?.visual_motifs),
    '', 'STORY',
    fmt('  beginning', story?.beginning), fmt('  middle', story?.middle), fmt('  ending', story?.ending),
    '', 'DIRECTION',
    fmt('  genre', vision?.genre), fmt('  tone', vision?.tone), fmt('  pacing', vision?.pacing),
    fmt('  camera philosophy', vision?.camera_philosophy),
    fmt('  editing philosophy', vision?.editing_philosophy),
    '', `VISUAL DNA v${dna?.version ?? 1}`,
    fmt('  film character', dna?.film_character), fmt('  color', dna?.color),
    fmt('  lighting', dna?.lighting), fmt('  avoid', dna?.avoid),
    '', 'WORLD BIBLE (refer to these by exact name)',
    ...worldCharacters.map((c) => `  character: ${c.name}`),
    ...worldLocations.map((l) => `  location: ${l.name}${l.architecture ? ` — ${l.architecture}` : ''}`),
    ...worldProps.map((p) => `  prop: ${p.name}`),
    script.length
      ? `\nSCRIPT (${script.length} elements)\n${script.map((e) => `  [${e.type}] ${e.text}`).join('\n')}`
      : null,
    '', 'SCENES THAT ALREADY EXIST (do not duplicate these)',
    ...existingScenes
      .map((sc) => `  ${String(sc.number).padStart(2, '0')} ${sc.title} — ${String(sc.description ?? '').slice(0, 120)}`),
  ].filter((l) => l !== null).join('\n')
}

on('POST', '/api/projects/:id/ai/scenes-from-story', async ({ params, body, session, requestId }) => {
  /* phase 2 — write the scenes the director approved. No model is consulted
     here and nothing is metered: the director is applying their own edits. */
  if (Array.isArray(body?.apply)) {
    const created = []
    for (const row of body.apply.slice(0, MAX_APPLY)) {
      const fields = take(row, SCENE_FIELDS)
      const loc = await findEntity(params.id, row?.location_text)
      if (loc?.kind === 'location') fields.location_id = loc.id
      const scene = await createScene(params.id, fields)
      const dna = take(row?.dna ?? {}, SCENE_DNA_FIELDS)
      if (Object.keys(dna).length) await patch('scene_dna', 'scene_id', scene.id, dna, { updated_at: now() })
      await linkAll('scene', scene.id, params.id, row?.entities)
      created.push(scene)
    }
    return { created, count: created.length }
  }

  /* phase 1 — propose, writing nothing */
  const story = await one('SELECT * FROM story WHERE project_id = ?', params.id)
  const script = await all('SELECT * FROM script_elements WHERE project_id = ? ORDER BY sort', params.id)
  const hasStory = [story?.beginning, story?.middle, story?.ending, story?.premise, story?.logline]
    .some((v) => String(v ?? '').trim())
  if (!hasStory && !script.length) throw badRequest('Write the story (or a script) before breaking it into scenes.', 'no_story')

  const asst = aiGate(session, requestId)
  const res = await asst.structured(
    'scenes-from-story',
    `Break this film into scenes. A scene is one continuous unit of place and time.
Follow the director's story and pacing — do not invent plot they have not implied.
Give each scene a working title, its place and time of day, what it does for the story,
what it does emotionally, and a short description of what we see.
Where a scene uses a location, character or prop that already exists in the world bible,
name it EXACTLY as written there in "entities". Leave "dna" out unless the scene genuinely
departs from the global Visual DNA. Propose as many scenes as the story needs — no more.`,
    await filmContext(params.id),
    `{ "scenes": [ { "title": "", "location_text": "", "time_of_day": "", "duration": "",
  "story_purpose": "", "emotional_purpose": "", "description": "",
  "entities": ["exact name from the world bible"],
  "dna": { "color": "", "lighting": "", "atmosphere": "" } } ] }`,
  )

  const proposed = Array.isArray(res.data?.scenes) ? res.data.scenes : null
  const source = proposed ? res.source : 'structural'
  const raw = proposed ?? ai.structuralScenes(story, script)
  const scenes = []
  for (const r of raw) {
    const row = {
      ...take(r, SCENE_FIELDS),
      entities: await knownEntities(params.id, r?.entities),
      dna: take(r?.dna ?? {}, SCENE_DNA_FIELDS),
    }
    if (row.title || row.description) scenes.push(row)
  }

  return {
    scenes, source,
    existing: (await all('SELECT id FROM scenes WHERE project_id = ?', params.id)).length,
    message: source === 'structural'
      ? 'No model key configured — this is your own story segmented at its existing paragraph breaks (or the script\'s scene headings), nothing authored. Set a key in Settings for a real breakdown.'
      : null,
  }
})

/** One scene in full, on top of the film context, plus the shots already in it. */
async function sceneContext(sceneId) {
  const scene = await one('SELECT * FROM scenes WHERE id = ?', sceneId)
  if (!scene) throw notFound('That scene no longer exists.')
  const sceneDna = await one('SELECT * FROM scene_dna WHERE scene_id = ?', sceneId)
  const links = await all('SELECT * FROM entity_links WHERE owner_type = ? AND owner_id = ?', 'scene', sceneId)
  const pick = async (kind, table) => {
    const rows = await Promise.all(links.filter((l) => l.entity_type === kind)
      .map((l) => one(`SELECT * FROM ${table} WHERE id = ?`, l.entity_id)))
    return rows.filter(Boolean)
  }
  const locations = await pick('location', 'locations')
  if (!locations.length && scene.location_id) {
    const l = await one('SELECT * FROM locations WHERE id = ?', scene.location_id)
    if (l) locations.push(l)
  }
  const characters = await pick('character', 'characters')
  const props = await pick('prop', 'props')
  const existingShots = await all(
    'SELECT number, title, description, shot_type FROM shots WHERE scene_id = ? ORDER BY sort', sceneId)
  const text = [
    await filmContext(scene.project_id),
    '',
    `THE SCENE TO BREAK DOWN — ${String(scene.number).padStart(2, '0')} ${scene.title}`,
    fmt('  place', scene.location_text || locations[0]?.name),
    fmt('  time', scene.time_of_day), fmt('  duration', scene.duration),
    fmt('  story purpose', scene.story_purpose), fmt('  emotional purpose', scene.emotional_purpose),
    fmt('  description', scene.description),
    fmt('  scene dna', [sceneDna?.color, sceneDna?.lighting, sceneDna?.atmosphere, sceneDna?.camera].filter(Boolean).join('; ')),
    '', 'ATTACHED TO THIS SCENE',
    ...characters.map((c) => `  character: ${c.name}${c.locked ? ' [LOCKED]' : ''} — ${[c.age, c.appearance, c.clothing].filter(Boolean).join(', ')}`),
    ...locations.map((l) => `  location: ${l.name}${l.locked ? ' [LOCKED]' : ''} — ${[l.architecture, l.materials].filter(Boolean).join(', ')}`),
    ...props.map((p) => `  prop: ${p.name}${p.locked ? ' [LOCKED]' : ''} — ${[p.description, p.material].filter(Boolean).join(', ')}`),
    '', 'SHOTS ALREADY IN THIS SCENE (do not duplicate these)',
    ...existingShots
      .map((sh) => `  ${String(sh.number).padStart(2, '0')} ${sh.title} [${sh.shot_type}] — ${String(sh.description ?? '').slice(0, 120)}`),
  ].filter((l) => l !== null).join('\n')
  return { scene, text }
}

on('POST', '/api/scenes/:sid/ai/shots-from-scene', async ({ params, body, session, requestId }) => {
  /* phase 2 — write the shots the director approved */
  if (Array.isArray(body?.apply)) {
    const scene = await one('SELECT * FROM scenes WHERE id = ?', params.sid)
    if (!scene) throw notFound('That scene no longer exists.')
    const created = []
    for (const row of body.apply.slice(0, MAX_APPLY)) {
      const shot = await createShot(params.sid, take(row, SHOT_FIELDS))
      await linkAll('shot', shot.id, scene.project_id, row?.entities)
      created.push(shot)
    }
    return { created, count: created.length }
  }

  /* phase 1 — propose, writing nothing */
  const { scene, text } = await sceneContext(params.sid)
  const usable = [scene.description, scene.story_purpose, scene.emotional_purpose, scene.title]
    .some((v) => String(v ?? '').trim())
  if (!usable) throw badRequest('Describe the scene before breaking it into shots.', 'no_scene')

  const asst = aiGate(session, requestId)
  const res = await asst.structured(
    'shots-from-scene',
    `Break this ONE scene into shots. Each shot is a single continuous frame.
Respect the director's camera philosophy and the Visual DNA — you are choosing coverage,
not redesigning the look. Fill camera, light, motion and emotion concretely: these fields
go straight into the prompt engine, so "medium close-up" and "50mm" are useful where
"cinematic" is not. Anything marked [LOCKED] is a fixed creative constraint — never
propose a change to it. Name every character, location and prop the shot contains in
"entities", exactly as the world bible writes it, so continuity is inherited.
Cover the scene in as few shots as it honestly takes.`,
    text,
    `{ "shots": [ { "title": "", "duration": "", "purpose": "", "description": "",
  "subject_primary": "", "action": "", "expression": "",
  "shot_type": "", "lens": "", "camera_angle": "", "camera_height": "", "camera_movement": "",
  "framing": "", "composition": "", "depth_of_field": "",
  "light_source": "", "light_direction": "", "light_quality": "", "color_temp": "",
  "subject_motion": "", "camera_motion": "", "env_motion": "",
  "emotion": "", "energy": "", "pacing": "",
  "entities": ["exact name from the world bible"] } ] }`,
  )

  const proposed = Array.isArray(res.data?.shots) ? res.data.shots : null
  const source = proposed ? res.source : 'structural'
  const raw = proposed ?? ai.structuralShots(scene)
  const shots = []
  for (const r of raw) {
    const row = {
      ...take(r, SHOT_FIELDS),
      entities: await knownEntities(scene.project_id, r?.entities),
    }
    if (row.title || row.description) shots.push(row)
  }

  return {
    shots, source,
    existing: (await all('SELECT id FROM shots WHERE scene_id = ?', params.sid)).length,
    message: source === 'structural'
      ? 'No model key configured — this is the scene description split at its sentences, with camera and light left empty rather than invented. Set a key in Settings for a real breakdown.'
      : null,
  }
})

/* --------------------- contextual assistant ------------------------
   The assistant always answers about a specific shot, with the whole film
   in view: story, vision, DNA, scene DNA, world entities and neighbours. */

async function narrative(ctx, prev, next) {
  const { project, vision, dna, scene, sceneDna, shot, characters, locations, props } = ctx
  const f = async (label, v) => (String(v ?? '').trim() ? `${label}: ${String(v).replace(/\s+/g, ' ').trim()}` : null)
  const story = await one('SELECT * FROM story WHERE project_id = ?', project.id)
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

on('POST', '/api/shots/:shid/ai/ask', async ({ params, body, session, requestId }) => {
  const asst = aiGate(session, requestId)
  const ctx = await shotContext(params.shid)
  const prev = await one('SELECT * FROM shots WHERE scene_id = ? AND sort < ? ORDER BY sort DESC LIMIT 1', ctx.shot.scene_id, ctx.shot.sort)
  const next = await one('SELECT * FROM shots WHERE scene_id = ? AND sort > ? ORDER BY sort ASC LIMIT 1', ctx.shot.scene_id, ctx.shot.sort)
  const question = String(body?.question ?? '').trim()
  if (!question) throw badRequest('Ask something first.', 'no_question')

  const context = await narrative(ctx, prev, next)
  const res = await asst.rewrite(
    'prompt-lab-ask',
    question,
    `Answer the director's question about this shot. You have the whole film in view.
Be concrete and brief — this is a working note, not an essay. Suggest; never assume the change is made.
Anything marked [LOCKED] is a fixed creative constraint: say so rather than proposing a change to it.`,
    context,
  )

  if (res.text == null) {
    /* "See context" still works with no model: the director sees exactly the
       material the assistant would have been given (brief §26). */
    return {
      answer: null, source: 'structural', context,
      message: res.note ?? 'No AI is configured. The full context the assistant would see is shown below — add a key in Settings to ask questions of it.',
      conflicts: [],
    }
  }
  return { answer: res.text, source: res.source, conflicts: lockConflicts(res.text, ctx), context: null, note: res.note }
})

on('POST', '/api/shots/:shid/ai/alternatives', async ({ params, session, requestId }) => {
  const asst = aiGate(session, requestId)
  const ctx = await shotContext(params.shid)
  const prev = await one('SELECT * FROM shots WHERE scene_id = ? AND sort < ? ORDER BY sort DESC LIMIT 1', ctx.shot.scene_id, ctx.shot.sort)
  const res = await asst.structured(
    'camera-alternatives',
    `Propose three alternative camera approaches to this shot. Keep the Visual DNA and the
director's camera philosophy intact — vary only the framing, lens, movement and angle.
For each, say in one line what it changes emotionally.`,
    await narrative(ctx, prev, null),
    '{ "options": [ { "shot_type": "", "lens": "", "camera_angle": "", "camera_movement": "", "framing": "", "why": "" } ] }',
  )
  if (!Array.isArray(res.data?.options)) {
    return {
      options: null, source: 'structural',
      message: res.note ?? structuralNote(asst, 'No AI is configured — camera alternatives need a model. Add your own key in Settings.'),
    }
  }
  return { options: res.data.options, source: res.source, note: res.note }
})

/** Split one shot into two, carrying continuity across. Brief §22. */
on('POST', '/api/shots/:shid/split', async ({ params }) => {
  const src = await one('SELECT * FROM shots WHERE id = ?', params.shid)
  if (!src) throw notFound('That shot no longer exists.')
  const id = uid()
  const n = ((await one('SELECT MAX(number) n FROM shots WHERE project_id = ?', src.project_id))?.n ?? 0) + 1
  await insert('shots', {
    ...src, id, number: n, sort: src.sort + 0.5, status: 'draft',
    title: `${src.title || 'Shot'} (b)`, description: '', action: '',
    updated_at: now(),
  })
  await run('UPDATE shots SET title = ? WHERE id = ?', `${src.title || 'Shot'} (a)`, src.id)
  for (const l of await all('SELECT * FROM entity_links WHERE owner_type = ? AND owner_id = ?', 'shot', params.shid))
    await insert('entity_links', { id: uid(), owner_type: 'shot', owner_id: id, entity_type: l.entity_type, entity_id: l.entity_id })
  await resequence(src.scene_id)
  return await one('SELECT * FROM shots WHERE id = ?', id)
})

/* ----------------------------- search ------------------------------ */
on('GET', '/api/projects/:id/search', async ({ params, query }) => {
  const q = String(query.get('q') ?? '').trim().toLowerCase()
  if (q.length < 2) return { results: [] }
  const hit = (text) => String(text ?? '').toLowerCase().includes(q)
  const results = []
  const add = (kind, id, label, where, sceneId) => results.push({ kind, id, label, where, sceneId })

  for (const c of await all('SELECT * FROM characters WHERE project_id = ?', params.id))
    if ([c.name, c.appearance, c.personality, c.clothing, c.distinctive].some(hit)) add('character', c.id, c.name, 'Characters')
  for (const l of await all('SELECT * FROM locations WHERE project_id = ?', params.id))
    if ([l.name, l.architecture, l.atmosphere, l.materials].some(hit)) add('location', l.id, l.name, 'Locations')
  for (const p of await all('SELECT * FROM props WHERE project_id = ?', params.id))
    if ([p.name, p.description, p.material].some(hit)) add('prop', p.id, p.name, 'Props')
  for (const s of await all('SELECT * FROM scenes WHERE project_id = ? ORDER BY sort', params.id))
    if ([s.title, s.description, s.story_purpose, s.emotional_purpose].some(hit))
      add('scene', s.id, `Scene ${String(s.number).padStart(2, '0')} — ${s.title}`, 'Scenes', s.id)
  for (const s of await all('SELECT * FROM shots WHERE project_id = ? ORDER BY sort', params.id))
    if ([s.title, s.description, s.action, s.purpose, s.subject_primary].some(hit))
      add('shot', s.id, `Shot ${String(s.number).padStart(2, '0')} — ${s.title}`, 'Shot Board', s.scene_id)
  for (const p of await all('SELECT p.*, s.number, s.scene_id FROM prompts p JOIN shots s ON s.id = p.shot_id WHERE s.project_id = ? AND p.is_current = 1', params.id))
    if (hit(p.body)) add('prompt', p.shot_id, `Prompt for shot ${String(p.number).padStart(2, '0')}`, 'Prompt Lab', p.scene_id)

  return { results: results.slice(0, 40) }
})

/* ----------------------------- export ------------------------------ */
on('GET', '/api/projects/:id/export', async ({ params }) => buildExport(await projectBundle(params.id)))
