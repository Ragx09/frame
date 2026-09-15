import { useState } from 'react'
import type { Ctx } from '../App'
import { api } from '../lib/api'
import { Field, SectionHead, Modal, LockButton, Tag, CopyButton } from '../components/ui'
import { VersionHistory } from '../components/VersionHistory'

const FIELDS: [string, string, number, string?][] = [
  ['film_character', 'film / image character', 4, '35mm cinematic photography\norganic photographic imperfections\nnatural texture\nphotorealistic'],
  ['color', 'color', 4, 'Muted earth tones\nwarm highlights\nslightly cooler shadows\nrestrained saturation'],
  ['contrast', 'contrast', 3, 'Soft cinematic contrast\npreserved shadow detail\ngentle highlight rolloff'],
  ['texture', 'texture', 4, 'Fine organic film grain\nsubtle halation\nnatural skin texture'],
  ['lighting', 'lighting', 4, 'Natural motivated lighting\nsoft sunlight\npractical sources'],
  ['atmosphere', 'atmosphere', 3, 'Subtle coastal humidity\nlight atmospheric haze\nnatural depth'],
  ['camera', 'camera', 4, 'Large-format cinematic feel\n24mm environmental\n50mm character\n85mm intimate detail'],
  ['depth', 'depth', 3, 'Natural depth of field\nshallow focus when emotionally appropriate'],
  ['image_quality', 'image quality', 3, 'Photorealistic\ncinematic\norganic\nnot overly polished'],
]

