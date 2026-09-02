-- ADR-0073 / #882 — speech enhance generation job role.

alter table public.generation_jobs
  drop constraint if exists generation_jobs_role_check;

alter table public.generation_jobs
  add constraint generation_jobs_role_check
  check (role in (
    'image', 'video', 'speech', 'transcribe', 'extract', 'index', 'music',
    'voice_clone', 'voice_synth', 'voice_dub', 'voice_lipsync',
    'speech_enhance'
  ));

comment on constraint generation_jobs_role_check on public.generation_jobs is
  'Generator roles plus extract, index, music, Voice Studio, and speech enhance (ADR-0073).';
