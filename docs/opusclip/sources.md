# OpusClip primary sources

Facts only. Product recommendation lives in [../competitive/editor-agents.md](../competitive/editor-agents.md). Fetched **2026-08-23** (live browser + first-party pages).

## 1. Homepage

https://www.opus.pro/

Tagline: “1 long video, 10 viral clips.” Drop a video link or upload. Pro ingest sources listed: YouTube, Google Drive, Vimeo, Zoom, Rumble, Twitch, Facebook, LinkedIn, Twitter, Loom, Riverside, StreamYard. Captions claimed “over 97% accuracy.” Free: 7-day Pro trial (90 minutes processing, ~30 clips), then free-forever 60 minutes/month.

Features nav (browser, 2026-08-23):

- AI Producer (New) — raw footage → polished ready-to-post
- Animated captions
- AI Reframe (Updated) — resize for every platform, 1 click
- ClipAnything — any video → shorts
- Social scheduler — a month of posts
- Brand template — font, color, logo, intro/outro
- AI B-Roll — “1 click, under 1 minute”
- Export to XML — Premiere Pro or DaVinci Resolve
- Team workspace
- Editor (Updated) — all-in-one AI editor
- Thumbnail generator (New) — link → YouTube thumbnail
- API — “video API every AI agent can call”
- MCP (New) — “Video MCP any AI agent workflow can use”
- Inspiration gallery

Homepage also names: AI clipping, AI captioning, AI reframe, AI B-roll, AI audio enhance, AI voice-over. ClipAnything vs podcast-only clippers. ReframeAnything: subject tracking + optional manual tracking.

FAQ: ClipAnything covers vlogs, sports, TV, little/no dialogue; natural-language prompts for a specific moment.

## 2. AI Producer / editor agent

https://www.opus.pro/ai-video-editor  
App: https://producer.opus.pro/

Positioning: “THE AI VIDEO EDITOR AGENT.” Two modes, same account: Producer (agent edits raw talking-head) and Editor (human drives text + timeline).

Producer claims (page copy):

- Real footage in. No avatars, no generated speakers, no fake voice.
- One pass: captions, B-roll, motion design, music, SFX; removes filler and dead air.
- Edit log explaining what changed and why.
- Plain-language adjust of *that*, not the whole video.
- Last mile: effect-level selection, undo, restore, targeted regeneration. Chat for intent, timeline for precision.

Browser (same page):

- Demo file `https://public.cdn.opus.pro/assets/editor/AIP_EMAIL.mp4` plus vertical demos (`demo-jon`, `demo-nick`, `demo-nimmin`, `demo-zach`, `demo-guest`).
- Chat chrome: **Smart model** + example `@00:12 select area swap the B-roll`.
- Timeline chrome: **Frame animation** effect blocks; Split / Delete / Volume; **Fade in and out**; **AI B-Roll** and **Stock B-roll** tags.
- Text editor: select transcript → Edit words, Split & Trim, Add emoji, Highlight, Add AI B-Roll, Remove caption, Remove caption & video. Auto emojis / word color.

Editor tabs named on the page: Text-based editing, Timeline editing, Keyboard Shortcuts, Upload custom media assets, Add a section, Custom framing, AI B-Roll, AI Voice-over, Speech enhancement, Filler words removal.

Layouts FAQ: fit, split, fill, **30/70 gameplay**.

Best-fit FAQ: ClipAnything for almost any long video; AI Producer for **short-form, single-speaker** talking-head (third-party writeup also: under 5 min / 1.5GB — not first-party, treat as unverified).

## 3. Agent Opus (generative, not the editor)

https://www.opus.pro/agent  
App: https://agent.opus.pro/

“Create publish-ready AI videos in one click” from scripts, voice, and brand assets. Inputs: idea prompt or upload audio. **Recreate** on example videos (browser: Prime bottle + Logan Paul-style remix). Format chips: AI Ads, Explainer, Audio to video, B-roll enhancement, Personal narrative.

Business claims: upload brand once → ad variants; feed voice/style once.

This is a **different product** from AI Producer (Producer FAQ: never generates speakers). Do not collapse them.

Help: https://help.opus.pro/agent-opus/article/ao-faq  
Prompt guide: https://help.opus.pro/agent-opus/prompt-guide  
Ads library: https://www.opus.pro/agent/ads-library/index  
Pricing (Agent): https://www.opus.pro/agent/pricing

