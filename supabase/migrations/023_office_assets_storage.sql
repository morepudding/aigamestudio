-- ─── Supabase Storage bucket for office assets ────────────────────────────────

insert into storage.buckets (id, name, public)
values ('office-assets', 'office-assets', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public read office-assets'
  ) then
    create policy "Public read office-assets"
      on storage.objects for select
      using (bucket_id = 'office-assets');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Service upload office-assets'
  ) then
    create policy "Service upload office-assets"
      on storage.objects for insert
      with check (bucket_id = 'office-assets');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Service upsert office-assets'
  ) then
    create policy "Service upsert office-assets"
      on storage.objects for update
      using (bucket_id = 'office-assets');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Service delete office-assets'
  ) then
    create policy "Service delete office-assets"
      on storage.objects for delete
      using (bucket_id = 'office-assets');
  end if;
end
$$;
