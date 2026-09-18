\# Build Brief — AI Film Development Workspace



\## 0. IMPORTANT: READ THIS FIRST



You are building a local-first web application that I will personally use as a creative filmmaking workspace.



This is NOT:



\* an AI video generator

\* a video editor

\* a CRM

\* a brand research platform

\* a marketing automation platform

\* a client management system

\* a replacement for Higgsfield

\* a replacement for Palmier

\* a generic AI writing application



The purpose of this application is to help me take a film/video idea that exists in my head and progressively turn it into a structured, production-ready creative blueprint.



My external production tools will be:



\* Higgsfield — AI video/image generation

\* Palmier — editing/post-production



This application sits BEFORE those tools.



The core workflow is:



IDEA

→ STORY

→ SCRIPT

→ DIRECTOR'S VISION

→ VISUAL DNA

→ SCENES

→ SHOTS

→ PROMPTS

→ HIGGSFIELD

→ PALMIER



The application should feel like a serious creative filmmaking tool, not a SaaS dashboard.



\---



\# 1. EXISTING FILE: theme.md



There is a file in the project called:



`theme.md`



IMPORTANT:



`theme.md` contains a simple visual/UI representation of how I want the application to look.



It is a UI/theme reference ONLY.



It should be used to understand:



\* visual hierarchy

\* spacing

\* colors

\* typography

\* component appearance

\* general layout

\* visual personality

\* dark/light treatment

\* sidebar style

\* cards

\* buttons

\* panels

\* overall aesthetic



DO NOT treat `theme.md` as a product specification.



DO NOT blindly copy its functionality.



DO NOT assume that everything shown in `theme.md` needs to exist.



Use it only as the visual design reference.



The actual product architecture and UX should be based on this document.



Before implementing the UI:



1\. Read `theme.md`.

2\. Understand its visual language.

3\. Preserve its visual intent.

4\. Adapt that visual language to the actual filmmaking workflow described below.



If there is a conflict between `theme.md` and this specification:



\* functionality follows this specification

\* visual styling follows `theme.md`



\---



\# 2. PRODUCT PHILOSOPHY



The application should be built around one central idea:



> I am the director. The AI is my creative development assistant.



The AI must NOT automatically take control of the creative process.



The system should help me:



\* clarify ideas

\* structure stories

\* develop scripts

\* define visual language

\* break stories into scenes

\* break scenes into shots

\* construct production prompts

\* maintain visual consistency

\* maintain character/location/object continuity

\* track generated versions

\* prepare assets for external generation/editing tools



I should always be able to:



\* edit AI output

\* reject AI suggestions

\* override AI decisions

\* lock creative decisions

\* manually create content

\* manually modify prompts

\* reorder scenes

\* reorder shots

\* duplicate shots

\* create alternate versions



Never make the product feel like:



"Tell AI what to make and wait."



It should feel like:



"Develop the film with an intelligent creative assistant."



\---



\# 3. CORE USER JOURNEY



A user should be able to enter something as rough as:



> "I want to make a cinematic film about an old Goan family where a spirit is passed from one generation to another. I imagine the grandfather, a copper still, coconut trees, dawn, and then eventually a modern bottle."



This is intentionally unstructured.



The application should help transform this into:



```text

IDEA

↓

STORY

↓

SCRIPT

↓

DIRECTOR'S VISION

↓

VISUAL DNA

↓

SCENES

↓

SHOTS

↓

SHOT PROMPTS

↓

GENERATION-READY OUTPUT

```



Every stage should preserve the decisions made in previous stages.



\---



\# 4. APPLICATION INFORMATION ARCHITECTURE



The main project structure should be:



