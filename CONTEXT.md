# Synawood

In-house go-to-market operating system: runbooks, product context, dashboard, automations, and Creative Studio. Product context is parameterized (`products/{name}/`). `products/demo/` is the stub kit so Studio boots without a customer brand. This repo does **not** ship a the private example GTM pack. The same codebase is becoming a **SaaS** other companies can sign up for ([docs/system-design/saas.md](docs/system-design/saas.md)).

## Language

### SaaS identity

**Account**:
A Supabase Auth user (one email, one user id). Not a Product. Not a membership.
_Avoid_: tenant user, organization as the login unit

**User profile**:
Person-level facts collected at signup (display name, job, optional intent). Skippable. Table `user_profiles`. Not ADR-0037 `functional_role`.
_Avoid_: stuffing profile into `product_members`; blocking invite accept on profile fields

**Organization** (customer chrome):
The company or team that owns Studio, brand, members, and the **billable account** ([ADR-0082](docs/adr/0082-hosted-billing-wallet-entitlements.md)). **Same database row as Product tenancy** (`products` + `product_members` + `product_invites` + `product_billing`). A later ADR may add a parent if one invoice must cover many marketed products.
_Avoid_: a second `organizations` table; tenant; workspace; saying Organization in SQL; billing a personal hobby seat as the primary meter

**Wallet**:
Prepaid generation credits in **pounds** on the Organisation. Debited on confirm-spend. Not tokens. Usage still lives in `CostEvent`.
_Avoid_: a second cost ledger; “unlimited credits”

**Guide** (product tour):
A versioned, dismissable in-app tutorial (`welcome` or `feature`). Progress is per user in Postgres. A new feature uses a new Guide id. Dismissed stays dismissed.
_Avoid_: localStorage as source of truth; Intercom as the system of record; Studio Agent as the teacher

### Operating system

**Synawood**:
The reusable GTM operating system in this repo — core procedures, dashboard, automations, and Creative Studio — applied per Organization (`products` tenancy). Private git slug is `Hepteract-Group/synawood-os` (formerly `marketing-os`). Public Apache snapshot is `Hepteract-Group/synawood`.
_Avoid_: marketing toolkit, growth stack, campaign manager; calling the product Synawood in operator-facing or agent docs

**Product context**:
Everything product-specific for a customer — positioning, brand kit, claims, content — lives on that **Organization** in the app (SQL `products` + brand library). `products/demo/` is a fixture kit for local boot and tests. Do not add a marketed product pack to git.
_Avoid_: tenant, workspace, brand profile; renaming the `products` table to `organizations`

**Core**:
Product-agnostic modules under `core/` (runbooks, channels, analytics, calendar, creative).
_Avoid_: shared lib, platform services

**Runbook**:
A product-agnostic procedure document that defines how a recurring process is executed. Automation implements the runbook; it never replaces reading it.
_Avoid_: SOP dump, playbook script, workflow YAML

**Phase**:
A numbered GTM stage (0–3) with explicit unlock conditions. Creative Studio may run in parallel with Phase 1 as a risk track; it does not redefine phase gates.
_Avoid_: sprint, milestone (unless calendar-specific)

### Funnel & content

**Funnel stage**:
One of the canonical conversion stages in `config.ts` (qualified traffic → … → retained 30d). Followers and reach are diagnostics, never Funnel stages.
_Avoid_: KPI vanity metric, engagement stage

**Content pipeline**:
The filesystem path briefs → drafts → final → published under a product's `content/` folder.
_Avoid_: CMS, media library, asset cloud (unless referring to object storage for renders)

**Brief**:
A planned content slot input (topic, channel, angle) before drafting.
_Avoid_: ticket, assignment (unless GitHub issue)

**Draft pack**:
A week's worth of drafted copy/scripts/assets under `content/drafts/{week}/` awaiting operator review.
_Avoid_: content dump, batch folder (prefer Draft pack)

**Final asset**:
A production-ready media file in `content/drafts/{week}/final/` after Studio cut + operator Approve.
_Avoid_: export blob, render output (those are intermediate)

### Creative Studio

**Creative Studio**:
The in-dashboard chat-to-timeline product for producing Final assets. Operators are a **marketing team** (Product members — ADR-0024 / 0037 / 0070), not a single founder and not live multiplayer. Success: the team describes the ad (and may attach assets); the agent returns a **30–120s ad** they can Approve without hiring an editor or motion designer — talking-head, motion graphics, or both (ADR-0049, ADR-0051, ADR-0091).
_Avoid_: refusing craft because another editor has it; “one founder”; asking the customer to pick a recipe or mode; Google-Docs co-editing on the timeline

