import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, onSaveState, type SaveState } from './lib/api'
import type { Bundle, ID, Project } from './lib/types'
import { Modal } from './components/ui'
import { CommandPalette } from './components/CommandPalette'
import { Settings } from './components/Settings'
import { HomeView } from './views/Home'
import { IdeaView } from './views/Idea'
import { StoryView } from './views/Story'
import { ScriptView } from './views/Script'
import { VisionView } from './views/Vision'
import { VisualDnaView } from './views/VisualDna'
import { WorldView } from './views/World'
import { ScenesView } from './views/Scenes'
import { ShotBoardView } from './views/ShotBoard'
import { PromptLabView } from './views/PromptLab'
import { ExportView } from './views/Export'

export type ViewId =
  | 'home' | 'idea' | 'story' | 'script' | 'vision' | 'dna'
  | 'characters' | 'locations' | 'props'
  | 'scenes' | 'board' | 'prompt' | 'export'

export interface Ctx {
  b: Bundle
  refresh: () => Promise<void>
  go: (v: ViewId, opts?: { scene?: ID; shot?: ID }) => void
  sceneId: ID | null
  shotId: ID | null
  setSceneId: (id: ID | null) => void
  setShotId: (id: ID | null) => void
  provider: string
}

const NAV: { group: string; items: { id: ViewId; label: string }[] }[] = [
  { group: 'project', items: [
    { id: 'home', label: 'Overview' },
    { id: 'idea', label: 'Idea' },
    { id: 'story', label: 'Story' },
    { id: 'script', label: 'Script' },
    { id: 'vision', label: "Director's Vision" },
    { id: 'dna', label: 'Visual DNA' },
  ] },
  { group: 'world', items: [
    { id: 'characters', label: 'Characters' },
    { id: 'locations', label: 'Locations' },
    { id: 'props', label: 'Props' },
  ] },
  { group: 'production', items: [
    { id: 'scenes', label: 'Scenes' },
    { id: 'board', label: 'Shot Board' },
    { id: 'prompt', label: 'Prompt Lab' },
    { id: 'export', label: 'Export' },
  ] },
]

