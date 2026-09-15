import { DatabaseSync } from 'node:sqlite'
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'data')
mkdirSync(dataDir, { recursive: true })

export const db = new DatabaseSync(join(dataDir, 'frame.db'))
db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'))

// idempotent additive migrations for databases created by an earlier schema
for (const [table, col, type] of [['idea_development', 'visual_motifs', 'TEXT']]) {
  const has = db.prepare(`PRAGMA table_info(${table})`).all().some((r) => r.name === col)
  if (!has) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`)
}

export const uid = () => randomUUID()
export const now = () => new Date().toISOString()

export const all = (sql, ...p) => db.prepare(sql).all(...p)
export const one = (sql, ...p) => db.prepare(sql).get(...p) ?? null
export const run = (sql, ...p) => db.prepare(sql).run(...p)

/** Columns of a table, minus ones the client must never set directly. */
const colCache = new Map()
export function columns(table) {
  if (!colCache.has(table)) {
    colCache.set(table, all(`PRAGMA table_info(${table})`).map((r) => r.name))
  }
  return colCache.get(table)
}

/** Build an UPDATE from a partial patch, ignoring unknown keys. */
export function patch(table, idCol, id, body, extra = {}) {
  const cols = columns(table)
  const data = { ...body, ...extra }
  const keys = Object.keys(data).filter((k) => cols.includes(k) && k !== idCol)
  if (!keys.length) return
  const sql = `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE ${idCol} = ?`
  run(sql, ...keys.map((k) => normalize(data[k])), id)
}

export function insert(table, data) {
  const cols = columns(table)
  const keys = Object.keys(data).filter((k) => cols.includes(k))
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
  run(sql, ...keys.map((k) => normalize(data[k])))
  return data.id
}

function normalize(v) {
  if (v === undefined || v === null) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'object') return JSON.stringify(v)
  return v
}

/** Snapshot any row into the version history. */
export function snapshot(projectId, entityType, entityId, row, label = '') {
  insert('versions', {
    id: uid(),
    project_id: projectId,
    entity_type: entityType,
    entity_id: entityId,
    label,
    snapshot: JSON.stringify(row),
    created_at: now(),
  })
}
