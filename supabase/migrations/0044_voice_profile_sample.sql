-- ADR-0060 / #762 — store the founder voice sample used for Instant Voice Clone.

alter table public.voice_profiles
  add column if not exists sample_blob_key text;

comment on column public.voice_profiles.sample_blob_key is
  'Azure Blob key for the clone sample (ADR-0060). Required for kind=clone.';

-- v1 mock clones had no sample; they cannot satisfy the new check.
update public.voice_profiles
  set status = 'archived', updated_at = now()
  where kind = 'clone'
    and (sample_blob_key is null or btrim(sample_blob_key) = '');

alter table public.voice_profiles
  drop constraint if exists voice_profiles_clone_sample_chk;

alter table public.voice_profiles
  add constraint voice_profiles_clone_sample_chk
  check (kind <> 'clone' or sample_blob_key is not null);
