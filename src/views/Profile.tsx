import { useEffect, useState } from 'react'
import type { Meta } from '../lib/api'
import type { ID, Project } from '../lib/types'
import { changePassword, currentProfile, signOut, updateDisplayName, type FrameProfile } from '../lib/session'
import { SectionHead, Tag } from '../components/ui'

/**
 * The signed-in account: who you are, your films, today's AI allowance, and
 * the account actions (password, sign out). Reached from the top bar and
 * independent of any open film, so it works before the first one exists.
 */
export function ProfileView({
  meta, projects, onOpenFilm, onNewFilm,
}: {
  meta: Meta
  projects: Project[] | null
  onOpenFilm: (id: ID) => void
  onNewFilm: () => void
}) {
  const [profile, setProfile] = useState<FrameProfile | null>(null)
  const [name, setName] = useState('')
  const [nameState, setNameState] = useState<'' | 'saving' | 'saved' | string>('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwState, setPwState] = useState<{ ok: boolean; msg: string } | null>(null)
  const [pwBusy, setPwBusy] = useState(false)

  useEffect(() => {
    currentProfile().then((p) => { setProfile(p); setName(p?.name ?? '') })
  }, [])

  const films = (projects ?? []).filter((p) => !p.is_demo)
  const usage = meta.usage
  const email = profile?.email ?? meta.user?.email ?? ''
  const shown = profile?.name || email.split('@')[0] || 'you'

  const saveName = async () => {
    if (!profile || name.trim() === profile.name) return
    setNameState('saving')
    const res = await updateDisplayName(name)
    if (!res.ok) { setNameState(res.error); return }
    setProfile({ ...profile, name: name.trim() })
    setNameState('saved')
    window.setTimeout(() => setNameState(''), 2200)
  }

  const savePassword = async () => {
    if (pw.length < 8) { setPwState({ ok: false, msg: 'Use at least 8 characters.' }); return }
    if (pw !== pw2) { setPwState({ ok: false, msg: 'The two passwords don’t match.' }); return }
    setPwBusy(true); setPwState(null)
    const res = await changePassword(pw)
    setPwBusy(false)
    setPwState(res.ok ? { ok: true, msg: 'Password changed.' } : { ok: false, msg: res.error })
    if (res.ok) { setPw(''); setPw2('') }
  }

  return (
    <div className="page">
      <div className="home">
        <div>
          <div className="profilehead">
            {profile?.avatar
              ? <img className="avatar" src={profile.avatar} alt="" referrerPolicy="no-referrer" />
              : <div className="avatar">{shown.charAt(0).toUpperCase()}</div>}
            <div>
              <div className="filmtitle" style={{ marginBottom: 4 }}>{shown}</div>
              <div className="segbar auto">
                <Tag kind="ready">{profile?.provider === 'google' ? 'google account' : 'email account'}</Tag>
                {profile?.createdAt && <Tag>member since {new Date(profile.createdAt).toLocaleDateString()}</Tag>}
              </div>
            </div>
          </div>

          <div className="rule" />

          <SectionHead title="account" />
          <div className="field">
            <div className="label"><span>display name</span>
              <span className="dim">{nameState === 'saving' ? 'saving…' : nameState === 'saved' ? 'saved' : ''}</span>
            </div>
            <input value={name} placeholder={email.split('@')[0]} disabled={!profile}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
            {nameState && nameState !== 'saving' && nameState !== 'saved' && (
              <div className="tiny" style={{ color: 'var(--error)', marginTop: 4 }}>{nameState}</div>
            )}
          </div>
          <div className="field">
            <div className="label"><span>email</span></div>
            <input value={email} disabled />
          </div>

          {profile && profile.provider === 'email' && (
            <>
              <SectionHead title="password" />
              <div className="field">
                <div className="label"><span>new password</span></div>
                <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
              </div>
              <div className="field">
                <div className="label"><span>confirm new password</span></div>
                <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') savePassword() }} />
              </div>
              <div className="segbar auto">
                <button className="primary" disabled={pwBusy || !pw || !pw2} onClick={savePassword}>
                  {pwBusy ? 'saving…' : 'change password'}
                </button>
              </div>
              {pwState && (
                <div className={`warnline v-${pwState.ok ? 'selected' : 'error'}`} style={{ marginTop: 12 }}>
                  <span className="dot" />{pwState.msg}
                </div>
              )}
            </>
          )}

          <SectionHead title="session" />
          <div className="tiny dim" style={{ marginBottom: 10 }}>Signed in as <span className="bright">{email}</span> on this browser.</div>
          <button className="danger" onClick={() => signOut()}>sign out</button>
        </div>

        <div>
          <SectionHead title="ai_today" />
          {usage ? (
            <div className="progress">
              <div className="prow">
                <span className="pn">hosted ai</span>
                <span className="bar"><i style={{ width: `${usage.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0}%` }} /></span>
                <span className="pv">{usage.limit ? `${usage.used}/${usage.limit}` : usage.used}</span>
              </div>
              <div className="tiny dim" style={{ marginTop: 8, lineHeight: 1.7 }}>
                {usage.limit
                  ? <>{usage.remaining} hosted AI request{usage.remaining === 1 ? '' : 's'} left today. Resets at 00:00 UTC.</>
                  : <>No daily limit on this deployment.</>}
              </div>
            </div>
          ) : (
            <div className="tiny dim">Usage isn’t tracked on this deployment.</div>
          )}

          <SectionHead title="your_films" count={films.length}>
            <button className="ghost" onClick={onNewFilm}>+ new film</button>
          </SectionHead>
          {projects === null ? (
            <div className="tiny dim">loading…</div>
          ) : films.length === 0 ? (
            <div className="tiny dim">No films yet. <span className="bright" style={{ cursor: 'pointer' }} onClick={onNewFilm}>Create your first one.</span></div>
          ) : (
            <div className="glist">
              {films.map((f) => (
                <li key={f.id} onClick={() => onOpenFilm(f.id)}>
                  <span className="nm">{f.name}</span>
                  <span className="tiny dim">edited {new Date(f.updated_at).toLocaleDateString()}</span>
                </li>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
