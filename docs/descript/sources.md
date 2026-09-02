# Descript / Underlord primary sources

Facts only. Product recommendation lives in [briefing.md](./briefing.md). Fetched 2026-08-23.

Help index used as the crawl map: https://help.descript.com/llms.txt

## 1. Product home

https://www.descript.com/

Tagline: “AI-editing for every kind of video.” Edit by typing, or direct the AI co-editor. FAQ: “Descript is an AI video and audio editor that lets you edit by editing text. You record or upload, Descript's AI transcribes it, then you cut, trim, and rearrange the video by changing the transcript.”

Workflow named on the page: Record → Edit → Refine → Share → Multiply. Named AI tools: text-based editing, Studio Sound, Underlord, clips from long-form, generated video/voice/music/images. Use-case carousel: video podcasts, create clips, transcribe video, audio cleanup, make video with AI, screen recording.

ICP on the page: marketing, sales engineer, support, CEO — “No video team required.” Enterprise logos/quotes: LinkedIn, Revelo, HubSpot, Amazon, Canva, Salesforce. SOC 2 Type II, SAML SSO, SCIM, GDPR.

## 2. Underlord marketing

https://www.descript.com/underlord

Positioning: “Your all-in-one video agent.” Copy: “the only AI video editor with the judgment you want in a collaborator” — **marketing-only** (superlative, unproven). “This is vibe editing” — **marketing-only**.

Documented claims on this page:

- Reads script, watches video, decides next steps; suggestions + feedback.
- “Knows everything Descript can do.”
- Bulk/tedious edits; will redo.
- Example jobs: avatar-hosted explainer, edit webinar + promo clips, create a podcast. “If you can make it in Descript, Underlord can make it easier.”
- Writing partner (script from prompt or feedback on a script).
- Convert docs/slides/blog posts/screen recordings into video.
- Bulk examples: center every speaker, bleep language, lower thirds.
- “Edit for maximum engagement” — **marketing-only** (outcome claim).
- Manual path on same page: text-based editing, scenes + layouts, one-click AI actions (gaze, sound, cut retakes, filler).
- AI templates: “battle-tested, customizable workflow, then direct Underlord.”

Example prompts listed (advertised agent tasks, not a guarantee they succeed): hide jumpcuts with zooms; edit to 2 minutes focusing on a topic; 5 common mistakes video from a LinkedIn post; webinar trailer; camera layouts when a dashboard is referenced; add stock to placeholders; re-edit tone; TED-talk style code-of-conduct video; copy one speaker into a new composition; write a product demo script; highlight named topics; animated callouts; analyze a script; 30s Facebook video.

## 3. Underlord help (beta)

https://help.descript.com/getting-started/underlord-beta-your-ai-co-editor-in-descript

“Underlord is Descript’s AI co-editor built specifically for video editing.” Open via Underlord icon in the right-hand sidebar of any project. Still in beta.

Credits: each prompt charges for the “agent brain.” Running a tool also charges for the tool. Non-deterministic cost. Chat-only messages still use credits.

Model picker (cube icon): Auto; Claude Fable 5; Claude Haiku 4.5; Claude Sonnet 5 / 4.6 / 4.5 and 4.6 Thinking; Claude Opus 5 + Thinking / 4.8 / 4.7 / 4.6; GPT 5.4 / 5.4 Thinking; GPT 5.5; Gemini 3.1 Pro; Gemini 3.5 Flash. Premium models on paid plans.

Documented prompt categories: Captions; Clips; Animations & Transitions; Translate; Sound Effects & Music; Slides to Video (TTS + avatar + generated media).

Filler / Shorten Word Gaps / Edit for Clarity moved to the AI tools panel; still callable by Underlord.

Stated limits: “can’t make edits in the background while you’re recording—it needs your narration or script in place first.” May overpromise, make incorrect assumptions, or follow workflows it cannot complete. Point at scenes, layers, or script passages.

Revert: https://help.descript.com/ai-assistant/revert — checkpoints in chat (session only); Undo; Version History after refresh.

Prompting: https://help.descript.com/ai-assistant/prompting — attach scenes, script selections, layers, project files, Speakers, timestamps via `@`.

## 4. Official primer (first-party blog)

