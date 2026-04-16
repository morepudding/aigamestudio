-- ─── Projects table ──────────────────────────────────────────────────────────
create table if not exists projects (
  id             text primary key,
  title          text not null,
  description    text not null default '',
  cover_gradient text not null default 'from-slate-900 via-gray-800 to-zinc-900',
  status         text not null default 'concept' check (status in ('concept','in-dev','released')),
  genre          text not null default '',
  platforms      text[] not null default '{}',
  tags           text[] not null default '{}',
  team           text[] not null default '{}',
  engine         text not null default '',
  created_at     timestamptz not null default now()
);

-- Seed: projects from the old static file
insert into projects (id, title, description, cover_gradient, status, genre, platforms, tags, team, engine)
values (
  'project-first-light',
  'First Light',
  'Premier projet externe du studio. Un Idle Game où l''énergie est éphémère et doit être rapidement réinvestie dans des automatisations pour espérer progresser.',
  'from-slate-900 via-gray-800 to-zinc-900',
  'in-dev',
  'Idle / Stratégie',
  ARRAY['Web'],
  ARRAY['idle','web','externe'],
  ARRAY['Romain'],
  'React / Vite'
)
on conflict (id) do nothing;

-- ─── Supabase Storage bucket for agent avatars ────────────────────────────────
-- Run this if your Supabase version supports storage via SQL migration.
-- Otherwise, create the bucket manually in the Supabase Dashboard:
--   Storage → New bucket → Name: "agent-avatars" → Public: ON
insert into storage.buckets (id, name, public)
values ('agent-avatars', 'agent-avatars', true)
on conflict (id) do nothing;

-- Allow public read + authenticated upload
create policy if not exists "Public read agent-avatars"
  on storage.objects for select
  using (bucket_id = 'agent-avatars');

create policy if not exists "Service upload agent-avatars"
  on storage.objects for insert
  with check (bucket_id = 'agent-avatars');

create policy if not exists "Service upsert agent-avatars"
  on storage.objects for update
  using (bucket_id = 'agent-avatars');
