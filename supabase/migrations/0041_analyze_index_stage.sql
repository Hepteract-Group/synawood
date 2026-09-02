-- Wave 2J / #588 — Analyze segment pass uses stage=analyze on the index chip.

alter table public.asset_index_state
  drop constraint if exists asset_index_state_stage_check;

alter table public.asset_index_state
  add constraint asset_index_state_stage_check
  check (
    stage in (
      'queued',
      'probe',
      'shots',
      'caption',
      'transcribe',
      'embed',
      'analyze',
      'ready',
      'failed'
    )
  );
