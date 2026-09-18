export type ID = string

export interface Project {
  id: ID; name: string; format: string; status: string
  /** NULL in local mode; the owning user in cloud mode. Server-set only. */
  owner_id: string | null
  /** 1 for the public, read-only demo film. Server-set only. */
  is_demo: number
  logline: string; core_emotion: string
  focus_scene_id: ID | null; focus_shot_id: ID | null
  created_at: string; updated_at: string
}

export interface Idea { project_id: ID; raw_text: string; updated_at: string }

export interface Development {
  id: ID; project_id: ID; central_idea: string; premise: string; theme: string
  emotional_direction: string; conflict: string; ending: string; questions: string
  source: string; created_at: string
}

export interface Story {
  project_id: ID; premise: string; logline: string; beginning: string; middle: string
  ending: string; characters: string; conflict: string; theme: string
  emotional_journey: string; message: string; visual_motifs: string; updated_at: string
}

export interface Vision {
  project_id: ID; genre: string; tone: string; emotional_journey: string; pacing: string
  camera_philosophy: string; performance_direction: string; editing_philosophy: string
  locked: number; updated_at: string
}

export interface VisualDNA {
  id: ID; project_id: ID; version: number; is_current: number; locked: number; label: string
  film_character: string; color: string; contrast: string; texture: string; lighting: string
  atmosphere: string; camera: string; depth: string; image_quality: string; avoid: string
  created_at: string; updated_at: string
}

export interface Character {
  id: ID; project_id: ID; name: string; age: string; gender: string; appearance: string
  face: string; hair: string; clothing: string; body_type: string; distinctive: string
  personality: string; performance: string; continuity: string; locked: number; sort: number
}

export interface Location {
  id: ID; project_id: ID; name: string; architecture: string; geography: string
  materials: string; colors: string; weather: string; time_characteristics: string
  lighting: string; atmosphere: string; locked: number; sort: number
}

export interface Prop {
  id: ID; project_id: ID; name: string; description: string; material: string; color: string
  age: string; condition: string; dimensions: string; locked: number; sort: number
}

export interface Scene {
  id: ID; project_id: ID; number: number; title: string; location_id: ID | null
  location_text: string; time_of_day: string; duration: string; story_purpose: string
  emotional_purpose: string; description: string; sort: number
}

export interface SceneDNA {
  scene_id: ID; mode: 'extend' | 'override'; color: string; lighting: string; atmosphere: string
  texture: string; camera: string; contrast: string; notes: string; locked: number
}

export interface Shot {
  id: ID; project_id: ID; scene_id: ID; number: number; title: string; duration: string
  purpose: string; description: string
  subject_primary: string; subject_secondary: string; action: string; expression: string; position: string
  shot_type: string; lens: string; camera_height: string; camera_angle: string; camera_movement: string
  focal_distance: string; depth_of_field: string; framing: string; composition: string
  light_source: string; light_direction: string; light_quality: string; color_temp: string; light_contrast: string
  weather: string; time_of_day: string; atmosphere: string; background: string
  subject_motion: string; camera_motion: string; env_motion: string
  emotion: string; energy: string; pacing: string
  status: 'draft' | 'ready' | 'generating' | 'selected'; sort: number
}

export interface EntityLink {
  id: ID; owner_type: 'scene' | 'shot'; owner_id: ID
  entity_type: 'character' | 'location' | 'prop'; entity_id: ID
}

export interface PromptRow {
  id: ID; shot_id: ID; version: number; is_current: number; body: string
  negative: string; layers_json: string; hand_edited: number; created_at: string
}

export interface Generation {
  id: ID; shot_id: ID; version: number; model: string; created_at: string
  notes: string; status: string; selected: number; reason: string
  media_mime: string | null; media_name: string | null
}

export interface ScriptElement {
  id: ID; project_id: ID; sort: number
  type: 'scene_heading' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition' | 'note'
  text: string
}

export interface Layer { key: string; label: string; source: string; text: string }
export interface Warning { level: 'info' | 'warn' | 'error'; text: string }

export interface PromptView {
  layers: Layer[]; body: string; negative: string; flat: string
  stored: PromptRow | null
  versions: { id: ID; version: number; hand_edited: number; created_at: string }[]
  warnings: Warning[]
  context: {
    dnaVersion: number | null; sceneNumber: number | null
    characters: { id: ID; name: string; locked: number }[]
    locations: { id: ID; name: string; locked: number }[]
    props: { id: ID; name: string; locked: number }[]
  }
}

export interface Bundle {
  project: Project
  idea: Idea | null
  development: Development[]
  story: Story | null
  vision: Vision | null
  dna: VisualDNA | null
  dnaVersions: Pick<VisualDNA, 'id' | 'version' | 'label' | 'is_current' | 'created_at'>[]
  characters: Character[]
  locations: Location[]
  props: Prop[]
  scenes: Scene[]
  sceneDna: SceneDNA[]
  shots: Shot[]
  links: EntityLink[]
  prompts: PromptRow[]
  generations: Generation[]
  script: ScriptElement[]
}