**Operator**:
A Product member who cuts, chats, or Approves in Studio (`owner` / `editor`, or functional role `founder` / `editor`). Use this word in Studio docs unless you mean the ADR-0037 functional role named `founder`.
_Avoid_: implying Studio is single-seat; calling live presence “team”

**Studio Project**:
The persisted timeline document (tracks, clips, overlays, audio, optional **composition source**) that the Studio Agent edits. Source of truth for preview and export.
_Avoid_: treating chat as the document; session

**Branch** (Studio Project branch):
A named alternate tip inside one Studio Project (e.g. Funny / Luxury). Every project has a reserved `main`. Distinct from a **variant** child project. See ADR-0030.
_Avoid_: git branch (when meaning Studio), variant (ADR-0027)

**Variant** (Ad Generator):
A child Studio Project forked for a platform × hook × CTA matrix cell (`parent_project_id`). Not a Branch.
_Avoid_: branch, A/B test alone

**Asset intelligence**:
Product-scoped index over `assets` (shots, tags, captions, embeddings, transcripts) for retrieval **and** analyze-on-index workflows. See ADR-0032, ADR-0052, ADR-0053.
_Avoid_: CMS, DAM, media cloud product; Twelve Labs Index as ours

**Visual shot embedding**:
Vector of a Shot keyframe in a multimodal space shared with text queries, so Moments retrieve by appearance. See ADR-0052.
_Avoid_: CLIP as the product name; Marengo; caption-then-text-embed counted as visual; whole-asset visual as the picture-track unit

**Analyze-on-index**:
One Studio Tool (`analyze_asset`) that runs a prompt + JSON schema over an asset or Shot window and writes structured results onto the existing index. See ADR-0053.
_Avoid_: second index; Pegasus as a product; a new agent; one ingest per workflow

**Visual compliance check**:
Analyze-on-index pass that flags Shots against catalog / DNA / `claim-vs-catalog` (on-screen text, logos, unsafe visuals). Does not replace copy lint.
_Avoid_: CCTV product; a separate compliance index; blocking Approve in v1

**Highlight Moment**:
A high-ranking Moment for a query or beat, placed with `place_shot`. Not a separate reel product.
_Avoid_: sports recap product; a new timeline type; “highlight reel” as a customer mode

**Story Builder**:
Media bin **mode** that searches/filters placed assets via asset intelligence — not a separate editor.
_Avoid_: CapCut AI story, autonomous full-cut pipeline

**Extract** (Product):
A scored screenshot, downloaded still, or page-text snippet from a public URL, stored on the Product so every Studio Project can reuse it. Shown in the Media bin **Extracts** tab. Distinct from Brand DNA, Catalog, Library, and `ExtractedBrief`. See ADR-0089.
_Avoid_: hotlinking the live site; scraping login walls; one-off project attachments that vanish with the cut

