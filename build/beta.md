\# FRAME — BETA LAUNCH IMPLEMENTATION



You are working inside the existing FRAME codebase.



Read the entire repository before making changes.



Also read:



\* `README.md`

\* `CLAUDE.md` if present

\* `THEME.md` if present

\* all existing server/client architecture relevant to AI, persistence, settings, projects, exports, and authentication.



Do NOT rewrite the application from scratch.



Do NOT replace working functionality unnecessarily.



The goal is NOT to build a production SaaS yet.



The goal is:



> Take the current local-first FRAME application and turn it into a clean, publicly deployable BETA/demo version that real users can access through a URL.



\---



\# 1. PRODUCT DEFINITION



FRAME is a local-first film development workspace.



Its purpose is:



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



FRAME does NOT generate video and does NOT edit video.



It creates the structured creative blueprint required by those tools.



Preserve this positioning.



Do not turn FRAME into a generic AI chat application.



The existing deterministic prompt engine, visual DNA system, scene/shot breakdown, locks, inheritance, history, Prompt Lab, search, and export workflow are core product functionality and must remain intact.



\---



\# 2. BETA BRANDING



The application must visibly communicate that this is a beta product.



Use:



"FRAME BETA"



or



"FRAME · BETA"



in the appropriate top-level branding locations.



Add a small, tasteful `BETA` badge near the FRAME logo in the main application shell.



Do NOT make the interface look amateurish.



The beta badge should fit the existing visual language.



Example:



FRAME  \[BETA]



Do not put "BETA" on every page.



At minimum:



\* main app/top navigation

\* landing/login experience if one exists



Add a small "Beta" indicator in Settings/About if appropriate.



\---



\# 3. IMPORTANT PRODUCT CONSTRAINT



This is a DEMO/BETA launch.



Do not build:



\* billing

\* Stripe

\* subscriptions

\* teams

\* enterprise accounts

\* complex RBAC

\* organization management

\* advanced analytics

\* production-grade multi-region architecture

\* Kubernetes

\* microservices

\* queues unless already required

\* unnecessary infrastructure



Keep the architecture simple.



The beta should be reliable, secure enough for real users, and easy to deploy.



\---



\# 4. AI MODEL ARCHITECTURE



The current application already has an AI provider abstraction.



Preserve and improve it rather than bypassing it.



The architecture should become:



AIProvider

├── openrouter

├── anthropic

├── structural

└── future providers



Do NOT scatter provider-specific API calls throughout the application.



All AI requests should go through the provider abstraction.



\---



\# 5. HOSTED FREE AI — OPENROUTER



The beta's default hosted AI provider is OpenRouter.



I, the developer, will provide ONE OpenRouter API key through an environment variable.



NEVER expose this key to the browser.



Use:



OPENROUTER\_API\_KEY



on the server only.



The frontend must never receive this key.



The server should make OpenRouter requests.



Use the OpenRouter API in a provider implementation.



The exact model must be configurable through an environment variable:



OPENROUTER\_MODEL



Do not hard-code the model name throughout the codebase.



Example:



OPENROUTER\_MODEL=...



Use the currently configured model as the beta's default model.



Do not assume a specific model if one is already configured in the project.



\---



\# 6. OPENROUTER PROVIDER



Create or modify the provider so it supports the same operations currently supported by the Anthropic provider.



At minimum preserve support for:



\* develop idea

\* story rewriting

\* scene generation/proposal

\* shot generation/proposal

\* Prompt Lab questions

\* camera alternatives

\* any other existing AI-assisted workflow



The provider should receive structured context from the existing application.



Do NOT change the existing prompt/context design unnecessarily.



The existing application already deliberately assembles context from the project.



Preserve that behavior.



\---



\# 7. PROVIDER SELECTION



Create a clean server-side provider selection mechanism.



Conceptually:



getAIProvider(request)



should determine:



1\. If the user explicitly requested BYOK and supplied a valid user key:

