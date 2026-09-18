import { useState, type ReactNode } from 'react'
import { Modal, Tag, Empty } from './ui'

export type Proposal = Record<string, unknown> & { entities?: string[] }

/**
 * Review surface for a story→scenes or scene→shots breakdown.
 *
 * Nothing proposed here exists yet. The director picks what survives and edits
 * it in place; only then is anything written. This is the same rule the rest of
 * FRAME follows — the model suggests, the director decides.
 */
export function BreakdownModal({
  title, noun, rows, source, message, fields, onApply, onClose,
}: {
  title: string
  noun: string
  rows: Proposal[]
  source: string
  message?: string | null
  /** [key, label] pairs shown as editable lines on each card. */
  fields: [string, string][]
  onApply: (rows: Proposal[]) => Promise<void>
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Proposal[]>(rows)
  const [keep, setKeep] = useState<boolean[]>(rows.map(() => true))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const chosen = draft.filter((_, i) => keep[i])

  const edit = (i: number, key: string, value: string) =>
    setDraft((d) => d.map((r, j) => (j === i ? { ...r, [key]: value } : r)))

  const apply = async () => {
    setBusy(true); setErr('')
    try {
      await onApply(chosen)
      onClose()
    } catch (e) {
      setErr(String((e as Error).message))
      setBusy(false)
    }
  }

  return (
    <Modal
      wide
      title={title}
      onClose={onClose}
      footer={
        <>
          <span className="tiny dim" style={{ marginRight: 'auto' }}>
            {chosen.length} of {draft.length} {noun}{chosen.length === 1 ? '' : 's'} will be created — nothing is written until you press create.
          </span>
          <button onClick={onClose}>discard</button>
          <button className="primary" disabled={busy || !chosen.length} onClick={apply}>
            {busy ? 'creating…' : `create ${chosen.length} ${noun}${chosen.length === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <div className="tiny dim" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <Tag kind={source === 'anthropic' ? 'selected' : 'info'}>{source}</Tag>
        <span>proposed, not saved</span>
      </div>
      {message && <div className="warnline v-warn" style={{ marginBottom: 12 }}><span className="dot" />{message}</div>}
      {err && <div className="warnline v-error" style={{ marginBottom: 12 }}><span className="dot" />{err}</div>}

      {!draft.length ? <Empty>nothing to propose from what is written so far</Empty> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {draft.map((row, i) => (
            <div
              key={i}
              style={{
                border: '1px solid var(--line)', borderRadius: 2, padding: '9px 11px',
                background: 'var(--bg-raised)', opacity: keep[i] ? 1 : 0.42,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <input
                  type="checkbox" checked={keep[i]}
                  onChange={() => setKeep((k) => k.map((v, j) => (j === i ? !v : v)))}
                />
                <span className="tiny dim">{noun}_{String(i + 1).padStart(2, '0')}</span>
                {(row.entities ?? []).map((n) => <Tag key={n}>{n}</Tag>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: '3px 10px', alignItems: 'start' }}>
                {fields.map(([key, label]) => {
                  const value = String(row[key] ?? '')
                  if (!value && key !== 'title') return null
                  const long = value.length > 70
                  return (
                    <Line key={key} label={label}>
                      {long ? (
                        <textarea
                          rows={3} value={value} disabled={!keep[i]}
                          onChange={(e) => edit(i, key, e.target.value)}
                        />
                      ) : (
                        <input
                          value={value} disabled={!keep[i]}
                          onChange={(e) => edit(i, key, e.target.value)}
                        />
                      )}
                    </Line>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

/** A label/control pair on the proposal card's two-column grid. */
function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div className="tiny dim" style={{ paddingTop: 5, textAlign: 'right' }}>{label}</div>
      <div>{children}</div>
    </>
  )
}