```text

PROJECT

│

├── Idea

│

├── Story

│

├── Script

│

├── Director's Vision

│

├── Visual DNA

│

├── Characters

│

├── Locations

│

├── Props / Objects

│

├── Scenes

│   ├── Scene 01

│   │   ├── Scene DNA

│   │   ├── Shot 01

│   │   ├── Shot 02

│   │   └── Shot 03

│   │

│   ├── Scene 02

│   │   ├── Scene DNA

│   │   ├── Shot 04

│   │   ├── Shot 05

│   │   └── Shot 06

│   │

│   └── Scene 03

│

├── Shot Board

│

├── Prompt Lab

│

└── Export

```



This hierarchy must be reflected both in the UI and in the data model.



\---



\# 5. MAIN APPLICATION LAYOUT



The application should have a persistent project workspace.



Suggested structure:



```text

┌───────────────────────────────────────────────────────────┐

│ PROJECT NAME                              Search   Settings │

├───────────────┬───────────────────────────────────────────┤

│               │                                           │

│ PROJECT       │                                           │

│               │                                           │

│ Idea          │                                           │

│ Story         │              MAIN WORKSPACE               │

│ Script        │                                           │

│ Director      │                                           │

│ Visual DNA    │                                           │

│               │                                           │

│ WORLD         │                                           │

│ Characters    │                                           │

│ Locations     │                                           │

│ Props         │                                           │

│               │                                           │

│ PRODUCTION    │                                           │

│ Scenes        │                                           │

│ Shot Board    │                                           │

│ Prompt Lab    │                                           │

│ Export        │                                           │

│               │                                           │

└───────────────┴───────────────────────────────────────────┘

```



The navigation should remain simple.



Do not create unnecessary dashboard pages.



\---



\# 6. PROJECT HOME



The project home should show the film at a glance.



Example:



```text

THE SPIRIT REMEMBERS



Status:

Creative Development



Progress:

Story ✓

Script ✓

Director ✓

Visual DNA ✓

Scenes 3/4

Shots 17/24

Prompts 12/24



────────────────────────



LOGLINE



A spirit travels through generations of a Goan family,

carrying the memory of a place and its craft.



────────────────────────



CORE EMOTION



Nostalgia

Wonder

Pride



────────────────────────



CURRENTLY WORKING ON



Scene 03 — The Distillery

Shot 17

```



This should be a workspace overview, not a metrics-heavy analytics dashboard.



\---



\# 7. IDEA WORKSPACE



This is the starting point.



The user should be able to freely dump ideas.



Allow:



\* plain text

\* paragraphs

\* bullet points

\* fragments

\* dialogue

\* visual thoughts

\* references

\* images

\* random notes



Example:



```text

WHAT'S IN YOUR HEAD?



I imagine an old Goan village at dawn.

A grandfather is walking with his grandson.

There is something about a spirit being passed

between generations.

I want the film to feel ancient but not fantasy.

Maybe we see a copper still.

At the end the spirit becomes the modern bottle.

```



Then provide:



`DEVELOP IDEA`



The AI can analyze the raw material and propose:



\* central idea

\* story premise

\* theme

\* emotional direction

\* possible conflict

\* possible ending

\* unanswered questions



BUT:



Do not overwrite the original idea.



Always preserve:



`ORIGINAL IDEA`



and separately show:



`AI DEVELOPMENT`



\---



\# 8. STORY WORKSPACE



The story workspace should transform the idea into a narrative.



Sections:



\## Premise



\## Logline



\## Beginning



\## Middle



\## Ending



\## Characters



\## Conflict



\## Theme



\## Emotional Journey



\## Message / Meaning



\## Visual Motifs



The user should be able to manually edit every field.



The AI should provide suggestions rather than silently changing the story.



Allow:



\* Regenerate section

\* Expand

\* Shorten

\* Make more emotional

\* Make more grounded

\* Make more cinematic

\* Rewrite

\* Accept

\* Reject



\---



\# 9. SCRIPT WORKSPACE



Support a screenplay-style editor.



Example:



```text

SCENE 01



EXT. GOAN VILLAGE — DAWN



A quiet village slowly emerges from darkness.



Coconut trees move gently in the morning wind.



A twelve-year-old boy follows his grandfather.



&#x20;                   VOICEOVER



&#x20;         Before it was a bottle...

```



