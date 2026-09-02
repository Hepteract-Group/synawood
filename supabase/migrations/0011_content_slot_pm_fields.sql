-- Work board PM fields + comments (Plan 05 / #34 expansion).
alter table public.content_slots
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists board_column text not null default 'planned'
    check (board_column in ('planned', 'in_progress', 'done')),
  add column if not exists priority text
    check (priority is null or priority in ('p0', 'p1', 'p2')),
  add column if not exists due_date date,
  add column if not exists planned_date date,
  add column if not exists labels jsonb not null default '[]'::jsonb,
  add column if not exists assignee text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists content_slots_planned_date_idx
  on public.content_slots (product_id, planned_date);

create index if not exists content_slots_board_column_idx
  on public.content_slots (product_id, board_column);

create table if not exists public.content_slot_comments (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.content_slots (id) on delete cascade,
  author text not null default 'founder',
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists content_slot_comments_slot_idx
  on public.content_slot_comments (slot_id, created_at);

alter table public.content_slot_comments enable row level security;
