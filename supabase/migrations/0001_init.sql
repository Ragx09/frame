-- FRAME beta — initial Supabase/Postgres schema.
--
-- Generated from `server/schema.sql`, which stays the single source of truth for
-- the shape of the data. Only three things differ from that file:
--
--   * SQLite PRAGMAs are dropped (Postgres needs no equivalent)
--   * REAL becomes DOUBLE PRECISION
--   * Row Level Security and its policies are added, at the bottom
--
-- Booleans stay INTEGER 0/1 exactly as in SQLite, on purpose, so the same
-- application code runs against either database with no translation layer.
--
-- Apply to a new Supabase project:
--   psql "<DATABASE_URL>" -f supabase/migrations/0001_init.sql
--
-- Every statement is IF NOT EXISTS or DROP-then-CREATE, so re-running is safe.

BEGIN;

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT,                   -- NULL in local mode; the user in cloud mode
  is_demo     INTEGER DEFAULT 0,      -- the read-only public demo film
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

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id, updated_at);

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
  sort        DOUBLE PRECISION NOT NULL,
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
  locked INTEGER DEFAULT 0, sort DOUBLE PRECISION DEFAULT 0, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT DEFAULT '', architecture TEXT DEFAULT '', geography TEXT DEFAULT '',
  materials TEXT DEFAULT '', colors TEXT DEFAULT '', weather TEXT DEFAULT '',
  time_characteristics TEXT DEFAULT '', lighting TEXT DEFAULT '', atmosphere TEXT DEFAULT '',
  locked INTEGER DEFAULT 0, sort DOUBLE PRECISION DEFAULT 0, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS props (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT DEFAULT '', description TEXT DEFAULT '', material TEXT DEFAULT '',
  color TEXT DEFAULT '', age TEXT DEFAULT '', condition TEXT DEFAULT '',
  dimensions TEXT DEFAULT '', locked INTEGER DEFAULT 0, sort DOUBLE PRECISION DEFAULT 0, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number INTEGER, title TEXT DEFAULT '',
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  location_text TEXT DEFAULT '',
  time_of_day TEXT DEFAULT '', duration TEXT DEFAULT '',
  story_purpose TEXT DEFAULT '', emotional_purpose TEXT DEFAULT '',
  description TEXT DEFAULT '', sort DOUBLE PRECISION DEFAULT 0, updated_at TEXT
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
  sort DOUBLE PRECISION DEFAULT 0, updated_at TEXT
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

/* ===================================================================
   BETA — identity, usage accounting and feedback.

   Everything below is additive. A database created by the pre-beta
   schema is migrated forward by the additive ALTERs in the SQLite
   driver, so an existing local `frame.db` keeps working untouched.
   =================================================================== */

/* A user is created on first authenticated request. Supabase Auth owns
   the credentials; this row exists only so project ownership has
   something local to reference. No password, no token, ever. */
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,      -- Supabase auth.users.id (uuid)
  email       TEXT DEFAULT '',
  created_at  TEXT NOT NULL,
  last_seen_at TEXT
);

/* Hosted-AI accounting. One row per hosted request, successful or not.
   Deliberately NOT a billing system (brief §35) — it exists so the beta
   limit can be enforced and the developer can see what the beta costs. */
