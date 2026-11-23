-- The server (service role key) writes screenings/reminders and reads organizations.
-- Newer Supabase projects no longer grant table privileges to service_role automatically
-- for tables created over a direct SQL connection, so grant them explicitly.
-- anon/authenticated stay locked down by 0001 (RLS + revokes).
grant usage on schema public to service_role;
grant select, insert, update, delete on public.facilities, public.organizations, public.screenings, public.reminders to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.nearest_facilities(double precision, double precision, integer, text[]) to service_role;