https://www.descript.com/blog/article/underlord-ai-video-editor-primer

“an AI agent built into a fully powered video editor.” Single prompt can: generate a rough cut, style visuals, add B-roll, apply Eye contact and Studio sound. Works on the transcript, not the timeline. Save a working prompt as a template. Can search stock or generate unique image/video. Sample chained prompt: remove retakes → filler → Studio sound ~55% → named layout → captions → title card.

“Labs” / “anybody can try it now” in this article — older framing vs current help “Beta”.

## 5. Video editing product page

https://www.descript.com/video-editing

Underlord: write, edit, design, generate visuals or voiceovers under direction. Manual: text-based editing, scenes/layouts. Named AI tools: Green Screen, Eye Contact, Studio Sound, Remove Filler Words, Translation, Transcription, Captions, Avatars, Quick Design, Generate video, Regenerate.

Regenerate FAQ: “Just type the correct word or phrase, and Descript’s AI will clone your voice, match your lip movements, and replace the audio seamlessly. It’s powered by the same technology behind Descript’s Overdub voice model.”

Also: timeline still exists for precision; Mac, Windows, and web; collaboration; YouTube/TikTok/LinkedIn.

## 6. Pricing

https://www.descript.com/pricing

Plans (annual headline / monthly listed beside it): Hobbyist **$16 / $24**; Creator **$24 / $35**; Business **$50 / $65**; Enterprise custom; Free **$0**. “Save up to 35% with annual billing.”

Metering: **media hours** (imported or recorded media, whether transcribed or not) and **AI credits** (Underlord, Studio Sound, Green Screen, Eye Contact, AI-generated media and avatars). Unused minutes/credits do not roll over. Top-ups on Creator+ (and Business). Free comparison table: **100 AI credits (one-time)** — plan card copy on other pages says “100 / month”; treat the comparison table as the stricter claim.

Feature matrix (Free / Hobbyist / Creator / Business) is the most complete advertised inventory. See briefing. Transcription: **26 languages** listed. Caption translation: **61 languages**. Dubbing: **30 languages**. Native-sounding AI speakers: **14 languages**. Rooms: 10 participants; recording hours 2 / 5 / 15 / 25 per drive. Stock search: first 5 / first 12 / unlimited / unlimited. Export: 720p / 1080p / 4k / 4k. Storage: 5GB / 100GB / 1TB / 2TB.

Credits help: https://help.descript.com/billing-payments-plans/track-and-understand-your-media-minutes-and-ai-credits

Studio Sound and Remove Filler Words: **max 30 credits per file/tool application**. Images count as **1 second** of media. Rooms: session length, not per participant. Viewers and project-level Editors cannot spend minutes/credits.

## 7. AI tools panel

https://help.descript.com/descript-tour/ai-tools-overview

Five groups: Sound good, Look good, Repurpose, Publish, Write. Tools may be disabled without a transcript, without a multi-track sequence, on audio-only files, on sequences, or without the right layer selected.

Sound good: https://help.descript.com/descript-tour/sound-good-tools — Edit For Clarity, Studio Sound, Remove Filler Words, Remove Retakes, Shorten Word Gaps, Add Chapters.

Look good: https://help.descript.com/descript-tour/look-good-tools — Quick Design, Eye Contact, Center Active Speaker (beta), Green Screen, Automatic Multicam, Generate media.

Repurpose: https://help.descript.com/descript-tour/repurpose-tools — Create clips, Create highlight reel, Find highlights, Translate.

Publish: https://help.descript.com/descript-tour/publish-tools — Draft a title, Summarize, Show notes, YouTube description, Draft a social post, Draft a blog post.

Write: https://help.descript.com/descript-tour/write-tools — Brainstorm, Write a script, Write an outline, Rewrite.

## 8. Core editor / speech / visuals (help)

