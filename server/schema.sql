PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  format      TEXT DEFAULT 'cinematic brand film',
  status      TEXT DEFAULT 'Creative Development',
  logline     TEXT DEFAULT '',
  core_emotion TEXT DEFAULT '',
  focus_scene_id TEXT,
  focus_shot_id  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS idea (
  project_id  TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  raw_text    TEXT DEFAULT '',
  updated_at  TEXT
);

-- AI development of the idea is stored separately so the original is never overwritten
CREATE TABLE IF NOT EXISTS idea_development (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  central_idea TEXT, premise TEXT, theme TEXT, emotional_direction TEXT,
  conflict TEXT, ending TEXT, questions TEXT, visual_motifs TEXT,
  source      TEXT DEFAULT 'ai',
  created_at  TEXT
);

CREATE TABLE IF NOT EXISTS story (
  project_id        TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  premise TEXT DEFAULT '', logline TEXT DEFAULT '',
  beginning TEXT DEFAULT '', middle TEXT DEFAULT '', ending TEXT DEFAULT '',
  characters TEXT DEFAULT '', conflict TEXT DEFAULT '', theme TEXT DEFAULT '',
  emotional_journey TEXT DEFAULT '', message TEXT DEFAULT '', visual_motifs TEXT DEFAULT '',
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS script_elements (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sort        REAL NOT NULL,
  type        TEXT NOT NULL,
  text        TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_script_project ON script_elements(project_id, sort);

CREATE TABLE IF NOT EXISTS director_vision (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  genre TEXT DEFAULT '', tone TEXT DEFAULT '', emotional_journey TEXT DEFAULT '',
  pacing TEXT DEFAULT '', camera_philosophy TEXT DEFAULT '',
  performance_direction TEXT DEFAULT '', editing_philosophy TEXT DEFAULT '',
  locked INTEGER DEFAULT 0, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS visual_dna (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version     INTEGER NOT NULL,
  is_current  INTEGER DEFAULT 0,
  locked      INTEGER DEFAULT 0,
  label       TEXT DEFAULT '',
  film_character TEXT DEFAULT '', color TEXT DEFAULT '', contrast TEXT DEFAULT '',
  texture TEXT DEFAULT '', lighting TEXT DEFAULT '', atmosphere TEXT DEFAULT '',
  camera TEXT DEFAULT '', depth TEXT DEFAULT '', image_quality TEXT DEFAULT '',
  avoid TEXT DEFAULT '',
  created_at TEXT, updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_vdna_project ON visual_dna(project_id, version);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT DEFAULT '', age TEXT DEFAULT '', gender TEXT DEFAULT '',
  appearance TEXT DEFAULT '', face TEXT DEFAULT '', hair TEXT DEFAULT '',
  clothing TEXT DEFAULT '', body_type TEXT DEFAULT '', distinctive TEXT DEFAULT '',
  personality TEXT DEFAULT '', performance TEXT DEFAULT '', continuity TEXT DEFAULT '',
  locked INTEGER DEFAULT 0, sort REAL DEFAULT 0, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT DEFAULT '', architecture TEXT DEFAULT '', geography TEXT DEFAULT '',
  materials TEXT DEFAULT '', colors TEXT DEFAULT '', weather TEXT DEFAULT '',
  time_characteristics TEXT DEFAULT '', lighting TEXT DEFAULT '', atmosphere TEXT DEFAULT '',
  locked INTEGER DEFAULT 0, sort REAL DEFAULT 0, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS props (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT DEFAULT '', description TEXT DEFAULT '', material TEXT DEFAULT '',
  color TEXT DEFAULT '', age TEXT DEFAULT '', condition TEXT DEFAULT '',
  dimensions TEXT DEFAULT '', locked INTEGER DEFAULT 0, sort REAL DEFAULT 0, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number INTEGER, title TEXT DEFAULT '',
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  location_text TEXT DEFAULT '',
  time_of_day TEXT DEFAULT '', duration TEXT DEFAULT '',
  story_purpose TEXT DEFAULT '', emotional_purpose TEXT DEFAULT '',
  description TEXT DEFAULT '', sort REAL DEFAULT 0, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS scene_dna (
  scene_id TEXT PRIMARY KEY REFERENCES scenes(id) ON DELETE CASCADE,
  mode TEXT DEFAULT 'extend',
  color TEXT DEFAULT '', lighting TEXT DEFAULT '', atmosphere TEXT DEFAULT '',
  texture TEXT DEFAULT '', camera TEXT DEFAULT '', contrast TEXT DEFAULT '',
  notes TEXT DEFAULT '', locked INTEGER DEFAULT 0, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS shots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id   TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  number INTEGER, title TEXT DEFAULT '', duration TEXT DEFAULT '',
  purpose TEXT DEFAULT '', description TEXT DEFAULT '',
  subject_primary TEXT DEFAULT '', subject_secondary TEXT DEFAULT '',
  action TEXT DEFAULT '', expression TEXT DEFAULT '', position TEXT DEFAULT '',
  shot_type TEXT DEFAULT '', lens TEXT DEFAULT '', camera_height TEXT DEFAULT '',
  camera_angle TEXT DEFAULT '', camera_movement TEXT DEFAULT '',
  focal_distance TEXT DEFAULT '', depth_of_field TEXT DEFAULT '',
  framing TEXT DEFAULT '', composition TEXT DEFAULT '',
  light_source TEXT DEFAULT '', light_direction TEXT DEFAULT '',
  light_quality TEXT DEFAULT '', color_temp TEXT DEFAULT '', light_contrast TEXT DEFAULT '',
  weather TEXT DEFAULT '', time_of_day TEXT DEFAULT '', atmosphere TEXT DEFAULT '',
  background TEXT DEFAULT '',
  subject_motion TEXT DEFAULT '', camera_motion TEXT DEFAULT '', env_motion TEXT DEFAULT '',
  emotion TEXT DEFAULT '', energy TEXT DEFAULT '', pacing TEXT DEFAULT '',
  status TEXT DEFAULT 'draft',
  sort REAL DEFAULT 0, updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_shots_scene ON shots(scene_id, sort);

CREATE TABLE IF NOT EXISTS entity_links (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_id   TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_links_owner ON entity_links(owner_type, owner_id);

CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  shot_id TEXT NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  is_current INTEGER DEFAULT 0,
  body TEXT DEFAULT '',
  negative TEXT DEFAULT '',
  layers_json TEXT DEFAULT '[]',
  hand_edited INTEGER DEFAULT 0,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_prompts_shot ON prompts(shot_id, version);

CREATE TABLE IF NOT EXISTS refs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL,
  owner_id   TEXT NOT NULL,
  kind TEXT DEFAULT 'reference',
  filename TEXT, mime TEXT, data TEXT,
  note TEXT DEFAULT '', created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_refs_owner ON refs(owner_type, owner_id);

CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY,
  shot_id TEXT NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  prompt_snapshot TEXT DEFAULT '',
  model TEXT DEFAULT 'Higgsfield',
  created_at TEXT,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  selected INTEGER DEFAULT 0,
  reason TEXT DEFAULT '',
  media TEXT, media_mime TEXT, media_name TEXT
);
CREATE INDEX IF NOT EXISTS idx_gens_shot ON generations(shot_id, version);

CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  label TEXT DEFAULT '',
  snapshot TEXT NOT NULL,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_versions_entity ON versions(entity_type, entity_id, created_at);