Support:



\* scene headings

\* action

\* dialogue

\* character names

\* voiceover

\* transitions

\* notes



The script must remain editable manually.



AI features:



\* continue scene

\* rewrite scene

\* tighten dialogue

\* improve pacing

\* convert story section to screenplay

\* generate alternative ending

\* identify missing visual information



\---



\# 10. DIRECTOR'S VISION



This is one of the most important sections.



The director's vision defines HOW the film should feel and behave visually.



Fields:



\## Genre



Examples:



\* cinematic brand film

\* documentary

\* short film

\* music video

\* fashion film

\* experimental

\* narrative commercial



\## Tone



Examples:



\* intimate

\* mysterious

\* nostalgic

\* surreal

\* grounded

\* luxurious

\* melancholic



\## Emotional Journey



Example:



```text

Mystery

→ Curiosity

→ Nostalgia

→ Wonder

→ Pride

```



\## Pacing



\* slow

\* contemplative

\* moderate

\* fast

\* escalating

\* mixed



\## Camera Philosophy



Describe how the camera behaves.



Example:



```text

Slow deliberate movement.

Mostly observational.

Camera should feel physically present.

Avoid excessive cinematic movement.

Use movement only when emotionally motivated.

```



\## Performance Direction



Example:



```text

Understated.

Natural.

No theatrical acting.

Small facial expressions.

```



\## Editing Philosophy



Example:



```text

Slow cuts in the beginning.

Increasing pace toward the reveal.

Final product shot held longer.

```



\---



\# 11. VISUAL DNA



This is a CORE FEATURE.



Every project must have a persistent Visual DNA.



Visual DNA is the global visual language of the entire film.



It should be editable and lockable.



Sections:



\## Film / Image Character



Example:



```text

35mm cinematic photography

organic photographic imperfections

natural texture

photorealistic

```



\## Color



```text

Muted earth tones

warm highlights

slightly cooler shadows

natural greens

restrained saturation

```



\## Contrast



```text

Soft cinematic contrast

preserved shadow detail

gentle highlight rolloff

```



\## Texture



```text

Fine organic film grain

subtle halation

natural skin texture

slight optical imperfections

```



\## Lighting



```text

Natural motivated lighting

soft sunlight

practical sources

avoid artificial studio appearance

```



\## Atmosphere



```text

Subtle coastal humidity

light atmospheric haze

natural depth

```



\## Camera



```text

Large-format cinematic feel

24mm environmental

50mm character

85mm intimate detail

```



\## Depth



```text

Natural depth of field

shallow focus when emotionally appropriate

```



\## Image Quality



```text

Photorealistic

cinematic

organic

not overly polished

```



\## Avoid



Examples:



```text

Plastic skin

CGI appearance

oversaturated colors

HDR look

excessive sharpening

generic AI faces

fantasy aesthetics unless explicitly requested

```



\---



\# 12. THE PROMPT LAYERING SYSTEM



DO NOT simply append one giant master prompt to every shot.



The application must use a layered prompt architecture.



Final prompt should conceptually be:



```text

GLOBAL VISUAL DNA

\+

PROJECT RULES

\+

SCENE DNA

\+

WORLD CONTINUITY

\+

CHARACTER CONTINUITY

\+

OBJECT / PROP CONTINUITY

\+

SHOT DESCRIPTION

\+

CAMERA

\+

COMPOSITION

\+

LIGHTING

\+

MOTION

\+

EMOTION

\+

NEGATIVE CONSTRAINTS

```



This distinction is critical.



\---



\# 13. GLOBAL VISUAL DNA



Global Visual DNA applies to the entire film.



Example:



```text

35mm cinematic photographic character,

organic film grain,

subtle halation,

muted earth-tone palette,

warm highlights,

slightly cool shadows,

soft cinematic contrast,

naturalistic motivated lighting,

photorealistic,

organic imperfections,

natural skin texture,

restrained saturation.

```



