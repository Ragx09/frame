/**
 * SQLite driver — local development (brief §16).
 *
 * `node:sqlite` is synchronous by nature; the methods are declared `async` only
 * so that both drivers present one interface and the routes read the same
 * whichever is mounted. There is no thread hop and no measurable cost.
 */
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export function createSqliteDriver() {
  const dataDir = join(here, '..', '..', 'data')
  mkdirSync(dataDir, { recursive: true })

  const db = new DatabaseSync(join(dataDir, 'frame.db'))
  db.exec(readFileSync(join(here, '..', 'schema.sql'), 'utf8'))

  // idempotent additive migrations for databases created by an earlier schema
  for (const [table, col, type] of [
    ['idea_development', 'visual_motifs', 'TEXT'],
    ['projects', 'owner_id', 'TEXT'],
    ['projects', 'is_demo', 'INTEGER DEFAULT 0'],
  ]) {
    const has = db.prepare(`PRAGMA table_info(${table})`).all().some((r) => r.name === col)
    if (!has) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`)
  }

  return {
    dialect: 'sqlite',

    async all(sql, params) { return db.prepare(sql).all(...params) },
    async one(sql, params) { return db.prepare(sql).get(...params) ?? null },
    async run(sql, params) { db.prepare(sql).run(...params); return undefined },
    async exec(sql) { db.exec(sql) },

    async columns(table) {
      return db.prepare(`PRAGMA table_info(${table})`).all().map((r) => r.name)
    },

    /** node:sqlite is single-connection and synchronous, so a plain
     *  BEGIN/COMMIT around the callback is a real transaction. */
    async tx(fn) {
      db.exec('BEGIN')
      try {
        const out = await fn()
        db.exec('COMMIT')
        return out
      } catch (err) {
        try { db.exec('ROLLBACK') } catch { /* already rolled back */ }
        throw err
      }
    },

    async close() { db.close() },
  }
}
