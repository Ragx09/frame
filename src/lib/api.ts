import type { Bundle, ID, Project, PromptView } from './types'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const listeners = new Set<(s: SaveState) => void>()
let pending = 0
let timer: number | undefined

export function onSaveState(fn: (s: SaveState) => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const emit = (s: SaveState) => listeners.forEach((fn) => fn(s))

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const mutating = method !== 'GET'
  if (mutating) { pending++; window.clearTimeout(timer); emit('saving') }
  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error((data as { error?: string })?.error ?? `${res.status}`)
    if (mutating) {
      pending--
      if (!pending) { emit('saved'); timer = window.setTimeout(() => emit('idle'), 2200) }
    }
    return data as T
  } catch (err) {
    if (mutating) { pending = Math.max(0, pending - 1); emit('error') }
    throw err
  }
}

export const api = {
  meta: () => req<{ provider: string; keyState?: string; model?: string; version: string }>('GET', '/meta'),

  projects: () => req<Project[]>('GET', '/projects'),
  createProject: (name: string) => req<Project>('POST', '/projects', { name }),
  bundle: (id: ID) => req<Bundle>('GET', `/projects/${id}`),
  patchProject: (id: ID, body: Partial<Project>) => req<Project>('PATCH', `/projects/${id}`, body),
  deleteProject: (id: ID) => req<void>('DELETE', `/projects/${id}`),

  patchIdea: (id: ID, body: Record<string, unknown>) => req('PATCH', `/projects/${id}/idea`, body),
  patchStory: (id: ID, body: Record<string, unknown>) => req('PATCH', `/projects/${id}/story`, body),
  patchVision: (id: ID, body: Record<string, unknown>) => req('PATCH', `/projects/${id}/vision`, body),

  developIdea: (id: ID) => req<Record<string, string>>('POST', `/projects/${id}/ai/develop-idea`),
  rewrite: (text: string, instruction: string, context = '') =>
    req<{ text: string | null; source: string; message?: string }>('POST', '/ai/rewrite', { text, instruction, context }),
  scriptFromStory: (id: ID) =>
    req<{ elements: { type: string; text: string }[] }>('POST', `/projects/${id}/ai/script-from-story`),

  patchDna: (id: ID, body: Record<string, unknown>) => req('PATCH', `/dna/${id}`, body),
  newDnaVersion: (pid: ID, label?: string, fields?: Record<string, unknown>) =>
    req('POST', `/projects/${pid}/dna/version`, { label, fields }),
  activateDna: (pid: ID, dnaId: ID) => req('POST', `/projects/${pid}/dna/${dnaId}/activate`),
  dnaImpact: (id: ID) => req<{ count: number; shots: { id: ID; number: number; title: string; scene_number: number }[] }>('GET', `/dna/${id}/impact`),

  addEntity: (pid: ID, table: 'characters' | 'locations' | 'props', body: Record<string, unknown>) =>
    req('POST', `/projects/${pid}/${table}`, body),
  patchEntity: (table: 'characters' | 'locations' | 'props', id: ID, body: Record<string, unknown>) =>
    req('PATCH', `/${table}/${id}`, body),
  deleteEntity: (table: 'characters' | 'locations' | 'props', id: ID) => req('DELETE', `/${table}/${id}`),

  addScene: (pid: ID, body: Record<string, unknown>) => req('POST', `/projects/${pid}/scenes`, body),
  patchScene: (id: ID, body: Record<string, unknown>) => req('PATCH', `/scenes/${id}`, body),
  deleteScene: (id: ID) => req('DELETE', `/scenes/${id}`),
  patchSceneDna: (id: ID, body: Record<string, unknown>) => req('PATCH', `/scenes/${id}/dna`, body),

  addShot: (sceneId: ID, body: Record<string, unknown> = {}) => req('POST', `/scenes/${sceneId}/shots`, body),
  patchShot: (id: ID, body: Record<string, unknown>) => req('PATCH', `/shots/${id}`, body),
  deleteShot: (id: ID) => req('DELETE', `/shots/${id}`),
  duplicateShot: (id: ID) => req('POST', `/shots/${id}/duplicate`),
  reorderShots: (sceneId: ID, ids: ID[]) => req('POST', `/scenes/${sceneId}/reorder`, { ids }),
  renumber: (pid: ID) => req<{ renumbered: number }>('POST', `/projects/${pid}/renumber`),

  link: (body: Record<string, unknown>) => req<{ id: ID }>('POST', '/links', body),
  unlink: (id: ID) => req('DELETE', `/links/${id}`),

  prompt: (shotId: ID) => req<PromptView>('GET', `/shots/${shotId}/prompt`),
  savePrompt: (shotId: ID, body?: { body?: string; negative?: string }) =>
    req('POST', `/shots/${shotId}/prompt`, body ?? {}),
  restorePrompt: (pid: ID) => req('POST', `/prompts/${pid}/restore`),

  addGeneration: (shotId: ID, body: Record<string, unknown>) => req('POST', `/shots/${shotId}/generations`, body),
  patchGeneration: (id: ID, body: Record<string, unknown>) => req('PATCH', `/generations/${id}`, body),
  deleteGeneration: (id: ID) => req('DELETE', `/generations/${id}`),
  generationMedia: (id: ID) => req<{ media: string | null; media_mime: string | null }>('GET', `/generations/${id}/media`),

  refs: (ownerType: string, ownerId: ID) =>
    req<{ id: ID; kind: string; filename: string; mime: string; data: string; note: string }[]>('GET', `/refs/${ownerType}/${ownerId}`),
  addRef: (body: Record<string, unknown>) => req('POST', '/refs', body),
  deleteRef: (id: ID) => req('DELETE', `/refs/${id}`),

  saveScript: (pid: ID, elements: { id?: ID; type: string; text: string }[]) =>
    req('PUT', `/projects/${pid}/script`, { elements }),

  versions: (type: string, eid: ID) =>
    req<{ id: ID; label: string; created_at: string }[]>('GET', `/versions/${type}/${eid}`),
  snapshot: (type: string, eid: ID, label: string) => req('POST', `/versions/${type}/${eid}`, { label }),
  compareVersion: (vid: ID) =>
    req<{ version: { id: ID; label: string; created_at: string }; fields: { field: string; was: string; now: string }[] }>(
      'GET', `/versions/${vid}/compare`),
  restoreVersion: (vid: ID) => req('POST', `/versions/${vid}/restore`),
  deleteVersion: (vid: ID) => req('DELETE', `/versions/${vid}`),

  askShot: (shotId: ID, question: string) =>
    req<{ answer: string | null; source: string; message?: string; context: string | null; conflicts?: { entity: string; entityId: ID; kind: string; field: string }[] }>(
      'POST', `/shots/${shotId}/ai/ask`, { question }),
  shotAlternatives: (shotId: ID) =>
    req<{ options: Record<string, string>[] | null; source: string; message?: string }>(
      'POST', `/shots/${shotId}/ai/alternatives`),
  splitShot: (shotId: ID) => req('POST', `/shots/${shotId}/split`),

  search: (pid: ID, q: string) =>
    req<{ results: { kind: string; id: ID; label: string; where: string; sceneId: ID | null }[] }>(
      'GET', `/projects/${pid}/search?q=${encodeURIComponent(q)}`),

  exportProject: (pid: ID) => req<{ files: Record<string, string> }>('GET', `/projects/${pid}/export`),
}