&#x20;  use the user's provider/key.



2\. Otherwise:

&#x20;  use the hosted OpenRouter provider.



3\. If hosted AI is unavailable:

&#x20;  fall back to the existing structural provider wherever supported.



The structural provider must remain available.



Do NOT make the app completely dependent on external AI.



\---



\# 8. BYOK



Add a "Bring Your Own Key" feature.



This is a beta feature.



Users should be able to provide their own API key.



At minimum support:



\* Anthropic

\* OpenRouter



Structure the code so additional providers can be added later.



Settings should have something like:



AI PROVIDER



Hosted

FRAME Beta AI



or



Bring your own key



Provider:

\[ Anthropic ▼ ]



API Key:

\[ ••••••••••• ]



\[Save]



\[Remove]



Do not display the complete stored key after saving.



Display masked values only.



Example:



sk-ant-••••••••••••1234



\---



\# 9. BYOK SECURITY



IMPORTANT.



Never log API keys.



Never send the developer's hosted OpenRouter key to the client.



Never expose server environment variables through an API response.



Prefer storing BYOK credentials server-side only if the current architecture supports secure encrypted storage.



For the beta, if secure persistent server-side key storage is not already implemented, it is acceptable to store the BYOK key in the user's browser/local storage with a clear warning that this is a beta feature.



However:



\* never log it

\* never include it in analytics

\* never include it in error reports

\* never send it anywhere except the provider request

\* never include it in project exports

\* never include it in database records containing normal project content unless encrypted storage is explicitly implemented



If secure server-side encrypted storage is implemented, use that instead.



Do not invent a custom cryptographic system.



\---



\# 10. AI SETTINGS UX



Create a clean AI settings section.



Example:



AI



Hosted AI

● FRAME Beta AI

Powered by OpenRouter



Bring Your Own Key

○ Anthropic

○ OpenRouter



\[Configure]



Show a small note:



"FRAME Beta uses a hosted AI model for limited free usage. You can also use your own API key."



Do not mention internal infrastructure unnecessarily.



\---



\# 11. BETA USAGE LIMIT



Because the hosted OpenRouter key belongs to the developer, prevent unlimited anonymous AI usage.



Implement a simple beta usage limit.



Do NOT build a sophisticated billing/credit system.



For beta, use a simple request counter.



Recommended starting configuration:



BETA\_DAILY\_AI\_LIMIT=20



Make it configurable through environment variables.



For example:



BETA\_DAILY\_AI\_LIMIT=20



The server should enforce the limit.



Do not trust a frontend counter.



If authentication exists, associate usage with the authenticated user.



If authentication does not exist yet, implement lightweight authentication as described below.



When the limit is reached, return a clean response:



"Beta AI limit reached. Try again later or use your own API key."



Do not expose internal error details.



BYOK requests should NOT consume the hosted FRAME Beta allowance.



Structural/local operations should NOT consume hosted AI allowance.



\---



\# 12. RATE LIMITING



Add a basic server-side rate limit to AI endpoints.



The objective is abuse prevention, not sophisticated infrastructure.



At minimum protect:



\* AI generation endpoints

\* story rewrite

\* scene generation

\* shot generation

\* Prompt Lab assistant

\* camera alternatives



Use the simplest mechanism compatible with the existing backend.



If the project is deployed with a single server instance, an in-memory limiter is acceptable for beta.



Make it easy to replace later.



Do not introduce Redis just for this beta unless the existing project already uses it.



\---



\# 13. AUTHENTICATION



The beta needs basic user identity if cloud persistence is being introduced.



Prefer Supabase Auth.



Support:



\* email/password

\* Google login if already straightforward to configure



Do not build custom authentication.



Use Supabase Auth.



Supabase Auth provides authentication and integrates with Postgres/RLS.



The UI should have:



Sign in

Create account

Sign out



Do not force complicated onboarding.



\---



\# 14. SUPABASE



Prepare the beta for Supabase.



Use Supabase Postgres for cloud persistence.



