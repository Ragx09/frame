import { useEffect, useRef, useState } from 'react'
import type { Ctx } from '../App'
import { api } from '../lib/api'
import type { Shot } from '../lib/types'
import { Empty, Tag } from '../components/ui'

const STATUSES = ['all', 'draft', 'ready', 'generating', 'selected'] as const

export function ShotBoardView({ ctx }: { ctx: Ctx }) {
  const { b, refresh, go, shotId, setShotId } = ctx
  const [filterScene, setFilterScene] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<(typeof STATUSES)[number]>('all')
  const [zoom, setZoom] = useState(186)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const thumbs = useRef<Record<string, string>>({})
  const [, force] = useState(0)

  // pull the selected generation's still for each shot, once
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (const g of b.generations.filter((x) => x.selected && x.media_mime)) {
        if (thumbs.current[g.shot_id]) continue
        const m = await api.generationMedia(g.id)
        if (cancelled) return
        if (m.media) { thumbs.current[g.shot_id] = m.media; force((n) => n + 1) }
      }
    })()
    return () => { cancelled = true }
  }, [b.generations])

  const scenes = b.scenes.filter((s) => filterScene === 'all' || s.id === filterScene)

  const drop = async (sceneId: string, targetId: string) => {
    if (!dragId || dragId === targetId) return
    const list = b.shots.filter((s) => s.scene_id === sceneId).map((s) => s.id)
    const from = list.indexOf(dragId)
    if (from >= 0) list.splice(from, 1)
    const to = list.indexOf(targetId)
    list.splice(to < 0 ? list.length : to, 0, dragId)
    setDragId(null); setOverId(null)
    await api.reorderShots(sceneId, list)
    await refresh()
  }

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <h1>Shot Board</h1>
          <div className="sub">The film as a sequence. Drag to reorder within a scene.</div>
        </div>
        <div className="actions">
          <select value={filterScene} onChange={(e) => setFilterScene(e.target.value)} style={{ width: 190 }}>
            <option value="all">all scenes</option>
            {b.scenes.map((s) => (
              <option key={s.id} value={s.id}>{String(s.number).padStart(2, '0')} · {s.title || 'untitled'}</option>
            ))}
          </select>
          <div className="segbar auto">
            {STATUSES.map((s) => (
              <button key={s} className={filterStatus === s ? 'primary' : ''} onClick={() => setFilterStatus(s)}>{s}</button>
            ))}
          </div>
          <button onClick={async () => { await api.renumber(b.project.id); await refresh() }}
            title="Renumber every shot to its current board order">renumber</button>
          <div className="segbar auto">
            <button onClick={() => setZoom((z) => Math.max(130, z - 40))}>−</button>
            <button onClick={() => setZoom((z) => Math.min(340, z + 40))}>+</button>
          </div>
        </div>
      </div>

      <div className="boardscroll">
        {!b.scenes.length && (
          <Empty>
            no scenes yet<br />
            <button style={{ marginTop: 14 }} onClick={() => go('scenes')}>create the first scene</button>
          </Empty>
        )}
        {scenes.map((sc) => {
          const shots = b.shots.filter((s) => s.scene_id === sc.id && (filterStatus === 'all' || s.status === filterStatus))
          return (
            <div className="sceneband" key={sc.id}>
              <div className="bandhead">
                <div className="heading">scene_{String(sc.number).padStart(2, '0')}</div>
                <span className="dim" style={{ fontSize: 12 }}>{sc.title}</span>
                <span className="pill">{shots.length}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <button onClick={() => go('scenes', { scene: sc.id })}>scene dna</button>
                  <button onClick={async () => { await api.addShot(sc.id); await refresh() }}>+ shot</button>
                </div>
              </div>
              {shots.length === 0 ? <div className="empty">no shots in this scene</div> : (
                <div className="shotgrid" style={{ ['--cardw' as string]: `${zoom}px` }}>
                  {shots.map((s) => (
                    <ShotCard
                      key={s.id} shot={s} thumb={thumbs.current[s.id]}
                      selected={s.id === shotId}
                      dragging={dragId === s.id} over={overId === s.id}
                      onDragStart={() => setDragId(s.id)}
                      onDragOver={() => setOverId(s.id)}
                      onDrop={() => drop(sc.id, s.id)}
                      onClick={() => { setShotId(s.id); }}
                      onOpen={() => go('prompt', { scene: sc.id, shot: s.id })}
                      onDuplicate={async () => { await api.duplicateShot(s.id); await refresh() }}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ShotCard({
  shot, thumb, selected, dragging, over, onDragStart, onDragOver, onDrop, onClick, onOpen, onDuplicate,
}: {
  shot: Shot; thumb?: string; selected: boolean; dragging: boolean; over: boolean
  onDragStart: () => void; onDragOver: () => void; onDrop: () => void
  onClick: () => void; onOpen: () => void; onDuplicate: () => void
}) {
  return (
    <div
      className={`shotcard${selected ? ' sel' : ''}${dragging ? ' drag' : ''}${over ? ' over' : ''}`}
      style={{ ['--vc' as string]: `var(--${statusColor(shot.status)})` }}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver() }}
      onDrop={(e) => { e.preventDefault(); onDrop() }}
      onClick={onClick}
      onDoubleClick={onOpen}
    >
      <div className="thumb">
        {thumb ? <img src={thumb} alt="" /> : 'NO FRAME'}
      </div>
      <div className="body">
        <div className="num">
          SHOT {String(shot.number).padStart(2, '0')}
          <span className="dot" style={{ marginLeft: 'auto', ['--vc' as string]: `var(--${statusColor(shot.status)})` }} />
        </div>
        <div className="ttl">{shot.title || <span className="dim">untitled</span>}</div>
        <div className="spec">
          {shot.duration && <Tag>{shot.duration}</Tag>}
          {shot.lens && <Tag>{shot.lens}</Tag>}
          {shot.camera_movement && <Tag>{shot.camera_movement}</Tag>}
        </div>
        <div className="segbar auto" style={{ marginTop: 8 }}>
          <button onClick={(e) => { e.stopPropagation(); onOpen() }} style={{ flex: 1 }}>open</button>
          <button onClick={(e) => { e.stopPropagation(); onDuplicate() }}>dup</button>
        </div>
      </div>
    </div>
  )
}

function statusColor(s: string) {
  return s === 'selected' ? 'accent' : s === 'ready' ? 'accent-2' : s === 'generating' ? 'warn' : 'fg-dim'
}
