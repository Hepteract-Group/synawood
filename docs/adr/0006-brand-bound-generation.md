# Brand kit is bound into generate and assemble

Brand assets are included in Creative Studio outputs through three paths: **prompt binding**, **reference conditioning** on Image/Video Generators, and **guaranteed Remotion chrome** on export. Generators must receive a resolved Brand kit context; Final assets must not ship without Path C brand frames for v1 compositions.

**Why:** Soft “style hints” alone cannot keep logos and product UI honest. Hard refs + compose overlays are required to replace a human editor who would drop the logo on by hand.

**Rejected:** Hoping the diffusion model draws a correct wordmark. Baking the private example files into `core/creative`. Skipping Remotion chrome when a Generator returns a “finished” clip.
