import { useCallback, useEffect, useState } from 'react'
import type { Ctx } from '../App'
import { api } from '../lib/api'
import type { PromptView, Shot } from '../lib/types'
import { Field, SectionHead, Empty, Tag, CopyButton } from '../components/ui'
import { EntityPicker } from '../components/EntityPicker'
import { Generations } from '../components/Generations'
import { Assistant } from '../components/Assistant'
import { References } from '../components/References'
import { VersionHistory } from '../components/VersionHistory'

const CAMERA: [string, string, string[]?][] = [
  ['shot_type', 'shot type', ['extreme wide', 'wide', 'medium wide', 'medium', 'medium close-up', 'close-up', 'extreme close-up', 'insert']],
  ['lens', 'lens', ['24mm', '35mm', '50mm', '85mm', '100mm macro']],
  ['camera_angle', 'angle', ['eye-level', 'low angle', 'high angle', 'overhead', 'dutch']],
  ['camera_height', 'height', ['ground', 'waist', 'eye', 'above head']],
  ['camera_movement', 'movement', ['static', 'slow push-in', 'slow pull-out', 'pan', 'tilt', 'handheld', 'tracking', 'crane']],
  ['framing', 'framing'],
  ['composition', 'composition'],
  ['depth_of_field', 'depth of field', ['deep', 'natural', 'shallow', 'very shallow']],
]

const LIGHT: [string, string, string[]?][] = [
  ['light_source', 'source', ['daylight', 'window light', 'firelight', 'practical lamp', 'overcast sky', 'candle']],
  ['light_direction', 'direction', ['front', 'side', 'back', 'top', 'three-quarter']],
  ['light_quality', 'quality', ['soft', 'hard', 'diffused', 'dappled']],
  ['color_temp', 'color temperature', ['warm', 'neutral', 'cool', 'mixed']],
  ['light_contrast', 'contrast', ['low', 'medium', 'high']],
]