Every shot can inherit this.



If the Visual DNA changes:



```text

Current version affects 24 shots.

```



Show:



`APPLY TO ALL`



or



`APPLY ONLY TO FUTURE SHOTS`



or



`CREATE NEW VISUAL DNA VERSION`



Do not silently modify existing prompts.



\---



\# 14. SCENE DNA



Every scene may override or extend the global visual language.



Example:



GLOBAL:



```text

35mm

organic grain

muted palette

naturalistic

soft contrast

```



SCENE 03:



```text

Interior

dark copper tones

firelight

deeper shadows

mysterious atmosphere

```



The system combines them.



The scene does NOT completely replace the global DNA unless explicitly instructed.



\---



\# 15. WORLD BIBLE



Create persistent entities.



\## Characters



Each character has:



```text

Name

Age

Gender

Appearance

Face description

Hair

Clothing

Body type

Distinctive features

Personality

Performance direction

Reference images

Continuity notes

```



Example:



```text

ARUN



12 years old

curly black hair

brown skin

slim build

white linen shirt

brown shorts

small scar above left eyebrow

quiet and observant

```



\## Locations



Each location has:



```text

Name

Architecture

Geography

Materials

Colors

Weather

Time characteristics

Lighting

Atmosphere

Reference images

```



\## Props / Objects



Each object has:



```text

Name

Physical description

Material

Color

Age

Condition

Dimensions / proportions

Reference images

```



These entities can be attached to shots.



\---



\# 16. LOCK SYSTEM



Anything important should be lockable.



Examples:



```text

🔒 Visual DNA

🔒 Arun

🔒 Old Goan House

🔒 Copper Still

🔒 Goenchi Bottle

```



Locked elements should be treated as constraints.



If the AI wants to change something locked:



Show:



```text

This change conflicts with a locked creative element.



Locked:

Arun — appearance



Suggested change:

Different hairstyle



\[KEEP LOCKED]

\[UNLOCK]

\[CREATE ALTERNATIVE]

```



\---



\# 17. SCENES



Each scene should contain:



```text

Scene number

Scene title

Location

Time

Duration

Story purpose

Emotional purpose

Description

Scene DNA

Characters

Props

Reference images

Shots

```



Example:



```text

SCENE 03 — THE DISTILLERY



Location:

Traditional Goan distillery



Time:

Early morning



Purpose:

Reveal the craftsmanship behind the spirit.



Emotion:

Mystery + intimacy



Scene DNA:

Warm firelight

dark copper

deep shadows

steam

quiet atmosphere

```



\---



\# 18. SHOT SYSTEM



A shot is the fundamental production unit.



Each shot should contain:



\## Basic



```text

Shot number

Title

Duration

Scene

Purpose

Description

```



\## Subject



```text

Primary subject

Secondary subjects

Action

Expression

Position

```



\## Camera



```text

Shot type

Lens

Camera height

Camera angle

Camera movement

Focal distance

Depth of field

Framing

Composition

```



\## Lighting



```text

Source

Direction

Quality

Color temperature

Contrast

```



\## Environment



```text

Location

Weather

Time

Atmosphere

Background

```



\## Motion



```text

Subject motion

Camera motion

Environmental motion

```



\## Emotion



```text

Emotion

Energy

Pacing

```



\## Continuity



Automatically attach:



\* relevant characters

\* relevant location

\* relevant props

\* previous shot

\* next shot



\---



\# 19. SHOT PROMPT GENERATOR



Each shot should have a generated prompt.



The UI should show:



