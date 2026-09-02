# OpusClip + Descript Underlord vs Creative Studio

Decision note. Not an ADR. Founder vetoes below are **settled** (2026-08-23). Contracts: [ADR-0070](../adr/0070-studio-operators-are-a-marketing-team.md)–[0077](../adr/0077-approval-thumbnails.md).

**Sources:** [../opusclip/sources.md](../opusclip/sources.md), [../descript/sources.md](../descript/sources.md), [../descript/briefing.md](../descript/briefing.md) (full Descript inventory).
**Our job:** a **marketing team** shipping 30–120s ads with **video + music + brand**, chat-to-timeline, no freelance editor ([ADR-0049](../adr/0049-direct-branded-ad.md), [ADR-0070](../adr/0070-studio-operators-are-a-marketing-team.md)). Not a CapCut clone ([ADR-0016](../adr/0016-studio-editor-chrome.md)). Not live multiplayer. Not a shorts mill.

Fetched **2026-08-23** in a live browser (product pages + in-page demo videos/UI), plus first-party help/API pages.

---



## Direct answer

1. Veto column below is **settled**. Overrides: auto emoji/highlights **Add**; thumbnails **now on Approve / Work board**; do not copy Opus/Descript MCP (keep ours, #20).
2. The only editor-agent gaps that serve *our* job are talking-head **polish** and **agent-over-timeline** precision — not clipping, avatars, or in-agent posting.
3. Do not copy OpusClip’s “1 long video → 10 viral clips” product. Do not copy Descript’s recording suite (Rooms, eye contact, regenerate-the-words).
4. Studio is for a **marketing team**, not one founder. Team = Product membership + roles. Still **veto live co-editing**.

Closest analogue to the Studio Agent:


| Product                  | Job                                    | Shape                                                                                                                                                                                 |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OpusClip AI Producer** | Raw talking-head → publish-ready short | Chat + timeline. One pass: captions, B-roll, motion, music, SFX, filler/dead air. Edit log. `@00:12 select area swap the B-roll`. [AI Producer](https://www.opus.pro/ai-video-editor) |
| **Descript Underlord**   | Whatever Descript can do, from chat    | Transcript-first. Agent calls Studio Sound, retakes, layouts, captions, clips. [Underlord](https://www.descript.com/underlord)                                                        |
| **Studio Agent**         | 30–120s branded ad                     | Tools mutate one Studio Project. Marketing team operates it ([ADR-0070](../adr/0070-studio-operators-are-a-marketing-team.md)). Critic must watch the player ([ADR-0051](../adr/0051-agent-watches-the-player.md)). |


OpusClip **homepage** and **Agent Opus** are different jobs (clip mill; idea→generative video). Treat them as adjacent, not as the editor-agent spec.

---



## What the browser actually showed



### OpusClip

- Homepage: drop a URL → clips; Agent Opus in the nav. Features menu: AI Producer, animated captions, AI Reframe, ClipAnything, social scheduler, brand template, AI B-roll, XML export, team workspace, editor, thumbnail generator, API, MCP.
- [AI Producer](https://www.opus.pro/ai-video-editor): demo video `AIP_EMAIL.mp4`. Chat: **Smart model** + `@00:12 select area swap the B-roll`. Timeline with **Frame animation** effect blocks. Copy: one pass applies captions, B-roll, motion design, music, SFX; edit log; targeted regen; undo/restore.
- Text-based editor UI: select transcript → Edit words / Split & Trim / Add emoji / Highlight / **Add AI B-Roll** / Remove caption / Remove caption & video. Auto emojis and word color on the script.
- Timeline UI: Split, Delete, Volume, **Fade in and out**, **AI B-Roll** and **Stock B-roll** tags on the lane.
- [Agent Opus](https://www.opus.pro/agent): “Start with an idea” or upload audio. **Recreate** on other people’s videos (Prime bottle / Logan Paul style remix). Formats: AI Ads, Explainer, Audio to video, B-roll enhancement, Personal narrative.

AI Producer FAQ (first-party): **no avatars, no generated speakers, no fake voice.** That is their editor agent. Agent Opus is the opposite (full generative).

### Descript Underlord

- Hero: chat sidebar named **Underlord** over a transcript.
- Demo overlay: “I added zooms to mask the jump cuts, section titles, and placeholders… Want background music?” Follow-up: “Make a copy in German using an AI avatar…” → **Generating avatar…**
- Three cards: zoom cuts + B-roll + title cards; remove repeated takes + long pauses + offer Studio Sound; reformat **9:16**, shorter edit, captions.

---



## Thesis (do not collapse these)


|                          | OpusClip                                                | Descript                                   | Synawood Studio                         |
| ------------------------ | ------------------------------------------------------- | ------------------------------------------ | ------------------------------------------- |
| Who                      | Creators / agencies shipping shorts at volume           | Teams editing recordings like a Google Doc | Marketing team shipping branded ads         |
| Input                    | Long YouTube/podcast/webinar, or a talking-head take    | Recording, transcript, docs/slides         | Brief + brand + optional footage / generate |
| Output                   | Ranked clips, scheduled posts                           | Edited composition, share page, clips      | Final asset after Approve                   |
| Agent                    | AI Producer (edit footage) **or** Agent Opus (generate) | Underlord drives the whole editor          | Studio Agent + Director + critic            |
| Success metric they sell | Views / clip count                                      | Time-to-clean-cut                          | Weekly Finals, zero editor hours            |


We already lead on: Brand kit (Path A/B/C), cost caps (`confirmSpend`), Approve → Final, required player critic (`inspect_preview`), variant matrix, named branches, marketing skills, music license gate, voice-clone consent.

---



## Gap table

**Studio** = what exists as a Studio Tool or shipped contract, not “we could prompt the model.”
**Rec.** = Add now / Later / Never.
**Veto** = settled founder mark (2026-08-23). Empty = agreed with Rec.

Legend for they-have: `P` = OpusClip (Producer/editor), `C` = ClipAnything / clip mill, `A` = Agent Opus, `D` = Descript / Underlord.

### 1. Agent loop (how the editor is driven)


| Capability                                                          | They          | Studio today                                                                                                     | Rec.    | Veto | Why                                                                   |
| ------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------- | ------- | ---- | --------------------------------------------------------------------- |
| Chat agent mutates the cut                                          | P D           | Yes — Studio Agent + tools                                                                                       | —       |      | Already the product                                                   |
| One-pass “make it publish-ready” from a talking-head take           | P             | Partial — ADR-0049 loop + Director; not a single Producer-style pass with SFX/motion/edit log                    | **Add** |      | This *is* the freelance-editor replacement                            |
| Agent explains every decision (founder-facing edit log)             | P             | Partial — Thoughts/receipts ([ADR-0019](../adr/0019-studio-chat-narration-and-receipts.md)); full trace on Usage | **Add** |      | Receipts are tool names, not “why this B-roll at 0:12”                |
| Targeted regen of one effect, not the whole cut                     | P D           | Partial — Director dry-run; no per-effect regen                                                                  | **Add** |      | Matches “change that, not the whole video”                            |
| `@timestamp` / select-area / select-layer in chat                   | P D           | Partial — `@asset:` only                                                                                         | **Add** |      | Seen live: `@00:12 select area swap the B-roll`                       |
| Model picker for the editor agent                                   | P D           | Yes — reasoner beside Send                                                                                       | —       |      |                                                                       |
| Prompt templates / slash commands (stat card, quote callout, intro) | P D           | Partial — marketing skills, overlay presets                                                                      | Later   |      | Skills + overlay library cover this without a second command language |
| Screenshot / canvas crop into chat                                  | P             | No                                                                                                               | Later   |      | Nice; `@clip` + inspect frames may be enough                          |
| Agent watches the player before finishing                           | D (claims)    | **Yes, required** (`inspect_preview`)                                                                            | —       |      | We are stricter than their marketing                                  |
| Post-edit self-check pass                                           | D (changelog) | `inspect_preview` is required, not optional                                                                      | —       |      | Same idea; keep ours as a gate                                        |
| Dry-run Director plan with cost                                     | —             | Yes                                                                                                              | —       |      | They do not show this; keep it                                        |




### 2. Transcript / text-as-timeline


| Capability                                  | They | Studio today                                            | Rec.    | Veto       | Why                                                                              |
| ------------------------------------------- | ---- | ------------------------------------------------------- | ------- | ---------- | -------------------------------------------------------------------------------- |
| Edit video by editing the transcript        | P D  | No — captions exist; deleting words does not ripple-cut | **Add** |            | Highest-leverage talking-head edit. Descript’s whole product. Opus built it too. |
| Select text → split / trim / delete range   | P D  | Timeline split/trim only                                | **Add** |            | Same as above; wire to `apply_cut_list`                                          |
| Auto emoji + word highlights on captions    | P    | Captions from transcript; no auto emoji                 | **Add**   | **Add** (founder) | Style *and* the ad. First pass + overlay presets ([ADR-0075](../adr/0075-word-timed-captions.md)). |
| Edit for Clarity (cut rambling / off-topic) | D    | No                                                      | **Add** |            | Agent-level cut list; same as filler, bigger window                              |
| Add chapters                                | D    | No                                                      | Never   | **Veto**   | Podcast/YouTube long-form. Not 30–120s ads.                                      |




### 3. Talking-head audio polish


| Capability                                       | They | Studio today                                                | Rec.    | Veto     | Why                                                                                        |
| ------------------------------------------------ | ---- | ----------------------------------------------------------- | ------- | -------- | ------------------------------------------------------------------------------------------ |
| Remove filler words                              | P D  | Yes — `remove_fillers` + `apply_cut_list`                   | —       |          | Keep; make the agent actually run it on team takes |
| Shorten pauses / dead air                        | P D  | No (duration auto-fit is empty timeline, not inside speech) | **Add** |          | Same cut-list path as fillers                                                              |
| Remove retakes / false starts                    | P D  | No                                                          | **Add** |          | Opus prices “bad-takes”; Descript has a dedicated tool. Team recordings will have this. |
| Speech enhancement / noise + echo (Studio Sound) | P D  | No                                                          | **Add** |          | Highest-frequency “this take sounds amateur” fix                                           |
| Volume ducking / make speech stand out vs music  | D    | Music bed exists; no auto-duck tool                         | **Add** |          | Required for ADR-0049 (music under picture)                                                |
| Bleep / censor profanity                         | C D  | No                                                          | Never   | **Veto** | Not an ad-editor need. Clip mill / podcast.                                                |




### 4. Picture, captions, motion


| Capability                                                  | They                                                                                                                             | Studio today                                                                                                      | Rec.                           | Veto                                        | Why                                                                                                                             |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Animated / karaoke captions                                 | P D                                                                                                                              | Captions yes; not word-timed pop/emoji motion                                                                     | **Add**                        |                                             | Short ads without readable motion type look unfinished                                                                          |
| AI B-roll from selected line                                | P (image/stock yes; **video B-roll cannot target a sentence yet** — [help](https://help.opus.pro/docs/article/ai-video-broll)) D | Yes — `find_moments` / `assemble_broll` / `generate_video_clip`                                                   | —                              |                                             | We are library-first; they are stock/generate-first. Keep library-first. Their marketing oversells sentence-level video B-roll. |
| Stock B-roll library (Storyblocks / GIPHY)                  | P D                                                                                                                              | No                                                                                                                | Never                          | **Veto**                                    | Brand-bound ads. Stock GIFs fight Path C. Generate or use *our* index.                                                          |
| Jump-cut hide with zooms                                    | D                                                                                                                                | Effect `zoom_punch` exists; agent does not auto-apply on cuts                                                     | **Add**                        |                                             | Tool exists; missing the *policy* (apply on filler/retake cuts)                                                                 |
| Motion design / SFX in the first pass                       | P (Auto SFX help: [auto-sfx](https://help.opus.pro/docs/article/auto-sfx)) D (prompt → SFX)                                      | Music yes; no SFX generator; treatments exist                                                                     | **Add** (SFX + motion presets) |                                             | Producer’s one-pass includes both. Small pack, not a DAW.                                                                       |
| Quote cards / stat charts from transcript                   | P                                                                                                                                | Wave **2M** `CountUp` / kit — [ADR-0091](../adr/0091-empowered-agent-authored-compositions.md)                    | **Add** (2M)                   |                                             | Catalog numbers, not invented proof                                                                                             |
| Clip-to-clip transitions (fade, whip)                       | P D                                                                                                                              | Wave **2M** `TransitionSeries` on authored compositions                                                          | **Add** (2M)                   |                                             | Not an Effects-tab primitive (ADR-0058). In-scope as ad craft.                                                                  |
| Auto layouts: fit / split / fill                            | P D                                                                                                                              | PiP: inset, side-by-side, news                                                                                    | Later                          |                                             | PiP covers ads. 30/70 gameplay is not us.                                                                                       |
| 30/70 gameplay layout                                       | P                                                                                                                                | No                                                                                                                | Never                          | **Veto**                                    | Gaming clip mill.                                                                                                               |
| Custom crop / framing (manual + AI)                         | P D                                                                                                                              | Variants change aspect; no subject-tracking reframe                                                               | **Add** (reframe)              |                                             | 9:16 ads from a 16:9 talking-head is a real team job                                                                         |
| AI object-tracking reframe (ReframeAnything)                | C P                                                                                                                              | No                                                                                                                | **Add**                        |                                             | Same as above. Manual tracking UI can wait.                                                                                     |
| Center active speaker                                       | D                                                                                                                                | No                                                                                                                | Later                          |                                             | Useful if we ever do two-person; not v1 ads                                                                                     |
| Eye Contact (gaze warp)                                     | D                                                                                                                                | No                                                                                                                | Never                          | **Veto**                                    | Face rewrite. Uncanny, consent-heavy, not the ad.                                                                               |
| Green Screen / virtual background                           | D                                                                                                                                | No                                                                                                                | Never                          | **Veto**                                    | Recording studio feature.                                                                                                       |
| Automatic multicam switching                                | D                                                                                                                                | No                                                                                                                | Never                          | **Veto**                                    | Podcast studio.                                                                                                                 |
| Video regenerate (heal jump cuts *and* change spoken words) | D                                                                                                                                | Lip-sync is mock; no face regen                                                                                   | Later (heal cuts only)         | **Veto change-what-was-said**               | Healing a cut ≠ rewriting the founder’s line. Overdub-to-lie is off-thesis.                                                     |
| AI avatars / synthetic presenters                           | A D                                                                                                                              | No. Opus Producer explicitly refuses this.                                                                        | Never                          | **Veto**                                    | ADR-0049 ads use real brand + footage/generate B-roll, not a fake founder.                                                      |
| Thumbnail generator (YouTube)                               | C D                                                                                                                              | Slideshow cover stills only                                                                                       | **Add**                        | **Now, on Approve / Work board**            | Content week, **not** the editor-agent loop ([ADR-0077](../adr/0077-approval-thumbnails.md)).                                    |
| Quick Design (one-click talking-head polish)                | D                                                                                                                                | Director + `apply_brief`; not one button                                                                          | **Add** as the Producer loop   |                                             | Same job as Opus AI Producer. Do not add a second named recipe for the customer.                                                |
| Skin smoothing / blur speaker background                    | D                                                                                                                                | No                                                                                                                | Never                          | **Veto**                                    | Beauty filter, not an ad cut.                                                                                                   |




### 5. Voice, music, generation


| Capability                                    | They | Studio today                                      | Rec.                 | Veto     | Why                                                                                      |
| --------------------------------------------- | ---- | ------------------------------------------------- | -------------------- | -------- | ---------------------------------------------------------------------------------------- |
| TTS / AI voice-over                           | P D  | Yes                                               | —                    |          |                                                                                          |
| Voice clone with consent                      | D    | Yes ([ADR-0060](../adr/0060-live-voice-clone.md)) | —                    |          | Keep consent gate                                                                        |
| Translate + dub                               | D P  | Yes — locale branch + TTS; lipsync mock           | Later (live lipsync) |          | Contract exists; vendor still TBD                                                        |
| Music bed                                     | P D  | Yes — `generate_music` + license gate             | —                    |          | We are stricter on license                                                               |
| Idea / script / audio → full generative video | A D  | Generate clips then assemble                      | —                    |          | We already generate; we must still assemble + brand + critic                             |
| Recreate / remix someone else’s viral ad      | A    | No                                                | Never                | **Veto** | Copyright and brand risk. “Recreate” on Prime/Logan Paul is their growth loop, not ours. |
| Docs / slides → video                         | D    | Slideshow + campaign packs                        | Later                |          | We have a path; do not copy their avatar-hosted explainer.                               |




### 6. Clipping long footage (not the ad job)


| Capability                                                  | They                                                               | Studio today                                                    | Rec.  | Veto                              | Why                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------- | ----- | --------------------------------- | ------------------------------------------------------------------ |
| 1 long video → many ranked shorts (virality score)          | C ([help](https://help.opus.pro/docs/article/virality-score) 0–99) | `analyze_asset` highlight pack; `find_moments`                  | Later | **Veto as a product**             | Useful as a *tool* on a long team take. Do not become OpusClip. |
| OpusSearch (search a catalog / MAM, reuse old clips)        | C waitlist ([opussearch](https://www.opus.pro/opussearch))         | Asset intelligence + Story Builder                              | —     | **Veto copying the waitlist SKU** | We already have the index. Do not bolt on their search product.    |
| Skip clipping (captions/reframe only)                       | C                                                                  | We never auto-slice a long file into shorts                     | —     |                                   | Not a gap.                                                         |
| Prompt-to-find a moment (“Messi goal”, “opening statement”) | C                                                                  | `find_moments` + visual embeddings                              | —     |                                   | We already aimed here (Wave 2J). Keep.                             |
| Highlight reel / teaser stitch                              | C D                                                                | Agent can place shots; no “highlight reel” tool                 | Later |                                   | Optional on long webinars; not the weekly ad.                      |
| Import YouTube / Zoom / Drive URL as source                 | C                                                                  | URL ingest exists ([ADR-0022](../adr/0022-url-asset-ingest.md)) | —     |                                   | Keep ingest; do not add “clip my competitor’s YouTube.”            |




### 7. Brand, variants, distribution


| Capability                                                      | They                 | Studio today                                                                 | Rec.                    | Veto                  | Why                                                    |
| --------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------- | ----------------------- | --------------------- | ------------------------------------------------------ |
| Brand fonts / colors / logo / intro-outro                       | P D                  | **Stronger** — Path A/B/C, Brand DNA, Catalog                                | —                       |                       |                                                        |
| Platform × hook × CTA variants                                  | A (claims) D (clips) | Yes — Ad Generator                                                           | —                       |                       |                                                        |
| In-agent social scheduler / one-click post                      | C D                  | Postiz **after Approve** ([ADR-0065](../adr/0065-schedule-after-approve.md)) | —                       | **Veto in the agent** | Agent must not post. Schedule stays on the Work board. |
| Social copy (title, hashtags, YT description, show notes, blog) | C D                  | Product marketing + skills; not a Studio Tool                                | Later (GTM, not editor) |                       | Do not stuff the editor agent with a content mill.     |
| Analytics of posted clips                                       | C                    | Performance ingestion Wave 2F                                                | Later                   |                       | Already on the roadmap as GTM, not editor.             |




### 8. Interop, teams, capture


| Capability                              | They                                                        | Studio today                                                                                              | Rec.         | Veto                                  | Why                                                          |
| --------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------- | ------------------------------------------------------------ |
| Export XML to Premiere / DaVinci / FCP  | C D (Descript also exports Premiere, FCP, Pro Tools, Logic) | Remotion render                                                                                           | Never        | **Veto**                              | We are the editor. Interchange is how you keep a freelancer. |
| Public video MCP / clipping API         | C D                                                         | Planned: **our** Studio Tools over MCP ([#20](https://github.com/Hepteract-Group/marketing-os/issues/20)) | Later (ours) | **Veto copying theirs. Agreed.** | Ship our tools. Do not wrap OpusClip.                        |
| Team workspace / live multi-editor      | P D                                                         | Product membership + roles ([ADR-0024](../adr/0024-product-auth-and-membership.md) / [0037](../adr/0037-functional-roles.md) / [0070](../adr/0070-studio-operators-are-a-marketing-team.md)). One editor at a time. | Never (live co-edit) | **Veto live multiplayer** | Team is tenancy, not Google-Docs timeline.                   |
| Rooms / remote record / screen recorder | D                                                           | No                                                                                                        | Never        | **Veto**                              | Capture products. The team records elsewhere.                 |
| Keyboard shortcuts on the timeline      | P D                                                         | Partial (split/delete/nudge shipped)                                                                      | Later        |                                       | Already in editable-timeline contract.                       |


---



## Add vs never (ranked)



### Add now (Wave 2L — [ADR-0070](../adr/0070-studio-operators-are-a-marketing-team.md)–[0077](../adr/0077-approval-thumbnails.md))

Implementation issues live under epic [#866](https://github.com/Hepteract-Group/marketing-os/issues/866).

1. **Speech enhance** (noise/echo) — Studio Tool.
2. **Transcript-driven cut** — filler / pause / retake / clarity; ripple (`apply_cut_list`).
3. **Subject-tracking reframe** 16:9 ↔ 9:16.
4. **Chat grounding** — `@t:`, selected clip / overlay / region.
5. **First-pass policy** — team take → enhance + cuts + captions + duck + SFX/zooms + brand + critic. **No** customer-facing recipe name.
6. **Why-log** (“why this cut”) + **targeted regen** of one effect.
7. **Animated / karaoke captions** + **auto emoji and keyword highlights**.
8. **Volume ducking**, **jump-cut zooms** on splices, **small SFX pack**.
9. **Thumbnails at Approve / Work board** (not in the agent loop).

### Later (after Wave 2L)

- Quote cards / stat charts; clip transitions (already deferred ADR-0016 / 0058).
- Auto layouts fit/split/fill; center active speaker.
- Heal jump cuts only (not rewrite speech); highlight-reel tool on a long take (not a virality product).
- Prompt slash-commands; screenshot-to-chat; remaining keyboard shortcuts.
- Live lipsync (already contracted, vendor TBD).
- Social copy / analytics as GTM, not editor.

### Never (vetoed)

- Viral clipping mill / virality scores as the product.
- Agent Opus “Recreate” of other brands’ ads.
- AI avatars / Eye Contact / green screen / multicam / Rooms / screen recorder.
- Regenerate that **changes what was said**.
- Premiere/DaVinci XML.
- Stock GIF libraries.
- In-agent publish/schedule.
- **Live** multiplayer (membership is already the team).
- Gaming 30/70 layout, chapters, profanity censor as a SKU.
- Skin smoothing / background blur.
- OpusSearch as a separate SKU.
- Copying Opus/Descript public MCP (ship ours — #20).

---



## What we should not learn the wrong lesson from

**OpusClip homepage** is a distribution company that also edits. Their MCP `schedule_publish` is the clip mill closing the loop. We already decided Schedule lives after Approve.

**Agent Opus** is a generative-ad toy (idea → video, remix formats). That collides with our generate-then-assemble + brand + critic path. Steal “upload brand once, variants on demand” — we already have it as Ad Generator. Do not steal Recreate.

**Descript** is a recording editor. Underlord is excellent because the *tools* are excellent (Studio Sound, retakes, transcript). Copy the tools that clean a team take. Do not copy the capture surface or the face models.

---



## Pricing (context only)


|                 | OpusClip                                            | Descript                                                     |
| --------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| Free            | $0; trial 90 min processing; then 60 min/month      | $0; 1 media hour; 100 AI credits; limited Underlord          |
| Paid (headline) | Starter **$15/mo**, Pro **$29/mo**, Business custom | Hobbyist **$16**, Creator **$24**, Business **$50** (annual) |
| Meter           | Processing minutes / credits                        | Media hours + AI credits (agent brain *and* tools)           |


We meter **£ spend caps**, not creator-plan SKUs. Keep that.

---



## Next

Contracts are ADR-0070–0077. Implement under [#866](https://github.com/Hepteract-Group/marketing-os/issues/866). Do not ticket vetoed rows.