Text edit: https://help.descript.com/getting-started/edit-like-a-doc  
Transcription: https://help.descript.com/script-editing/automatic-transcription — 26 languages (index).  
Filler: https://help.descript.com/script-editing/filler-words  
Regenerate: https://help.descript.com/script-editing/regenerate-overview — English only; video regen unsupported on sequences, B-roll, multi-speaker, face not clearly visible.  
Studio Sound: https://help.descript.com/effects-animations-transitions/studio-sound — file-level, internet required; does not apply to AI-generated speech until converted to an audio layer.  
Eye Contact: https://help.descript.com/effects-animations-transitions/eye-contact — single face; not sideways / VFR well.  
Green Screen: https://help.descript.com/effects-animations-transitions/green-screen  
Captions: https://help.descript.com/visuals/captions  
Scenes: https://help.descript.com/getting-started/scenes  
TTS: https://help.descript.com/ai-speech/tts — ElevenLabs Multilingual v2 (default) and v3; tone tags on v3.  
Voice clone: https://help.descript.com/ai-speech/custom-speaker — recorded English consent; no deceased / non-consenting / AI-source clones.  
Avatars: https://help.descript.com/generative-media/overview — Kling Avatar v2 (720p) and v2 Pro (1080p).  
Translate: https://help.descript.com/repurpose/translate-overview — captions, dub, lip sync; proofread Business+; lip-sync Creator+.  
Clips: https://help.descript.com/repurpose/create-clips-from-your-content — 1–20 clips, 10s–5 min.  
Templates: https://help.descript.com/templates-and-presets/underlord-templates — Underlord prompt workflows; layouts are visual, not the same word. Custom templates cannot be edited/deleted after save; private only.  
Brand Studio: https://help.descript.com/branding/brand-studio — Business/Enterprise; one kit per Drive; up to 50 shared media assets.  
Rooms: https://help.descript.com/record/rooms-overview — browser, up to 10 participants, not mobile.  
Screen recorder: https://help.descript.com/record/screen-recorder — desktop; 4 hour max; no 4K screen on Windows.  
Stock: https://help.descript.com/descript-tour/media-panel — GIPHY + Storyblocks; GIPHY not commercial.  
Generate audio: https://help.descript.com/generative-media/generate-audio  
Models: https://help.descript.com/generative-media/models  
Changelog: https://feedback.descript.com/changelog — 2026-08-05: smoother jump cuts, schedule Room, Claude Fable 5, image inpaint, YouTube thumbnail, filler in ES/DE/FR/PT/IT, caption gradients, Underlord thinking ceiling 100→200, LinkedIn publish, MCP import fix.

## 9. API / MCP

Help: https://help.descript.com/api-and-mcp/api  
MCP: https://help.descript.com/api-and-mcp/mcp  
Custom MCP: https://help.descript.com/api-and-mcp/mcp-custom — server `https://api.descript.com/v2/mcp`, OAuth, single Drive.  
Reference: https://docs.descriptapi.com/  
Other endpoints: https://help.descript.com/api-and-mcp/other-endpoints

Documented surface: import media (URL or direct upload); agent edit (`POST …/jobs/agent` or `/v1/jobs/agent` in Zapier samples); list agent models; publish; export transcript; list/get/cancel jobs; list/get projects; status. CLI: `@descript/platform-cli`. Zapier built-in: Import Media, Edit with AI (Underlord).

Stated API/MCP limits: no local export (publish to web link + signed MP4 URL only); no YouTube URL import; job history 30 days; single-drive token/MCP scope.

Changelog (2026-06-11 Telethon / later): MCP listed in Claude connector directory and ChatGPT app marketplace; API open beta for all users.

## 10. Feature landing pages crawled

- https://www.descript.com/eye-contact  
- https://www.descript.com/tools/green-screen  
- https://www.descript.com/studio-sound  
- https://www.descript.com/regenerate  
- https://www.descript.com/captions  
- https://www.descript.com/ai/translate-video  
- https://www.descript.com/ai-avatars  
- https://www.descript.com/text-to-speech  
- https://www.descript.com/screen-recording  
- https://www.descript.com/rooms  

Footer also names (not all fetched as full pages): transcription, remote-recording, captions, translate-video, changelog at feedback.descript.com.

## 11. Absence (do not invent)

No first-party source in this set documents: Remotion/timeline-as-code; a Synawood–style Approve → Final → Schedule pipeline; the private example/product-context brand DNA; campaign-pack variant matrices; still-to-motion as a named product; Postiz-class social scheduling as the core publish path (they publish to YouTube, podcast hosts, LinkedIn, share pages). Underlord is not a standalone SKU.
