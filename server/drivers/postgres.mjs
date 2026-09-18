/**
 * Postgres driver — Supabase, for the beta deployment.
 *
 * The application's SQL is written once, in SQLite's dialect, because that is
 * what local development runs. Rather than fork every query, this driver
 * translates the two things that actually differ:
 *
 *   `?` placeholders   → `$1, $2, …`
 *   quoted identifiers → unchanged (the schema uses none)
 *
 * The Postgres schema deliberately keeps `locked`/`is_current` as INTEGER 0/1
 * rather than BOOLEAN, so the application's truthiness logic is identical on
 * both drivers and no route needs to know which one it is talking to.
 */
import pg from 'pg'
import { DATABASE_URL, isProd } from '../config.mjs'

/** Return NUMERIC as a JS number — the app treats `sort` as a float. */
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)))
/** Return BIGINT as a number; no count in this app approaches 2^53. */
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)))

/** `SELECT * FROM t WHERE a = ? AND b = ?` → `… a = $1 AND b = $2`. */
export function toPgPlaceholders(sql) {
  let n = 0
  let out = ''
  let quote = null
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i]
    if (quote) {
      out += c
      if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"') { quote = c; out += c; continue }
    out += c === '?' ? `$${++n}` : c
  }
  return out
}

export function createPostgresDriver() {
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX ?? 8),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Supabase terminates TLS with its own chain; managed hosts commonly need this.
    ssl: isProd ? { rejectUnauthorized: false } : undefined,
  })

  pool.on('error', (err) => {
    // An idle client died. Logged, never surfaced — the pool will replace it.
    console.error('[frame] pg pool error', err.message)
  })

  /** Within a transaction all queries must use the same client. */
  let current = null
  const exec = async (sql, params = []) => {
    const runner = current ?? pool
    return runner.query(toPgPlaceholders(sql), params)
  }

  return {
    dialect: 'postgres',

    async all(sql, params) { return (await exec(sql, params)).rows },
    async one(sql, params) { return (await exec(sql, params)).rows[0] ?? null },
    async run(sql, params) { await exec(sql, params); return undefined },
    async exec(sql) { await exec(sql, []) },

    async columns(table) {
      const { rows } = await exec(
        'SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ?',
        ['public', table],
      )
      return rows.map((r) => r.column_name)
    },

    async tx(fn) {
      if (current) return fn() // already inside one; join it
      const client = await pool.connect()
      current = client
      try {
        await client.query('BEGIN')
        const out = await fn()
        await client.query('COMMIT')
        return out
      } catch (err) {
        try { await client.query('ROLLBACK') } catch { /* connection already gone */ }
        throw err
      } finally {
        current = null
        client.release()
      }
    },

    async close() { await pool.end() },
  }
}
