-- Align office_zones with the rest of the single-player data model.
-- The app writes zones from the browser with the anon key, so RLS must be open.

alter table office_zones enable row level security;

drop policy if exists "Allow read for all authenticated users" on office_zones;
drop policy if exists "Allow insert for all authenticated users" on office_zones;
drop policy if exists "Allow update for all authenticated users" on office_zones;
drop policy if exists "Allow delete for all authenticated users" on office_zones;
drop policy if exists "allow_all_office_zones" on office_zones;

create policy "allow_all_office_zones"
on office_zones
for all
using (true)
with check (true);