Use Supabase Auth for authentication.



Use Supabase Storage only if existing project assets require cloud file storage.



Do not migrate every existing implementation blindly.



First understand the current SQLite schema and persistence architecture.



The current schema is relational and already organized as one table per entity.



Preserve that conceptual structure.



\---



\# 15. DATA MODEL



Users should own their projects.



Conceptually:



user

↓

projects

↓

stories

scripts

director visions

visual DNA

characters

locations

props

scenes

shots

prompt versions

exports



Every cloud-persisted project/entity must be associated with the authenticated user/project.



Do not allow User A to read or modify User B's projects.



Enable Postgres Row Level Security for user/project-owned data.



Supabase explicitly recommends enabling RLS on exposed tables and using authenticated-user policies for row-level authorization.



Do not expose Supabase secret/service keys to the browser. Supabase documents that these keys bypass RLS and must remain server-side.



\---



\# 16. LOCAL MODE MUST NOT BREAK



Very important:



The existing local development workflow must continue working.



Currently:



npm install

npm run dev



must remain usable.



Do not destroy SQLite/local-first development just because cloud persistence is being added.



If possible, support:



LOCAL DEVELOPMENT

→ SQLite



BETA DEPLOYMENT

→ Supabase



Use an abstraction if necessary.



Do not duplicate business logic unnecessarily.



\---



\# 17. PROJECT PERSISTENCE



For beta cloud users:



\* create project

\* save project

\* load project

\* edit project

\* autosave

\* history/versioning

\* delete project

\* export project



must work.



Do not silently lose project data.



The existing application already autosaves and has history/versioning.



Preserve that behavior.



\---



\# 18. DEMO MODE



Create a public demo experience.



The user should be able to see FRAME before committing to it.



Create or preserve a sample project.



Suggested sample:



"FRAME Demo Film"



It should demonstrate:



\* Story

\* Director's Vision

\* Visual DNA

\* Characters

\* Locations

\* Scenes

\* Shots

\* Prompt Lab

\* generated production prompts



Do not require an API key just to explore the demo.



If possible, use the structural provider for static/demo content.



The goal is:



LANDING PAGE

→ TRY DEMO

→ EXPERIENCE FRAME

→ SIGN UP



\---



\# 19. LANDING PAGE



If the current app does not have a landing page, create a minimal one.



Do NOT build a huge marketing website.



The page should communicate:



FRAME

BETA



"From idea to production-ready film blueprint."



Then:



IDEA

→ STORY

→ SCRIPT

→ DIRECTOR'S VISION

→ VISUAL DNA

→ SCENES

→ SHOTS

→ PROMPTS



Primary CTA:



\[Try FRAME]



Secondary:



\[Sign in]



Small text:



"Beta — free to try"



Explain briefly:



"FRAME does not generate video. It prepares the creative blueprint for your video generation workflow."



Keep the page visually consistent with the existing FRAME theme.



\---



\# 20. BETA NOTICE



Add a small beta notice somewhere appropriate.



Example:



"FRAME is currently in beta. Your feedback helps shape the product."



If there is a feedback mechanism, link to it.



Do not create a complicated support system.



\---



\# 21. FEEDBACK



Add a simple feedback option.



For example:



"Feedback"



which opens:



\* feedback text

\* optional category:



&#x20; \* Bug

&#x20; \* Feature request

&#x20; \* General feedback



For beta, this can either:



\* use an existing backend endpoint/database table

\* or link to a configurable feedback URL



Make the feedback URL configurable:



PUBLIC\_FEEDBACK\_URL



If no URL exists, do not show a broken link.



\---



\# 22. ERROR HANDLING



The beta must fail gracefully.



Never show:



\* stack traces

\* API keys

\* environment variables

\* provider raw errors

\* database credentials

\* internal filesystem paths



For AI errors, show:



"FRAME couldn't complete that request. Please try again."



Optionally show a short user-safe reason:



"Your API key may be invalid."



