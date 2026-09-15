import { useCallback, useEffect, useRef, useState } from 'react'
import type { Ctx } from '../App'
import { api } from '../lib/api'

const KINDS = ['character', 'location', 'composition', 'lighting', 'product', 'texture', 'style']

interface Ref { id: string; kind: string; filename: string; mime: string; data: string; note: string }

/** Reference images are inputs, never outputs — the UI keeps that distinction visible. */
export function References({ ctx, ownerType, ownerId }: { ctx: Ctx; ownerType: string; ownerId: string }) {
  const [refs, setRefs] = useState<Ref[] | null>(null)
  const [kind, setKind] = useState('composition')
  const file = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setRefs(await api.refs(ownerType, ownerId))
  }, [ownerType, ownerId])

  useEffect(() => { load() }, [load])

  const upload = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      const data: string = await new Promise((res) => {
        const r = new FileReader()
        r.onload = () => res(String(r.result))
        r.readAsDataURL(f)
      })
      await api.addRef({
        project_id: ctx.b.project.id, owner_type: ownerType, owner_id: ownerId,
        kind, filename: f.name, mime: f.type, data,
      })
    }
    await load()
  }

  return (
    <div>
      <div className="segbar auto" style={{ marginBottom: 8 }}>
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 130 }}>
          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <button onClick={() => file.current?.click()}>+ reference</button>
        <input ref={file} type="file" accept="image/*" multiple hidden
          onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
      </div>

      {refs === null ? <div className="tiny dim">loading…</div>
        : refs.length === 0 ? <div className="empty">no references attached</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 6 }}>
            {refs.map((r) => (
              <div key={r.id} style={{ border: '1px solid var(--line)', borderRadius: 2, overflow: 'hidden', background: 'var(--bg-raised)' }}>
                <div style={{ aspectRatio: '1', background: '#06090d' }}>
                  <img src={r.data} alt={r.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ padding: '3px 5px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="tiny dim" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.kind}</span>
                  <span className="tiny" style={{ cursor: 'pointer', color: 'var(--placeholder)' }}
                    onClick={async () => { await api.deleteRef(r.id); await load() }}>×</span>
                </div>
              </div>
            ))}
          </div>
        )}
      <div className="tiny dim" style={{ marginTop: 8, lineHeight: 1.6 }}>
        References are inputs you carry into Higgsfield. They are never treated as style transfer
        unless you choose that there.
      </div>
    </div>
  )
}
