import type { Ctx } from '../App'
import { api } from '../lib/api'

const GROUPS: { kind: 'character' | 'location' | 'prop'; table: 'characters' | 'locations' | 'props'; label: string }[] = [
  { kind: 'character', table: 'characters', label: 'characters' },
  { kind: 'location', table: 'locations', label: 'locations' },
  { kind: 'prop', table: 'props', label: 'props' },
]

/** Attach world entities to a scene or shot. These become continuity layers in the prompt. */
export function EntityPicker({ ctx, ownerType, ownerId }: { ctx: Ctx; ownerType: 'scene' | 'shot'; ownerId: string }) {
  const { b, refresh } = ctx
  const mine = b.links.filter((l) => l.owner_type === ownerType && l.owner_id === ownerId)

  const toggle = async (kind: string, id: string) => {
    const existing = mine.find((l) => l.entity_type === kind && l.entity_id === id)
    if (existing) await api.unlink(existing.id)
    else await api.link({ owner_type: ownerType, owner_id: ownerId, entity_type: kind, entity_id: id })
    await refresh()
  }

  return (
    <div>
      {GROUPS.map((g) => {
        const items = b[g.table] as { id: string; name: string; locked: number }[]
        if (!items.length) return null
        return (
          <div key={g.kind} style={{ marginBottom: 10 }}>
            <div className="label" style={{ marginBottom: 5 }}>{g.label}</div>
            <div className="linkrow">
              {items.map((it) => {
                const on = mine.some((l) => l.entity_type === g.kind && l.entity_id === it.id)
                return (
                  <span key={it.id} className={`chip${on ? ' on' : ''}`} onClick={() => toggle(g.kind, it.id)}>
                    {it.locked ? '🔒 ' : ''}{it.name || 'untitled'}
                  </span>
                )
              })}
            </div>
          </div>
        )
      })}
      {!b.characters.length && !b.locations.length && !b.props.length && (
        <div className="tiny dim">Nothing in the world bible yet — add characters, locations or props first.</div>
      )}
    </div>
  )
}
