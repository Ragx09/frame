import { useState } from 'react'
import { Modal } from './ui'

/**
 * The model connection. FRAME works fully without a key — every AI action then
 * falls back to a local structural pass, and the UI says so rather than pretending.
 */
export function Settings({
  meta, onClose, onChanged,
}: {
  meta: { provider: string; keyState?: string; model?: string }
  onClose: () => void
  onChanged: () => void
}) {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null)

  const submit = async () => {
    setBusy(true); setResult(null)
    const res = await fetch('/api/settings/key', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key }),
    }).then((r) => r.json())
    setBusy(false)
    setResult({ ok: res.ok, error: res.error })
    setKey('')
    onChanged()
  }

  return (
    <Modal title="settings" onClose={onClose} footer={<button onClick={onClose}>close</button>}>
      <div className="heading" style={{ marginBottom: 10 }}>assistant</div>
      <div className="inherit" style={{ marginBottom: 14 }}>
        <div className="i" style={{ ['--vc' as string]: meta.provider === 'anthropic' ? 'var(--accent)' : 'var(--warn)' }}>
          <span className="nm">{meta.provider === 'anthropic' ? `connected · ${meta.model}` : 'structural fallback'}</span>
          <span className="src">{meta.keyState === 'env' ? 'from environment' : meta.keyState === 'stored' ? 'stored locally' : 'no key'}</span>
        </div>
      </div>

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
          onKeyDown={(e) => { if (e.key === 'Enter' && key) submit() }} />
      </div>
      <div className="segbar auto">
        <button className="primary" disabled={!key || busy} onClick={submit}>{busy ? 'verifying…' : 'save & verify'}</button>
        {meta.keyState === 'stored' && (
          <button className="danger" onClick={async () => {
            await fetch('/api/settings/key', {
              method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: '' }),
            })
            setResult(null); onChanged()
          }}>remove stored key</button>
        )}
      </div>

      {result && (
        <div className={`warnline v-${result.ok ? 'selected' : 'error'}`} style={{ marginTop: 12 }}>
          <span className="dot" />
          {result.ok ? 'Key verified — the assistant is live.' : `Rejected: ${result.error}`}
        </div>
      )}

      <div className="tiny dim" style={{ marginTop: 14 }}>
        Stored at <span className="bright">data/settings.json</span> in this project folder. Nothing leaves your machine
        except the API calls you trigger.
      </div>
    </Modal>
  )
}