```text

SHOT 07



─────────────────────────────



SHOT DESCRIPTION



Traditional copper still inside a dim Goan distillery.

Steam slowly rises from the vessel as an older man's

hand adjusts the apparatus.



─────────────────────────────



CAMERA



50mm

Medium close-up

Slow push-in

Eye-level



─────────────────────────────



LIGHT



Warm firelight

Soft daylight from window



─────────────────────────────



INHERITED VISUAL DNA



35mm

Organic grain

Muted earth tones

Soft contrast

Naturalistic lighting



─────────────────────────────



CONTINUITY



Grandfather ✓

Copper still ✓

Distillery ✓



─────────────────────────────



FINAL PROMPT



\[Generated prompt]



\[EDIT]

\[COPY]

\[REGENERATE]

```



The generated prompt should be deterministic and understandable.



Do not fill it with meaningless cinematic adjectives.



\---



\# 20. PROMPT PREVIEW



The user should be able to see exactly WHY each part of the prompt exists.



Example:



```text

GLOBAL

35mm cinematic photographic character

↓

SCENE

dark copper interior

↓

CHARACTER

Grandfather appearance

↓

PROP

aged copper still

↓

SHOT

hand adjusting apparatus

↓

CAMERA

50mm slow push-in

↓

LIGHT

warm firelight

↓

NEGATIVE

avoid CGI / plastic skin

```



This transparency is important.



\---



\# 21. SHOT CONTINUITY



The system should understand relationships between shots.



Example:



SHOT 06:



```text

Grandfather walks toward still.

```



SHOT 07:



```text

Grandfather reaches toward still.

```



SHOT 08:



```text

Close-up of his hand.

```



SHOT 09:



```text

Steam rises.

```



The system should warn about obvious continuity problems.



Example:



```text

⚠ Continuity warning



Shot 07:

Grandfather wearing white linen shirt.



Shot 08:

Prompt does not specify clothing.



Use inherited character continuity?

\[APPLY]

```



\---



\# 22. SHOT BOARD



Create a visual storyboard.



Cards:



```text

┌────────────┐

│   IMAGE    │

│            │

│ SHOT 07    │

│ 4 seconds  │

│ 50mm       │

│ Push-in    │

└────────────┘

```



Allow:



\* drag and drop

\* reorder

\* duplicate

\* delete

\* add shot

\* split shot

\* merge conceptual shots

\* zoom

\* fullscreen

\* filter by scene

\* filter by status



\---



\# 23. GENERATION TRACKER



I will generate actual videos outside the application, primarily using Higgsfield.



The application should therefore track generations.



For each shot:



```text

SHOT 07



Generation 01

Generation 02

Generation 03 ★ SELECTED

Generation 04

```



Each generation stores:



```text

Version

Prompt

Reference images

Model

Generation date

Notes

Status

Selected / rejected

Reason

```



Example:



```text

GEN 03 ✓ SELECTED



Notes:

Best facial consistency.

Camera movement slightly too fast.

```



This is useful because AI generation is iterative.



\---



\# 24. REFERENCES



Every shot should support reference images.



References may be:



\* character references

\* location references

\* composition references

\* lighting references

\* product references

\* texture references

\* style references



The UI should clearly distinguish:



`REFERENCE`



from:



`OUTPUT`



Do not accidentally treat every reference image as a style transfer.



\---



\# 25. VERSIONING



Creative work changes.



Support versions for:



\* story

\* script

\* director's vision

\* visual DNA

\* scenes

\* shots

\* prompts



Example:



```text

Visual DNA v1

Visual DNA v2

Visual DNA v3 — CURRENT

```



Allow:



`Compare versions`



and:



`Restore version`



Never destroy previous creative work silently.



\---



\# 26. AI ASSISTANT



The AI assistant should be contextual.



If I'm inside:



`Shot 07`



the AI should know:



\* project

\* story

\* script

\* director's vision

\* global visual DNA

\* scene DNA

\* characters

\* locations

\* props

\* previous shots

\* next shots

\* current shot



I should be able to ask:



> "Make this shot feel more intimate without changing the visual DNA."



Or:



> "Give me three alternative camera approaches."



Or:



> "The previous shot is very static. Give me a transition that naturally leads into this shot."



