import { useEffect, useState } from 'react'
import type { Ctx } from '../App'
import { api } from '../lib/api'
import { Field, SectionHead, Empty, LockButton, Tag } from '../components/ui'
import { References } from '../components/References'

type Kind = 'characters' | 'locations' | 'props'

const SPEC: Record<Kind, { title: string; sub: string; singular: string; link: string; fields: [string, string, number?][] }> = {
  characters: {
    title: 'Characters', singular: 'character', link: 'character',
    sub: 'Who stays consistent across every shot they appear in.',
    fields: [
      ['name', 'name'], ['age', 'age'], ['gender', 'gender'],
      ['appearance', 'appearance', 4], ['face', 'face description', 3], ['hair', 'hair', 2],
      ['body_type', 'body type', 2], ['clothing', 'clothing', 3],
      ['distinctive', 'distinctive features', 3],
      ['personality', 'personality', 3], ['performance', 'performance direction', 3],
      ['continuity', 'continuity notes', 3],
    ],
  },
  locations: {
    title: 'Locations', singular: 'location', link: 'location',
    sub: 'Places the film returns to. Shots inherit their material and light.',
    fields: [
      ['name', 'name'], ['architecture', 'architecture', 3], ['geography', 'geography', 3],
      ['materials', 'materials', 3], ['colors', 'colors', 3], ['weather', 'weather', 2],
      ['time_characteristics', 'time characteristics', 3], ['lighting', 'lighting', 3],
      ['atmosphere', 'atmosphere', 3],
    ],
  },
  props: {
    title: 'Props / Objects', singular: 'prop', link: 'prop',
    sub: 'Objects that must look the same every time the camera finds them.',
    fields: [
      ['name', 'name'], ['description', 'physical description', 4], ['material', 'material', 2],
      ['color', 'color', 2], ['age', 'age', 2], ['condition', 'condition', 2],
      ['dimensions', 'dimensions / proportions', 2],
    ],
  },
}

export function WorldView({ ctx, kind }: { ctx: Ctx; kind: Kind }) {
  const { b, refresh } = ctx
  const spec = SPEC[kind]
  const items = b[kind] as unknown as Record<string, string | number>[]
  const [selId, setSelId] = useState<string | null>(null)

  useEffect(() => {
    if (!items.find((i) => i.id === selId)) setSelId((items[0]?.id as string) ?? null)
  }, [items, selId])

  const sel = items.find((i) => i.id === selId)

  const add = async () => {
    const created = await api.addEntity(b.project.id, kind, { name: `New ${spec.singular}` }) as { id: string }
    await refresh()
    setSelId(created.id)
  }

  const save = async (body: Record<string, unknown>) => {
    if (!sel) return
    await api.patchEntity(kind, sel.id as string, body)
    await refresh()
  }

  const remove = async () => {
    if (!sel) return
    await api.deleteEntity(kind, sel.id as string)
    setSelId(null)
    await refresh()
  }

  const usedIn = (id: string) =>
    b.links.filter((l) => l.entity_type === spec.link && l.entity_id === id && l.owner_type === 'shot').length

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <h1>{spec.title}</h1>
          <div className="sub">{spec.sub}</div>
        </div>
        <div className="actions">
          <button className="primary" onClick={add}>+ {spec.singular}</button>
        </div>
      </div>

      <div className="pagebody">
        <div className="main">
          {items.length === 0 ? (
            <Empty>
              no {kind} yet<br />
              <span className="tiny">add the ones the film keeps returning to</span>
            </Empty>
          ) : (
            <div className="cardgrid">
              {items.map((it) => {
                const shots = usedIn(it.id as string)
                return (
                  <div key={it.id as string}
                    className={`card${it.id === selId ? ' sel' : ''}`}
                    style={{ ['--vc' as string]: it.locked ? 'var(--warn)' : shots ? 'var(--accent)' : 'var(--line)' }}
                    onClick={() => setSelId(it.id as string)}>
                    <div className="t">
                      {it.locked ? '🔒' : ''} {String(it.name || `Untitled ${spec.singular}`)}
                    </div>
                    <div className="d">
                      {String(it.appearance || it.description || it.architecture || '') || <span className="dim">no description yet</span>}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                      <Tag kind={shots ? 'ready' : 'draft'}>{shots} shot{shots === 1 ? '' : 's'}</Tag>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="side wide">
          {!sel ? <Empty>select a {spec.singular}</Empty> : (
            <>
              <SectionHead title={spec.singular}>
                <LockButton locked={!!sel.locked} onToggle={() => save({ locked: sel.locked ? 0 : 1, _force: true })} />
                <button className="danger ghost" onClick={remove}>delete</button>
              </SectionHead>
              {!!sel.locked && (
                <div className="warnline v-warn" style={{ marginBottom: 12 }}>
                  <span className="dot" />
                  Locked. This is treated as a fixed creative constraint — unlock to edit.
                </div>
              )}
              {spec.fields.map(([key, label, rows]) => (
                <Field key={key} label={label} rows={rows} locked={!!sel.locked}
                  value={String(sel[key] ?? '')} onCommit={(v) => save({ [key]: v })} />
              ))}

              <SectionHead title="references" />
              <References ctx={ctx} ownerType={spec.link} ownerId={sel.id as string} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
