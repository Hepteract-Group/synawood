-- Render export targets: stills | mp4 | both (slideshow pack export).
alter table public.render_jobs
  add column if not exists targets text not null default 'both'
    check (targets in ('stills', 'mp4', 'both'));

comment on column public.render_jobs.targets is
  'Export targets for Remotion render: stills, mp4, or both.';
