# Per-project brand is the Studio source of truth

Studio brand lives on the **Studio Project** (`project.brand`). New projects start with **no brand**. Founders set logo, stills, colors, type, and CTA in Brand Studio. Optional **Import product brand** copies from a Product Brand Library (API/blob), not by re-attaching files from a repo folder path at request time.

**Why:** Re-attach from `products/{id}/brand-kit/` forced the same the private example (or product) assets onto every project and made brand non-editable. Brand must be per-project and replaceable.

**Supersedes (Studio contract):** the attach-from-disk UX in [brand-in-media.md](../architecture/brand-in-media.md) and the auto-attach-on-generate pattern. ADR-0006 (Path A/B/C binding) still holds — generators and Path C still consume a resolved `project.brand`; only *how* that brand gets onto the project changes.

**Rejected:** the private example (or any product) as a silent default brand for every project. Re-attach as the primary brand path. Auto-`attachBrandKit` from disk when generate runs without brand.
