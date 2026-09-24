import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, onSaveState, type Meta, type SaveState } from './lib/api'
import { accessToken, configureAuth, onAuthChange, signOut } from './lib/session'
import { SignIn } from './components/SignIn'
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
import { ProfileView } from './views/Profile'

export type ViewId =
  | 'home' | 'idea' | 'story' | 'script' | 'vision' | 'dna'
  | 'characters' | 'locations' | 'props'
  | 'scenes' | 'board' | 'prompt' | 'export' | 'profile'

export interface Ctx {
  b: Bundle
  refresh: () => Promise<void>
  go: (v: ViewId, opts?: { scene?: ID; shot?: ID }) => void
  sceneId: ID | null
  shotId: ID | null
  setSceneId: (id: ID | null) => void
  setShotId: (id: ID | null) => void
  provider: string
  /** Delete a film for good and move to the next one. */
  deleteFilm: (id: ID) => Promise<void>
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
  const [meta, setMeta] = useState<Meta | null>(null)
  const [metaError, setMetaError] = useState('')
  const [settings, setSettings] = useState(false)
  const [palette, setPalette] = useState(false)
  const [newProject, setNewProject] = useState(false)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  /* `?demo=<id>` — the landing page's "Try FRAME" link. Readable signed out. */
  const demoParam = useMemo(() => new URLSearchParams(window.location.search).get('demo'), [])

  useEffect(() => { const off = onSaveState(setSave); return () => { off() } }, [])
  const loadMeta = useCallback(async () => {
    try {
      let m = await api.meta()
      // Which Supabase project to talk to is the server's to decide, so the
      // auth client is configured from /api/meta rather than at build time.
      configureAuth(m.supabaseUrl, m.supabaseKey)
      // The first call can go out before the client existed, so without the
      // stored session's token. Ask again now that it can be sent.
      if (m.mode === 'cloud' && !m.user && await accessToken()) m = await api.meta()
      setMeta(m)
      setMetaError('')
    } catch (err) {
      setMeta(null)
      setMetaError(err instanceof Error ? err.message : 'FRAME couldn’t reach its server.')
    }
  }, [])
  useEffect(() => { loadMeta() }, [loadMeta])

  /* Signing in or out changes who the API answers as — reload everything. */
  useEffect(() => onAuthChange(() => { loadMeta(); setProjectId(null) }), [loadMeta])

  const signedOut = meta?.mode === 'cloud' && !meta.user
  const needsSignIn = signedOut && !demoParam

  useEffect(() => {
    if (!meta || needsSignIn) return
    if (signedOut && demoParam) { setProjects([]); setProjectId(demoParam); return }
    api.projects().then((ps) => {
      setProjects(ps)
      const last = localStorage.getItem('frame.project')
      // Open the user's own film; the read-only demo only when asked for, so a
      // new account lands on "create a film" rather than an uneditable film.
      const pick = ps.find((p) => p.id === last)
        ?? ps.find((p) => !p.is_demo)
        ?? (demoParam ? ps.find((p) => p.id === demoParam) : undefined)
      setProjectId(pick?.id ?? null)
    }).catch(() => setProjects([]))
  }, [meta, needsSignIn, signedOut, demoParam])

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

  const openNewProject = () => {
    // Signed-out demo visitors have nowhere to save a film yet.
    if (signedOut) { window.location.href = window.location.pathname; return }
    setCreateError('')
    setNewProject(true)
  }

  const createProject = async () => {
    if (creating) return
    setCreating(true)
    setCreateError('')
    try {
      const p = await api.createProject(newName || 'Untitled Film')
      setProjects((ps) => [p, ...(ps ?? [])])
      setProjectId(p.id)
      setNewProject(false)
      setNewName('')
      setView('idea')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'FRAME couldn’t create the film. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const deleteFilm = useCallback(async (id: ID) => {
    await api.deleteProject(id)
    const rest = (projects ?? []).filter((p) => p.id !== id)
    setProjects(rest)
    try { if (localStorage.getItem('frame.project') === id) localStorage.removeItem('frame.project') } catch { /* storage unavailable */ }
    setProjectId(rest.find((p) => !p.is_demo)?.id ?? null)
    setView('home')
  }, [projects])

  const ctx: Ctx | null = b
    ? { b, refresh, go, sceneId, shotId, setSceneId, setShotId, provider: meta?.provider ?? '…', deleteFilm }
    : null

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

  /* Without /api/meta nothing else can load — say so rather than spin. */
  if (!meta && metaError) return (
    <div className="landing"><div className="landing-inner">
      <div className="warnline v-error"><span className="dot" />FRAME couldn’t reach its server: {metaError}</div>
      <button className="primary" style={{ marginTop: 14 }} onClick={() => loadMeta()}>try again</button>
    </div></div>
  )

  /* Cloud deployments gate on sign-in; local development never does (§16). */
  if (needsSignIn) return <SignIn meta={meta} onSignedIn={loadMeta} />

  const readOnly = Boolean(b?.project?.is_demo)

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <span className="blk">█</span> FRAME<span className="betabadge">BETA</span>
          <span className="sep">::</span>
          {view.toUpperCase()} <span className="cursor">_</span>
        </div>
        {readOnly && <span className="demoflag">demo · read-only</span>}
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
          <span><span className="k">ai</span><span className="v">{meta?.provider ?? '…'}</span></span>
        </div>
        <button className="ghost" title="Command palette — search and jump anywhere" onClick={() => setPalette(true)}>
          {/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl+K'}
        </button>
        <button className="ghost" onClick={() => setSettings(true)}>settings</button>
        {meta?.user && (
          <button className={`ghost who${view === 'profile' ? ' on' : ''}`} title={`Signed in as ${meta.user.email} — profile`}
            onClick={() => go('profile')}>
            {meta.user.email.split('@')[0]}
          </button>
        )}
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
              onChange={(e) => e.target.value === '__new' ? openNewProject() : setProjectId(e.target.value)}
              style={{ width: 'calc(100% - 20px)', margin: '0 10px 4px' }}
            >
              {!projectId && <option value="" disabled>choose a film…</option>}
              {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              {b && !(projects ?? []).some((p) => p.id === b.project.id) && (
                <option value={b.project.id}>{b.project.name}</option>
              )}
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
          {view === 'profile' && meta?.user ? (
            <ProfileView meta={meta} projects={projects}
              onOpenFilm={(id) => { setProjectId(id); setView('home') }}
              onNewFilm={openNewProject} />
          ) : !ctx ? (
            <div className="block grow" style={{ display: 'grid', placeItems: 'center' }}>
              <div className="empty">
                {projects === null ? 'loading…' : (
                  <>
                    no film yet<br />
                    <button className="primary" style={{ marginTop: 14 }} onClick={openNewProject}>create a film</button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <Router view={view} ctx={ctx} />
          )}
        </div>
      </div>

      {settings && meta && (
        <Settings meta={meta} onClose={() => setSettings(false)} onChanged={loadMeta} onSignOut={signOut} />
      )}

      {palette && ctx && <CommandPalette ctx={ctx} nav={NAV} onClose={() => setPalette(false)} />}

      {newProject && (
        <Modal
          title="new film"
          onClose={() => setNewProject(false)}
          footer={<>
            <button onClick={() => setNewProject(false)}>cancel</button>
            <button className="primary" disabled={creating} onClick={createProject}>{creating ? 'creating…' : 'create'}</button>
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
          {createError && <div className="tiny" style={{ color: 'var(--error)', marginBottom: 6 }}>{createError}</div>}
          <div className="tiny dim">You can rename it any time.</div>
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
