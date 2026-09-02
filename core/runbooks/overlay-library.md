# Runbook: Overlay library (Text, Captions, Stickers, Filters, Effects)

**Purpose:** Put type, captions, stickers, a color look, or a clip treatment on a cut — from the Media bin or from chat — without hiring an editor.
**Cadence:** As needed while cutting a 30–120s ad.
**Owner:** Founder (marketing operator) and Studio Agent (same mutations).
**Time budget:** Seconds to place a preset; 1–3 minutes if generating a sticker or transcribing for captions.
**Automation status:** partially automated — bins + Studio Tools; generate/import jobs poll like other generation.

Contracts: [ADR-0057](../../docs/adr/0057-overlay-library-text-captions-stickers.md), [ADR-0058](../../docs/adr/0058-filters-and-treatments.md), [ADR-0059](../../docs/adr/0059-authorable-library-import.md). UX: [overlay-bin.md](../../docs/ux/overlay-bin.md).

## Inputs

- Local review: `npm run dev:review` → Studio project
- Brand kit preferred (type and color inherit; Text still works with defaults)
- Transcript on a clip before “Captions from transcript”
- Confirm spend when generating a sticker or running paid transcription

## Steps

### A — Text

1. Media bin → **Text**. Click Hook / Title / Lower third / CTA or drag onto the overlay lane.
2. Done = type visible on the player at the playhead. Edit copy in the inspector. Do not ask chat to `generate_image` of the words.

### B — Captions

1. Select a clip with speech → Captions → **From this clip’s transcript**. Confirm spend if transcribe is needed.
2. Or **Type a line** at the playhead. Done = caption lane has strips; player shows the band.

### C — Stickers

1. Stickers tab → first-party mark or product library. Drag onto the picture.
2. Resize on the player. Done = alpha graphic, Path C logo still on top. Do not place a sticker as a full-frame MAIN clip.

### D — Filters (looks)

1. Filters tab. Label shows **Apply to cut** or **Apply to selected clip**.
2. Pick VHS / teal / perfume / a library grade. Done = preview grade changes; logo and captions still readable.

### E — Effects (treatments)

1. Select a clip. Effects tab → shake / glow / flash / zoom-punch.
2. Empty state if nothing is selected: “Select a clip on the timeline.” Done = motion on that clip only.

### F — Create or import

1. **New…** / **Generate…** / **Import…** on the relevant tab (ADR-0059).
2. Imported files need **I have the right to use this commercially** before Approve. Agent cannot tick that box.
3. Generate uses the job modal + persistent banner. Reload still shows the job.

## Outputs

- `overlays[]` (text, captions, stickers) and/or clip `filterId` / `treatments[]` / `project.stylePackId`
- Optional `studio_library_items` rows + Blob keys

## Escalation

- Unknown filter/treatment id → Approve fails closed. Do not bypass.
- CapCut / AE project files → refuse (we author in Remotion). GIF without a license → refuse. Licensed Lottie is Wave **2M** Composition source / Product library ([ADR-0091](../../docs/adr/0091-empowered-agent-authored-compositions.md)), not this sticker import path.
- If Generate hangs: check generation jobs banner, not the button label.

## Change log

- 2026-08-22 — Wave 2K contract (ADR-0057–0059).