"Beta AI usage limit reached."



"AI provider temporarily unavailable."



Log the technical error server-side.



\---



\# 23. LOADING STATES



Every AI action must have a clear loading state.



Examples:



Developing idea...



Breaking story into scenes...



Breaking scene into shots...



Thinking...



Generating alternatives...



Do not allow accidental duplicate submissions.



Disable the relevant button while the request is running.



\---



\# 24. EXISTING TWO-PHASE SCENE/SHOT WORKFLOW



Do not change this.



The existing architecture deliberately:



1\. proposes

2\. shows proposals

3\. lets the user review/edit/toggle

4\. applies only after confirmation



Preserve this exact behavior.



The AI should never silently write creative material into the project.



This is a core FRAME product principle.



\---



\# 25. LOCKS / VERSIONING / VISUAL DNA



Do not break or simplify:



\* locks

\* Visual DNA inheritance

\* version history

\* snapshots

\* prompt drift detection

\* explicit regeneration

\* scene DNA

\* character/location/prop continuity



These are core features.



Regression-test them.



\---



\# 26. PROMPT LAB



Preserve the Prompt Lab behavior.



The assistant should receive the existing structured project context.



"See context" must continue to show the material that was actually provided to the AI.



Do not secretly add unrelated user/project information.



The assistant should suggest rather than silently modify project data.



\---



\# 27. ENVIRONMENT VARIABLES



Create/update `.env.example`.



At minimum document:



\# Hosted AI



OPENROUTER\_API\_KEY=

OPENROUTER\_MODEL=



\# Beta



BETA\_DAILY\_AI\_LIMIT=20



\# Supabase



SUPABASE\_URL=

SUPABASE\_PUBLISHABLE\_KEY=

SUPABASE\_SECRET\_KEY=



\# App



APP\_URL=



\# Optional



PUBLIC\_FEEDBACK\_URL=



Never commit actual secrets.



Make sure `.env` is in `.gitignore`.



If the project currently uses older Supabase `anon` terminology, preserve compatibility where necessary, but use the current publishable/secret key terminology where appropriate.



\---



\# 28. API SECURITY



Review every backend endpoint.



For each endpoint determine:



\* public?

\* authenticated?

\* project-owned?

\* admin/server-only?



AI endpoints must validate the user/session before applying user-specific hosted usage limits.



Project endpoints must verify project ownership.



Never rely solely on frontend route protection.



\---



\# 29. CORS



Configure CORS correctly for beta deployment.



Do not use:



Access-Control-Allow-Origin: \*



for authenticated/private APIs unless there is a specific reason.



Use the configured APP\_URL.



Allow local development origins when NODE\_ENV is development.



\---



\# 30. PRODUCTION CONFIGURATION



Add:



NODE\_ENV=production



and make sure production behavior does not depend on localhost.



Remove hard-coded:



localhost:5180

127.0.0.1:8787



from production API URLs.



Use environment configuration.



\---



\# 31. DEPLOYMENT TARGET



The deployment should be simple.



Recommended architecture:



Frontend

→ Vercel



Backend

→ Railway / Render / equivalent Node host



Database/Auth

→ Supabase



AI

→ OpenRouter



Do not add additional infrastructure unless required by the current application.



Document deployment steps in:



DEPLOYMENT.md



The document must contain:



1\. Supabase setup

2\. database migration

3\. environment variables

4\. OpenRouter setup

5\. backend deployment

6\. frontend deployment

7\. CORS/APP\_URL configuration

8\. authentication redirect URLs

9\. production smoke test



\---



\# 32. DATABASE MIGRATIONS



Do not manually create production tables without migrations.



Create a reproducible migration process.



Include:



\* schema

\* indexes

\* foreign keys

\* RLS

\* policies



Test the migrations locally before deployment.



\---



\# 33. HEALTH ENDPOINT



Add:



GET /health



Response:



{

"ok": true,

"service": "frame"

}



Do not expose secrets or infrastructure details.



