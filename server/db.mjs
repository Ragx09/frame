/**
 * The data layer — one interface, two drivers.
 *
 *   local development  → SQLite (`node:sqlite`, no native build, file on disk)
 *   beta deployment    → Supabase Postgres (`DATABASE_URL` is set)
 *
 * Every helper keeps the signature it had when FRAME was SQLite-only; the only
 * change is that they are now `async`, because no synchronous Postgres driver
 * exists. Business logic above this line is written once and does not know or
 * care which database it is talking to (brief §16, §47).
 *
 * The application's SQL is written in the portable subset both accept —
 * `?` placeholders, no dialect functions — and the Postgres driver rewrites
 * placeholders. Booleans are INTEGER 0/1 on both, so truthiness is identical.
 */
import { randomUUID } from 'node:crypto'
import { DATABASE_URL, cloudMode } from './config.mjs'
import { createSqliteDriver } from './drivers/sqlite.mjs'

const driver = DATABASE_URL
  ? (await import('./drivers/postgres.mjs')).createPostgresDriver()
  : createSqliteDriver()

export const dialect = driver.dialect
export const isCloud = cloudMode

export const uid = () => randomUUID()
export const now = () => new Date().toISOString()

export const all = (sql, ...p) => driver.all(sql, p)
export const one = (sql, ...p) => driver.one(sql, p)
export const run = (sql, ...p) => driver.run(sql, p)
export const exec = (sql) => driver.exec(sql)
export const tx = (fn) => driver.tx(fn)
export const close = () => driver.close()

/** Columns of a table. Cached — the schema does not change at runtime. */
const colCache = new Map()
export async function columns(table) {
  if (!colCache.has(table)) colCache.set(table, await driver.columns(table))
  return colCache.get(table)
}

/** Build an UPDATE from a partial patch, ignoring unknown keys. */
export async function patch(table, idCol, id, body, extra = {}) {
  const cols = await columns(table)
  const data = { ...body, ...extra }
  const keys = Object.keys(data).filter((k) => cols.includes(k) && k !== idCol)
  if (!keys.length) return
  const sql = `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE ${idCol} = ?`
  await run(sql, ...keys.map((k) => normalize(data[k])), id)
}

export async function insert(table, data) {
  const cols = await columns(table)
  const keys = Object.keys(data).filter((k) => cols.includes(k))
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
  await run(sql, ...keys.map((k) => normalize(data[k])))
  return data.id
}

function normalize(v) {
  if (v === undefined || v === null) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'object') return JSON.stringify(v)
  return v
}

/** Snapshot any row into the version history. */
export async function snapshot(projectId, entityType, entityId, row, label = '') {
  await insert('versions', {
    id: uid(),
    project_id: projectId,
    entity_type: entityType,
    entity_id: entityId,
    label,
    snapshot: JSON.stringify(row),
    created_at: now(),
  })
}

/** Liveness probe for `/health` — cheap, and never returns connection detail. */
export async function ping() {
  await driver.one('SELECT 1 AS ok', [])
  return true
}
