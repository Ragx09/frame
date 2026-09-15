import { useEffect } from 'react'
import type { Ctx } from '../App'
import { api } from '../lib/api'
import { Field, Select, SectionHead, Empty, Tag } from '../components/ui'
import { EntityPicker } from '../components/EntityPicker'
import { References } from '../components/References'
import { VersionHistory } from '../components/VersionHistory'

const DNA_FIELDS: [string, string, number, string?][] = [
  ['color', 'color', 2, 'dark copper tones'],
  ['lighting', 'lighting', 2, 'firelight, low window light'],
  ['contrast', 'contrast', 2, 'deeper shadows'],
  ['texture', 'texture', 2, ''],
  ['camera', 'camera', 2, ''],
  ['atmosphere', 'atmosphere', 2, 'steam, quiet'],
]

export function ScenesView({ ctx }: { ctx: Ctx }) {
  const { b, refresh, sceneId, setSceneId, go } = ctx
  const scenes = b.scenes

  useEffect(() => {
    if (!scenes.find((s) => s.id === sceneId)) setSceneId(scenes[0]?.id ?? null)
  }, [scenes, sceneId, setSceneId])

  const scene = scenes.find((s) => s.id === sceneId)
  const dna = b.sceneDna.find((d) => d.scene_id === sceneId)
  const shots = b.shots.filter((s) => s.scene_id === sceneId)

  const add = async () => {
    const created = await api.addScene(b.project.id, { title: 'New scene' }) as { id: string }
    await refresh()
    setSceneId(created.id)
  }

  const save = async (body: Record<string, unknown>) => {
    if (!scene) return
    await api.patchScene(scene.id, body); await refresh()
  }
  const saveDna = async (body: Record<string, unknown>) => {
    if (!scene) return
    await api.patchSceneDna(scene.id, body); await refresh()
  }

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <h1>Scenes</h1>
          <div className="sub">Each scene may extend the global visual language — it never silently replaces it.</div>
        </div>
        <div className="actions"><button className="primary" onClick={add}>+ scene</button></div>
      </div>

      <div className="pagebody">
        <div className="side" style={{ width: 268 }}>
          <SectionHead title="scenes" count={scenes.length} />
          {scenes.length === 0 ? <Empty>no scenes yet</Empty> : (
            <ul className="glist">
              {scenes.map((s) => {
                const n = b.shots.filter((x) => x.scene_id === s.id).length
                return (
                  <li key={s.id} className={s.id === sceneId ? 'sel' : ''} onClick={() => setSceneId(s.id)}>
                    <span className="nm">{String(s.number).padStart(2, '0')} · {s.title || 'untitled'}</span>
                    <span className="meta">{n} shot{n === 1 ? '' : 's'}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="main">
          {!scene ? <Empty>create a scene to begin breaking the film down</Empty> : (
            <>
              <SectionHead title={`scene_${String(scene.number).padStart(2, '0')}`}>
                <button onClick={() => go('board', { scene: scene.id })}>open in board</button>
                <button className="danger ghost" onClick={async () => { await api.deleteScene(scene.id); setSceneId(null); await refresh() }}>delete</button>
              </SectionHead>

              <Field label="title" value={scene.title} onCommit={(v) => save({ title: v })} placeholder="The Distillery" />
              <div className="fieldrow three">
                <Select label="location" value={scene.location_id ?? ''}
                  onCommit={(v) => save({ location_id: v || null })}
                  options={b.locations.map((l) => ({ value: l.id, label: l.name || 'untitled' }))} />
                <Field label="time" value={scene.time_of_day} onCommit={(v) => save({ time_of_day: v })} placeholder="early morning" />
                <Field label="duration" value={scene.duration} onCommit={(v) => save({ duration: v })} placeholder="20s" />
              </div>
              {!scene.location_id && (
                <Field label="location (free text)" value={scene.location_text}
                  onCommit={(v) => save({ location_text: v })}
                  placeholder="Traditional Goan distillery" />
              )}

              <div className="fieldrow two">
                <Field label="story purpose" rows={3} value={scene.story_purpose} onCommit={(v) => save({ story_purpose: v })}
                  placeholder="Reveal the craftsmanship behind the spirit." />
                <Field label="emotional purpose" rows={3} value={scene.emotional_purpose} onCommit={(v) => save({ emotional_purpose: v })}
                  placeholder="Mystery + intimacy" />
              </div>
              <Field label="description" rows={5} value={scene.description} onCommit={(v) => save({ description: v })} />

              <SectionHead title="scene_dna">
                <div className="segbar auto">
                  <button className={dna?.mode !== 'override' ? 'primary' : ''} onClick={() => saveDna({ mode: 'extend' })}>extend global</button>
                  <button className={dna?.mode === 'override' ? 'primary' : ''} onClick={() => saveDna({ mode: 'override' })}>override</button>
                </div>
              </SectionHead>
              <div className="tiny dim" style={{ marginBottom: 10, lineHeight: 1.7 }}>
                {dna?.mode === 'override'
                  ? <>This scene <span className="bright">replaces</span> the global palette, contrast and texture. Film character and lighting philosophy still carry through.</>
                  : <>This scene <span className="bright">adds to</span> Visual DNA v{b.dna?.version ?? 1}. Leave a field empty to inherit it unchanged.</>}
              </div>
              <div className="fieldrow two">
                {DNA_FIELDS.map(([key, label, rows, ph]) => (
                  <Field key={key} label={label} rows={rows} placeholder={ph}
                    value={String((dna as unknown as Record<string, string>)?.[key] ?? '')}
                    onCommit={(v) => saveDna({ [key]: v })} />
                ))}
              </div>
              <Field label="notes" rows={3} value={dna?.notes ?? ''} onCommit={(v) => saveDna({ notes: v })} />
            </>
          )}
        </div>

        {scene && (
          <div className="side">
            <SectionHead title="in_this_scene" />
            <EntityPicker ctx={ctx} ownerType="scene" ownerId={scene.id} />

            <SectionHead title="shots" count={shots.length}>
              <button onClick={async () => { await api.addShot(scene.id); await refresh() }}>+ shot</button>
            </SectionHead>
            {shots.length === 0 ? <Empty>no shots yet</Empty> : (
              <ul className="glist">
                {shots.map((s) => (
                  <li key={s.id} className={`v-${s.status}`} onClick={() => go('prompt', { scene: scene.id, shot: s.id })}>
                    <span className="nm">{String(s.number).padStart(2, '0')} · {s.title || 'untitled'}</span>
                    <Tag kind={s.status}>{s.status}</Tag>
                  </li>
                ))}
              </ul>
            )}

            <SectionHead title="references" />
            <References ctx={ctx} ownerType="scene" ownerId={scene.id} />

            <VersionHistory type="scene" entityId={scene.id} onRestored={refresh} />

            <SectionHead title="inherits" />
            <div className="inherit">
              <div className="i" style={{ ['--vc' as string]: 'var(--accent)' }}>
                <span className="nm">Visual DNA v{b.dna?.version ?? 1}</span><span className="src">global</span>
              </div>
              {b.vision?.tone && (
                <div className="i" style={{ ['--vc' as string]: 'var(--accent-2)' }}>
                  <span className="nm">{b.vision.tone}</span><span className="src">tone</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