If useful, add:



GET /health/ai



but do not make it call the expensive AI provider on every health check.



\---



\# 34. LOGGING



Add clean server logging.



Every AI request should have a request ID.



Log:



\* request ID

\* authenticated user ID if available

\* operation

\* provider

\* model

\* success/failure

\* duration



Do NOT log:



\* API keys

\* prompt contents unless explicitly required for debugging

\* full user creative content

\* authentication tokens



\---



\# 35. AI COST/USAGE LOGGING



For hosted OpenRouter requests, track:



\* user ID

\* operation

\* provider

\* model

\* timestamp

\* success/failure



If token usage is available from the provider response, store usage metadata.



Do not build a billing system.



This is simply for beta monitoring.



\---



\# 36. SETTINGS



The Settings page should include:



GENERAL



\* appearance/theme if existing

\* account



AI



\* Hosted FRAME Beta AI

\* BYOK provider

\* API key configuration

\* current AI mode



BETA



\* current usage

\* feedback link

\* beta information



ABOUT



\* FRAME version

\* beta status



Do not clutter the Settings page.



\---



\# 37. UI QUALITY



The existing FRAME visual system is important.



Do NOT replace the existing design.



Do not introduce generic SaaS cards everywhere.



Do not make it look like a dashboard template.



Preserve:



\* dark cinematic feel

\* typography

\* spacing

\* existing navigation

\* existing Prompt Lab

\* existing visual hierarchy

\* existing creative-tool feel



Only add the minimum UI required for beta functionality.



\---



\# 38. ACCESSIBILITY



At minimum:



\* buttons must have accessible labels

\* inputs must have labels/placeholders

\* keyboard navigation should work

\* dialogs should be dismissible

\* loading states should be understandable

\* error messages should be readable



Do not spend days on full WCAG compliance for this beta.



\---



\# 39. RESPONSIVE BEHAVIOR



The primary target is desktop.



Make sure the application does not completely break on smaller screens.



Do NOT redesign the entire application for mobile.



For beta, desktop-first is acceptable.



\---



\# 40. EXPORTS



Existing export functionality must continue to work.



Test:



\* project export

\* prompt export

\* production package export



Do not break the current production workflow.



\---



\# 41. SEARCH



Preserve Ctrl/Cmd+K search.



It should continue searching the film/project content as currently implemented.



Do not replace it with a generic site search.



\---



\# 42. AUTOSAVE



Preserve autosave.



Clearly show:



Saving...

Saved

Offline/local

Error



or equivalent existing states.



A beta user must know whether their work has been saved.



\---



\# 43. TESTING



Before declaring the beta ready, test these flows.



\## Flow 1 — Anonymous/demo



Open landing page.



Click Try Demo.



Explore demo project.



No API key required.



No errors.



\---



\## Flow 2 — Signup



Create account.



Sign in.



Create project.



Save project.



Refresh browser.



Project remains available.



\---



\## Flow 3 — Hosted AI



Create project.



Use:



Develop Idea.



Verify request uses OpenRouter.



Verify developer API key is never sent to frontend.



Verify usage counter increments.



\---



\## Flow 4 — Hosted AI limit



Use enough hosted requests to reach the beta limit.



Verify:



\* request is rejected

\* clean message is shown

\* no provider call is made after limit

\* user can still use BYOK



\---



\## Flow 5 — BYOK Anthropic



Configure personal Anthropic key.



Run AI operation.



Verify request uses user's provider/key.



Verify hosted quota is not consumed.



Remove key.



Verify fallback to hosted mode.



\---



\## Flow 6 — Structural fallback



Disable external AI temporarily.



Verify supported structural workflows still work.



\---



\## Flow 7 — Project isolation



Create two test users.



User A must not be able to access User B's project.



Test direct API requests, not only the UI.



\---



\## Flow 8 — Refresh/reload



Create project.



Make edits.



Refresh.



Verify state persists.



\---



\## Flow 9 — History



