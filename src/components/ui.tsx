import { useEffect, useRef, useState, type ReactNode } from 'react'

/* ------------------------------------------------------------------ */
/* Debounced text field — the autosave workhorse.                      */
/* ------------------------------------------------------------------ */
export function Field({
  label, value, onCommit, rows, placeholder, hint, locked, mono = true, delay = 500,
}: {
  label?: string
  value: string
  onCommit: (v: string) => void
  rows?: number
  placeholder?: string
  hint?: ReactNode
  locked?: boolean
  mono?: boolean
  delay?: number
}) {
  const [local, setLocal] = useState(value ?? '')
  const dirty = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!dirty.current) setLocal(value ?? '')
  }, [value])

  const change = (v: string) => {
    dirty.current = true
    setLocal(v)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      dirty.current = false
      if (v !== value) onCommit(v)
    }, delay)
  }

  const flush = () => {
    window.clearTimeout(timer.current)
    dirty.current = false
    if (local !== value) onCommit(local)
  }

  const common = {
    value: local,
    placeholder,
    disabled: locked,
    onChange: (e: { target: { value: string } }) => change(e.target.value),
    onBlur: flush,
    style: mono ? undefined : { fontSize: 13 },
  }

  return (
    <div className="field">
      {label && (
        <div className="label">
          <span>{label}</span>
          {hint ? <span className="hint">{hint}</span> : null}
        </div>
      )}
      {rows ? <textarea rows={rows} {...common} /> : <input {...common} />}
    </div>
  )
}

export function Select({
  label, value, onCommit, options, allowEmpty = true,
}: {
  label?: string
  value: string
  onCommit: (v: string) => void
  options: { value: string; label: string }[]
  allowEmpty?: boolean
}) {
  return (
    <div className="field">
      {label && <div className="label"><span>{label}</span></div>}
      <select value={value ?? ''} onChange={(e) => onCommit(e.target.value)}>
        {allowEmpty && <option value="">—</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

/* ------------------------------------------------------------------ */
export function SectionHead({ title, count, children }: { title: string; count?: number; children?: ReactNode }) {
  return (
    <div className="sectionhead">
      <div className="heading">{title}{count !== undefined && <span className="pill">{count}</span>}</div>
      {children && <div className="actions">{children}</div>}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="pill">{children}</span>
}

export function Tag({ kind, children }: { kind?: string; children: ReactNode }) {
  return <span className={`vtag v-${kind ?? 'info'}`}>{children}</span>
}

export function LockButton({ locked, onToggle, label = 'lock' }: { locked: boolean; onToggle: () => void; label?: string }) {
  return (
    <button className={locked ? 'ghost' : 'ghost'} onClick={onToggle} title={locked ? 'Unlock' : 'Lock as a creative constraint'}
      style={locked ? { color: 'var(--warn)', borderColor: 'var(--warn)' } : undefined}>
      {locked ? `🔒 ${label}ed` : `🔓 ${label}`}
    </button>
  )
}

/* ------------------------------------------------------------------ */
export function Modal({
  title, children, onClose, footer, wide,
}: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="modalwrap" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={wide ? { width: 'min(820px, 94vw)' } : undefined}>
        <div className="mh"><div className="heading">{title}</div></div>
        <div className="mb">{children}</div>
        {footer && <div className="mf">{footer}</div>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
export function CopyButton({ text, label = 'copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className={done ? 'primary' : ''}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          const ta = document.createElement('textarea')
          ta.value = text; document.body.appendChild(ta); ta.select()
          document.execCommand('copy'); ta.remove()
        }
        setDone(true)
        window.setTimeout(() => setDone(false), 1400)
      }}
    >{done ? 'copied ✓' : label}</button>
  )
}
