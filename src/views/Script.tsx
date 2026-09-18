import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Ctx } from '../App'
import { api } from '../lib/api'
import { SectionHead, Empty } from '../components/ui'
import { VersionHistory } from '../components/VersionHistory'

type ElType = 'scene_heading' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition' | 'note'
interface El { id: string; type: ElType; text: string }

const TYPES: ElType[] = ['scene_heading', 'action', 'character', 'dialogue', 'parenthetical', 'transition', 'note']
const LABEL: Record<ElType, string> = {
  scene_heading: 'scene', action: 'action', character: 'character', dialogue: 'dialogue',
  parenthetical: 'paren', transition: 'transition', note: 'note',
}

/** What pressing Enter gives you next — screenplay muscle memory. */
const NEXT: Record<ElType, ElType> = {
  scene_heading: 'action', action: 'action', character: 'dialogue',
  dialogue: 'action', parenthetical: 'dialogue', transition: 'scene_heading', note: 'action',
}

export function ScriptView({ ctx }: { ctx: Ctx }) {
  const { b, refresh } = ctx
  const [els, setEls] = useState<El[]>(() => b.script.map((e) => ({ id: e.id, type: e.type, text: e.text })))
  const [focused, setFocused] = useState<string | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  const focusNext = useRef<string | null>(null)

  /**
   * Every mutation goes through here as a functional update — typing, Enter and
   * Tab can all land within one React tick, and a closure over `els` loses
   * whichever one rendered last.
   */
  const mutate = useCallback((fn: (prev: El[]) => El[]) => {
    setEls((prev) => {
      const next = fn(prev)
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(async () => {
        await api.saveScript(b.project.id, next)
        await refresh()
      }, 700)
      return next
    })
  }, [b.project.id, refresh])

  // focus a line only once it actually exists in the DOM
  useLayoutEffect(() => {
    if (!focusNext.current) return
    const el = document.getElementById(`s-${focusNext.current}`) as HTMLTextAreaElement | null
    focusNext.current = null
    el?.focus()
  }, [els])

  const uid = () => Math.random().toString(36).slice(2)

  const setText = (id: string, text: string) =>
    mutate((prev) => prev.map((e) => (e.id === id ? { ...e, text } : e)))

  const setType = (id: string, type: ElType) =>
    mutate((prev) => prev.map((e) => (e.id === id ? { ...e, type } : e)))

  const cycleType = (id: string, back = false) =>
    mutate((prev) => prev.map((e) => {
      if (e.id !== id) return e
      const i = TYPES.indexOf(e.type)
      return { ...e, type: TYPES[(i + (back ? TYPES.length - 1 : 1)) % TYPES.length] }
    }))

  const insertAfter = (id: string | null, type: ElType) => {
    const el: El = { id: uid(), type, text: '' }
    focusNext.current = el.id
    mutate((prev) => {
      const i = id ? prev.findIndex((e) => e.id === id) : prev.length - 1
      const next = [...prev]
      next.splice(i + 1, 0, el)
      return next
    })
  }

  const remove = (id: string) =>
    mutate((prev) => {
      const i = prev.findIndex((e) => e.id === id)
      if (prev[i - 1]) focusNext.current = prev[i - 1].id
      return prev.filter((e) => e.id !== id)
    })

  const importFromStory = async () => {
    const res = await api.scriptFromStory(b.project.id)
    if (!res.elements.length) return
    mutate((prev) => [...prev, ...res.elements.map((e) => ({ id: uid(), type: e.type as ElType, text: e.text }))])
  }

  const clearAll = () => mutate(() => [])

  const focusedEl = els.find((e) => e.id === focused)

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <h1>Script</h1>
          <div className="sub">
            <span className="kbd">↵</span> new line · <span className="kbd">tab</span> cycle element type ·
            <span className="kbd">⌫</span> on an empty line removes it
          </div>
        </div>
        <div className="actions">
          {els.length > 0 && <button className="danger ghost" onClick={clearAll}>clear</button>}
          <button onClick={importFromStory}>import from story</button>
          <button className="primary" onClick={() => insertAfter(els[els.length - 1]?.id ?? null, 'scene_heading')}>
            + scene heading
          </button>
        </div>
      </div>

      <div className="pagebody">
        <div className="main">
          {els.length === 0 ? (
            <Empty>
              the script is empty<br />
              <span className="tiny">start with a scene heading, or import the story beats</span><br />
              <button className="primary" style={{ marginTop: 14 }} onClick={() => insertAfter(null, 'scene_heading')}>
                start writing
              </button>
            </Empty>
          ) : (
            <div className="script">
              {els.map((el) => (
                <div className={`sline t-${el.type}`} key={el.id}>
                  <div className="gutter" onClick={() => cycleType(el.id)} title="click to change element type">
                    {LABEL[el.type]}
                  </div>
                  <div className="inp">
                    <AutoTextarea
                      id={`s-${el.id}`}
                      value={el.text}
                      placeholder={placeholderFor(el.type)}
                      onFocus={() => setFocused(el.id)}
                      onChange={(v) => setText(el.id, v)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); insertAfter(el.id, NEXT[el.type]) }
                        else if (e.key === 'Tab') { e.preventDefault(); cycleType(el.id, e.shiftKey) }
                        else if (e.key === 'Backspace' && !el.text) { e.preventDefault(); remove(el.id) }
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="side">
          <SectionHead title="element_type" />
          <div className="tiny dim" style={{ marginBottom: 8 }}>
            Applies to the line you're on. Click the gutter label to cycle, or press <span className="kbd">tab</span>.
          </div>
          <div className="segbar" style={{ flexDirection: 'column' }}>
            {TYPES.map((t) => (
              <button key={t} className={focusedEl?.type === t ? 'primary' : ''} disabled={!focusedEl}
                onClick={() => focused && setType(focused, t)}>{t.replace('_', ' ')}</button>
            ))}
          </div>

          <VersionHistory type="script" entityId={b.project.id}
            onRestored={async () => { const nb = await api.bundle(b.project.id); setEls(nb.script.map((e) => ({ id: e.id, type: e.type, text: e.text }))); await refresh() }} />

          <SectionHead title="stats" />
          <div className="inherit">
            <div className="i"><span className="nm">elements</span><span className="src">{els.length}</span></div>
            <div className="i"><span className="nm">scenes</span><span className="src">{els.filter((e) => e.type === 'scene_heading').length}</span></div>
            <div className="i"><span className="nm">dialogue lines</span><span className="src">{els.filter((e) => e.type === 'dialogue').length}</span></div>
            <div className="i"><span className="nm">words</span><span className="src">{els.reduce((n, e) => n + e.text.split(/\s+/).filter(Boolean).length, 0)}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** A textarea that grows to its content — screenplay lines wrap unpredictably. */
function AutoTextarea({
  id, value, placeholder, onChange, onKeyDown, onFocus,
}: {
  id: string; value: string; placeholder: string
  onChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onFocus: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const fit = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(fit, [fit, value])

  return (
    <textarea
      id={id} ref={ref} rows={1} value={value} placeholder={placeholder}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onChange={(e) => { onChange(e.target.value); fit() }}
    />
  )
}

function placeholderFor(t: ElType) {
  switch (t) {
    case 'scene_heading': return 'EXT. GOAN VILLAGE — DAWN'
    case 'character': return 'VOICEOVER'
    case 'dialogue': return 'Before it was a bottle…'
    case 'parenthetical': return '(quietly)'
    case 'transition': return 'CUT TO:'
    case 'note': return 'a note to yourself'
    default: return 'A quiet village slowly emerges from darkness.'
  }
}