export function PromptLabView({ ctx }: { ctx: Ctx }) {
  const { b, refresh, shotId, setShotId, go } = ctx
  const [pv, setPv] = useState<PromptView | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [tab, setTab] = useState<'shot' | 'camera' | 'light' | 'motion'>('shot')

  const shot = b.shots.find((s) => s.id === shotId) ?? null

  useEffect(() => {
    if (!shot && b.shots.length) setShotId(b.shots[0].id)
  }, [shot, b.shots, setShotId])

  const loadPrompt = useCallback(async () => {
    if (!shotId) { setPv(null); return }
    try { setPv(await api.prompt(shotId)) } catch { setPv(null) }
  }, [shotId])

  useEffect(() => { loadPrompt() }, [loadPrompt, b])

  const save = async (body: Record<string, unknown>) => {
    if (!shot) return
    await api.patchShot(shot.id, body)
    await refresh()
  }

  if (!b.shots.length) {
    return (
      <div className="page">
        <div className="pagehead"><div><h1>Prompt Lab</h1><div className="sub">Where every layer becomes one production prompt.</div></div></div>
        <div className="block grow">
          <Empty>
            no shots yet<br />
            <span className="tiny">create a scene, then a shot</span><br />
            <button style={{ marginTop: 14 }} onClick={() => go('scenes')}>go to scenes</button>
          </Empty>
        </div>
      </div>
    )
  }

  const scene = b.scenes.find((s) => s.id === shot?.scene_id)

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <h1>Shot {String(shot?.number ?? 0).padStart(2, '0')} <span className="dim" style={{ fontSize: 14 }}>{shot?.title}</span></h1>
          <div className="sub">
            Scene {String(scene?.number ?? 0).padStart(2, '0')}{scene?.title ? ` — ${scene.title}` : ''}
            {' · '}inherits Visual DNA v{pv?.context.dnaVersion ?? b.dna?.version}
          </div>
        </div>
        <div className="actions">
          <select value={shotId ?? ''} onChange={(e) => setShotId(e.target.value)} style={{ width: 240 }}>
            {b.shots.map((s) => (
              <option key={s.id} value={s.id}>
                {String(s.number).padStart(2, '0')} · {s.title || 'untitled'}
              </option>
            ))}
          </select>
          <button onClick={() => go('board', { scene: shot?.scene_id })}>board</button>
        </div>
      </div>

      <div className="pagebody">
        {/* -------------------------- shot definition -------------------------- */}
        <div className="side wide">
          <div className="segbar" style={{ marginBottom: 12 }}>
            {(['shot', 'camera', 'light', 'motion'] as const).map((t) => (
              <button key={t} className={tab === t ? 'primary' : ''} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>

          {shot && tab === 'shot' && (
            <>
              <Field label="title" value={shot.title} onCommit={(v) => save({ title: v })} placeholder="Grandfather adjusts the still" />
              <div className="fieldrow two">
                <Field label="duration" value={shot.duration} onCommit={(v) => save({ duration: v })} placeholder="4s" />
                <Field label="time of day" value={shot.time_of_day} onCommit={(v) => save({ time_of_day: v })} />
              </div>
              <Field label="purpose" rows={2} value={shot.purpose} onCommit={(v) => save({ purpose: v })} />
              <Field label="description" rows={5} value={shot.description} onCommit={(v) => save({ description: v })}
                placeholder="Traditional copper still inside a dim Goan distillery. Steam rises as an older man's hand adjusts the apparatus." />
              <div className="fieldrow two">
                <Field label="primary subject" value={shot.subject_primary} onCommit={(v) => save({ subject_primary: v })} />
                <Field label="secondary" value={shot.subject_secondary} onCommit={(v) => save({ subject_secondary: v })} />
              </div>
              <Field label="action" rows={2} value={shot.action} onCommit={(v) => save({ action: v })} />
              <div className="fieldrow two">
                <Field label="expression" value={shot.expression} onCommit={(v) => save({ expression: v })} />
                <Field label="position" value={shot.position} onCommit={(v) => save({ position: v })} />
              </div>

              <SectionHead title="continuity" />
              <EntityPicker ctx={ctx} ownerType="shot" ownerId={shot.id} />

              <SectionHead title="references" />
              <References ctx={ctx} ownerType="shot" ownerId={shot.id} />
            </>
          )}

          {shot && tab === 'camera' && <Suggested shot={shot} rows={CAMERA} save={save} />}
          {shot && tab === 'light' && (
            <>
              <Suggested shot={shot} rows={LIGHT} save={save} />
              <SectionHead title="environment" />
              <div className="fieldrow two">
                <Field label="weather" value={shot.weather} onCommit={(v) => save({ weather: v })} />
                <Field label="atmosphere" value={shot.atmosphere} onCommit={(v) => save({ atmosphere: v })} />
              </div>
              <Field label="background" rows={2} value={shot.background} onCommit={(v) => save({ background: v })} />
            </>
          )}
          {shot && tab === 'motion' && (
            <>
              <Field label="subject motion" rows={2} value={shot.subject_motion} onCommit={(v) => save({ subject_motion: v })} />
              <Field label="camera motion" rows={2} value={shot.camera_motion} onCommit={(v) => save({ camera_motion: v })} />
              <Field label="environmental motion" rows={2} value={shot.env_motion} onCommit={(v) => save({ env_motion: v })} />
              <SectionHead title="emotion" />
              <div className="fieldrow three">
                <Field label="emotion" value={shot.emotion} onCommit={(v) => save({ emotion: v })} />
                <Field label="energy" value={shot.energy} onCommit={(v) => save({ energy: v })} />
                <Field label="pacing" value={shot.pacing} onCommit={(v) => save({ pacing: v })} />
              </div>
            </>
          )}
        </div>

        {/* ---------------------------- the prompt ----------------------------- */}
        <div className="main">
          <SectionHead title="final_prompt">
            {pv?.stored && <span className="pill">v{pv.stored.version}{pv.stored.hand_edited ? ' · edited' : ''}</span>}
            <CopyButton text={pv?.flat ?? ''} label="copy for higgsfield" />
            {editing ? (
              <>
                <button className="primary" onClick={async () => {
                  await api.savePrompt(shot!.id, { body: draft })
                  setEditing(false); await refresh(); await loadPrompt()
                }}>save edit</button>
                <button onClick={() => setEditing(false)}>cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => { setDraft(pv?.stored?.body ?? pv?.body ?? ''); setEditing(true) }}>edit</button>
                <button className="primary" onClick={async () => { await api.savePrompt(shot!.id); await refresh(); await loadPrompt() }}>
                  {pv?.stored ? 'regenerate' : 'generate'}
                </button>
              </>
            )}
          </SectionHead>

          {editing ? (
            <textarea className="promptout editing" rows={14} value={draft} onChange={(e) => setDraft(e.target.value)} />
          ) : (
            <div className="promptout">
              {(pv?.stored?.body ?? pv?.body) || <span className="dim">define the shot to build a prompt</span>}
              {(pv?.stored?.negative ?? pv?.negative) && (
                <div style={{ marginTop: 16, color: '#d79aa8', fontSize: 12 }}>
                  Avoid: {pv?.stored?.negative ?? pv?.negative}.
                </div>
              )}
            </div>
          )}

          {pv?.stored && pv.stored.body !== pv.body && (
            <div className="warnline v-warn" style={{ marginTop: 10 }}>
              <span className="dot" />
              The saved prompt differs from what the current layers would produce.
              Regenerate to pick up the newer Visual DNA, scene or continuity values.
            </div>
          )}

          {!!pv?.warnings.length && (
            <>
              <SectionHead title="continuity_check" count={pv.warnings.length} />
              {pv.warnings.map((w, i) => (
                <div key={i} className={`warnline v-${w.level}`}><span className="dot" />{w.text}</div>
              ))}
            </>
          )}

          <SectionHead title="why_this_prompt" />
          <div className="tiny dim" style={{ marginBottom: 8 }}>Every line below is a layer the prompt was built from, in order.</div>
          <div className="layerstack">
            {(pv?.layers ?? []).map((l) => (
              <div key={l.key} className={`layer${l.key === 'negative' ? ' neg' : ''}`}>
                <div className="lh"><span className="lk">{l.label}</span><span className="ls">{l.source}</span></div>
                <div className="lt">{l.text}</div>
              </div>
            ))}
            {!pv?.layers.length && <div className="layer"><div className="lt dim">nothing defined yet</div></div>}
          </div>

          {!!pv?.versions.length && (
            <>
              <SectionHead title="prompt_versions" count={pv.versions.length} />
              <ul className="glist">
                {pv.versions.map((v) => (
                  <li key={v.id} className={pv.stored?.id === v.id ? 'sel' : ''}
                    onClick={async () => { await api.restorePrompt(v.id); await refresh(); await loadPrompt() }}>
                    <span className="nm">v{v.version}{v.hand_edited ? ' · hand edited' : ''}</span>
                    <span className="meta">{new Date(v.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* --------------------------- generations ----------------------------- */}
        <div className="side">
          <SectionHead title="inherits" />
          <div className="inherit">
            <div className="i" style={{ ['--vc' as string]: 'var(--accent)' }}>
              <span className="nm">Visual DNA v{pv?.context.dnaVersion ?? '—'}</span><span className="src">global</span>
            </div>
            <div className="i" style={{ ['--vc' as string]: 'var(--accent-2)' }}>
              <span className="nm">Scene {String(pv?.context.sceneNumber ?? 0).padStart(2, '0')} DNA</span><span className="src">scene</span>
            </div>
            {pv?.context.characters.map((c) => (
              <div key={c.id} className="i" style={{ ['--vc' as string]: c.locked ? 'var(--warn)' : 'var(--accent)' }}>
                <span className="nm">{c.locked ? '🔒 ' : ''}{c.name}</span><span className="src">character</span>
              </div>
            ))}
            {pv?.context.locations.map((l) => (
              <div key={l.id} className="i" style={{ ['--vc' as string]: l.locked ? 'var(--warn)' : 'var(--accent)' }}>
                <span className="nm">{l.locked ? '🔒 ' : ''}{l.name}</span><span className="src">location</span>
              </div>
            ))}
            {pv?.context.props.map((p) => (
              <div key={p.id} className="i" style={{ ['--vc' as string]: p.locked ? 'var(--warn)' : 'var(--accent)' }}>
                <span className="nm">{p.locked ? '🔒 ' : ''}{p.name}</span><span className="src">prop</span>
              </div>
            ))}
          </div>

          <SectionHead title="status" />
          <div className="segbar">
            {(['draft', 'ready', 'generating', 'selected'] as const).map((s) => (
              <button key={s} className={shot?.status === s ? 'primary' : ''} onClick={() => save({ status: s })}>{s}</button>
            ))}
          </div>

          <SectionHead title="higgsfield" />
          <div className="tiny dim" style={{ lineHeight: 1.8, marginBottom: 10 }}>
            Copy the prompt → generate in Higgsfield → come back and attach the result below.
            FRAME tracks the versions; it does not generate video.
          </div>
          {shot && <Generations ctx={ctx} shot={shot} onChange={loadPrompt} />}

          {shot && (
            <>
              <SectionHead title="shot_actions" />
              <div className="segbar" style={{ flexWrap: 'wrap' }}>
                <button onClick={async () => { await api.duplicateShot(shot.id); await refresh() }}>duplicate</button>
                <button onClick={async () => { await api.splitShot(shot.id); await refresh() }}
                  title="Split into two shots, carrying continuity across">split</button>
                <button className="danger" onClick={async () => { await api.deleteShot(shot.id); setShotId(null); await refresh() }}>delete</button>
              </div>

              <VersionHistory type="shot" entityId={shot.id} onRestored={async () => { await refresh(); await loadPrompt() }} />

              <Assistant shot={shot} onApply={async (fields) => { await save(fields); await loadPrompt() }} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Suggested({
  shot, rows, save,
}: { shot: Shot; rows: [string, string, string[]?][]; save: (b: Record<string, unknown>) => void }) {
  return (
    <>
      {rows.map(([key, label, opts]) => (
        <div key={key}>
          <Field label={label} value={String((shot as unknown as Record<string, string>)[key] ?? '')}
            onCommit={(v) => save({ [key]: v })} />
          {opts && (
            <div className="linkrow" style={{ marginTop: -8, marginBottom: 14 }}>
              {opts.map((o) => (
                <span key={o}
                  className={`chip${String((shot as unknown as Record<string, string>)[key] ?? '') === o ? ' on' : ''}`}
                  onClick={() => save({ [key]: o })}>{o}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  )
}