export function VisualDnaView({ ctx }: { ctx: Ctx }) {
  const { b, refresh, go } = ctx
  const dna = b.dna
  const [impact, setImpact] = useState<{ count: number; shots: { id: string; number: number; title: string; scene_number: number }[] } | null>(null)
  const [showImpact, setShowImpact] = useState(false)
  const [pendingEdit, setPendingEdit] = useState<{ key: string; value: string } | null>(null)

  if (!dna) return <div className="page"><div className="block grow"><div className="empty">no visual dna</div></div></div>

  const get = (k: string) => String((dna as unknown as Record<string, string>)[k] ?? '')
  const affected = b.shots.length

  const commit = async (key: string, value: string) => {
    if (dna.locked) return
    // Editing in place when shots already inherit this DNA is a decision, not a keystroke.
    if (affected > 0 && get(key) !== value) { setPendingEdit({ key, value }); return }
    await api.patchDna(dna.id, { [key]: value })
    await refresh()
  }

  const applyInPlace = async () => {
    if (!pendingEdit) return
    await api.patchDna(dna.id, { [pendingEdit.key]: pendingEdit.value })
    setPendingEdit(null)
    await refresh()
  }

  const applyAsNewVersion = async () => {
    if (!pendingEdit) return
    await api.newDnaVersion(b.project.id, undefined, { [pendingEdit.key]: pendingEdit.value })
    setPendingEdit(null)
    await refresh()
  }

  const openImpact = async () => {
    setImpact(await api.dnaImpact(dna.id))
    setShowImpact(true)
  }

  const summary = FIELDS.map(([k]) => get(k)).filter(Boolean).join(', ').replace(/\n/g, ', ')

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <h1>Visual DNA <span className="pill" style={{ marginLeft: 8 }}>v{dna.version}</span></h1>
          <div className="sub">The global visual language of the film. Every shot inherits this.</div>
        </div>
        <div className="actions">
          <button onClick={openImpact}>{affected} shots affected</button>
          <LockButton locked={!!dna.locked} onToggle={async () => { await api.patchDna(dna.id, { locked: dna.locked ? 0 : 1, _force: true }); await refresh() }} />
          <button onClick={async () => { await api.newDnaVersion(b.project.id); await refresh() }}>new version</button>
        </div>
      </div>

      <div className="pagebody">
        <div className="main">
          <SectionHead title="visual_language" />
          <div className="fieldrow two">
            {FIELDS.map(([key, label, rows, placeholder]) => (
              <Field key={key} label={label} rows={rows} placeholder={placeholder}
                locked={!!dna.locked}
                value={get(key)} onCommit={(v) => commit(key, v)} />
            ))}
          </div>

          <SectionHead title="avoid" />
          <div className="tiny dim" style={{ marginBottom: 8 }}>
            These become the negative constraints on every generated prompt.
          </div>
          <Field rows={6} locked={!!dna.locked}
            placeholder={'Plastic skin\nCGI appearance\noversaturated colors\nHDR look\nexcessive sharpening\ngeneric AI faces'}
            value={get('avoid')} onCommit={(v) => commit('avoid', v)} />
        </div>

        <div className="side">
          <SectionHead title="versions" count={b.dnaVersions.length} />
          <ul className="glist">
            {b.dnaVersions.map((v) => (
              <li key={v.id} className={v.is_current ? 'sel' : ''}
                onClick={async () => { if (!v.is_current) { await api.activateDna(b.project.id, v.id); await refresh() } }}>
                <span className="nm">v{v.version} {v.label && <span className="dim">· {v.label}</span>}</span>
                {v.is_current ? <Tag kind="selected">current</Tag> : <span className="meta">restore</span>}
              </li>
            ))}
          </ul>
          <div className="tiny dim" style={{ marginTop: 6 }}>
            Older versions are never deleted. Switching version changes what new prompts inherit.
          </div>

          <VersionHistory type="visual_dna" entityId={dna.id} onRestored={refresh} title="edit_history" />

          <SectionHead title="inherited_string">
            <CopyButton text={summary} />
          </SectionHead>
          <div style={{
            background: '#06090d', border: '1px solid var(--line)', padding: '10px 11px',
            fontSize: 11, lineHeight: 1.7, color: 'var(--fg)', whiteSpace: 'pre-wrap', borderRadius: 2,
          }}>
            {summary || <span className="dim">nothing defined yet</span>}
          </div>
        </div>
      </div>

      {pendingEdit && (
        <Modal title="this_change_affects_existing_shots" onClose={() => setPendingEdit(null)}
          footer={<>
            <button onClick={() => setPendingEdit(null)}>cancel</button>
            <button onClick={applyInPlace}>apply to all {affected} shots</button>
            <button className="primary" onClick={applyAsNewVersion}>create v{dna.version + 1}</button>
          </>}>
          <div style={{ fontSize: 12, lineHeight: 1.8 }}>
            You are editing <span className="bright">{pendingEdit.key.replace(/_/g, ' ')}</span> on
            Visual DNA <span className="bright">v{dna.version}</span>, which
            <span className="bright"> {affected} shot{affected === 1 ? '' : 's'}</span> currently inherit.
            <div className="rule" />
            <div className="label" style={{ marginBottom: 5 }}>new value</div>
            <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', padding: '8px 10px', whiteSpace: 'pre-wrap', fontSize: 11.5 }}>
              {pendingEdit.value || <span className="dim">(cleared)</span>}
            </div>
            <div className="rule" />
            <span className="dim tiny">
              <b>Apply to all</b> rewrites what every existing shot inherits.
              <b> Create v{dna.version + 1}</b> keeps v{dna.version} intact and makes the new version current —
              prompts regenerated from now on use it.
            </span>
          </div>
        </Modal>
      )}

      {showImpact && impact && (
        <Modal title={`affected_shots — ${impact.count}`} onClose={() => setShowImpact(false)}
          footer={<button onClick={() => setShowImpact(false)}>close</button>}>
          {impact.count === 0 ? <div className="empty">no shots exist yet</div> : (
            <ul className="glist">
              {impact.shots.map((s) => (
                <li key={s.id} onClick={() => { setShowImpact(false); go('prompt', { shot: s.id }) }}>
                  <span className="nm">Shot {String(s.number).padStart(2, '0')} {s.title && <span className="dim">· {s.title}</span>}</span>
                  <span className="meta">scene {String(s.scene_number).padStart(2, '0')}</span>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  )
}