CREATE TABLE IF NOT EXISTS ai_usage (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  day         TEXT NOT NULL,          -- UTC YYYY-MM-DD, the limit window
  operation   TEXT NOT NULL,
  provider    TEXT NOT NULL,
  model       TEXT DEFAULT '',
  metered     INTEGER DEFAULT 1,      -- 0 for BYOK and structural
  success     INTEGER DEFAULT 1,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  duration_ms INTEGER,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_user_day ON ai_usage(user_id, day);

/* Beta feedback, when no PUBLIC_FEEDBACK_URL is configured. */
CREATE TABLE IF NOT EXISTS feedback (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  category    TEXT DEFAULT 'general',
  body        TEXT NOT NULL,
  app_version TEXT DEFAULT '',
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);

-- =====================================================================
-- Row Level Security
--
-- FRAME's Node API is the only thing that talks to this database, and it
-- connects with credentials that bypass RLS. These policies are therefore
-- defence in depth rather than the primary control: the server verifies
-- project ownership on every request (server/access.mjs).
--
-- They matter because Supabase also exposes these tables over PostgREST to
-- anyone holding the publishable key. Without RLS that is an open database.
-- With it, a browser carrying only a user's own session reaches only that
-- user's rows -- the posture Supabase documents as required for any table
-- exposed to its API.
--
-- The secret (service_role) key bypasses all of this and must never reach a
-- browser.
-- =====================================================================

-- auth.uid() is a uuid; owner_id is text, because the same column holds
-- 'local' when FRAME runs in local mode.
CREATE OR REPLACE FUNCTION public.frame_current_user() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT auth.uid()::text $$;

CREATE OR REPLACE FUNCTION public.frame_can_read_project(p_id text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = p_id AND (p.owner_id = public.frame_current_user() OR p.is_demo = 1)
    )
  $$;

CREATE OR REPLACE FUNCTION public.frame_can_write_project(p_id text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = p_id AND p.owner_id = public.frame_current_user() AND p.is_demo = 0
    )
  $$;

-- ---------------------------------------------------------------- projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS projects_read ON public.projects;
CREATE POLICY projects_read ON public.projects FOR SELECT TO authenticated
  USING (owner_id = public.frame_current_user() OR is_demo = 1);
DROP POLICY IF EXISTS projects_insert ON public.projects;
CREATE POLICY projects_insert ON public.projects FOR INSERT TO authenticated
  WITH CHECK (owner_id = public.frame_current_user() AND is_demo = 0);
DROP POLICY IF EXISTS projects_update ON public.projects;
CREATE POLICY projects_update ON public.projects FOR UPDATE TO authenticated
  USING (owner_id = public.frame_current_user() AND is_demo = 0)
  WITH CHECK (owner_id = public.frame_current_user() AND is_demo = 0);
DROP POLICY IF EXISTS projects_delete ON public.projects;
CREATE POLICY projects_delete ON public.projects FOR DELETE TO authenticated
  USING (owner_id = public.frame_current_user() AND is_demo = 0);

-- The demo film is readable before sign-in, so the landing page can show it.
DROP POLICY IF EXISTS projects_demo_anon ON public.projects;
CREATE POLICY projects_demo_anon ON public.projects FOR SELECT TO anon USING (is_demo = 1);

-- ---------------------------------------------------------------- idea
ALTER TABLE public.idea ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS idea_read ON public.idea;
CREATE POLICY idea_read ON public.idea FOR SELECT TO authenticated
  USING (public.frame_can_read_project(project_id));
DROP POLICY IF EXISTS idea_write ON public.idea;
CREATE POLICY idea_write ON public.idea FOR ALL TO authenticated
  USING (public.frame_can_write_project(project_id))
  WITH CHECK (public.frame_can_write_project(project_id));
DROP POLICY IF EXISTS idea_demo_anon ON public.idea;
CREATE POLICY idea_demo_anon ON public.idea FOR SELECT TO anon
  USING (public.frame_can_read_project(project_id));

-- ---------------------------------------------------------------- idea_development
ALTER TABLE public.idea_development ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS idea_development_read ON public.idea_development;
CREATE POLICY idea_development_read ON public.idea_development FOR SELECT TO authenticated
  USING (public.frame_can_read_project(project_id));
DROP POLICY IF EXISTS idea_development_write ON public.idea_development;
CREATE POLICY idea_development_write ON public.idea_development FOR ALL TO authenticated
  USING (public.frame_can_write_project(project_id))
  WITH CHECK (public.frame_can_write_project(project_id));
DROP POLICY IF EXISTS idea_development_demo_anon ON public.idea_development;
CREATE POLICY idea_development_demo_anon ON public.idea_development FOR SELECT TO anon
  USING (public.frame_can_read_project(project_id));

-- ---------------------------------------------------------------- story
ALTER TABLE public.story ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS story_read ON public.story;
CREATE POLICY story_read ON public.story FOR SELECT TO authenticated
  USING (public.frame_can_read_project(project_id));
DROP POLICY IF EXISTS story_write ON public.story;
CREATE POLICY story_write ON public.story FOR ALL TO authenticated
  USING (public.frame_can_write_project(project_id))
  WITH CHECK (public.frame_can_write_project(project_id));
DROP POLICY IF EXISTS story_demo_anon ON public.story;
CREATE POLICY story_demo_anon ON public.story FOR SELECT TO anon
  USING (public.frame_can_read_project(project_id));

-- ---------------------------------------------------------------- script_elements
ALTER TABLE public.script_elements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS script_elements_read ON public.script_elements;
CREATE POLICY script_elements_read ON public.script_elements FOR SELECT TO authenticated
  USING (public.frame_can_read_project(project_id));
DROP POLICY IF EXISTS script_elements_write ON public.script_elements;
CREATE POLICY script_elements_write ON public.script_elements FOR ALL TO authenticated
  USING (public.frame_can_write_project(project_id))
  WITH CHECK (public.frame_can_write_project(project_id));
DROP POLICY IF EXISTS script_elements_demo_anon ON public.script_elements;
CREATE POLICY script_elements_demo_anon ON public.script_elements FOR SELECT TO anon
  USING (public.frame_can_read_project(project_id));

-- ---------------------------------------------------------------- director_vision
ALTER TABLE public.director_vision ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS director_vision_read ON public.director_vision;
CREATE POLICY director_vision_read ON public.director_vision FOR SELECT TO authenticated
  USING (public.frame_can_read_project(project_id));
DROP POLICY IF EXISTS director_vision_write ON public.director_vision;
CREATE POLICY director_vision_write ON public.director_vision FOR ALL TO authenticated
  USING (public.frame_can_write_project(project_id))
  WITH CHECK (public.frame_can_write_project(project_id));
DROP POLICY IF EXISTS director_vision_demo_anon ON public.director_vision;
CREATE POLICY director_vision_demo_anon ON public.director_vision FOR SELECT TO anon
  USING (public.frame_can_read_project(project_id));

-- ---------------------------------------------------------------- visual_dna
ALTER TABLE public.visual_dna ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS visual_dna_read ON public.visual_dna;
CREATE POLICY visual_dna_read ON public.visual_dna FOR SELECT TO authenticated
  USING (public.frame_can_read_project(project_id));
DROP POLICY IF EXISTS visual_dna_write ON public.visual_dna;
CREATE POLICY visual_dna_write ON public.visual_dna FOR ALL TO authenticated
  USING (public.frame_can_write_project(project_id))
  WITH CHECK (public.frame_can_write_project(project_id));
DROP POLICY IF EXISTS visual_dna_demo_anon ON public.visual_dna;
CREATE POLICY visual_dna_demo_anon ON public.visual_dna FOR SELECT TO anon
  USING (public.frame_can_read_project(project_id));

-- ---------------------------------------------------------------- characters
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS characters_read ON public.characters;
CREATE POLICY characters_read ON public.characters FOR SELECT TO authenticated
  USING (public.frame_can_read_project(project_id));
DROP POLICY IF EXISTS characters_write ON public.characters;
CREATE POLICY characters_write ON public.characters FOR ALL TO authenticated
  USING (public.frame_can_write_project(project_id))
  WITH CHECK (public.frame_can_write_project(project_id));
DROP POLICY IF EXISTS characters_demo_anon ON public.characters;
CREATE POLICY characters_demo_anon ON public.characters FOR SELECT TO anon
  USING (public.frame_can_read_project(project_id));

-- ---------------------------------------------------------------- locations
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS locations_read ON public.locations;
CREATE POLICY locations_read ON public.locations FOR SELECT TO authenticated
  USING (public.frame_can_read_project(project_id));
DROP POLICY IF EXISTS locations_write ON public.locations;
CREATE POLICY locations_write ON public.locations FOR ALL TO authenticated
  USING (public.frame_can_write_project(project_id))
  WITH CHECK (public.frame_can_write_project(project_id));
DROP POLICY IF EXISTS locations_demo_anon ON public.locations;
CREATE POLICY locations_demo_anon ON public.locations FOR SELECT TO anon
  USING (public.frame_can_read_project(project_id));

-- ---------------------------------------------------------------- props
ALTER TABLE public.props ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS props_read ON public.props;
CREATE POLICY props_read ON public.props FOR SELECT TO authenticated
  USING (public.frame_can_read_project(project_id));
DROP POLICY IF EXISTS props_write ON public.props;
CREATE POLICY props_write ON public.props FOR ALL TO authenticated
  USING (public.frame_can_write_project(project_id))
  WITH CHECK (public.frame_can_write_project(project_id));
DROP POLICY IF EXISTS props_demo_anon ON public.props;
CREATE POLICY props_demo_anon ON public.props FOR SELECT TO anon
  USING (public.frame_can_read_project(project_id));

-- ---------------------------------------------------------------- scenes
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scenes_read ON public.scenes;
CREATE POLICY scenes_read ON public.scenes FOR SELECT TO authenticated
  USING (public.frame_can_read_project(project_id));
DROP POLICY IF EXISTS scenes_write ON public.scenes;
CREATE POLICY scenes_write ON public.scenes FOR ALL TO authenticated
  USING (public.frame_can_write_project(project_id))
  WITH CHECK (public.frame_can_write_project(project_id));
DROP POLICY IF EXISTS scenes_demo_anon ON public.scenes;
CREATE POLICY scenes_demo_anon ON public.scenes FOR SELECT TO anon
  USING (public.frame_can_read_project(project_id));

-- ---------------------------------------------------------------- refs
ALTER TABLE public.refs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS refs_read ON public.refs;
CREATE POLICY refs_read ON public.refs FOR SELECT TO authenticated
  USING (public.frame_can_read_project(project_id));
DROP POLICY IF EXISTS refs_write ON public.refs;
CREATE POLICY refs_write ON public.refs FOR ALL TO authenticated
  USING (public.frame_can_write_project(project_id))
  WITH CHECK (public.frame_can_write_project(project_id));
DROP POLICY IF EXISTS refs_demo_anon ON public.refs;
CREATE POLICY refs_demo_anon ON public.refs FOR SELECT TO anon
  USING (public.frame_can_read_project(project_id));

-- ---------------------------------------------------------------- versions
ALTER TABLE public.versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS versions_read ON public.versions;
CREATE POLICY versions_read ON public.versions FOR SELECT TO authenticated
  USING (public.frame_can_read_project(project_id));
DROP POLICY IF EXISTS versions_write ON public.versions;
CREATE POLICY versions_write ON public.versions FOR ALL TO authenticated
  USING (public.frame_can_write_project(project_id))
  WITH CHECK (public.frame_can_write_project(project_id));
DROP POLICY IF EXISTS versions_demo_anon ON public.versions;
CREATE POLICY versions_demo_anon ON public.versions FOR SELECT TO anon
  USING (public.frame_can_read_project(project_id));

-- --------------------------------------------------------------- scene_dna
ALTER TABLE public.scene_dna ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scene_dna_read ON public.scene_dna;
CREATE POLICY scene_dna_read ON public.scene_dna FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scenes s WHERE s.id = scene_id AND public.frame_can_read_project(s.project_id)));
DROP POLICY IF EXISTS scene_dna_write ON public.scene_dna;
CREATE POLICY scene_dna_write ON public.scene_dna FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scenes s WHERE s.id = scene_id AND public.frame_can_write_project(s.project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.scenes s WHERE s.id = scene_id AND public.frame_can_write_project(s.project_id)));

