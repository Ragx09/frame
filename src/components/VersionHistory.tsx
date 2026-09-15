import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { SectionHead, Empty, Modal } from './ui'

export interface VersionRow { id: string; label: string; created_at: string }
export interface DiffField { field: string; was: string; now: string }

/**
 * Snapshot / compare / restore for any versioned record. Restoring snapshots the
 * state it replaces first, so a restore is itself undoable.
 */
export function VersionHistory({
  type, entityId, onRestored, title = 'history',
}: {
  type: string
  entityId: string
  onRestored: () => Promise<void> | void
  title?: string
}) {
  const [rows, setRows] = useState<VersionRow[] | null>(null)
  const [diff, setDiff] = useState<{ version: VersionRow; fields: DiffField[] } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setRows(await api.versions(type, entityId))
  }, [type, entityId])

  useEffect(() => { load() }, [load])

  const snap = async () => {
    setBusy(true)
    await api.snapshot(type, entityId, new Date().toLocaleString())
    await load()
    setBusy(false)
  }

  return (
    <>
      <SectionHead title={title} count={rows?.length}>
        <button onClick={snap} disabled={busy}>save version</button>
      </SectionHead>

      {rows === null ? <div className="tiny dim">loading…</div>
        : rows.length === 0 ? (
          <Empty>
            no saved versions<br />
            <span className="tiny">save one before a big rewrite</span>
          </Empty>
        ) : (
          <ul className="glist">
            {rows.map((v) => (
              <li key={v.id} onClick={async () => setDiff(await api.compareVersion(v.id))}>
                <span className="nm">{v.label || 'unlabelled'}</span>
                <span className="meta">{new Date(v.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}

      {diff && (
        <Modal
          wide
          title={`compare — ${diff.version.label || 'version'}`}
          onClose={() => setDiff(null)}
          footer={<>
            <button className="danger ghost" onClick={async () => {
              await api.deleteVersion(diff.version.id); setDiff(null); await load()
            }}>delete version</button>
            <button onClick={() => setDiff(null)}>close</button>
            <button className="primary" disabled={!diff.fields.length} onClick={async () => {
              await api.restoreVersion(diff.version.id)
              setDiff(null); await load(); await onRestored()
            }}>restore this version</button>
          </>}
        >
          {diff.fields.length === 0 ? (
            <div className="empty">identical to what is on screen now</div>
          ) : (
            <>
              <div className="tiny dim" style={{ marginBottom: 12 }}>
                {diff.fields.length} field{diff.fields.length === 1 ? '' : 's'} differ.
                Restoring saves the current state as a version first, so this is undoable.
              </div>
              {diff.fields.map((f) => (
                <div key={f.field} style={{ marginBottom: 14 }}>
                  <div className="label" style={{ marginBottom: 5 }}>{f.field.replace(/_/g, ' ')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div className="tiny" style={{ color: 'var(--warn)', marginBottom: 3 }}>saved version</div>
                      <div style={diffBox}>{f.was || <span className="dim">(empty)</span>}</div>
                    </div>
                    <div>
                      <div className="tiny" style={{ color: 'var(--accent)', marginBottom: 3 }}>now</div>
                      <div style={diffBox}>{f.now || <span className="dim">(empty)</span>}</div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </Modal>
      )}
    </>
  )
}

const diffBox: React.CSSProperties = {
  background: 'var(--bg-raised)', border: '1px solid var(--line)', borderRadius: 2,
  padding: '7px 9px', fontSize: 11.5, lineHeight: 1.6, whiteSpace: 'pre-wrap',
  maxHeight: 180, overflow: 'auto',
}
