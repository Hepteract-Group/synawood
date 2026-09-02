-- Plan 07 / #340 — record whether waitlist confirmation mail was sent.

alter table public.waitlist_entries
  add column if not exists email_sent_at timestamptz;

comment on column public.waitlist_entries.email_sent_at is
  'Set when confirmation mail is sent. Null = skipped or not yet sent. Row always persists first.';
