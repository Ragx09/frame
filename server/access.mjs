/**
 * Project ownership (brief §15, §28).
 *
 * Every entity in FRAME belongs to exactly one project, and in cloud mode every
 * project belongs to exactly one user. Rather than sprinkling an ownership
 * check through fifty handlers — where the next handler added would simply
 * forget it — this resolves the owning project from whichever id a route
 * happens to carry, and the router applies it to every request before the
 * handler runs. A new route is covered the moment its parameter name is in the
 * table below; one that is not is refused rather than allowed.
 *
 * The demo project is world-readable and nobody's to write (brief §18).
 */
import { one } from './db.mjs'
import { cloudMode } from './config.mjs'
import { forbidden, notFound } from './errors.mjs'

/**
 * How to get from a route parameter to a project id. Each entry is the SQL
 * that maps the id to `project_id`, or `'project'` when the id already is one.
 */
const RESOLVERS = {
  // the project itself
  id: 'project',
  pid: 'project',

  // direct children — one hop
  sid: 'SELECT project_id FROM scenes WHERE id = ?',
  shid: 'SELECT project_id FROM shots WHERE id = ?',
  eid: null, // resolved by route family; see `resolveProject`
  dnaId: 'SELECT project_id FROM visual_dna WHERE id = ?',
  rid: 'SELECT project_id FROM refs WHERE id = ?',
  vid: 'SELECT project_id FROM versions WHERE id = ?',

  // two hops, through the shot
  gid: 'SELECT s.project_id AS project_id FROM generations g JOIN shots s ON s.id = g.shot_id WHERE g.id = ?',
  promptId: 'SELECT s.project_id AS project_id FROM prompts p JOIN shots s ON s.id = p.shot_id WHERE p.id = ?',
}

/** `/api/characters/:eid` → the characters table, and so on. */
const ENTITY_TABLE_BY_PATH = {
  characters: 'characters',
  locations: 'locations',
  props: 'props',
}

/**
 * Work out which project this request touches. Returns `null` when the route
 * is not project-scoped (`/api/meta`, `/api/projects` listing, and so on).
 */
export async function resolveProject(pathname, params) {
  // /api/dna/:id and /api/prompts/:pid do not carry a project id despite the
  // parameter name, so they are matched by path before the generic table.
  if (pathname.startsWith('/api/dna/')) {
    return (await one('SELECT project_id FROM visual_dna WHERE id = ?', params.id))?.project_id ?? null
  }
  if (pathname.startsWith('/api/prompts/')) {
    return (await one(RESOLVERS.promptId, params.pid))?.project_id ?? null
  }

  // /api/versions/:type/:eid — the entity type names the table.
  if (params.type && params.eid) return null // handled by the route's own lookup

  // /api/characters/:eid, /api/locations/:eid, /api/props/:eid
  if (params.eid) {
    const segment = pathname.split('/')[2]
    const table = ENTITY_TABLE_BY_PATH[segment]
    if (!table) return null
    return (await one(`SELECT project_id FROM ${table} WHERE id = ?`, params.eid))?.project_id ?? null
  }

  // /api/refs/:ownerType/:ownerId — the owner names its own table.
  if (params.ownerType && params.ownerId) {
    const table = { character: 'characters', location: 'locations', prop: 'props', scene: 'scenes', shot: 'shots' }[params.ownerType]
    if (!table) return null
    return (await one(`SELECT project_id FROM ${table} WHERE id = ?`, params.ownerId))?.project_id ?? null
  }

  for (const [key, sql] of Object.entries(RESOLVERS)) {
    const value = params[key]
    if (!value || !sql) continue
    if (sql === 'project') return value
    return (await one(sql, value))?.project_id ?? null
  }
  return null
}

/**
 * Assert this session may act on this project.
 *
 * Local development has one implicit user and no sign-in, so ownership is not
 * enforced there — it would only get in the way of the workflow §16 protects.
 * In cloud mode a project must exist and must belong to the caller, with the
 * demo film readable by everyone and writable by nobody.
 */
export async function loadProject(projectId) {
  if (!projectId) return null
  return one('SELECT id, owner_id, is_demo FROM projects WHERE id = ?', projectId)
}

export async function assertAccess({ session, projectId, project, write }) {
  if (!projectId) return null

  if (project === undefined) project = await loadProject(projectId)
  if (!project) throw notFound('That project no longer exists.')

  if (project.is_demo) {
    if (write) throw forbidden('The demo film is read-only. Create your own film to make changes.', 'demo_readonly')
    return project
  }

  if (!cloudMode) return project

  const user = session?.user
  if (!user) throw forbidden('Sign in to open this film.', 'unauthenticated')
  if (project.owner_id && project.owner_id !== user.id) {
    // Deliberately the same shape as "does not exist": a stranger should not be
    // able to probe which project ids are real.
    throw notFound('That project no longer exists.')
  }
  return project
}
