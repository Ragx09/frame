import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Ctx } from '../App'
import { api } from '../lib/api'
import { SectionHead, Empty, CopyButton } from '../components/ui'

const GROUPS = [
  { id: 'all', label: 'production package', match: () => true },
  { id: 'prompts', label: 'all prompts', match: (p: string) => p.startsWith('prompts/') },
  { id: 'story', label: 'screenplay + story', match: (p: string) => p.startsWith('story/') },
  { id: 'visual', label: 'visual', match: (p: string) => p.startsWith('visual/') },
  { id: 'world', label: 'world bible', match: (p: string) => p.startsWith('world/') },
  { id: 'scenes', label: 'scenes + shots', match: (p: string) => p.startsWith('scenes/') },
]

export function ExportView({ ctx }: { ctx: Ctx }) {
  const { b } = ctx
  const [files, setFiles] = useState<Record<string, string> | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [group, setGroup] = useState('all')

  const load = useCallback(async () => {
    const res = await api.exportProject(b.project.id)
    setFiles(res.files)
    setSel((s) => s ?? Object.keys(res.files)[0] ?? null)
  }, [b.project.id])

  useEffect(() => { load() }, [load])

  const matcher = GROUPS.find((g) => g.id === group)!.match
  const paths = useMemo(
    () => Object.keys(files ?? {}).filter(matcher).sort(),
    [files, matcher],
  )

  const download = () => {
    if (!files) return
    // A single readable bundle — no zip dependency, no server round-trip.
    const bundle = paths.map((p) => `${'='.repeat(70)}\nFILE: ${p}\n${'='.repeat(70)}\n\n${files[p]}`).join('\n\n')
    const blob = new Blob([bundle], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${slug(b.project.name)}-${group}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <h1>Export</h1>
          <div className="sub">The production package, exactly as it will sit on disk.</div>
        </div>
        <div className="actions">
          <button onClick={load}>rebuild</button>
          <button className="primary" onClick={download} disabled={!paths.length}>download {group}</button>
        </div>
      </div>

      <div className="pagebody">
        <div className="side">
          <SectionHead title="package" />
          <div className="segbar" style={{ flexDirection: 'column', marginBottom: 14 }}>
            {GROUPS.map((g) => (
              <button key={g.id} className={group === g.id ? 'primary' : ''} onClick={() => setGroup(g.id)}>{g.label}</button>
            ))}
          </div>

          <SectionHead title="files" count={paths.length} />
          {!files ? <div className="tiny dim">building…</div>
            : paths.length === 0 ? <Empty>nothing in this group yet</Empty> : (
              <div className="filetree">
                {paths.map((p) => (
                  <div key={p} className={`f${sel === p ? ' on' : ''}`} onClick={() => setSel(p)}>
                    <span className="p">{p}</span>
                    <span className="sz">{Math.max(1, Math.round((files[p]?.length ?? 0) / 100) / 10)}k</span>
                  </div>
                ))}
              </div>
            )}
        </div>

        <div className="main">
          <SectionHead title={sel ?? 'preview'}>
            {sel && files && <CopyButton text={files[sel]} />}
          </SectionHead>
          {sel && files ? (
            <div className="promptout" style={{ fontSize: 12, minHeight: 320 }}>{files[sel] || <span className="dim">(empty)</span>}</div>
          ) : <Empty>select a file</Empty>}

          <SectionHead title="handoff" />
          <div className="tiny dim" style={{ lineHeight: 1.9 }}>
            <span className="bright">prompts/</span> goes to Higgsfield — one file per shot, plus a combined list.<br />
            <span className="bright">scenes/</span> carries shot specs, durations and intended order for Palmier.<br />
            <span className="bright">world/</span> and <span className="bright">visual/</span> are the continuity record for the whole film.
          </div>
        </div>
      </div>
    </div>
  )
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'film'
