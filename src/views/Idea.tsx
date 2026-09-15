import { useState } from 'react'
import type { Ctx } from '../App'
import { api } from '../lib/api'
import { Field, SectionHead, Empty, Tag } from '../components/ui'

export function IdeaView({ ctx }: { ctx: Ctx }) {
  const { b, refresh } = ctx
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const latest = b.development[0]

  const develop = async () => {
    setBusy(true); setErr('')
    try {
      await api.developIdea(b.project.id)
      await refresh()
    } catch (e) {
      setErr(String((e as Error).message))
    } finally {
      setBusy(false)
    }
  }

  const copyToStory = async (field: string, value: string) => {
    await api.patchStory(b.project.id, { [field]: value })
    await refresh()
  }

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <h1>Idea</h1>
          <div className="sub">Everything in your head, unstructured. Nothing here is ever overwritten.</div>
        </div>
        <div className="actions">
          <button className="primary" onClick={develop} disabled={busy}>
            {busy ? 'developing…' : 'develop idea'}
          </button>
        </div>
      </div>

      <div className="pagebody">
        <div className="main">
          <SectionHead title="original_idea" />
          <div className="tiny dim" style={{ marginBottom: 10 }}>
            Dump it raw — fragments, images, dialogue, references. The shape comes later.
          </div>
          <Field
            value={b.idea?.raw_text ?? ''}
            rows={22}
            placeholder={`I imagine an old Goan village at dawn.\nA grandfather is walking with his grandson.\nThere is something about a spirit being passed between generations.\nI want the film to feel ancient but not fantasy.\nMaybe we see a copper still.\nAt the end the spirit becomes the modern bottle.`}
            onCommit={async (v) => { await api.patchIdea(b.project.id, { raw_text: v }); await refresh() }}
          />
          {err && <div className="warnline v-error"><span className="dot" />{err}</div>}
        </div>

        <div className="side wide">
          <SectionHead title="ai_development" count={b.development.length} />
          {!latest ? (
            <Empty>
              nothing developed yet<br />
              <span className="tiny">write the idea, then press DEVELOP IDEA</span>
            </Empty>
          ) : (
            <>
              <div className="tiny dim" style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <Tag kind={latest.source === 'anthropic' ? 'selected' : 'info'}>{latest.source}</Tag>
                <span>{new Date(latest.created_at).toLocaleString()}</span>
              </div>
              {latest.source === 'structural' && (
                <div className="warnline v-warn" style={{ marginBottom: 12 }}>
                  <span className="dot" />
                  No model key configured, so this is a structural pass over your own words — segmentation and
                  extraction only, nothing authored. Set ANTHROPIC_API_KEY and restart to get a real development pass.
                </div>
              )}
              {DEV_FIELDS.map(([key, label, storyField]) => {
                const value = String((latest as unknown as Record<string, string>)[key] ?? '')
                if (!value.trim()) return null
                return (
                  <div className="field" key={key}>
                    <div className="label">
                      <span>{label}</span>
                      {storyField && (
                        <button className="ghost" style={{ marginLeft: 'auto', padding: '1px 6px' }}
                          onClick={() => copyToStory(storyField, value)}>→ story</button>
                      )}
                    </div>
                    <div style={{
                      background: 'var(--bg-raised)', border: '1px solid var(--line)', borderRadius: 2,
                      padding: '7px 9px', fontSize: 11.5, lineHeight: 1.65, whiteSpace: 'pre-wrap',
                      color: 'var(--fg)',
                    }}>{value}</div>
                  </div>
                )
              })}
              {b.development.length > 1 && (
                <div className="tiny dim" style={{ marginTop: 16 }}>
                  {b.development.length - 1} earlier development pass{b.development.length > 2 ? 'es' : ''} kept in history.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const DEV_FIELDS: [string, string, string?][] = [
  ['central_idea', 'central idea'],
  ['premise', 'premise', 'premise'],
  ['theme', 'theme', 'theme'],
  ['emotional_direction', 'emotional direction', 'emotional_journey'],
  ['conflict', 'possible conflict', 'conflict'],
  ['ending', 'possible ending', 'ending'],
  ['visual_motifs', 'visual motifs', 'visual_motifs'],
  ['questions', 'unanswered questions'],
]