**Creative constitution**:
The 20 operating principles for Studio ads (audience, one idea, proof, mute-robust, native platform). Wave **2N** / [ADR-0092](docs/adr/0092-creative-constitution.md). Specialists stay skill packs. Source: [principles chat](https://chatgpt.com/share/6a909d42-dab4-83ed-8276-a393f782fae2).
_Avoid_: 13 in-loop agents; “be engaging / tell a story” as the brief; rolling back motion craft because performance ads can look rough

**Extracts tab**:
Media bin mode beside Library and Story. Operator-visible stills and text from Product Extracts, with source URL and quality score.
_Avoid_: burying screenshots on a generation job; a fourth brand surface that duplicates DNA

**Studio Agent**:
The LLM tool-calling loop that mutates a Studio Project via Studio Tools. Not a general coding agent and not a one-shot script pipeline.
_Avoid_: chatbot, autopilot, LangChain agent

**Studio Tool**:
A plain function the Studio Agent may call (add clip, trim, captions, brand kit, render). First-party tools are in-repo (PRs). Extra tools may be **inbound MCP** (ADR-0081), listed in Settings. Same first-party surface later exposed **outbound** over MCP.
_Avoid_: plugin, skill (skills are markdown craft); treating inbound and outbound MCP as one door

**Composition**:
A Remotion React tree that turns a Studio Project into frames (preview) or an encoded file (export). May be a first-party preset **or** project-owned **composition source** the Studio Agent authors (ADR-0091).
_Avoid_: template-only as the product; treating chat as the composition

**Composition source**:
Versioned Remotion TSX stored on the Studio Project. The agent writes and edits it. Preview and export compile it in a sandbox. Path C chrome still wraps the tree.
_Avoid_: prompt history as the TSX; unrestricted Node in the render worker

**Motion seed**:
String on the Studio Project that Remotion `random()` hashes with. Same saved source + seed + assets → the same frames on re-export.
_Avoid_: `Math.random()` in compositions; treating this as Veo “same prompt same pixels”

**Slideshow** / **Carousel pack**:
A Studio format with ordered `slides[]` (background + Path C text), channel presets, optional VO, and Final export as stills and/or vertical MP4. See `docs/architecture/slideshow-infographics.md`.
_Avoid_: carousel-only as a synonym for any image post

**Brand kit**:
Organization-owned visual/audio package (logo, colors, fonts, stills, voice, style) on the Product Brand Library and `project.brand`. `products/demo/brand-kit/` is a fixture seed only. Bound into generation via prompt binding, reference conditioning, and Remotion chrome (see `docs/architecture/brand-in-media.md`).
_Avoid_: theme, design tokens alone, dashboard chrome

**Model Profile**:
Internal registry row: which models to call for reasoner / image / video / speech / transcribe / caption, plus tool gates and limits. Not a customer-facing mode. Customers see generation that just works, a cost confirm when £>0, and optionally Fast / Standard / Best later.
_Avoid_: showing founder-edit, spend, balanced, Live clips, or “Edit only” as product; provider lock; “the model”

**Marketing skill**:
A modular GTM / craft document (channel hooks, slide density, talking-head polish, claim safety) loaded into the Studio Agent. First-party under `core/marketing-skills/` (+ product overlays). Operators may **install** more (Product- or Account-scoped, including skills.sh) — ADR-0080. Distinct from engineering skills in `.agents/skills/`. Not a Studio Tool.
_Avoid_: Cursor skill (when meaning Studio); prompt pack only; installable scripts as skills on hosted SaaS

**Generation Plan**:
Structured shot list + dialogue + model ids + £ on the Studio Project, edited before paid generate. Markdown in the UI is a view. See ADR-0086.
_Avoid_: DirectorPlan (that is an edit diff); calling spoken lines “script”; freeform `plan.md` as source of truth

**Artefacts pane**:
Studio media-bin view of Generation Plan, installed skills (read-only), and brand excerpts. Not a writable filesystem.
_Avoid_: Cursor repo; `writeFile`; executables

**Family adapter**:
Product module for one Gateway model family (duration, stills, prompt tokens, preflight). Add-model: adapter → live smoke → picker (ADR-0084). Vercel owns the wire; we own the adapter.
_Avoid_: dumping `/v1/models` into Send; one `if (seedance)` tower for every vendor

**Frozen model**:
Allowlisted id missing from Gateway with no remap. Picker disabled; no spend (ADR-0085).
_Avoid_: freezing login; treating a remapped id as frozen

**CostEvent**:
A ledger row for a billable reasoner/generator/render call — model, units, estimated/actual GBP, project attribution.
_Avoid_: invoice, Stripe charge

**Publish record**:
DB row (Supabase) tracking distribution of a Final asset — channel, status, posted URL, optional Postiz id. Distinct from Approve.
_Avoid_: post, tweet (too channel-specific as the type name)

**Public API v1**:
HTTP face of first-party Studio Tools (`/api/v1`). Product API keys, idempotency, webhooks. Not MCP, not the Studio Agent reasoner. See ADR-0038.
_Avoid_: GraphQL public RPC; proxying inbound MCP tools; treating keys as user passwords

**API key**:
Owner-created, Product-scoped secret. Hashed at rest. Plaintext shown once at create. Dashboard session stays on `/api/studio/*`.
_Avoid_: putting the secret in git; sharing one key across Products

**API webhook**:
Signed `job.ready` / `job.failed` POST to an operator URL. Distinct from Postiz webhooks and from inbound MCP.
_Avoid_: generic inbound HTTP as a Studio Tool; localhost webhooks on hosted SaaS

**Approve** vs **Publish**:
Approve retains a Final asset in Azure Blob + Supabase. Publish distributes it (paste URL always; Postiz Schedule after Approve — ADR-0063). Never collapse these steps.

**Shot**:
A contiguous visual segment of a video asset (or the whole still), stored on `asset_shots`. Timeline **clips** place shots; shots are not clips.
_Avoid_: scene (Intent/Scenes), clip, take (unless meaning the uploaded file)

**Moment**:
A retrieved Shot (optional transcript window) the Studio Agent can place on the picture track. Comes from asset intelligence (text + visual rank), not from a graph database.
_Avoid_: knowledge-graph node, scene, highlight reel as a type; saying “B-roll” to customers

**Overlay**:
Optional second picture layer on top of the main video (internal track id may still be `track_broll`). Used only when main already has picture and the cut needs it. Customers never pick a talking-head vs B-roll recipe.
_Avoid_: talking head, A-roll, B-roll, PIP as product words; teaching customers editor slang; calling type or stickers Overlay

**Text overlay**:
On-screen type in project `overlays[]` (hook, title, lower third, CTA). Founder and agent both place it. Distinct from Overlay (picture-on-picture) and from Caption.
_Avoid_: caption; generating an image of words instead of a text overlay

**Caption** (Studio):
Timed speech lines on the caption lane. Distinct from asset-intelligence image captions (ADR-0032).
_Avoid_: hook title; a second SRT timeline in v1

**Sticker**:
A graphic with alpha placed on the overlay lane, not a main-track clip and not Path C logo.
_Avoid_: B-roll; treating the logo as a sticker; unlicensed emoji fonts

**Filter** (grade):
A color look on the whole cut (`stylePackId`) or one clip (`filterId`). Lives in the Filters tab.
_Avoid_: effect (that is a Treatment); “filter” as blur-the-face

**Treatment** (effect):
An allowlisted motion recipe on a clip (shake, glow, flash, zoom-punch). Lives in the Effects tab.
_Avoid_: filter; shader; After Effects; clip-to-clip transition

**Library item**:
A product-owned reusable sticker, grade, treatment, or text/caption preset — first-party, generated, or imported.
_Avoid_: marketplace SKU (ADR-0039); Studio Project

**Picture completeness**:
Every second of the requested length has picture on the main video track. Music must not play over black. Enforced in code, then by cut review (ADR-0051).
_Avoid_: “the JSON has clips” as proof the ad is watchable

**Cut review**:
Required vision pass over real player frames (and an optional preview encode) before “make a video” or “make a carousel” can complete. Structured rubric: coverage, motion, size, audio-over-black, brand, brief. Slideshow coverage is slide duration vs export canvas (no empty tail). Same role as tests for a coding agent.
_Avoid_: optional VLM flag; declaring success from timeline JSON; asking the operator to eyeball structure

**B-roll assembly** (internal):
Library-first then generate-to-fill, to cover the picture track. Not a customer-facing mode. Music and brand still required (ADR-0049). Overlay vs main is the agent’s decision (ADR-0051).
_Avoid_: graph database; a “B-roll” product switch; “we cannot make an ad without Remotion”

**Picture layout**:
Where overlay sits relative to the main video — inset, side-by-side, or news split. Stored as `project.pipLayout`. Manual handles stay for fallback edits. Default must be readable; a tiny corner on empty Main is a failed cut.
_Avoid_: treating overlay as a fixed bottom-right sticker; PiP as the name of the product

**Photo-to-life**:
Image + prompt + duration → video of that photo in motion (ADR-0050). The image is the start; the prompt is the action.
_Avoid_: generic pan, text-to-video when they attached a photo

**Generate-to-fill**:
Creating video or stills for holes after library search, until the ad is the requested 30–120s.
_Avoid_: stop at one 4s clip and call it done

**Generator**:
An adapter that produces media (image, video, TTS, music). The Final is the **ad** (video + music + brand) after Approve — however it was encoded.
_Avoid_: treating Remotion as the only allowed encoder

**AI Media**:
Dashboard surface at `/ai-media` for this Product’s Generation Jobs and the assets they produced. Review and place into Studio. No new-generate composer; Retry of a failed job is allowed.
_Avoid_: generator app, Midjourney page, Usage (that is traces + ledger)

**Generation Job**:
An async run that produces or derives media (image, video clip, music, speech, extract, index, transcribe, and other `generation_jobs.role` values). Distinct from a Render Job.
_Avoid_: render, export

**Render Job**:
An async Remotion encode of a Studio Project to MP4/PNG. Must not block the interactive Studio request path.
_Avoid_: build, deploy, generation (that is Generation Job)

**Approve**:
Founder action that promotes a render into a Final asset in Blob/DB. Kill and Regenerate are sibling review actions. Does not post to social.
_Avoid_: publish, merge, schedule
