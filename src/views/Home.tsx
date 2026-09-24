import { useState } from 'react'
import type { Ctx } from '../App'
import { api } from '../lib/api'
import { Field, Modal, SectionHead, Tag } from '../components/ui'

export function HomeView({ ctx }: { ctx: Ctx }) {
  const { b, refresh, go } = ctx
  const p = b.project
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const closeConfirm = () => { setConfirming(false); setTyped(''); setDeleteError('') }
  const remove = async () => {
    setDeleting(true); setDeleteError('')
    try {
      await ctx.deleteFilm(p.id)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'FRAME couldn’t delete the film. Please try again.')
      setDeleting(false)
    }
  }

  const done = (o: object | null, keys: string[]) =>
    !!o && keys.some((k) => String((o as Record<string, string>)[k] ?? '').trim())

  const stages: [string, boolean, number?, number?][] = [
    ['idea', !!b.idea?.raw_text?.trim()],
    ['story', done(b.story, ['premise', 'logline', 'beginning'])],
    ['script', b.script.length > 0],
    ['director', done(b.vision, ['genre', 'tone', 'camera_philosophy'])],
    ['visual dna', done(b.dna, ['film_character', 'color', 'lighting'])],
    ['scenes', b.scenes.length > 0, b.scenes.length, Math.max(b.scenes.length, 1)],
    ['shots', b.shots.length > 0, b.shots.length, Math.max(b.shots.length, 1)],
    ['prompts', b.prompts.length > 0, b.prompts.length, Math.max(b.shots.length, 1)],
  ]

  const current = b.shots.find((s) => s.status === 'ready' || s.status === 'draft') ?? b.shots[b.shots.length - 1]
  const currentScene = b.scenes.find((s) => s.id === current?.scene_id)
  const selected = b.generations.filter((g) => g.selected).length

  return (
    <div className="page">
      {confirming && (
        <Modal title="delete film" onClose={closeConfirm} footer={<>
          <button onClick={closeConfirm}>cancel</button>
          <button className="danger" disabled={deleting || typed.trim() !== p.name.trim()} onClick={remove}>
            {deleting ? 'deleting…' : 'delete forever'}
          </button>
        </>}>
          <div className="tiny" style={{ lineHeight: 1.8, marginBottom: 12 }}>
            This permanently deletes <span className="bright">{p.name}</span> and everything in it. Type the film’s
            title to confirm.
          </div>
          <div className="field">
            <input autoFocus value={typed} placeholder={p.name} onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && typed.trim() === p.name.trim() && !deleting) remove() }} />
          </div>
          {deleteError && <div className="warnline v-error"><span className="dot" />{deleteError}</div>}
        </Modal>
      )}
      <div className="home">
        <div>
          <div className="label" style={{ marginBottom: 8 }}>{p.status}</div>
          <div className="filmtitle">{p.name}</div>
          <div className="segbar auto" style={{ marginBottom: 4 }}>
            <Tag kind="ready">{p.format}</Tag>
            {b.dna && <Tag kind="selected">visual dna v{b.dna.version}</Tag>}
            <Tag>{selected} generation{selected === 1 ? '' : 's'} selected</Tag>
          </div>

          <div className="rule" />

          <SectionHead title="logline" />
          <Field rows={3} value={b.story?.logline || p.logline}
            placeholder="A spirit travels through generations of a Goan family, carrying the memory of a place and its craft."
            onCommit={async (v) => { await api.patchStory(p.id, { logline: v }); await refresh() }} />

          <SectionHead title="core_emotion" />
          <Field rows={2} value={p.core_emotion}
            placeholder="Nostalgia · Wonder · Pride"
            onCommit={async (v) => { await api.patchProject(p.id, { core_emotion: v }); await refresh() }} />

          <SectionHead title="currently_working_on" />
          {current ? (
            <div className="glist">
              <li className={`v-${current.status}`} onClick={() => go('prompt', { scene: current.scene_id, shot: current.id })}>
                <span className="nm">
                  Scene {String(currentScene?.number ?? 0).padStart(2, '0')}
                  {currentScene?.title ? ` — ${currentScene.title}` : ''} · Shot {String(current.number).padStart(2, '0')}
                </span>
                <Tag kind={current.status}>{current.status}</Tag>
              </li>
            </div>
          ) : (
            <div className="tiny dim">
              Nothing in production yet. Start at <span className="bright" style={{ cursor: 'pointer' }} onClick={() => go('idea')}>Idea</span>.
            </div>
          )}

          <SectionHead title="project" />
          <Field label="title" value={p.name} onCommit={async (v) => { await api.patchProject(p.id, { name: v }); await refresh() }} />
          <Field label="format" value={p.format} onCommit={async (v) => { await api.patchProject(p.id, { format: v }); await refresh() }} />
          <Field label="status" value={p.status} onCommit={async (v) => { await api.patchProject(p.id, { status: v }); await refresh() }} />

          {!p.is_demo && (
            <>
              <SectionHead title="danger_zone" />
              <div className="tiny dim" style={{ marginBottom: 10 }}>
                Deleting a film removes its story, script, world, scenes, shots and prompts. This can’t be undone.
              </div>
              <button className="danger" onClick={() => setConfirming(true)}>delete this film</button>
            </>
          )}
        </div>

        <div>
          <SectionHead title="progress" />
          <div className="progress">
            {stages.map(([name, ok, n, d]) => (
              <div className="prow" key={name} onClick={() => go(routeFor(name))} style={{ cursor: 'pointer' }}>
                <span className="pn">{name}</span>
                <span className="bar"><i style={{ width: `${n !== undefined ? Math.round((n / (d || 1)) * 100) : ok ? 100 : 0}%` }} /></span>
                <span className="pv">{n !== undefined ? `${n}/${d}` : ok ? '✓' : '—'}</span>
              </div>
            ))}
          </div>

          <SectionHead title="world" />
          <div className="inherit">
            {[['characters', b.characters.length], ['locations', b.locations.length], ['props', b.props.length]].map(([k, n]) => (
              <div className="i" key={k as string} style={{ ['--vc' as string]: n ? 'var(--accent)' : 'var(--fg-dim)', cursor: 'pointer' }}
                onClick={() => go(k as 'characters')}>
                <span className="nm">{k as string}</span><span className="src">{n as number}</span>
              </div>
            ))}
          </div>

          <SectionHead title="the_pipeline" />
          <div className="tiny dim" style={{ lineHeight: 2 }}>
            IDEA → STORY → SCRIPT → DIRECTOR'S VISION → VISUAL DNA → SCENES → SHOTS → PROMPTS
            <div style={{ marginTop: 8, color: 'var(--accent-2)' }}>→ HIGGSFIELD → PALMIER</div>
          </div>

          <SectionHead title="idea" />
          <div className="bigtext" style={{ fontSize: 12, maxHeight: 260, overflow: 'auto' }}>
            {b.idea?.raw_text?.trim() || <span className="dim">nothing written yet</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function routeFor(name: string) {
  const map: Record<string, string> = {
    idea: 'idea', story: 'story', script: 'script', director: 'vision',
    'visual dna': 'dna', scenes: 'scenes', shots: 'board', prompts: 'prompt',
  }
  return (map[name] ?? 'home') as Parameters<Ctx['go']>[0]
}
