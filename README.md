# FRAME

A local-first film development workspace. It sits **before** Higgsfield and Palmier:
it turns an idea in your head into a structured, production-ready creative blueprint.

```
IDEA → STORY → SCRIPT → DIRECTOR'S VISION → VISUAL DNA
     → SCENES → SHOTS → PROMPTS → HIGGSFIELD → PALMIER
```

FRAME does not generate video and does not edit video. It builds the material those tools need,
and tracks what came back.

## Running it

```bash
npm install
npm run dev
```

- UI — http://localhost:5180
- API — http://127.0.0.1:8787

Node 22+ is required (the server uses the built-in `node:sqlite`, so there are no native
dependencies to compile). On Windows, Node may be installed but off `PATH`; if `node -v` fails,
use `"C:\Program Files\nodejs\node.exe"` or add that directory to `PATH`.

## Where things live

```
server/
  schema.sql        relational SQLite schema — one table per entity, no JSON blobs
  db.mjs            connection, additive migrations, generic insert/patch/snapshot
  index.mjs         HTTP API (tiny router, no framework)
  prompt-engine.mjs the layered prompt composer — deterministic, no model needed
  ai.mjs            AIProvider abstraction: anthropic | structural fallback
  export.mjs        production package builder
src/
  lib/              api client, types, autosave state
  components/       Field, Modal, EntityPicker, References, Generations, Settings, palette
  views/            one file per workspace
  styles/           theme.css (design tokens per build/THEME.md) + app.css (layout)
data/
  frame.db          your work. Back this file up.
  settings.json     the stored API key, if you set one
```

## The prompt engine

A shot's prompt is composed from addressable layers, in this order:

```
PROJECT_RULES + GLOBAL_VISUAL_DNA + SCENE_DNA + WORLD_STATE + CHARACTER_STATE
+ PROP_STATE + SHOT_DESCRIPTION + CAMERA + COMPOSITION + LIGHTING + MOTION
+ EMOTION + NEGATIVE_CONSTRAINTS
```

The Prompt Lab shows every layer and where it came from, so you can always see *why* a line
is in the prompt. The composer de-duplicates clauses and prefers the more specific of any
overlapping pair, so the output reads as direction rather than as a concatenated database row.

The engine is entirely deterministic. It needs no model and works offline.

## Visual DNA and inheritance

- **Global Visual DNA** is versioned. Editing it when shots already inherit it asks whether to
  apply in place or fork a new version. Old versions are never deleted.
- **Scene DNA** *extends* the global language by default; `override` replaces the palette,
  contrast and texture for that scene only.
- **Locks** mark anything as a fixed creative constraint. Locked records cannot be edited until
  unlocked, and the lock is shown wherever the record is inherited.
- Nothing about your creative work is changed silently. Regenerating a prompt is always explicit,
  and the Prompt Lab warns when a saved prompt has drifted from its current layers.

## The assistant

`ai.mjs` is a provider abstraction. Two implementations ship:

- **anthropic** — real model calls (`claude-opus-5`), used when a key is available from
  `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, or the key saved in Settings.
- **structural** — deterministic, local, no network. It segments and extracts from your own
  words and never invents material. The UI labels which one answered.

A Claude Code or claude.ai subscription is not an API credential — this needs an Anthropic API
key, billed per token. Without one, everything except `develop idea` and the story rewrites
works exactly the same.

## Versioning

Story, script, director's vision, scenes, shots and Visual DNA can each be snapshotted from
their **history** panel. Opening a snapshot shows a field-by-field diff against what is on
screen now. Restoring saves the state it replaces as a version first, so a restore is itself
undoable, and nothing is ever destroyed silently.

## The assistant in the Prompt Lab

Ask a question about the shot you are on and the assistant answers with the whole film in view:
logline, tone, camera philosophy, global Visual DNA, Scene DNA, every attached character,
location and prop, and the shots either side of this one. **See context** shows the exact
material it was given — it is assembled from your project, never invented.

It suggests and never writes into the project. `3 camera alternatives` proposes framings that
keep the Visual DNA intact; you apply one explicitly. If a suggestion touches something you have
locked, FRAME says so and offers **keep locked** or **unlock** rather than acting.

## Search

`⌘/Ctrl+K` searches the whole film — characters, locations, props, scenes, shots and the text of
generated prompts — not just names.

## Keyboard

`⌘/Ctrl+K` command palette · `i` idea · `s` scenes · `b` board · `p` prompt lab · `v` visual DNA

Everything autosaves; the topbar shows the save state.