Edit story.



Create snapshot.



Edit again.



Restore previous version.



Verify restore remains undoable.



\---



\## Flow 10 — Scene/shot generation



Generate scene proposals.



Review.



Edit.



Apply.



Generate shot proposals.



Review.



Apply.



Verify locked entities remain respected.



\---



\# 44. SECURITY REVIEW BEFORE FINISHING



Search the entire repository for:



\* OPENROUTER\_API\_KEY

\* ANTHROPIC\_API\_KEY

\* SUPABASE\_SECRET\_KEY

\* service\_role

\* API keys

\* tokens

\* passwords

\* localhost

\* hardcoded secrets



Make sure no real credentials are committed.



Check `.gitignore`.



Check frontend bundles for secrets.



Check server responses for secrets.



Check browser network requests.



\---



\# 45. DO NOT CHANGE THESE PRODUCT PRINCIPLES



FRAME should remain:



LOCAL-FIRST IN DEVELOPMENT



STRUCTURED



DETERMINISTIC WHERE POSSIBLE



AI-ASSISTED WHERE USEFUL



EXPLICIT



NON-DESTRUCTIVE



CREATIVE-CONTEXT AWARE



PROMPT-TRANSPARENT



USER-CONTROLLED



The AI proposes.



The user decides.



The system should never silently rewrite creative work.



\---



\# 46. IMPLEMENTATION PROCESS



Do this in phases.



PHASE 1

Inspect the entire codebase.



Output a concise architecture report before modifying anything:



\* frontend

\* backend

\* database

\* AI provider

\* settings

\* routing

\* persistence

\* deployment blockers



Then proceed.



PHASE 2

Implement provider abstraction/OpenRouter hosted AI.



PHASE 3

Implement BYOK.



PHASE 4

Implement beta usage limits and rate limiting.



PHASE 5

Implement Supabase auth/cloud persistence while preserving local SQLite development.



PHASE 6

Add beta branding and demo mode.



PHASE 7

Security hardening.



PHASE 8

Deployment configuration.



PHASE 9

Run tests/build.



PHASE 10

Perform a final beta-readiness audit.



\---



\# 47. IMPORTANT CODING RULES



Do not rewrite working files unnecessarily.



Do not create duplicate implementations.



Do not introduce dependencies without checking whether the project already has an equivalent.



Prefer small, maintainable modules.



Follow the existing code style.



Keep provider-specific code isolated.



Keep authentication isolated.



Keep persistence isolated.



Keep business logic independent of Supabase where possible.



Keep local development working.



\---



\# 48. FINAL DELIVERABLE



At the end, provide:



1\. Files changed

2\. Files created

3\. Database migrations created

4\. Environment variables required

5\. Commands to run locally

6\. Supabase setup steps

7\. OpenRouter setup steps

8\. Deployment steps

9\. Test results

10\. Known beta limitations

11\. Exact URL/configuration values I need to fill in

12\. Any remaining blockers



Do not claim the application is production-ready.



Call it:



"FRAME Beta — ready for public demo"



only after the required flows pass.



\---



\# FINAL PRODUCT GOAL



When this work is complete, I should be able to:



1\. Push the repository to GitHub.

2\. Create a Supabase project.

3\. Add environment variables.

4\. Add my OpenRouter API key.

5\. Deploy the backend.

6\. Deploy the frontend.

7\. Open the public FRAME URL.

8\. See "FRAME BETA".

9\. Try the demo without an API key.

10\. Create an account.

11\. Create my own project.

12\. Use the hosted OpenRouter model within a beta limit.

13\. Add my own Anthropic/OpenRouter API key.

14\. Use BYOK without consuming hosted quota.

15\. Refresh/reopen the project and retain work.

16\. Generate scenes and shots.

17\. Use Prompt Lab.

18\. Export the project.

19\. Give the beta to real users.



That is the entire scope.



Do not expand the scope beyond this unless a change is necessary to make the beta actually work.