The AI should respond in context.



\---



\# 27. AI SHOULD NOT DESTROY USER INTENT



Never automatically:



\* rewrite the entire story

\* change characters

\* change visual style

\* change locked elements

\* delete shots

\* reorder shots

\* overwrite prompts



without explicit user confirmation.



Use:



`SUGGEST`



rather than:



`AUTOMATICALLY CHANGE`.



\---



\# 28. EXPORT



The tool should eventually allow production-ready export.



Example:



```text

PROJECT EXPORT



film\_project/

│

├── story/

│   ├── story.md

│   └── script.md

│

├── visual/

│   ├── visual-dna.md

│   ├── director-vision.md

│   └── references/

│

├── world/

│   ├── characters/

│   ├── locations/

│   └── props/

│

├── scenes/

│   ├── scene-01/

│   │   ├── scene.md

│   │   ├── shot-01.md

│   │   ├── shot-02.md

│   │   └── references/

│   │

│   └── scene-02/

│

└── prompts/

&#x20;   ├── shot-01.txt

&#x20;   ├── shot-02.txt

&#x20;   └── ...

```



Also support:



`Export all prompts`



`Export storyboard`



`Export screenplay`



`Export production package`



\---



\# 29. HIGGSFIELD WORKFLOW



Do NOT initially attempt to recreate Higgsfield inside this application.



Do NOT build an AI video-generation backend.



Instead, optimize the application for:



```text

FRAME

↓

Create shot

↓

Generate prompt

↓

Copy prompt

↓

Open Higgsfield

↓

Generate

↓

Return to FRAME

↓

Attach generation

↓

Select version

```



Later, integrations can be added.



The architecture should keep the integration boundary clean.



\---



\# 30. PALMIER WORKFLOW



Palmier is the editing environment.



This application should prepare the material for editing but should not become an editor.



Eventually support:



\* shot durations

\* intended ordering

\* transition notes

\* audio notes

\* edit notes

\* selected generations



Then export a production/editing package.



\---



\# 31. DESIGN LANGUAGE



The interface should feel like a professional creative application.



Desired references in spirit:



\* Figma

\* Final Draft

\* Milanote

\* Linear

\* modern filmmaking software



But do not copy any one product.



Avoid:



\* generic SaaS dashboards

\* excessive rounded cards

\* excessive gradients

\* unnecessary analytics

\* huge AI buttons everywhere

\* childish AI aesthetics

\* excessive animations

\* clutter



The UI should feel:



\* cinematic

\* minimal

\* premium

\* focused

\* dark

\* tactile

\* visual

\* professional



Again, use `theme.md` as the primary visual reference.



\---



\# 32. RESPONSIVENESS



Primary target:



Desktop.



This is a serious creative workspace.



Optimize for:



\* 1440p

\* 1080p

\* large laptop displays



Do not sacrifice desktop productivity just to make a mobile UI.



A tablet/mobile adaptation can come later.



\---



\# 33. KEYBOARD-FIRST INTERACTION



Add useful keyboard shortcuts.



Examples:



```text

N       New shot

S       New scene

P       Prompt

V       Visual DNA

Space   Preview

Cmd/Ctrl + K   Command palette

Cmd/Ctrl + S   Save

Cmd/Ctrl + Z   Undo

```



Add a command palette eventually.



\---



\# 34. DATA MODEL



Use a structured relational data model.



Core entities:



```text

Project

Idea

Story

Script

DirectorVision

VisualDNA

Character

Location

Prop

Scene

SceneDNA

Shot

Prompt

Reference

Generation

Version

```



Relationships should be explicit.



For example:



```text

Project

&#x20;├── VisualDNA

&#x20;├── DirectorVision

&#x20;├── Characters

&#x20;├── Locations

&#x20;├── Props

&#x20;└── Scenes

&#x20;     └── Shots

&#x20;          ├── Prompt

&#x20;          ├── References

&#x20;          └── Generations

```



