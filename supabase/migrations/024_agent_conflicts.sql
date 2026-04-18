-- Agent conflicts table
-- Tracks manually-triggered conflicts between two agents
-- Impact is purely memorial: no gameplay malus, just emotions stored in agent_memory

create table if not exists agent_conflicts (
  id uuid primary key default gen_random_uuid(),
  agent_a_slug text not null references agents(slug) on delete cascade,
  agent_b_slug text not null references agents(slug) on delete cascade,
  type text not null check (type in ('creative_disagreement', 'personal_tension', 'resource_conflict')),
  status text not null default 'active' check (status in ('active', 'resolved')),
  title text not null,
  description text not null,
  opening_dialogues jsonb not null default '[]'::jsonb,
  player_position integer check (player_position between -2 and 2),
  created_at timestamp with time zone default now(),
  resolved_at timestamp with time zone
);

-- Index for fast lookup by agent
create index if not exists agent_conflicts_agent_a_idx on agent_conflicts(agent_a_slug);
create index if not exists agent_conflicts_agent_b_idx on agent_conflicts(agent_b_slug);
create index if not exists agent_conflicts_status_idx on agent_conflicts(status);

-- RLS: open (single-player, no auth)
alter table agent_conflicts enable row level security;
create policy "allow_all_agent_conflicts" on agent_conflicts for all using (true) with check (true);
