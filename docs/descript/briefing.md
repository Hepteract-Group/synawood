# Descript / Underlord — competitive inventory

Fetched 2026-08-23 from first-party pages only. Citations: [sources.md](./sources.md).

**Verdict:** Descript is a **transcript-first talking-head / podcast / webinar editor**. Underlord is a **chat agent in the right sidebar** of that editor (still **beta**). It is not a separate SKU. Creative Studio’s job is a **30–120s branded ad** (video + music + brand) a marketing team Approves ([ADR-0049](../adr/0049-direct-branded-ad.md), [ADR-0070](../adr/0070-studio-operators-are-a-marketing-team.md)).

**Add vs skip is not this file.** Settled vetoes live in [../competitive/editor-agents.md](../competitive/editor-agents.md). Steal the tools that clean a team take (Studio Sound, pauses, retakes, transcript-as-cut). Do not copy Eye Contact, Green Screen, Rooms, or regenerate-that-changes-words.

---

## Product thesis

**Who it’s for (their words):** anyone on a team who needs video without a video team — marketers, sales engineers, support, CEOs, podcasters, YouTube/LinkedIn creators, L&D, enablement. Homepage: “No video team required.” Enterprise logos: Amazon, Canva, Salesforce, LinkedIn, HubSpot.

**Job to be done:** record or drop in footage → get a transcript → cut by deleting words → polish with one-click AI → publish / clip / translate. Underlord is “tell the editor in English” for people who do not want to hunt menus.

**How Underlord relates:** in-project **sidebar chat** that calls the same tools the AI Tools panel exposes. Templates are saved Underlord prompt chains. API/MCP `Edit with AI` is the same agent, one-shot (no conversation). Help: *“If you can make it in Descript, Underlord can make it easier.”*

https://www.descript.com/ · https://www.descript.com/underlord · https://help.descript.com/getting-started/underlord-beta-your-ai-co-editor-in-descript

---

## Driver legend

| Driver | Meaning |
|---|---|
| **Agent** | Underlord chat (and API/MCP agent job) can be asked to do it |
| **One-click** | AI Tools panel / effect toggle; Underlord can also invoke it |
| **Manual editor** | Script, scenes, timeline, Rooms, recorder — no AI required |
| **Marketing-only** | Slogan or outcome claim with no how-it-works doc |

Help states AI Tools buttons (filler, shorten gaps, Edit for Clarity) still exist **and** Underlord can run them as part of a prompt.

---

## Capability inventory

### A. Underlord (agent)

