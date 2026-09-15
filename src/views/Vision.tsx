import type { Ctx } from '../App'
import { api } from '../lib/api'
import { Field, SectionHead } from '../components/ui'
import { VersionHistory } from '../components/VersionHistory'

const GENRES = ['cinematic brand film', 'documentary', 'short film', 'music video', 'fashion film', 'experimental', 'narrative commercial']
const TONES = ['intimate', 'mysterious', 'nostalgic', 'surreal', 'grounded', 'luxurious', 'melancholic', 'reverent', 'playful']
const PACING = ['slow', 'contemplative', 'moderate', 'fast', 'escalating', 'mixed']

export function VisionView({ ctx }: { ctx: Ctx }) {
  const { b, refresh } = ctx
  const v = b.vision
  const save = async (body: Record<string, unknown>) => { await api.patchVision(b.project.id, body); await refresh() }
  const get = (k: string) => String((v as unknown as Record<string, string>)?.[k] ?? '')

  const toggleIn = (key: string, word: string) => {
    const cur = get(key).split(',').map((s) => s.trim()).filter(Boolean)
    const next = cur.includes(word) ? cur.filter((c) => c !== word) : [...cur, word]
    save({ [key]: next.join(', ') })
  }

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <h1>Director's Vision</h1>
          <div className="sub">How the film behaves — before a single frame is described.</div>
        </div>
      </div>

      <div className="pagebody">
        <div className="main">
          <SectionHead title="identity" />
          <Field label="genre" value={get('genre')} onCommit={(x) => save({ genre: x })} placeholder="cinematic brand film" />
          <div className="linkrow" style={{ marginTop: -8, marginBottom: 16 }}>
            {GENRES.map((g) => (
              <span key={g} className={`chip${get('genre').includes(g) ? ' on' : ''}`} onClick={() => save({ genre: g })}>{g}</span>
            ))}
          </div>

          <Field label="tone" value={get('tone')} onCommit={(x) => save({ tone: x })} placeholder="intimate, nostalgic" />
          <div className="linkrow" style={{ marginTop: -8, marginBottom: 16 }}>
            {TONES.map((t) => (
              <span key={t} className={`chip${get('tone').includes(t) ? ' on' : ''}`} onClick={() => toggleIn('tone', t)}>{t}</span>
            ))}
          </div>

          <Field label="emotional journey" rows={3} value={get('emotional_journey')}
            onCommit={(x) => save({ emotional_journey: x })}
            placeholder="Mystery → Curiosity → Nostalgia → Wonder → Pride" />

          <Field label="pacing" value={get('pacing')} onCommit={(x) => save({ pacing: x })} />
          <div className="linkrow" style={{ marginTop: -8, marginBottom: 16 }}>
            {PACING.map((p) => (
              <span key={p} className={`chip${get('pacing').includes(p) ? ' on' : ''}`} onClick={() => save({ pacing: p })}>{p}</span>
            ))}
          </div>

          <SectionHead title="direction" />
          <Field label="camera philosophy" rows={6} value={get('camera_philosophy')}
            onCommit={(x) => save({ camera_philosophy: x })}
            placeholder={'Slow deliberate movement.\nMostly observational.\nUse movement only when emotionally motivated.'} />
          <Field label="performance direction" rows={5} value={get('performance_direction')}
            onCommit={(x) => save({ performance_direction: x })}
            placeholder={'Understated. Natural.\nNo theatrical acting.\nSmall facial expressions.'} />
          <Field label="editing philosophy" rows={5} value={get('editing_philosophy')}
            onCommit={(x) => save({ editing_philosophy: x })}
            placeholder={'Slow cuts in the beginning.\nIncreasing pace toward the reveal.\nFinal product shot held longer.'} />
        </div>

        <div className="side">
          <SectionHead title="why_this_matters" />
          <div className="tiny dim" style={{ lineHeight: 1.85 }}>
            The Director's Vision is not exported into every prompt verbatim. It shapes the
            <span className="bright"> project rules </span> layer and gives the assistant the register to write in.
            <br /><br />
            Concrete visual language — grain, palette, contrast, lighting — belongs in
            <span className="bright"> Visual DNA</span>, which every shot inherits.
          </div>

          <VersionHistory type="director_vision" entityId={b.project.id} onRestored={refresh} />

          <SectionHead title="reads_as" />
          <div className="inherit">
            {[['genre', get('genre')], ['tone', get('tone')], ['pacing', get('pacing')]].map(([k, val]) => (
              <div className="i" key={k} style={{ ['--vc' as string]: val ? 'var(--accent)' : 'var(--fg-dim)' }}>
                <span className="nm">{val || <span className="dim">not set</span>}</span>
                <span className="src">{k}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