export default function App() {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [projectId, setProjectId] = useState<ID | null>(null)
  const [b, setB] = useState<Bundle | null>(null)
  const [view, setView] = useState<ViewId>('home')
  const [sceneId, setSceneId] = useState<ID | null>(null)
  const [shotId, setShotId] = useState<ID | null>(null)
  const [save, setSave] = useState<SaveState>('idle')
  const [meta, setMeta] = useState<{ provider: string; keyState?: string; model?: string }>({ provider: '…' })
  const [settings, setSettings] = useState(false)
  const [palette, setPalette] = useState(false)
  const [newProject, setNewProject] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => { const off = onSaveState(setSave); return () => { off() } }, [])
  const loadMeta = useCallback(() => { api.meta().then(setMeta).catch(() => setMeta({ provider: 'offline' })) }, [])
  useEffect(() => { loadMeta() }, [loadMeta])

  useEffect(() => {
    api.projects().then((ps) => {
      setProjects(ps)
      const last = localStorage.getItem('frame.project')
      const pick = ps.find((p) => p.id === last) ?? ps[0]
      if (pick) setProjectId(pick.id)
    })
  }, [])

  const refresh = useCallback(async () => {
    if (!projectId) return
    setB(await api.bundle(projectId))
  }, [projectId])

  useEffect(() => {
    if (!projectId) { setB(null); return }
    localStorage.setItem('frame.project', projectId)
    refresh()
  }, [projectId, refresh])

  const go = useCallback((v: ViewId, opts?: { scene?: ID; shot?: ID }) => {
    if (opts?.scene !== undefined) setSceneId(opts.scene)
    if (opts?.shot !== undefined) setShotId(opts.shot)
    setView(v)
  }, [])

  /* ------------------------- keyboard ------------------------- */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = /input|textarea|select/i.test(t?.tagName ?? '') || t?.isContentEditable
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); return }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); return } // autosaved
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'v') go('dna')
      else if (k === 'p') go('prompt')
      else if (k === 's') go('scenes')
      else if (k === 'b') go('board')
      else if (k === 'i') go('idea')
      else if (k === '?') setPalette(true)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [go])

  const counts = useMemo(() => {
    if (!b) return { scenes: 0, shots: 0, prompts: 0 }
    return { scenes: b.scenes.length, shots: b.shots.length, prompts: b.prompts.length }
  }, [b])

  const createProject = async () => {
    const p = await api.createProject(newName || 'Untitled Film')
    setProjects((ps) => [p, ...(ps ?? [])])
    setProjectId(p.id)
    setNewProject(false)
    setNewName('')
    setView('idea')
  }

  const ctx: Ctx | null = b ? { b, refresh, go, sceneId, shotId, setSceneId, setShotId, provider: meta.provider } : null

  const crumbs = useMemo(() => {
    if (!b) return []
    const out: string[] = [b.project.name]
    const nav = NAV.flatMap((g) => g.items).find((i) => i.id === view)
    if (nav && view !== 'home') out.push(nav.label)
    const sc = b.scenes.find((s) => s.id === sceneId)
    if (sc && (view === 'board' || view === 'prompt' || view === 'scenes'))
      out.push(`Scene ${String(sc.number).padStart(2, '0')}${sc.title ? ` — ${sc.title}` : ''}`)
    const sh = b.shots.find((s) => s.id === shotId)
    if (sh && (view === 'board' || view === 'prompt')) out.push(`Shot ${String(sh.number).padStart(2, '0')}`)
    return out
  }, [b, view, sceneId, shotId])

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <span className="blk">█</span> FRAME<span className="sep">::</span>
          {view.toUpperCase()} <span className="cursor">_</span>
        </div>
        <div className="crumbs">
          {crumbs.map((c, i) => (
            <span key={i} style={{ display: 'contents' }}>
              {i > 0 && <span className="arrow">→</span>}
              <span className={`c${i === crumbs.length - 1 ? ' last' : ''}`}>{c}</span>
            </span>
          ))}
        </div>
        <div className="spacer" />
        <div className="counters">
          <span><span className="k">scenes</span><span className="v">{counts.scenes}</span></span>
          <span><span className="k">shots</span><span className="v">{counts.shots}</span></span>
          <span><span className="k">prompts</span><span className="v">{counts.prompts}</span></span>
          <span><span className="k">ai</span><span className="v">{meta.provider}</span></span>
        </div>
        <button className="ghost" onClick={() => setPalette(true)}>⌘K</button>
        <button className="ghost" onClick={() => setSettings(true)}>settings</button>
        <div className={`savestate ${save}`}>
          {save === 'saving' ? 'saving…' : save === 'saved' ? 'saved' : save === 'error' ? 'error' : ''}
        </div>
      </div>

      <div className="shell">
        <div className="sidebar">
          <div className="navgroup">
            <div className="label" style={{ padding: '0 14px 6px' }}>film</div>
            <select
              value={projectId ?? ''}
              onChange={(e) => e.target.value === '__new' ? setNewProject(true) : setProjectId(e.target.value)}
              style={{ width: 'calc(100% - 20px)', margin: '0 10px 4px' }}
            >
              {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="__new">+ new film…</option>
            </select>
          </div>
          {NAV.map((g) => (
            <div className="navgroup" key={g.group}>
              <div className="label">{g.group}</div>
              {g.items.map((it) => (
                <div
                  key={it.id}
                  className={`navitem${view === it.id ? ' active' : ''}`}
                  onClick={() => go(it.id)}
                >
                  <span className="n">{it.label}</span>
                  <span className="badge">{badgeFor(it.id, b)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="workspace">
          {!ctx ? (
            <div className="block grow" style={{ display: 'grid', placeItems: 'center' }}>
              <div className="empty">
                {projects === null ? 'loading…' : (
                  <>
                    no film yet<br />
                    <button className="primary" style={{ marginTop: 14 }} onClick={() => setNewProject(true)}>create a film</button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <Router view={view} ctx={ctx} />
          )}
        </div>
      </div>

      {settings && <Settings meta={meta} onClose={() => setSettings(false)} onChanged={loadMeta} />}

      {palette && ctx && <CommandPalette ctx={ctx} nav={NAV} onClose={() => setPalette(false)} />}

      {newProject && (
        <Modal
          title="new film"
          onClose={() => setNewProject(false)}
          footer={<>
            <button onClick={() => setNewProject(false)}>cancel</button>
            <button className="primary" onClick={createProject}>create</button>
          </>}
        >
          <div className="field">
            <div className="label"><span>working title</span></div>
            <input
              autoFocus value={newName} placeholder="The Spirit Remembers"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createProject() }}
            />
          </div>
          <div className="tiny dim">You can rename it any time. Everything is stored locally.</div>
        </Modal>
      )}
    </>
  )
}

function Router({ view, ctx }: { view: ViewId; ctx: Ctx }) {
  switch (view) {
    case 'home': return <HomeView ctx={ctx} />
    case 'idea': return <IdeaView ctx={ctx} />
    case 'story': return <StoryView ctx={ctx} />
    case 'script': return <ScriptView ctx={ctx} />
    case 'vision': return <VisionView ctx={ctx} />
    case 'dna': return <VisualDnaView ctx={ctx} />
    case 'characters': return <WorldView ctx={ctx} kind="characters" />
    case 'locations': return <WorldView ctx={ctx} kind="locations" />
    case 'props': return <WorldView ctx={ctx} kind="props" />
    case 'scenes': return <ScenesView ctx={ctx} />
    case 'board': return <ShotBoardView ctx={ctx} />
    case 'prompt': return <PromptLabView ctx={ctx} />
    case 'export': return <ExportView ctx={ctx} />
  }
}

function badgeFor(id: ViewId, b: Bundle | null) {
  if (!b) return ''
  const filled = (o: object | null, keys: string[]) =>
    o ? keys.some((k) => String((o as Record<string, unknown>)[k] ?? '').trim()) : false
  switch (id) {
    case 'idea': return b.idea?.raw_text?.trim() ? '✓' : ''
    case 'story': return filled(b.story, ['premise', 'logline', 'beginning']) ? '✓' : ''
    case 'script': return b.script.length ? String(b.script.length) : ''
    case 'vision': return filled(b.vision, ['genre', 'tone', 'camera_philosophy']) ? '✓' : ''
    case 'dna': return b.dna ? `v${b.dna.version}` : ''
    case 'characters': return b.characters.length || ''
    case 'locations': return b.locations.length || ''
    case 'props': return b.props.length || ''
    case 'scenes': return b.scenes.length || ''
    case 'board': return b.shots.length || ''
    case 'prompt': return b.prompts.length ? `${b.prompts.length}/${b.shots.length}` : ''
    default: return ''
  }
}
