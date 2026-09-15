import { useEffect, useMemo, useRef, useState } from 'react'
import type { Ctx, ViewId } from '../App'
import { api } from '../lib/api'

interface Cmd { id: string; label: string; group: string; run: () => void }

export function CommandPalette({
  ctx, nav, onClose,
}: {
  ctx: Ctx
  nav: { group: string; items: { id: ViewId; label: string }[] }[]
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const [found, setFound] = useState<Cmd[]>([])
  const searchTimer = useRef<number | undefined>(undefined)

  // full-text search runs on the server so it reaches prompt bodies and
  // descriptions, not just the names already in the bundle
  useEffect(() => {
    window.clearTimeout(searchTimer.current)
    const t = q.trim()
    if (t.length < 2) { setFound([]); return }
    searchTimer.current = window.setTimeout(async () => {
      const res = await api.search(ctx.b.project.id, t)
      setFound(res.results.map((r) => ({
        id: `find:${r.kind}:${r.id}`,
        label: r.label,
        group: `in ${r.where.toLowerCase()}`,
        run: () => {
          if (r.kind === 'shot' || r.kind === 'prompt') ctx.go('prompt', { scene: r.sceneId ?? undefined, shot: r.id })
          else if (r.kind === 'scene') ctx.go('scenes', { scene: r.id })
          else ctx.go((r.kind === 'character' ? 'characters' : r.kind === 'location' ? 'locations' : 'props') as ViewId)
        },
      })))
    }, 180)
    return () => window.clearTimeout(searchTimer.current)
  }, [q, ctx])

  const cmds = useMemo<Cmd[]>(() => {
    const out: Cmd[] = []
    for (const g of nav)
      for (const it of g.items)
        out.push({ id: `go:${it.id}`, label: it.label, group: g.group, run: () => ctx.go(it.id) })
    for (const sc of ctx.b.scenes)
      out.push({
        id: `scene:${sc.id}`,
        label: `Scene ${String(sc.number).padStart(2, '0')}${sc.title ? ` — ${sc.title}` : ''}`,
        group: 'scenes',
        run: () => ctx.go('scenes', { scene: sc.id }),
      })
    for (const sh of ctx.b.shots)
      out.push({
        id: `shot:${sh.id}`,
        label: `Shot ${String(sh.number).padStart(2, '0')}${sh.title ? ` — ${sh.title}` : ''}`,
        group: 'shots',
        run: () => ctx.go('prompt', { scene: sh.scene_id, shot: sh.id }),
      })
    for (const c of ctx.b.characters)
      out.push({ id: `char:${c.id}`, label: c.name || 'Untitled character', group: 'world', run: () => ctx.go('characters') })
    return out
  }, [ctx, nav])

  const hits = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return cmds.slice(0, 40)
    const direct = cmds.filter((c) => c.label.toLowerCase().includes(t) || c.group.includes(t))
    const seen = new Set(direct.map((c) => c.label))
    return [...direct, ...found.filter((f) => !seen.has(f.label))].slice(0, 40)
  }, [q, cmds, found])

  useEffect(() => setI(0), [q])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowDown') { e.preventDefault(); setI((n) => Math.min(n + 1, hits.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setI((n) => Math.max(n - 1, 0)) }
      else if (e.key === 'Enter') { hits[i]?.run(); onClose() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [hits, i, onClose])

  return (
    <div className="modalwrap" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="mh">
          <input autoFocus placeholder="jump to, or search the whole film…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="mb palette" style={{ padding: 6 }}>
          {hits.length === 0 && <div className="empty">nothing matches</div>}
          {hits.map((c, n) => (
            <div key={c.id} className={`pi${n === i ? ' on' : ''}`}
              onMouseEnter={() => setI(n)} onClick={() => { c.run(); onClose() }}>
              <span>{c.label}</span><span className="grp">{c.group}</span>
            </div>
          ))}
        </div>
        <div className="mf" style={{ justifyContent: 'flex-start' }}>
          <span className="tiny dim">
            <span className="kbd">↑↓</span> move · <span className="kbd">↵</span> open · <span className="kbd">esc</span> close
            &nbsp;·&nbsp; i idea · s scenes · b board · p prompt · v visual dna
          </span>
        </div>
      </div>
    </div>
  )
}