## 4. ClipAnything

https://www.opus.pro/clipanything

Prompt-to-clip any genre. Hands-free vs custom prompt. Claims: visual / audio / sentiment; teasers; highlight reels; clips up to 15 minutes; reframe to 9:16 / 1:1 / 16:9. ClipAnything vs ClipBasic table on the page (talking-head-only basic). Demo roles: social manager, vlogger, sports, news, gamer, etc.

## 5. Reframe / B-roll / audio

- Reframe: https://www.opus.pro/ai-reframe
- Voice enhancer: https://www.opus.pro/tools/voice-enhancer
- Speech enhancement help: https://help.opus.pro/docs/article/speech-enhancement — Pro; AI Enhance tab; separate audio track; noise reduction + voice isolation; toggle compare.
- AI voiceover help: https://help.opus.pro/docs/article/ai-voiceover — TTS; AI hook in the editor; original vs VO sliders; move/delete on timeline.

## 6. MCP / API

https://www.opus.pro/mcp  
Server: `https://mcp.opus.pro/mcp`  
Agent setup: https://help.opus.pro/api-reference/agent-setup

Documented tools (prefixed `opusclip_`, ~27–28): `submit_project` (clip URL; captions, reframe, filler removal, brand template params), `list_clips` (virality scores), `get_transcript`, `export_clip` (HD/4K or Premiere XML), `create_censor_job`, `create_social_copy_job`, `schedule_publish`, `create_thumbnail_job` / `get_thumbnail_job`. Editing scripts retired; `opusclip_edit_clip` is the edit route. Thumbnail job: https://help.opus.pro/api-reference/endpoints/generative-jobs/create-thumbnail-job (7 credits; experimental).

Plan gate: calling tools needs Pro Beta / Max / Business; OAuth otherwise shows upgrade.

## 7. Pricing (clip product)

https://www.opus.pro/pricing

Free $0; Starter **$15/mo**; Pro **$29/mo**; Business custom. XML export on Pro+. AI copilot “prompt to clip” / topics search on Pro+. Processing-speed tiers.

## 8. Extra help/API facts (crawled 2026-08-23)

Do not trust [opus.pro/mcp](https://www.opus.pro/mcp) for the live tool list — it still advertises retired `get_editing_script` / `apply_editing_script`. Help: `opusclip_edit_clip` is the only edit path. `/features` and `/ai-producer` **404**. No public changelog; history is blog posts.

- Virality score 0–99: https://help.opus.pro/docs/article/virality-score
- Speech cleanup (fillers + pauses, user confirms): https://help.opus.pro/docs/article/speech-cleanup
- Auto SFX: https://help.opus.pro/docs/article/auto-sfx
- Video dubbing (clone source voice, 25 langs; transcript edits do not regen dub): https://help.opus.pro/docs/article/video-dubbing
- AI image/stock B-roll: https://help.opus.pro/docs/article/ai-broll — highlight transcript to add
- AI **video** B-roll: https://help.opus.pro/docs/article/ai-video-broll — **cannot yet target a selected sentence**
- Skip clipping (`skipCurate`): captions/reframe only
- XML: captions are burned overlays in Premiere, not editable tracks; ship `.srt` for restyle. One clip at a time. ~1.5h max
- Custom thumbnails: not on YouTube Shorts or X
- OpusSearch waitlist: https://www.opus.pro/opussearch
- REST: `https://api.opus.pro/api/` — Pro Beta / Max / Business. 1 credit ≈ 1 minute of source. Floor 10 credits/API project. 30 req/min. Parallel 4 (Pro Beta/Max) or 50 (Business)
- MCP: `https://mcp.opus.pro/mcp` OAuth. Tool calls need Pro Beta / Max / Business
- Agent Opus FAQ: not a documentary tool; cannot turn one long video into many clips; https://help.opus.pro/agent-opus/article/ao-faq
- Pricing conflicts to check in-app before quoting: help still mentions a **Max** plan (1500 credits) that the public pricing table omits; brand-template counts (help “Pro = 2” vs pricing “up to 4”); video B-roll regen 5 vs 10 credits in the same article

## 9. Absence (do not invent)

No first-party source in this set documents: Remotion/timeline-as-code; Synawood Approve → Final; £ spend caps; required VLM critic on the player; Brand DNA/catalog as we define them; named Studio branches. AI Producer is talking-head polish, not a 30–120s branded-ad assembler with a product kit.