-- ------------------------------------------------------------------- shots
ALTER TABLE public.shots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shots_read ON public.shots;
CREATE POLICY shots_read ON public.shots FOR SELECT TO authenticated
  USING (public.frame_can_read_project(project_id));
DROP POLICY IF EXISTS shots_write ON public.shots;
CREATE POLICY shots_write ON public.shots FOR ALL TO authenticated
  USING (public.frame_can_write_project(project_id))
  WITH CHECK (public.frame_can_write_project(project_id));
DROP POLICY IF EXISTS shots_demo_anon ON public.shots;
CREATE POLICY shots_demo_anon ON public.shots FOR SELECT TO anon
  USING (public.frame_can_read_project(project_id));

-- ----------------------------------------------------------------- prompts
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prompts_read ON public.prompts;
CREATE POLICY prompts_read ON public.prompts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shots s WHERE s.id = shot_id AND public.frame_can_read_project(s.project_id)));
DROP POLICY IF EXISTS prompts_write ON public.prompts;
CREATE POLICY prompts_write ON public.prompts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shots s WHERE s.id = shot_id AND public.frame_can_write_project(s.project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shots s WHERE s.id = shot_id AND public.frame_can_write_project(s.project_id)));
DROP POLICY IF EXISTS prompts_demo_anon ON public.prompts;
CREATE POLICY prompts_demo_anon ON public.prompts FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.shots s WHERE s.id = shot_id AND public.frame_can_read_project(s.project_id)));

