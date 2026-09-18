# FRAME · BETA

### From a film idea to a production-ready creative blueprint.

**[→ Try FRAME Beta](YOUR_DEMO_URL_HERE)**

---

You have an idea for a film.

Maybe it's a scene you've been thinking about.
Maybe it's a character.
Maybe it's just one really good shot in your head.

The problem starts when you try to actually make it.

The story lives in one place.
The character description is somewhere else.
Your visual style changes from prompt to prompt.
Scenes get disconnected.
And after a while, you're basically fighting your own AI tools to keep the film consistent.

**FRAME is built for that part.**

It takes an idea and turns it into a structured creative blueprint that you can actually take into your video generation workflow.

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
PROMPTS
  ↓
HIGGSFIELD / PALMIER / YOUR WORKFLOW
```

FRAME doesn't generate the final video.

**It prepares everything that comes before it.**

---

## Why FRAME?

AI video generation is getting incredibly good.

But generating a cool shot isn't the same thing as directing a film.

A film needs continuity.

The same character should still feel like the same character.
A location should have a visual identity.
The lighting shouldn't randomly change between shots.
The camera language should feel intentional.
And when you change something important, you shouldn't have to manually fix twenty different prompts.

That's what FRAME is trying to solve.

Instead of treating every prompt as an isolated request, FRAME treats the film as **one connected creative system**.

Your characters, locations, props, scenes, shots and visual language all live together.

And when a shot is generated, it knows where that information came from.

---

## The interesting part

FRAME isn't just a prompt generator.

Underneath it is a structured model of the film.

A shot can inherit things like:

* Global Visual DNA
* Scene-specific visual language
* Character state
* Location state
* Prop state
* World state
* Camera
* Composition
* Lighting
* Motion
* Emotion
* Negative constraints

The prompt engine then brings those layers together into one production prompt.

So instead of:

> "A man walks through a dark hallway..."

you can build something much closer to an actual piece of direction — where the **story, world, character, visual language and shot itself all inform the result.**

---

## AI proposes. You decide.

This is probably the part of FRAME I care about most.

AI shouldn't silently rewrite your film.

When FRAME breaks a story into scenes or a scene into shots, it **proposes** what it thinks the structure could be.

You get to review it.

Edit it.

Reject it.

Then apply it.

Nothing gets written into the project just because an AI model decided it should. The existing scene/shot workflow is deliberately two-phase: propose → review → edit → apply.

That philosophy runs through the rest of FRAME too.

**AI assists the director. It doesn't become the director.**

---

## Visual DNA

One of the core ideas behind FRAME is **Visual DNA**.

Think of it as the visual language of your film.

Palette.
Contrast.
Texture.
Lighting language.
The overall feeling of the world.

The film can have a global Visual DNA, while individual scenes can extend or override it when needed.

And because it's versioned, changing your visual direction doesn't have to destroy what you've already built.

This is less about making a prettier prompt.

It's about giving the entire film a **visual memory**.

---

## Prompt Lab

Then there's the Prompt Lab.

Instead of asking an AI something with no context, FRAME can give it the context of the film you're actually working on.

The assistant can see things like:

* the logline
* tone
* camera philosophy
* Global Visual DNA
* Scene DNA
* attached characters
* locations
* props
* surrounding shots

And you can actually inspect the context it received.

So the assistant isn't supposed to magically know what you meant.

**You can see what it knows.**

And again, it suggests rather than silently changing the project.

---

## Continuity without the spreadsheet nightmare

Characters, locations and props aren't just text attached to random prompts.

They're part of the project.

Scenes reference them.
Shots inherit from them.
Locked elements stay locked.
Versions can be restored.
Prompts can be checked against the state they're supposed to represent.

FRAME also keeps history instead of casually destroying previous creative decisions.

The goal is simple:

**Change your film without losing your film.**

---

## Built for the AI video workflow

FRAME deliberately sits **before** the video generation tools.

It doesn't try to replace them.

You can take the production-ready material from FRAME and continue into tools such as **Higgsfield, Palmier, or whatever comes next**.

That means FRAME is focused on the part of the workflow that tends to get messy:

**developing the film itself.**

---

# What you can do in the Beta

The current beta includes:

* 🎬 Idea development
* ✍️ Story development and rewriting
* 📜 Script structure
* 🎥 Director's Vision
* 🧬 Global + Scene Visual DNA
* 👤 Character / Location / Prop continuity
* 🎞️ Scene breakdown
* 📷 Shot breakdown
* 🧠 Prompt Lab
* 🔒 Creative locks
* 🕐 Version history & snapshots
* 🔍 Full-project search
* 💾 Autosave
* 📦 Production/package exports
* 🤖 AI-assisted workflows
* 🔑 Bring Your Own Key (BYOK)
* 📴 Structural/local fallback where supported

The underlying prompt engine is deterministic and can work without a model, while AI-assisted workflows can use the configured provider when available.

---

# A little different from another AI chat app

FRAME isn't trying to be:

> "Chat with AI about your movie."

There are plenty of ways to do that.

FRAME is closer to:

> **"Build the movie."**

The AI is one component.

The actual product is the **creative system around the AI**.

---

# 🚧 This is a Beta

FRAME is still early.

This is a public beta/demo, not a finished production SaaS product.

Some things will change.

Some things will probably break.

And honestly, that's part of why I'm putting it out there.

I'd rather get FRAME into the hands of people who actually make films, experiment with AI video, write stories, direct, storyboard, or just have weird ideas they want to turn into something — and see where it goes.

If you try it, **I'd genuinely like to know what feels useful, what feels annoying, and what's missing.**

---

# → Try it

### **[LAUNCH FRAME BETA](YOUR_DEMO_URL_HERE)**

No need to read a 20-page manual first.

Open it.
Create something.
Break something.
See if the workflow makes sense.

That's the point of the beta.

---

## A note on the name

**FRAME** is about the moment where an idea starts becoming something you can actually see.

One frame becomes a shot.

Shots become scenes.

Scenes become a film.

And somewhere in between the idea in your head and the final generated video, there needs to be a place where the whole thing makes sense.

**That's what I'm building with FRAME.**

---

## Built with

* React / Vite
* Node.js
* SQLite for local-first development
* Structured prompt composition
* AI provider abstraction
* OpenRouter / Anthropic
* Supabase for beta cloud infrastructure
* And a frankly unreasonable amount of iteration

---

## Status

**FRAME · BETA**

Built enough to try.

Not finished enough to stop changing.

**→ [Try the Beta](YOUR_DEMO_URL_HERE)**

---

*If you make something interesting with FRAME, I'd love to see it.*
