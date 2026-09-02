# Asset ingest (upload + Add from URL)

Contract for [#108](https://github.com/Hepteract-Group/marketing-os/issues/108) / ADR-0022. Studio Media bin attaches media onto a project; Remotion and Approve always read **Blob keys**, never remote hotlinks.

## Sources

| `assets.source` | How bytes arrive |
|---|---|
| `upload` | Founder file picker / drag-drop |
| `url` | Server-side fetch of an image URL (SSRF-gated) |
| `generator` | Image / video / TTS Generation Job |
| `brand_kit` | Brand attach / extract materialize |

## Add from URL (#108)

1. Editor posts `{ projectId, expectedRevision, url }` to `POST /api/studio/assets/from-url`.
2. Server runs `assertSafeFetchUrl` + `fetchSafeBytes` (same gate as extract): http(s) only, no credentials, block private/link-local DNS, size/time caps.
3. Content-Type must be an image (JPEG / PNG / WebP / GIF).
4. Bytes go to Azure Blob under `uploads/`; DB row + project JSON use `source: url` and `probe.sourceUrl` (final URL after redirects).
5. Asset index enqueue matches upload (ADR-0032).

Failures surface **inline in the Add from URL dialog** and on the Studio error banner.

## Caps

- Max body: 8 MB (`URL_ASSET_MAX_BYTES`)
- Timeout: 15 s

## Out of scope here

- Video/audio URL ingest
- Brand DNA page ingest (#106)
- Campaign pack Assets surface (Plan 09)
- Product-scoped Extracts (screenshots + scored stills) — [product-extracts.md](./product-extracts.md) / [ADR-0089](../adr/0089-product-extracts.md)
