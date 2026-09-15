import { useState } from 'react'
import type { Ctx } from '../App'
import { api } from '../lib/api'
import { Field, SectionHead } from '../components/ui'
import { VersionHistory } from '../components/VersionHistory'

const SECTIONS: { key: keyof StoryFields; label: string; rows: number; placeholder?: string }[] = [
  { key: 'premise', label: 'premise', rows: 4, placeholder: 'What the film is, in a few sentences.' },
  { key: 'logline', label: 'logline', rows: 3, placeholder: 'One sentence. Who, what, and what is at stake.' },
  { key: 'beginning', label: 'beginning', rows: 6 },
  { key: 'middle', label: 'middle', rows: 6 },
  { key: 'ending', label: 'ending', rows: 6 },
  { key: 'characters', label: 'characters', rows: 5 },
  { key: 'conflict', label: 'conflict', rows: 4 },
  { key: 'theme', label: 'theme', rows: 3 },
  { key: 'emotional_journey', label: 'emotional journey', rows: 3, placeholder: 'Mystery → Curiosity → Nostalgia → Wonder → Pride' },
  { key: 'message', label: 'message / meaning', rows: 3 },
  { key: 'visual_motifs', label: 'visual motifs', rows: 4, placeholder: 'copper, dawn light, coconut palms, steam, the bottle' },
]

type StoryFields =
  Pick<NonNullable<Ctx['b']['story']>,
    'premise' | 'logline' | 'beginning' | 'middle' | 'ending' | 'characters' |
    'conflict' | 'theme' | 'emotional_journey' | 'message' | 'visual_motifs'>

const MOVES = [
  ['expand', 'Expand this. Keep the director’s voice; add specificity, not adjectives.'],
  ['shorten', 'Tighten this to its essentials without losing meaning.'],
  ['more emotional', 'Make this land more emotionally, staying grounded and unsentimental.'],
  ['more grounded', 'Make this more grounded and concrete. Remove abstraction.'],
  ['more cinematic', 'Rewrite this so it describes what the camera would actually see.'],
] as const

export function StoryView({ ctx }: { ctx: Ctx }) {
  const { b, refresh } = ctx
  const story = b.story
  const [active, setActive] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<{ key: string; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const save = async (key: string, v: string) => {
    await api.patchStory(b.project.id, { [key]: v })
    await refresh()
  }

  const suggest = async (key: string, instruction: string) => {
    const current = String((story as unknown as Record<string, string>)?.[key] ?? '')
    if (!current.trim()) { setNote('Nothing to rewrite in that section yet.'); return }
    setBusy(true); setNote('')
    const res = await api.rewrite(current, instruction, contextFor(b))
    setBusy(false)
    if (!res.text) { setNote(res.message ?? 'No model configured.'); return }
    setSuggestion({ key, text: res.text })
  }

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <h1>Story</h1>
          <div className="sub">The idea becomes a narrative. Every field is yours — the assistant only suggests.</div>
        </div>
      </div>

      <div className="pagebody">
        <div className="main">
          {SECTIONS.map((s) => (
            <div key={s.key} onFocus={() => setActive(s.key)}>
              <Field
                label={s.label}
                rows={s.rows}
                placeholder={s.placeholder}
                value={String((story as unknown as Record<string, string>)?.[s.key] ?? '')}
                onCommit={(v) => save(s.key, v)}
                hint={active === s.key ? <span className="dim">editing</span> : undefined}
              />
              {suggestion?.key === s.key && (
                <div style={{ marginTop: -6, marginBottom: 16, border: '1px solid var(--accent)', borderRadius: 2 }}>
                  <div style={{ padding: '6px 9px', borderBottom: '1px solid var(--line)' }} className="label">suggestion — not applied</div>
                  <div style={{ padding: '9px 10px', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{suggestion.text}</div>
                  <div style={{ padding: '7px 9px', display: 'flex', gap: 6, borderTop: '1px solid var(--line)' }}>
                    <button className="primary" onClick={async () => { await save(s.key, suggestion.text); setSuggestion(null) }}>accept</button>
                    <button onClick={() => setSuggestion(null)}>reject</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="side">
          <SectionHead title="section_moves" />
          <div className="tiny dim" style={{ marginBottom: 10 }}>
            Applies to: <span className="bright">{active ?? 'select a field'}</span>
          </div>
          <div className="segbar" style={{ flexDirection: 'column' }}>
            {MOVES.map(([label, instruction]) => (
              <button key={label} disabled={!active || busy} onClick={() => suggest(active!, instruction)}>
                {busy ? 'thinking…' : label}
              </button>
            ))}
          </div>
          {note && <div className="warnline v-warn" style={{ marginTop: 12 }}><span className="dot" />{note}</div>}

          <VersionHistory type="story" entityId={b.project.id} onRestored={refresh} />

          <SectionHead title="from_the_idea" />
          {b.development[0] ? (
            <div className="tiny dim" style={{ lineHeight: 1.8 }}>
              A development pass exists on the Idea page. Use its <span className="bright">→ story</span> buttons
              to pull fields across without losing the original.
            </div>
          ) : (
            <div className="tiny dim">No idea development yet.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function contextFor(b: Ctx['b']) {
  return [
    `FILM: ${b.project.name}`,
    b.story?.logline && `LOGLINE: ${b.story.logline}`,
    b.vision?.tone && `TONE: ${b.vision.tone}`,
    b.vision?.genre && `GENRE: ${b.vision.genre}`,
  ].filter(Boolean).join('\n')
}
