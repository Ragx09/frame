import { useEffect, useState } from 'react'
import type { Meta } from '../lib/api'
import { api } from '../lib/api'
import { signIn, signInWithGoogle, signUp } from '../lib/session'

/**
 * The landing and sign-in screen (brief §13, §19).
 *
 * It is shown only by a cloud deployment, and only while nobody is signed in.
 * Local development never reaches it, so `npm run dev` still opens straight
 * into the workspace exactly as it did before the beta (§16).
 *
 * It is deliberately not a marketing site: one screen, the pipeline FRAME
 * covers, what FRAME is not, and the two ways in — try the demo, or sign up.
 */
const PIPELINE = [
  'IDEA', 'STORY', 'SCRIPT', "DIRECTOR'S VISION", 'VISUAL DNA', 'SCENES', 'SHOTS', 'PROMPTS',
]

export function SignIn({ meta, onSignedIn }: { meta: Meta; onSignedIn: () => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [demoId, setDemoId] = useState<string | null>(null)

  useEffect(() => { api.demo().then((d) => setDemoId(d.id)).catch(() => setDemoId(null)) }, [])

  /* Offer Google only when the Supabase project has the provider switched on;
     otherwise the button leads to Supabase's "provider is not enabled" page. */
  const [google, setGoogle] = useState(false)
  useEffect(() => {
    if (!meta.supabaseUrl || !meta.supabaseKey) return
    fetch(`${meta.supabaseUrl}/auth/v1/settings`, { headers: { apikey: meta.supabaseKey } })
      .then((r) => r.json())
      .then((s: { external?: { google?: boolean } }) => setGoogle(Boolean(s.external?.google)))
      .catch(() => setGoogle(false))
  }, [meta.supabaseUrl, meta.supabaseKey])

  const google_ = async () => {
    setError('')
    const res = await signInWithGoogle()
    if (!res.ok) setError(res.error)
  }

  const submit = async () => {
    if (!email || !password) return
    setBusy(true); setError(''); setNotice('')
    const res = mode === 'in'
      ? await signIn(email, password)
      : await signUp(email, password)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    if (mode === 'up' && 'needsConfirmation' in res && res.needsConfirmation) {
      setNotice('Check your email to confirm the account, then sign in.')
      setMode('in')
      return
    }
    onSignedIn()
  }

  return (
    <div className="landing">
      <div className="landing-inner">
        <div className="landing-mark">
          <span className="blk">█</span> FRAME<span className="betabadge">BETA</span>
        </div>

        <h1 className="landing-line">From idea to production-ready film blueprint.</h1>

        <div className="landing-pipe">
          {PIPELINE.map((step, i) => (
            <span key={step} className="pipe-step">
              {i > 0 && <span className="pipe-arrow">→</span>}
              <span className="pipe-name">{step}</span>
            </span>
          ))}
        </div>

        <p className="landing-note">
          FRAME does not generate video. It prepares the creative blueprint for your
          video generation workflow — and keeps it consistent from the first frame to the last.
        </p>

        <div className="landing-actions">
          {demoId && (
            <a className="landing-cta" href={`?demo=${demoId}`}>Try FRAME</a>
          )}
          <span className="landing-free">Beta — free to try</span>
        </div>

        <div className="landing-auth">
          <div className="heading" style={{ marginBottom: 12 }}>
            {mode === 'in' ? 'sign in' : 'create account'}
          </div>

          <div className="field">
            <div className="label"><span>email</span></div>
            <input
              type="email" value={email} autoComplete="email" placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            />
          </div>
          <div className="field">
            <div className="label"><span>password</span></div>
            <input
              type="password" value={password} placeholder="••••••••"
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            />
          </div>

          <div className="segbar auto">
            <button className="primary" disabled={busy || !email || !password} onClick={submit}>
              {busy ? 'working…' : mode === 'in' ? 'sign in' : 'create account'}
            </button>
            <button onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(''); setNotice('') }}>
              {mode === 'in' ? 'create account' : 'i have an account'}
            </button>
            {google && <button onClick={google_}>continue with google</button>}
          </div>

          {error && (
            <div className="warnline v-error" style={{ marginTop: 12 }}>
              <span className="dot" />{error}
            </div>
          )}
          {notice && (
            <div className="warnline v-selected" style={{ marginTop: 12 }}>
              <span className="dot" />{notice}
            </div>
          )}
        </div>

        <div className="tiny dim landing-foot">
          FRAME is currently in beta. Your feedback helps shape the product.
          {meta.hostedAI && ` Hosted AI is included, up to ${meta.dailyLimit} requests a day.`}
          {meta.feedbackUrl && (
            <> · <a href={meta.feedbackUrl} target="_blank" rel="noreferrer">Feedback</a></>
          )}
        </div>
      </div>
    </div>
  )
}
