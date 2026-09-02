# Architecture overview

```mermaid
flowchart TB
  subgraph dashboard [dashboard_Nextjs]
    studioUI[Studio_UI]
    api[API_routes]
  end
  subgraph creative [core_creative]
    harness[Studio_Agent_harness]
    tools[Studio_Tools]
    store[Project_and_asset_store]
    remotion[Remotion_assemble_export]
    gens[Generators_image_video_tts_stt]
  end
  subgraph product [products_name]
    brand[brand_kit]
    marketing[product_marketing.md]
    pipeline[content_pipeline]
  end
  studioUI --> api
  api --> harness
  harness --> tools
  tools --> store
  tools --> gens
  gens --> store
  store --> remotion
  brand --> tools
  brand --> gens
  marketing --> harness
  remotion --> pipeline
```

## Layers

1. **UI** — dashboard Studio: full-viewport editor (media bin, chat, Remotion Player + transport, editable timeline chrome — ADR-0016), review actions.
2. **API** — auth'd routes: chat turn, project CRUD, upload, Generation Jobs, Render Jobs, Approve.
3. **Harness** — tool-calling loop (see [agent-harness.md](./agent-harness.md)).
4. **Domain** — Studio Project + asset store + Studio Tools.
5. **Generate** — Image, Video Clip, TTS, Transcription adapters ([generators.md](./generators.md)).
6. **Assemble / export** — Remotion preview + async Render Job.
7. **Product** — brand + marketing context injected into prompts and generator hints.