Do not store the entire project as one giant JSON blob.



The system should remain queryable and extensible.



\---



\# 35. TECHNICAL PRINCIPLES



Prioritize:



\* clean architecture

\* modular components

\* typed interfaces

\* reusable components

\* strong validation

\* autosave

\* versioning

\* predictable state management

\* local-first operation where practical

\* easy future API integration

\* clear separation between UI, business logic and AI services



Do not overengineer V1.



Build a working product first.



\---



\# 36. AI PROVIDER ABSTRACTION



Do not hard-code the application around one LLM provider.



Create an abstraction such as:



```text

AIProvider

&#x20;├── generate

&#x20;├── rewrite

&#x20;├── analyze

&#x20;├── suggest

&#x20;└── structuredOutput

```



Then providers can be changed later.



The AI should return structured data wherever possible.



For example:



```json

{

&#x20; "title": "...",

&#x20; "emotion": "...",

&#x20; "visual\_motifs": \[],

&#x20; "story\_beats": \[]

}

```



rather than relying entirely on free-form text.



\---



\# 37. AUTOSAVE



Creative work must never be easily lost.



Implement:



\* autosave

\* save status

\* draft state

\* undo/redo where practical

\* version history for major changes



Show a subtle indicator:



```text

Saved

```



or:



```text

Saving...

```



Do not use intrusive notifications for every save.



\---



\# 38. MVP SCOPE



Do NOT build everything at once.



Build the MVP in this order:



\## Phase 1



Project creation



Idea workspace



Story workspace



Script workspace



Director's Vision



Visual DNA



\---



\## Phase 2



Characters



Locations



Props



Scenes



Scene DNA



\---



\## Phase 3



Shot builder



Shot board



Prompt generator



Prompt layering



Continuity



\---



\## Phase 4



Reference management



Generation tracker



Versioning



Export



\---



\## Phase 5



AI improvements



Contextual assistant



Continuity warnings



Prompt optimization



Creative suggestions



\---



\# 39. WHAT NOT TO BUILD IN V1



Explicitly avoid:



\* video generation

\* video editing

\* CRM

\* payments

\* team collaboration

\* social media publishing

\* client management

\* brand research

\* web scraping

\* analytics

\* marketplace

\* mobile app

\* complex cloud infrastructure

\* automatic Higgsfield integration

\* automatic Palmier integration



These can be considered later.



The core product must become excellent first.



\---



\# 40. DEVELOPMENT APPROACH



Before writing a large amount of code:



1\. Inspect the existing repository.

2\. Read `theme.md`.

3\. Determine the current stack.

4\. Identify what already exists.

5\. Do not unnecessarily replace existing infrastructure.

6\. Create a clear implementation plan.

7\. Build the application incrementally.

8\. Run the application after meaningful changes.

9\. Test the actual UI.

10\. Fix errors before moving on.



Do not create fake functionality.



If a feature isn't implemented, show an appropriate empty state rather than pretending it works.



\---



\# 41. IMPORTANT UX RULE



At every stage, the user should understand:



\### WHERE AM I?



Example:



```text

Project

→ Scene 03

→ Shot 07

→ Prompt

```



\### WHAT AM I EDITING?



Example:



```text

Shot 07 — Grandfather adjusts the still

```



\### WHAT DOES IT INHERIT?



Example:



```text

Global Visual DNA ✓

Scene DNA ✓

Grandfather ✓

Copper Still ✓

```



\### WHAT WILL CHANGE IF I EDIT THIS?



Make dependencies visible.



For example:



```text

Changing Global Visual DNA may affect 24 shots.



\[VIEW AFFECTED SHOTS]

```



This is essential.



\---



\# 42. THE CORE PROMPT ENGINE



The prompt engine should conceptually work like:



