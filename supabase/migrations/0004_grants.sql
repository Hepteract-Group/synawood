-- Explicit grants for Supabase API roles.
-- Newer Supabase Postgres images no longer auto-grant DML on tables created in
-- migrations, so service_role hit "permission denied for table studio_projects".
-- RLS stays enabled (0001): anon/authenticated get no DML; the server-side
-- service_role client is the only writer/reader, matching the Plan 00 design.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
