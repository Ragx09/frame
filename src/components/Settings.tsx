import { useState } from 'react'
import { Modal } from './ui'
import { api, type Meta } from '../lib/api'
import { clearByok, loadByok, saveByok, type ByokProvider } from '../lib/byok'

const PREFIX: Record<ByokProvider, string> = { anthropic: 'sk-ant-', openrouter: 'sk-or-' }
const CONSOLE: Record<ByokProvider, string> = { anthropic: 'console.anthropic.com', openrouter: 'openrouter.ai/keys' }

/**
 * The model connection. In the cloud beta a user can bring their own key,
 * held in this browser only (lib/byok.ts); in local development the key is
 * stored by the local server. Without either, hosted AI or the structural
 * fallback answers, and the UI says which.
 */
export function Settings({
  meta, onClose, onChanged, onSignOut,
}: {
  meta: Meta
  onClose: () => void
  onChanged: () => void
  onSignOut: () => void
}) {
  const cloud = meta.mode === 'cloud'
  const providers = meta.capability.byok.map((p) => p.id as ByokProvider)
  const [saved, setSaved] = useState(() => loadByok())
  const [provider, setProvider] = useState<ByokProvider>(saved?.provider ?? providers[0] ?? 'openrouter')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null)

  const status =
    meta.aiMode === 'byok' ? `your ${meta.provider} key`
    : meta.aiMode === 'hosted' ? `hosted · ${meta.model ?? meta.provider}`
    : meta.aiMode === 'local-key' ? `connected · ${meta.model ?? meta.provider}`
    : 'structural fallback'

  const failed = (err: unknown) =>
    setResult({ ok: false, error: err instanceof Error ? err.message : 'FRAME couldn’t verify that key.' })

  /* Cloud: verify with the provider, then keep it in this browser only. */
  const saveOwnKey = async () => {
    setBusy(true); setResult(null)
    try {
      const res = await api.verifyByok(provider, key.trim())
      if (res.ok) {
        const b = { provider, key: key.trim(), masked: res.masked ?? '••••', savedAt: new Date().toISOString() }
        saveByok(b); setSaved(b); setKey('')
        onChanged()
      }
      setResult({ ok: res.ok, error: res.error })
    } catch (err) { failed(err) } finally { setBusy(false) }
  }

  const removeOwnKey = () => { clearByok(); setSaved(null); setResult(null); onChanged() }

  /* Local development: the local server stores the key in data/settings.json. */
  const saveLocalKey = async (value: string) => {
    setBusy(true); setResult(null)
    try {
      const res = await api.setLocalKey(value)
      if (value) setResult({ ok: res.ok, error: res.error })
      setKey('')
      onChanged()
    } catch (err) { failed(err) } finally { setBusy(false) }
  }

  return (
    <Modal title="settings" onClose={onClose} footer={<>
      {meta.user && <button className="danger" onClick={onSignOut}>sign out</button>}
      <button onClick={onClose}>close</button>
    </>}>
      <div className="heading" style={{ marginBottom: 10 }}>assistant</div>
      <div className="inherit" style={{ marginBottom: 14 }}>
        <div className="i" style={{ ['--vc' as string]: meta.aiMode === 'structural' ? 'var(--warn)' : 'var(--accent)' }}>
          <span className="nm">{status}</span>
          <span className="src">
            {meta.aiMode === 'hosted' && meta.usage && meta.usage.limit
              ? `${meta.usage.remaining}/${meta.usage.limit} left today`
              : meta.aiMode === 'byok' ? 'no daily limit' : ''}
          </span>
        </div>
      </div>

      {cloud ? (
        <>
          <div className="tiny dim" style={{ lineHeight: 1.8, marginBottom: 14 }}>
            FRAME’s built-in AI is limited to <span className="bright">{meta.dailyLimit || 'a few'}</span> requests
            a day. Add your own key to remove the limit — requests are then billed to your account with that provider.
            <br /><br />
            Your key is kept <span className="bright">only in this browser</span>. It is sent with the requests that
            need it and never stored on FRAME’s server, logged, or included in exports. Sign in on another device
            and you’ll need to add it there too.
          </div>

          {saved ? (
            <div className="segbar auto" style={{ alignItems: 'center' }}>
              <span className="tiny">
                <span className="dim">{saved.provider} key</span> <span className="bright">{saved.masked}</span>
              </span>
              <button className="danger" onClick={removeOwnKey}>remove key</button>
            </div>
          ) : (
            <>
              <div className="segbar auto" style={{ marginBottom: 10 }}>
                {providers.map((p) => (
                  <button key={p} className={provider === p ? 'primary' : ''} onClick={() => { setProvider(p); setResult(null) }}>
                    {meta.capability.byok.find((x) => x.id === p)?.label ?? p}
                  </button>
                ))}
              </div>
              <div className="field">
                <div className="label"><span>{provider} api key</span><span className="dim">from {CONSOLE[provider]}</span></div>
                <input type="password" value={key} placeholder={`${PREFIX[provider]}…`} autoComplete="off"
                  onChange={(e) => setKey(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && key) saveOwnKey() }} />
              </div>
              <div className="segbar auto">
                <button className="primary" disabled={!key || busy} onClick={saveOwnKey}>{busy ? 'verifying…' : 'verify & save'}</button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="tiny dim" style={{ lineHeight: 1.8, marginBottom: 14 }}>
            Without a key, <span className="bright">develop idea</span> and the story rewrites run a local
            structural pass — they segment and extract from what you wrote, and never invent material.
            The prompt engine itself is fully deterministic and needs no model at all.
            <br /><br />
            A Claude Code or claude.ai subscription is not an API credential. This needs an
            Anthropic API key from <span className="bright">console.anthropic.com</span>, billed per token.
          </div>
          <div className="field">
            <div className="label"><span>anthropic api key</span></div>
            <input type="password" value={key} placeholder="sk-ant-…" autoComplete="off"
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && key) saveLocalKey(key) }} />
          </div>
          <div className="segbar auto">
            <button className="primary" disabled={!key || busy} onClick={() => saveLocalKey(key)}>{busy ? 'verifying…' : 'save & verify'}</button>
            {meta.capability.localKeyState === 'stored' && (
              <button className="danger" onClick={() => saveLocalKey('')}>remove stored key</button>
            )}
          </div>
          <div className="tiny dim" style={{ marginTop: 14 }}>
            Stored at <span className="bright">data/settings.json</span> in this project folder. Nothing leaves your machine
            except the API calls you trigger.
          </div>
        </>
      )}

      {result && (
        <div className={`warnline v-${result.ok ? 'selected' : 'error'}`} style={{ marginTop: 12 }}>
          <span className="dot" />
          {result.ok ? 'Key verified — the assistant is live.' : `Rejected: ${result.error}`}
        </div>
      )}
    </Modal>
  )
}