```text

PROMPT =

&#x20;   PROJECT\_RULES

&#x20; + GLOBAL\_VISUAL\_DNA

&#x20; + SCENE\_DNA

&#x20; + WORLD\_STATE

&#x20; + CHARACTER\_STATE

&#x20; + PROP\_STATE

&#x20; + SHOT\_DESCRIPTION

&#x20; + CAMERA

&#x20; + COMPOSITION

&#x20; + LIGHTING

&#x20; + MOTION

&#x20; + EMOTION

&#x20; + NEGATIVE\_CONSTRAINTS

```



But the generated natural-language prompt should not feel like a concatenated database dump.



The AI should intelligently synthesize these inputs into a coherent production prompt.



\---



\# 43. PROMPT CONSISTENCY



The system should preserve consistency while allowing intentional variation.



For example:



Global:



```text

Muted earth tones

```



Scene:



```text

Night

```



Shot:



```text

Warm lantern light

```



The final result should naturally become:



```text

A nighttime scene with muted earth tones,

primarily illuminated by warm practical lantern light...

```



Not:



```text

Muted earth tones, night, warm, cinematic, lantern,

earth, 35mm, beautiful, emotional, dramatic...

```



The prompt generator should prioritize semantic coherence.



\---



\# 44. CREATIVE MEMORY



The project should behave as if it remembers the film.



If the user says:



> "Make the next shot consistent with the grandfather we established earlier."



The AI should retrieve the grandfather's established description.



If the user says:



> "Use the same house."



It should retrieve the location.



If the user says:



> "Continue the visual language."



It should retrieve Visual DNA.



This is one of the most important reasons the structured project model exists.



\---



\# 45. FUTURE EXTENSIBILITY



Design the architecture so future capabilities could include:



\* Higgsfield integration

\* image generation

\* direct video generation

\* MCP tools

\* Palmier integration

\* automatic storyboard image generation

\* timeline synchronization

\* voiceover generation

\* sound design assistance

\* music references

\* shot similarity search

\* continuity analysis

\* AI director agents

\* collaborative filmmaking

\* cloud projects



But do NOT implement these unless they are part of the current phase.



\---



\# 46. FIRST BUILD TASK



Start by inspecting the repository.



Then:



1\. Read `theme.md`.

2\. Analyze the existing codebase.

3\. Identify the framework and architecture.

4\. Propose the folder structure.

5\. Propose the database schema.

6\. Propose the component architecture.

7\. Explain how Visual DNA, Scene DNA and Shot Prompts will interact.

8\. Then implement the MVP.



Do not spend the first step generating huge documentation.



I want a real working application.



\---



\# 47. ACCEPTANCE CRITERIA



The MVP is successful if I can do this end-to-end:



```text

Create Project

↓

Write messy idea

↓

Develop story

↓

Create script

↓

Define Director's Vision

↓

Define Global Visual DNA

↓

Create characters

↓

Create locations

↓

Create scene

↓

Define Scene DNA

↓

Create shot

↓

Define camera / lighting / composition

↓

Generate final prompt

↓

See inherited Visual DNA

↓

See inherited continuity

↓

Copy prompt

↓

Generate externally in Higgsfield

↓

Attach generated result

↓

Select generation

↓

Move to next shot

```



If I can do this smoothly, the core product works.



\---



\# 48. FINAL PRODUCT PRINCIPLE



The entire product should revolve around one principle:



> \*\*Turn imagination into direction.\*\*



The application should help bridge the gap between:



> "I can see this film in my head."



and:



> "Here is exactly how I am going to make every shot."



Do not lose that simplicity.



The product is not about AI for the sake of AI.



It is about giving a filmmaker a structured creative environment where:



\*\*ideas become stories,\*\*



\*\*stories become scripts,\*\*



\*\*scripts become direction,\*\*



\*\*direction becomes visual language,\*\*



\*\*visual language becomes scenes,\*\*



\*\*scenes become shots,\*\*



\*\*shots become consistent prompts,\*\*



and those prompts become production-ready material for external tools such as Higgsfield and Palmier.



Build the tool around that workflow.



