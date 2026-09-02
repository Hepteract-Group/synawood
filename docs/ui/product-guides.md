# Product Guides (UI)

Visual spec for dismissable Guides. Behaviour: [ux/product-guides.md](../ux/product-guides.md). Components: [components.md](./components.md). Motion: [motion.md](./motion.md).

---

## 1. Layering (z-order)

From back to front:

1. App shell (sidebar, Studio, etc.)
2. Dim overlay (`rgba` using existing overlay token, ~40–50% black). Pointer events: click overlay = Not now **only on the start modal**. During steps, overlay click does **not** dismiss (too easy to lose place); use Skip guide.
3. Spotlight hole (optional): higher contrast border 2px using focus token around the target. Do not use a second neon.
4. Dialog / step card
5. Persistent **Guide** chip (always clickable; z above Studio chrome, below system dialogs)

Start modal and step card are **not** nested inside Studio’s generation toast. Generation status still wins (banner under the player; [ADR-0087](../adr/0087-generation-toast.md)).

---

## 2. Start modal

- Size: existing dashboard modal max-width (~440px).
- Title: catalogue `title`.
- Body: `summary` (2–3 lines).
- Actions: primary **Start guide**, secondary **Not now** (ghost).
- Close X = Not now.
- Focus trap while open. Restore focus to the chip or Home on close.

**Avoid:** full-screen takeover, illustration packs, autoplay video.

---

## 3. Step card

- Anchored: prefer **below or right of** the spotlight target with 12px gap. Flip if viewport collision. If no target, **center** like the start modal.
- Width: ~360px.
- Header: `Step 2 of 4` in muted type, then title.
- Body: short paragraph. Name the real control in **bold** once.
- Footer: Back (ghost, hidden on 1) · Skip guide (text, destructive-muted, not red Kill) · Next (primary). Last step Next label: **Done**.

Skip is never icon-only.

---

## 4. Spotlight

- `data-guide="{step.spotlight}"` on the **actual** control (nav item, Members heading, chat title).
- Outline 2px solid token; 4px radius matching buttons, not pill-full unless the target is already a pill.
- Do not animate a looping pulse (motion budget; reduced-motion: static outline only).

Missing node: card centered, no fake highlight on a random element.

---

## 5. Persistent chip

| Property | Spec |
|---|---|
| Placement | Shell top bar right, or sidebar bottom above collapse. Same place always |
| Default | Label **Guide** + `2/4` |
| Click | Reopens step card |
| Skip | **Skip** next to the chip while in progress. Escape skips the start dialog and the open step card, not the chip-only state. |
| In progress after reload | Chip visible immediately; step card collapsed until click (do not re-force the start modal) |

Can they miss it? Chip is text + number, not a 8px dot. If the sidebar is collapsed, chip stays in the top bar.

---

## 6. Settings → Guides

Card on Settings hub:

- Title: **Guides**
- Rows: name, status chip (`Not seen` / `In progress` / `Done` / `Dismissed`), button **Replay** when terminal or in progress (in progress = **Resume**).
- Empty catalogue: do not render the card.

Status chips: existing vocabulary styling, not emoji.

---

## 7. Reduced motion

`prefers-reduced-motion: reduce`: no overlay fade, no spotlight transition, instant dialog. Still dismissable.

---

## 8. Studio conflict

If a step’s `route` is `/studio`:

- Navigate, wait for editor chrome.
- Step card must not cover **Approve / Kill / player**. Prefer the **left** chat column or below the top Studio bar.
- Generation banner (persistent job) stays visible; Guide card sits under it.

---

## 9. QA

1. Welcome start on `/home` after first org create  
2. Not now → reload → no modal; Settings shows Dismissed  
3. Start → step 2 → reload → chip `2/n`, no start modal  
4. Skip mid-way → chip gone  
5. Feature Guide after simulated `released_at` / previous login  
6. Two eligible features → one modal  
7. Spotlight missing → no crash  
8. Mobile: card full width with 16px inset, buttons stacked
