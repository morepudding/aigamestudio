-- Agent Memory: stores accumulated conversational memories per agent
CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_slug TEXT NOT NULL REFERENCES agents(slug) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('summary', 'decision', 'preference', 'progress', 'relationship')),
  content TEXT NOT NULL,
  source_conversation_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_memory_slug ON agent_memory(agent_slug);
CREATE INDEX idx_agent_memory_type ON agent_memory(agent_slug, memory_type);

-- Enable RLS
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;

-- Allow all operations (single-player game, no auth needed)
CREATE POLICY "Allow all on agent_memory" ON agent_memory
  FOR ALL USING (true) WITH CHECK (true);
