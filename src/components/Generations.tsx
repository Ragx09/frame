import { useRef, useState } from 'react'
import type { Ctx } from '../App'
import { api } from '../lib/api'
import type { Shot } from '../lib/types'
import { Field, Tag } from './ui'

const MODELS = ['Higgsfield', 'Higgsfield · image', 'Higgsfield · video', 'other']

/**
 * FRAME does not generate. It tracks what you generated elsewhere, so the
 * iteration history of a shot stays attached to the shot.
 */
export function Generations({ ctx, shot, onChange }: { ctx: Ctx; shot: Shot; onChange: () => void }) {
  const { b, refresh } = ctx
  const gens = b.generations.filter((g) => g.shot_id === shot.id)
  const [open, setOpen] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const [pendingFor, setPendingFor] = useState<string | null>(null)

  const add = async () => {
    await api.addGeneration(shot.id, { model: 'Higgsfield' })
    await refresh(); onChange()
  }

  const attach = async (id: string, files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    const data: string = await new Promise((res) => {
      const r = new FileReader()
      r.onload = () => res(String(r.result))
      r.readAsDataURL(f)
    })
    await api.patchGeneration(id, { media: data, media_mime: f.type, media_name: f.name })
    await refresh(); onChange()
  }

  return (
    <div>
      <div className="segbar auto" style={{ marginBottom: 8 }}>
        <button onClick={add}>+ generation</button>
      </div>
      {gens.length === 0 ? (
        <div className="empty">no generations attached</div>
      ) : (
        <ul className="glist">
          {gens.map((g) => (
            <li key={g.id} className={g.selected ? 'sel' : ''} style={{ display: 'block', cursor: 'default' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                onClick={() => setOpen(open === g.id ? null : g.id)}>
                <span className="nm" style={{ cursor: 'pointer' }}>
                  GEN {String(g.version).padStart(2, '0')} {g.selected ? '★' : ''}
                </span>
                <Tag kind={g.selected ? 'selected' : g.status === 'rejected' ? 'error' : 'draft'}>
                  {g.selected ? 'selected' : g.status}
                </Tag>
              </div>

              {open === g.id && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                  {g.media_mime && (
                    <MediaPreview id={g.id} mime={g.media_mime} />
                  )}
                  <div className="segbar auto" style={{ marginBottom: 8 }}>
                    <select value={g.model} onChange={async (e) => { await api.patchGeneration(g.id, { model: e.target.value }); await refresh() }}>
                      {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <button onClick={() => { setPendingFor(g.id); file.current?.click() }}>attach file</button>
                  </div>
                  <Field label="notes" rows={2} value={g.notes}
                    onCommit={async (v) => { await api.patchGeneration(g.id, { notes: v }); await refresh() }}
                    placeholder="Best facial consistency. Camera move slightly too fast." />
                  <div className="segbar" style={{ marginBottom: 8 }}>
                    <button className={g.selected ? 'primary' : ''}
                      onClick={async () => { await api.patchGeneration(g.id, { selected: 1, status: 'approved' }); await refresh(); onChange() }}>
                      select
                    </button>
                    <button className={g.status === 'rejected' ? 'primary' : ''}
                      onClick={async () => { await api.patchGeneration(g.id, { status: 'rejected', selected: 0 }); await refresh() }}>
                      reject
                    </button>
                    <button className="danger"
                      onClick={async () => { await api.deleteGeneration(g.id); setOpen(null); await refresh(); onChange() }}>
                      delete
                    </button>
                  </div>
                  {g.status === 'rejected' && (
                    <Field label="reason" rows={2} value={g.reason}
                      onCommit={async (v) => { await api.patchGeneration(g.id, { reason: v }); await refresh() }} />
                  )}
                  <div className="tiny dim">{new Date(g.created_at).toLocaleString()}</div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <input ref={file} type="file" accept="image/*,video/*" hidden
        onChange={(e) => { if (pendingFor) attach(pendingFor, e.target.files); e.target.value = ''; setPendingFor(null) }} />
    </div>
  )
}

function MediaPreview({ id, mime }: { id: string; mime: string }) {
  const [src, setSrc] = useState<string | null>(null)
  if (src === null) {
    api.generationMedia(id).then((m) => setSrc(m.media ?? ''))
    return <div className="tiny dim" style={{ marginBottom: 8 }}>loading media…</div>
  }
  if (!src) return null
  return (
    <div style={{ marginBottom: 8, border: '1px solid var(--line)', borderRadius: 2, overflow: 'hidden', background: '#06090d' }}>
      {mime.startsWith('video')
        ? <video src={src} controls style={{ width: '100%', display: 'block' }} />
        : <img src={src} alt="" style={{ width: '100%', display: 'block' }} />}
    </div>
  )
}