| Name | What it actually does | Source | Evidence | Driver |
|---|---|---|---|---|
| Underlord chat | Sidebar agent in any project. Reads script, can be pointed at scenes/layers/passages, proposes and applies edits. Beta. | [help](https://help.descript.com/getting-started/underlord-beta-your-ai-co-editor-in-descript) · [page](https://www.descript.com/underlord) | help + feature page | Agent |
| Model picker | Auto, Claude Fable 5 / Haiku 4.5 / Sonnet 5–4.5 (+ Thinking), Opus 5–4.6 (+ Thinking), GPT 5.4/5.5, Gemini 3.1 Pro / 3.5 Flash. Paid for premium. | [help](https://help.descript.com/getting-started/underlord-beta-your-ai-co-editor-in-descript) | help | Agent |
| Agent credits | Each message uses credits. Tool runs charge **brain + tool**. Same prompt, different cost. Chat-only still bills. | [credits](https://help.descript.com/billing-payments-plans/track-and-understand-your-media-minutes-and-ai-credits) | help | Agent |
| Context attach | `@` or right-click: scenes, script selection, layers, files, Speakers, timestamps. | [prompting](https://help.descript.com/ai-assistant/prompting) | help | Agent |
| Revert | Checkpoints in the current chat; Undo; Version History after refresh/close. | [revert](https://help.descript.com/ai-assistant/revert) | help | Agent |
| Chat persistence | Chats survive refresh; older threads listed and auto-titled. | [changelog](https://feedback.descript.com/changelog) | changelog | Agent |
| Self-check pass | After an edit turn, a second pass looks for missed targets / extra deletes. | [changelog](https://feedback.descript.com/changelog) | changelog | Agent |
| Underlord templates | Gallery of multi-prompt workflows; Home or chat → Use template → Underlord asks follow-ups. Style: aspect, tone, layout pack, B-roll, AI speaker, avatar. | [help](https://help.descript.com/templates-and-presets/underlord-templates) | help | Agent |
| Custom templates | Save a prompt as a private template. **Cannot edit/delete after publish; not shareable; cannot remix gallery templates.** | [help](https://help.descript.com/templates-and-presets/custom-templates) | help | Agent |
| “Judgment / vibe editing / max engagement” | Superlatives, no mechanism. | [underlord](https://www.descript.com/underlord) | marketing-only | — |

**Documented example prompts (advertised, not guaranteed):** hide jump cuts with zooms; cut to 2 min on a topic; LinkedIn-post → “5 mistakes” video; webinar trailer; layouts when a feature is named; stock into placeholders; retone an announcement; TED-style policy video; copy one speaker into a new composition; write a demo script; highlight named topics; animated callouts; script analysis; 30s Facebook video; viral-style captions; split into ≤1 min clips; vertical social clips; pan/zoom/fade; translate captions/dub; reverb / Studio Sound intensity; slides/PDF → narrated video with avatar + generated media.

https://www.descript.com/underlord · https://help.descript.com/getting-started/underlord-beta-your-ai-co-editor-in-descript

**Stated agent limits:** cannot edit while you are recording; needs script/narration first; may overpromise or start workflows it cannot finish; check work as you go.

### B. Text-based editing (the editor Underlord drives)

| Name | What it actually does | Source | Evidence | Driver |
|---|---|---|---|---|
| Transcript editing | Transcribe, then delete/move words to cut/rearrange media. Timeline exists for precision. | [home](https://www.descript.com/) · [help](https://help.descript.com/getting-started/edit-like-a-doc) | page + help | Manual; Agent can drive |
| Transcription | Auto transcript on import/record. Help index: 26 languages. Pricing page lists 25 named languages. | [help](https://help.descript.com/script-editing/automatic-transcription) · [pricing](https://www.descript.com/pricing) | help + pricing | One-click |
| Speaker detect | Label 8+ speakers; clip playback to name them. Multitrack transcription for synced mics. | [pricing](https://www.descript.com/pricing) | pricing | One-click |
| Glossary | Drive dictionary for names/jargon. | [pricing](https://www.descript.com/pricing) · [brand](https://help.descript.com/branding/brand-studio) | pricing + help | Manual |
| Correct / realign | Correct mode; wordbar; realign range. | [llms.txt](https://help.descript.com/llms.txt) | help index | Manual |
| Ignore vs delete | Strikethrough ignore vs hard delete. | help index | help | Manual |
| Wordless media (beta) | Script regions with no speech (silence, ambience). | help index | help | Manual |
| Sequences | Bundle cameras/mics/screen as one editable unit; Sequence Editor per track. | help index | help | Manual |
| Scenes | Visual segments with own layout/layers. `/` or split. Video comps only. | [help](https://help.descript.com/getting-started/scenes) | help | Manual; Agent |
| Layouts / layout packs | Reusable scene designs (titles, captions, intros). Formerly called “templates.” Remix + share packs. | [help](https://help.descript.com/templates-and-presets/overview) | help | Manual; Agent |
| Timeline | Trim, split, microfades, freeze frames, gap clips. | help index | help | Manual |
| Layers | Video, image, text, shapes, waveforms, progress bars; placeholders; visual roles. | help index | help | Manual; Agent |
| Action bar | Cmd+K command search. | help index | help | Manual |
| Version history | Auto-save; restore. | help index | help | Manual |

### C. Speech / audio AI

| Name | What it actually does | Source | Evidence | Driver |
|---|---|---|---|---|
| Studio Sound | Regenerative cleanup: noise, echo, enhance voice. File-level; intensity slider; internet. **Max 30 credits/file.** Does **not** run on AI speech until converted to audio. | [help](https://help.descript.com/effects-animations-transitions/studio-sound) · [page](https://www.descript.com/studio-sound) | help + feature page | One-click; Agent |
| Remove filler | Detect um/uh/like/you know; delete, gap, ignore, or strip transcript only. “Avoid harsh cuts.” Changelog 2026-08-05: ES, DE, FR, PT, IT. **Max 30 credits/file.** | [help](https://help.descript.com/script-editing/filler-words) · [sound](https://help.descript.com/descript-tour/sound-good-tools) | help | One-click; Agent |
| Shorten word gaps | Shrink/cut pauses; per-gap or all. | [sound](https://help.descript.com/descript-tour/sound-good-tools) | help | One-click; Agent |
| Remove retakes | Detect repeated lines/false starts; ignore earlier takes. | [sound](https://help.descript.com/descript-tour/sound-good-tools) | help | One-click; Agent |
| Edit for Clarity | Cut wordiness, retakes, filler, off-topic; intensity slider; optional AI speech to smooth. | [sound](https://help.descript.com/descript-tour/sound-good-tools) | help | One-click; Agent |
| Add chapters | Markers/titles in script or timestamp list. | [sound](https://help.descript.com/descript-tour/sound-good-tools) | help | One-click; Agent |
| TTS | ElevenLabs v2 (default) or v3; stock or clone; v3 tone tags `(whisper)`. Languages listed in TTS help (EN, FI, PT, SK, HR, FR, RO, TR, CS, DE, MS, DA, HU, PL, ES, NL, IT, PT-BR, SV). | [help](https://help.descript.com/ai-speech/tts) · [page](https://www.descript.com/text-to-speech) | help + feature page | One-click; Agent |
| Custom voice clone | Record English consent script; minutes to ready. No deceased, no non-consent, no AI-source audio. Accents may flatten (US-English model). | [help](https://help.descript.com/ai-speech/custom-speaker) | help | One-click |
| Stock AI speakers | Gallery; pricing: 25+ Free/Hobbyist, 60+ Creator+. | [pricing](https://www.descript.com/pricing) | pricing | One-click |
| Convert recording → AI speech | Dub original talk track with an AI speaker. | help index | help | One-click |
| Regenerate (audio) | Heal jump cuts / pacing / noise **without changing script**; or **change words** with an authorized clone. **English only.** | [help](https://help.descript.com/script-editing/regenerate-overview) · [page](https://www.descript.com/regenerate) | help + feature page | One-click; Agent |
| Smooth jump cuts | Find every cut and regen audio/video across them. Changelog 2026-08-05: rebuilt modal, audio/video/both. | [help](https://help.descript.com/script-editing/regenerate-overview) · changelog | help + changelog | One-click |
| Room tone | Fill gaps with matched ambience. | help index | help | One-click |
| Auto-level / duck / EQ / VU | Loudness, duck other layers, 5-band EQ, meter. | help index | help | Manual |
| Generate music / SFX | Prompt → music or SFX; duration/tempo/loop; optional lyrics. 1000-char prompt cap. Copyright of output “uncertain.” | [help](https://help.descript.com/generative-media/generate-audio) | help | One-click; Agent |

Regenerate marketing page also says it “livens up” dull delivery — **marketing-only** (no help procedure for “make it more energetic”).

### D. Visual AI (talking-head polish)

| Name | What it actually does | Source | Evidence | Driver |
|---|---|---|---|---|
| Eye Contact | Warp gaze toward camera. Single clear face; not sideways; not VFR; glasses glare hurts; internet. | [help](https://help.descript.com/effects-animations-transitions/eye-contact) · [page](https://www.descript.com/eye-contact) | help + feature page | One-click; Agent |
| Green Screen | AI matte, no physical screen. Toggle after process; all scenes or one. | [help](https://help.descript.com/effects-animations-transitions/green-screen) · [page](https://www.descript.com/tools/green-screen) | help + feature page | One-click; Agent |
| Center Active Speaker (beta) | Reframe to whoever is talking. Best when A/V on one track. | [look](https://help.descript.com/descript-tour/look-good-tools) | help | One-click |
| Automatic Multicam | On multi-track sequences: scenes + switch to speaker. | [look](https://help.descript.com/descript-tour/look-good-tools) | help | One-click; Agent |
| Quick Design | Single-speaker, single-track, **single-scene** rough cut: scenes, layouts, optional stock/AI B-roll. | [look](https://help.descript.com/descript-tour/look-good-tools) · [help](https://help.descript.com/ai-assistant/quick-design) | help | One-click; Agent |
| Video regenerate | Default regen is audio **and** video (mouth). Consent on first use. **Not** on sequences, B-roll, multi-speaker, or face unclear. English only. | [help](https://help.descript.com/script-editing/regenerate-overview) | help | One-click |
| Lip sync (dub) | After dub, warp mouth to translated audio. **Creator+.** | [translate](https://help.descript.com/repurpose/translate-overview) | help | One-click; Agent |
| Blur speaker background | Blur behind person. | help index | help | One-click |
| Skin smoothing | Strength + region. | help index | help | One-click |
| Color / glass blur | Filters, glass blur on shapes. | help index | help | Manual |
| Animations / transitions / Ken Burns / smart transitions | Layer motion, scene transitions, image pans. | help + Underlord table | help | Manual; Agent |
| Edit image with AI | Prompt, or draw a region (changelog 2026-08-05). | changelog · help index | changelog + help | One-click; Agent |

### E. Generative media

| Name | What it actually does | Source | Evidence | Driver |
|---|---|---|---|---|
| Generate image / video | Prompt → options; model picker. Image models: Nano Banana / 2 / Pro, Flux [dev]/Kontext/2 Pro, GPT Image 2, Qwen. Video: PixVerse v5, Hailuo 02, Kling v01/O3/O3 Pro/v3.0/v3.0 Pro, Seedance 2.0 (no face *inputs*), Veo 3.1 / fast, Wan v2.2 turbo. Plan-gated. | [models](https://help.descript.com/generative-media/models) · [pricing](https://www.descript.com/pricing) | help + pricing | One-click; Agent |
| Extend video | Extra frames when a clip is too short. | help index | help | One-click |
| Start/end-frame transition | Morph between two frames. | help index | help | One-click |
| YouTube thumbnail | AI action or ask Underlord. | changelog 2026-08-05 | changelog | One-click; Agent |
| Avatars | Kling Avatar v2 (720p) / v2 Pro (1080p). Gallery 35+; text-prompt avatar; stylize; **photo-upload custom = Business+.** One avatar per speaker. Works with TTS or recorded VO. Attitude prompt. Artifacts: extra background motion, bad hands, fidget in silence. | [help](https://help.descript.com/generative-media/overview) · [page](https://www.descript.com/ai-avatars) | help + feature page | One-click; Agent |
| AI Video Maker | Prompt/script/footage → editable video (ChatGPT script + visuals + TTS on pricing matrix). | help index · [pricing](https://www.descript.com/pricing) | help + pricing | Agent / one-click |
| Style library | Built-in image/video styles. | help index | help | One-click |

Homepage: “generated video, voice, music, and images… with your choice of models.” Confirmed in help for image/video/audio/TTS.

### F. Captions, translation, clips, write, publish copy

| Name | What it actually does | Source | Evidence | Driver |
|---|---|---|---|---|
| Dynamic captions | From script; styles; active/future words; per-speaker layers; save in a layout. Gradient fill (changelog). | [help](https://help.descript.com/visuals/captions) | help | Manual; Agent |
| Translate captions | New composition with translated captions. Pricing lists **61** caption languages. | [translate](https://help.descript.com/repurpose/translate-overview) · [pricing](https://www.descript.com/pricing) | help + pricing | One-click; Agent |
| Dub speech | Translated VO via Speakers. Pricing: **30** dub languages. Styles: Auto / match timing / direct. | same | help + pricing | One-click; Agent |
| Translation proofread | Side-by-side original vs translation. **Business+.** | [translate](https://help.descript.com/repurpose/translate-overview) | help | Manual |
| Do-not-translate list | Brand terms skip translation. | Brand Studio help | help | Manual |
| Create clips | 1–20 clips, 10s–5min, optional layout, optional topic hint → new comps in a folder. Source ≳ clip length; &lt;1 min may yield none. | [help](https://help.descript.com/repurpose/create-clips-from-your-content) | help | One-click; Agent |
| Highlight reel / Find highlights | Compile teasers; mark beats in script. | [repurpose](https://help.descript.com/descript-tour/repurpose-tools) | help | One-click; Agent |
| Write tools | Brainstorm, script, outline, rewrite (selection or whole). | [write](https://help.descript.com/descript-tour/write-tools) | help | One-click; Agent |
| Publish tools | Title, summary, show notes (chapters+timestamps), YouTube description, social post, blog post. | [publish](https://help.descript.com/descript-tour/publish-tools) | help | One-click; Agent |

Marketing translate page: “+130% video output” / “4600% if you translate into 30 languages” — **marketing-only**. Caption page “30+ languages, all lip-synced” vs help’s plan gate for lip-sync — prefer help.

### G. Record, stock, brand, export

| Name | What it actually does | Source | Evidence | Driver |
|---|---|---|---|---|
| Rooms | Browser remote record, up to **10** people, local capture + cloud backup, separate tracks, auto import + transcribe (no extra media minutes for that transcribe). **Not mobile.** | [help](https://help.descript.com/record/rooms-overview) · [page](https://www.descript.com/rooms) | help + feature page | Manual |
| Control Room / producers | Paid: start/stop, push-to-talk, not recorded. Producer caps 3 / 3 / 10 by plan. | [pricing](https://www.descript.com/pricing) | pricing + help | Manual |
| Schedule Room | Future Room + Google/Outlook invite (changelog 2026-08-05). | changelog | changelog | Manual |
| Session hours | 2 / 5 / 15 / 25 recording hours per drive (Free→Business). | [pricing](https://www.descript.com/pricing) | pricing | — |
| Screen recorder | Desktop (and web tab-audio). Screen + cam + mic; optional Studio Sound; teleprompter; Quick Share. **4h max. No 4K screen on Windows.** Up to 2 screens (pricing). | [help](https://help.descript.com/record/screen-recorder) · [page](https://www.descript.com/screen-recording) | help + feature page | Manual |
| Editor recorder | Record into the project. | help index | help | Manual |
| Teleprompter | Script-follow while recording. | help index | help | Manual |
| Zoom / Captivate / Restream import | Cloud recordings into a project. | help index | help | Manual |
| SquadCast | Legacy remote product; billed via Descript if linked. | help index | help | Manual |
| Stock library | Video, images, GIFs, music, SFX (GIPHY + Storyblocks). Search cap: 5 / 12 / unlimited / unlimited. GIPHY **not** commercial. | [media](https://help.descript.com/descript-tour/media-panel) · [pricing](https://www.descript.com/pricing) | help + pricing | Manual; Agent |
| Media library | Reuse drive files without re-counting minutes. | help index | help | Manual |
| Brand Studio | **Business/Enterprise.** One kit/Drive: fonts, colors, share-page logo, default layout pack, ≤50 brand media, glossary, do-not-translate. Enterprise asset permissions. | [help](https://help.descript.com/branding/brand-studio) | help | Manual |
| Export local | MP4/GIF; Free 720p, Hobbyist 1080p, Creator+ 4k; watermark-free on all listed plans. | [pricing](https://www.descript.com/pricing) | pricing | Manual |
| Share page | Hosted player + transcript; duration cap 1h Free/Hobbyist, 3h Creator+. | [pricing](https://www.descript.com/pricing) | pricing | Manual |
| Publish destinations | YouTube; LinkedIn (changelog); podcast hosts (Buzzsprout, Castos, Podbean, Podcast.co, Transistor, Hello Audio, Blubrry, Captivate); Wistia, VideoAsk, eWebinar, HubSpot, Restream, Headliner, Google Drive. SRT/VTT; transcript docx/txt/rtf/md/html. | help index · changelog | help + changelog | Manual; MCP publish = share page |
| Timeline export | Premiere, FCP, Pro Tools, Logic, Audition, Samplitude, Reaper (plan-split on matrix). | [pricing](https://www.descript.com/pricing) | pricing | Manual |
| Batch export | By markers/line breaks or all comps. | [pricing](https://www.descript.com/pricing) | pricing | Manual |
| Live collab | Comments, cursor presence, project links. Seats: 1 / 1 / 1–3 / up to 5. | [pricing](https://www.descript.com/pricing) | pricing | Manual |
| Labs | Opt-in betas. | help index | help | Manual |

### H. API / MCP

| Name | What it actually does | Source | Evidence | Driver |
|---|---|---|---|---|
| HTTP API | Token per Drive. Jobs: import, **agent (Underlord)**, publish. Sync: export transcript. GET projects/jobs/status; DELETE cancel job. Direct upload via signed URL. CLI `@descript/platform-cli` (docs also show `descript-api`). | [help](https://help.descript.com/api-and-mcp/api) · [docs](https://docs.descriptapi.com/) | help + API docs | Agent via API |
| Zapier | Built-in: Import Media, Edit with AI. Other routes via HTTP. | [other](https://help.descript.com/api-and-mcp/other-endpoints) | help | Agent via API |
| MCP | OAuth to one Drive. Server `https://api.descript.com/v2/mcp`. Claude directory + ChatGPT app + custom. Import, Underlord edit, folders, publish share links, poll jobs. | [mcp](https://help.descript.com/api-and-mcp/mcp) · [custom](https://help.descript.com/api-and-mcp/mcp-custom) | help | Agent (external LLM) |

**API agent:** `POST` agent job with `prompt`, optional `project_id` / `project_name`, `composition_id`, `conversation_id`, `callback_url`. Docs: conversation is impractical — **one-shot prompts**. Result includes `agent_response`, `ai_credits_used`.

**Stated API/MCP non-goals:** no local file export (share-page MP4 URL only); no YouTube URL import; jobs expire in 30 days; single-drive scope.

---

## Pricing model

Source of truth: https://www.descript.com/pricing (annual headline / monthly beside it).

| Plan | Price | Media / month | AI credits | Export | Underlord | Notes |
|---|---|---|---|---|---|---|
| Free | $0 | 1 hour | 100 **one-time** on the comparison table (some cards say /month — treat table as stricter) | 720p | Limited | Limited AI Speech trial |
| Hobbyist | $16/mo annual ($24 monthly) | 10 hours | 400/mo | 1080p | Access | Studio Sound, filler, clips, clones, video regen |
| Creator | $24/mo annual ($35 monthly) | 30 hours | 800/mo | 4k | Full + 20+ tools | Latest gen-video models; unlimited stock; top-ups; lip-sync |
| Business | $50/mo annual ($65 monthly) | 40 hours | 1500/mo | 4k | Full | Brand Studio; translate proofread; photo avatars; SLA chat |
| Enterprise | Custom | Custom | Custom | — | — | SSO/SCIM, training opt-out, custom retention, CSM |

Minutes: import, record, Rooms (session length, not × guests), stills = 1 second. Credits: Underlord, Studio Sound, Green Screen, Eye Contact, AI speech, avatars, gen video, etc. **No rollover.** Top-ups: Creator+ (pricing) / some copy says Business. Viewers cannot spend.

Studio Sound + filler: ceiling **30 credits** per file per application.

---

## What they explicitly do **not** do

From help/API, not inference:

- Underlord: **no edits during recording**; needs narration/script first; may agree to work it cannot finish.
- Video regenerate: **no** sequences, B-roll, multi-speaker, occluded face; **English only**.
- Eye Contact: not multi-person, not profile, weak on VFR / tiny faces / glare.
- Studio Sound: not on unconverted TTS; may zero the waveform on extreme noise.
- API/MCP: **no local export**; **no YouTube import**; 30-day jobs; one Drive.
- Rooms: **not mobile**.
- Screen recorder: **4h cap**; **no 4K screen on Windows**.
- Custom Underlord templates: **no edit/delete after save**; **private**; **no remix of gallery**.
- Voice clone: **no dead people, no non-consent, no AI training audio**; consent in English.
- Lip-sync: not Free/Hobbyist.
- Translation proofread: not below Business.
- Photo custom avatars: not below Business.
- GIPHY stock: not commercial.

Not claimed anywhere in this crawl: Remotion/code timeline, Synawood Approve→Final→Schedule, product-context brand DNA, campaign-pack variant matrices, still-to-motion as a named product.

---

## Gap vs Creative Studio

Studio success ([CONTEXT.md](../../CONTEXT.md), [creative-studio.md](../system-design/creative-studio.md), ADR-0049): founder describes (and may attach footage); agent returns a **30–120s ad with video, music, and brand** they can **Approve** without becoming an editor.

| Descript is strong | Studio is aiming at a different job |
|---|---|
| Transcript-first cut of real speech | Generative-first assemble (clips + TTS + Remotion), footage optional |
| Talking-head polish (Studio Sound, eyes, matte, filler, retakes, lips) | Brand-in-media as correctness (prompt + refs + Path C chrome) |
| Rooms + screen recorder + podcast hosts | Not a remote studio; Phase 1 funnel + Studio in parallel |
| Long-form → clips / dub / 61-lang captions | Channel-fit short ads + campaign packs + variants |
| Public API + MCP driving **their** editor | MCP of **our** tools; local-first; Approve gate |
| Brand Studio = fonts/colors/layouts for talking-head comps | Brand kit must appear **in generated pixels**, not only chrome |

Steal vs skip lives in [../competitive/editor-agents.md](../competitive/editor-agents.md) (Veto column). Short version: copy take-cleanup (sound, pauses, retakes, transcript cut). Do not copy Eye Contact, Green Screen, Rooms, SquadCast, podcast RSS, or Overdub-style lip rewrite. We already have filler removal.

**Worth watching:** `@` context + revert checkpoints; saved prompt templates vs our skills; gen-video model picker; captions as a first-class layer; MCP as “external LLM runs the editor.”

**Where we stay different:** weekly Final ads, music + brand required, Approve, content pipeline, no CapCut feature race ([ADR-0004](../adr/0004-parallel-studio-track.md)).

---

## Next

Open [../competitive/editor-agents.md](../competitive/editor-agents.md) and mark the Veto column. URLs for any row: [sources.md](./sources.md).
