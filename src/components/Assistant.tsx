import { useState } from 'react'
import { api } from '../lib/api'
import type { Shot } from '../lib/types'
import { SectionHead, Modal, Tag } from './ui'

export interface Conflict { entity: string; entityId: string; kind: string; field: string }

const PRESETS = [
  'Make this shot feel more intimate without changing the Visual DNA.',
  'The previous shot is very static — suggest a transition that leads into this one.',
  'What is missing from this shot for it to generate consistently?',
  'Is this shot doing the same job as the one before it?',
]

/**
 * The assistant always answers about the shot in front of you, with the whole
 * film in view. It suggests; it never writes into the project itself.
 */
export function Assistant({
  shot, onApply,
}: {
  shot: Shot
  onApply: (fields: Record<string, string>) => Promise<void>
}) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [context, setContext] = useState<string | null>(null)
  const [showContext, setShowContext] = useState(false)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [alts, setAlts] = useState<Record<string, string>[] | null>(null)

  const ask = async (question: string) => {
    if (!question.trim()) return
    setBusy(true); setNote(''); setAnswer(null); setConflicts([]); setAlts(null)
    try {
      const res = await api.askShot(shot.id, question)
      setContext(res.context)
      if (res.answer) { setAnswer(res.answer); setConflicts(res.conflicts ?? []) }
      else setNote(res.message ?? 'No model configured.')
    } catch (e) {
      setNote(String((e as Error).message))
    } finally {
      setBusy(false)
    }
  }

  const alternatives = async () => {
    setBusy(true); setNote(''); setAnswer(null); setAlts(null)
    try {
      const res = await api.shotAlternatives(shot.id)
      if (res.options) setAlts(res.options)
      else setNote(res.message ?? 'No model configured.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SectionHead title="assistant">
        {context && <button className="ghost" onClick={() => setShowContext(true)}>see context</button>}
      </SectionHead>

      <textarea
        rows={3} value={q} placeholder="Ask about this shot…"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ask(q) }}
      />
      <div className="segbar auto" style={{ margin: '6px 0 10px' }}>
        <button className="primary" disabled={busy || !q.trim()} onClick={() => ask(q)}>
          {busy ? 'thinking…' : 'ask'}
        </button>
        <button disabled={busy} onClick={alternatives}>3 camera alternatives</button>
      </div>

      <div className="linkrow" style={{ marginBottom: 10 }}>
        {PRESETS.map((p) => (
          <span key={p} className="chip" onClick={() => { setQ(p); ask(p) }}>{p.slice(0, 34)}…</span>
        ))}
      </div>

      {note && <div className="warnline v-warn"><span className="dot" />{note}</div>}

      {!!conflicts.length && (
        <div style={{ border: '1px solid var(--warn)', borderRadius: 2, marginBottom: 10 }}>
          <div className="label" style={{ padding: '6px 9px', borderBottom: '1px solid var(--line)', color: 'var(--warn)' }}>
            conflicts with a locked element
          </div>
          <div style={{ padding: '9px 10px' }}>
            {conflicts.map((c, i) => (
              <div key={i} className="tiny" style={{ marginBottom: 6, lineHeight: 1.6 }}>
                Locked: <span className="bright">{c.entity}</span> — {c.field}
                <br /><span className="dim">The suggestion above touches it. Nothing has been changed.</span>
              </div>
            ))}
            <div className="segbar auto" style={{ marginTop: 8 }}>
              <button className="primary" onClick={() => setConflicts([])}>keep locked</button>
              <button onClick={async () => {
                for (const c of conflicts) {
                  const table = c.kind === 'character' ? 'characters' : c.kind === 'location' ? 'locations' : 'props'
                  await api.patchEntity(table, c.entityId, { locked: 0, _force: true })
                }
                setConflicts([])
              }}>unlock</button>
            </div>
          </div>
        </div>
      )}

      {answer && (
        <div style={{
          background: 'var(--bg-raised)', border: '1px solid var(--line)', borderRadius: 2,
          padding: '10px 11px', fontSize: 11.5, lineHeight: 1.75, whiteSpace: 'pre-wrap',
        }}>
          {answer}
          <div className="tiny dim" style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
            A suggestion. Nothing in the project has changed.
          </div>
        </div>
      )}

      {alts && (
        <div style={{ marginTop: 4 }}>
          {alts.map((o, i) => (
            <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 2, marginBottom: 8 }}>
              <div style={{ padding: '7px 9px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['shot_type', 'lens', 'camera_angle', 'camera_movement'].map((k) => o[k] && <Tag key={k}>{o[k]}</Tag>)}
              </div>
              <div style={{ padding: '8px 10px', fontSize: 11, lineHeight: 1.6 }}>{o.why}</div>
              <div style={{ padding: '7px 9px', borderTop: '1px solid var(--line)' }}>
                <button onClick={() => onApply({
                  shot_type: o.shot_type ?? '', lens: o.lens ?? '',
                  camera_angle: o.camera_angle ?? '', camera_movement: o.camera_movement ?? '',
                  framing: o.framing ?? '',
                })}>apply to this shot</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showContext && context && (
        <Modal wide title="what_the_assistant_sees" onClose={() => setShowContext(false)}
          footer={<button onClick={() => setShowContext(false)}>close</button>}>
          <div className="tiny dim" style={{ marginBottom: 10 }}>
            This is the exact context assembled for this shot. It is built from your project, not invented.
          </div>
          <div style={{
            background: '#06090d', border: '1px solid var(--line)', padding: '10px 11px',
            fontSize: 11, lineHeight: 1.65, whiteSpace: 'pre-wrap', maxHeight: '48vh', overflow: 'auto',
          }}>{context}</div>
        </Modal>
      )}
    </>
  )
}