-- ------------------------------------------------------------- generations
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS generations_read ON public.generations;
CREATE POLICY generations_read ON public.generations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shots s WHERE s.id = shot_id AND public.frame_can_read_project(s.project_id)));
DROP POLICY IF EXISTS generations_write ON public.generations;
CREATE POLICY generations_write ON public.generations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shots s WHERE s.id = shot_id AND public.frame_can_write_project(s.project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shots s WHERE s.id = shot_id AND public.frame_can_write_project(s.project_id)));

-- ------------------------------------------------------------ entity_links
-- Links are keyed by an opaque owner id, so the owner's own policy is the gate.
ALTER TABLE public.entity_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entity_links_read ON public.entity_links;
CREATE POLICY entity_links_read ON public.entity_links FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shots s  WHERE s.id = owner_id AND public.frame_can_read_project(s.project_id))
    OR EXISTS (SELECT 1 FROM public.scenes s WHERE s.id = owner_id AND public.frame_can_read_project(s.project_id))
  );
DROP POLICY IF EXISTS entity_links_write ON public.entity_links;
CREATE POLICY entity_links_write ON public.entity_links FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shots s  WHERE s.id = owner_id AND public.frame_can_write_project(s.project_id))
    OR EXISTS (SELECT 1 FROM public.scenes s WHERE s.id = owner_id AND public.frame_can_write_project(s.project_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.shots s  WHERE s.id = owner_id AND public.frame_can_write_project(s.project_id))
    OR EXISTS (SELECT 1 FROM public.scenes s WHERE s.id = owner_id AND public.frame_can_write_project(s.project_id))
  );

-- ------------------------------------------------------------------- users
-- A user sees only their own row. Nobody writes one from the browser: rows are
-- created server-side on the first authenticated request.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_self ON public.users;
CREATE POLICY users_self ON public.users FOR SELECT TO authenticated
  USING (id = public.frame_current_user());

-- ---------------------------------------------------------------- ai_usage
-- Readable by the user it belongs to, so Settings can show their own count.
-- Never writable from the browser: the server is the only thing that meters.
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_usage_self ON public.ai_usage;
CREATE POLICY ai_usage_self ON public.ai_usage FOR SELECT TO authenticated
  USING (user_id = public.frame_current_user());

-- ---------------------------------------------------------------- feedback
-- Write-only from the browser's point of view: you may file it, not read it.
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS feedback_insert ON public.feedback;
CREATE POLICY feedback_insert ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = public.frame_current_user() OR user_id IS NULL);

COMMIT;
