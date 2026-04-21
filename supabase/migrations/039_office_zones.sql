-- Migration 039: Office zones for agent movement restrictions
-- Created: 2026-04-20

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create office_zones table
CREATE TABLE IF NOT EXISTS office_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Zone bounds as JSON (supports rectangles and simple polygons)
  -- Format for rectangle: {"type": "rectangle", "bounds": {"x1": 0.1, "y1": 0.1, "x2": 0.9, "y2": 0.9}}
  -- Format for polygon: {"type": "polygon", "points": [[0.1,0.1], [0.9,0.1], [0.9,0.9], [0.1,0.9]]}
  bounds JSONB NOT NULL,
  
  -- Visual styling
  color TEXT DEFAULT '#3b82f6', -- Tailwind blue-500 as default
  opacity REAL DEFAULT 0.2,
  
  -- Zone type: 'department', 'restricted', 'common', 'custom'
  zone_type TEXT DEFAULT 'custom',
  
  -- Optional department association
  department TEXT,
  
  -- Optional agent-specific zone
  agent_slug TEXT,
  
  -- Zone behavior flags
  is_active BOOLEAN DEFAULT true,
  is_exclusive BOOLEAN DEFAULT false, -- If true, agents cannot leave this zone
  allow_crossing BOOLEAN DEFAULT true, -- If true, agents can cross through this zone
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign key constraints
  CONSTRAINT fk_agent FOREIGN KEY (agent_slug) REFERENCES agents(slug) ON DELETE CASCADE,
  
  -- Check constraints
  CONSTRAINT valid_color CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT valid_opacity CHECK (opacity >= 0 AND opacity <= 1),
  CONSTRAINT valid_zone_type CHECK (zone_type IN ('department', 'restricted', 'common', 'custom')),
  CONSTRAINT valid_department CHECK (
    department IS NULL OR 
    department IN ('Art', 'Programming', 'Game Design', 'Audio', 'Narrative', 'QA', 'Marketing', 'Direction')
  ),
  
  -- Ensure either department or agent_slug is set, not both
  CONSTRAINT department_or_agent CHECK (
    (department IS NULL AND agent_slug IS NOT NULL) OR
    (department IS NOT NULL AND agent_slug IS NULL) OR
    (department IS NULL AND agent_slug IS NULL)
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_office_zones_department ON office_zones(department) WHERE department IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_office_zones_agent_slug ON office_zones(agent_slug) WHERE agent_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_office_zones_is_active ON office_zones(is_active);
CREATE INDEX IF NOT EXISTS idx_office_zones_zone_type ON office_zones(zone_type);
CREATE INDEX IF NOT EXISTS idx_office_zones_created_at ON office_zones(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_office_zones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_office_zones_updated_at
BEFORE UPDATE ON office_zones
FOR EACH ROW
EXECUTE FUNCTION update_office_zones_updated_at();

-- Create RLS (Row Level Security) policies
ALTER TABLE office_zones ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read zones
CREATE POLICY "Allow read for all authenticated users" ON office_zones
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Allow all authenticated users to insert zones
CREATE POLICY "Allow insert for all authenticated users" ON office_zones
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: Allow all authenticated users to update zones
CREATE POLICY "Allow update for all authenticated users" ON office_zones
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Policy: Allow all authenticated users to delete zones
CREATE POLICY "Allow delete for all authenticated users" ON office_zones
  FOR DELETE USING (auth.role() = 'authenticated');

-- Insert default department zones (optional, can be created via UI)
-- These are example zones that can be modified or deleted by users
INSERT INTO office_zones (name, description, bounds, color, zone_type, department, is_exclusive)
VALUES 
  ('Zone Art', 'Zone pour les artistes et graphistes', 
   '{"type": "rectangle", "bounds": {"x1": 0.05, "y1": 0.3, "x2": 0.25, "y2": 0.7}}',
   '#ef4444', 'department', 'Art', true),
  
  ('Zone Programmation', 'Zone pour les développeurs', 
   '{"type": "rectangle", "bounds": {"x1": 0.25, "y1": 0.2, "x2": 0.45, "y2": 0.6}}',
   '#3b82f6', 'department', 'Programming', true),
  
  ('Zone Game Design', 'Zone pour les game designers', 
   '{"type": "rectangle", "bounds": {"x1": 0.45, "y1": 0.15, "x2": 0.65, "y2": 0.55}}',
   '#10b981', 'department', 'Game Design', true),
  
  ('Zone Audio', 'Zone pour les sound designers', 
   '{"type": "rectangle", "bounds": {"x1": 0.65, "y1": 0.25, "x2": 0.85, "y2": 0.65}}',
   '#8b5cf6', 'department', 'Audio', true),
  
  ('Zone Commune', 'Zone commune pour les réunions', 
   '{"type": "rectangle", "bounds": {"x1": 0.3, "y1": 0.65, "x2": 0.7, "y2": 0.9}}',
   '#f59e0b', 'common', NULL, false)
ON CONFLICT DO NOTHING;

-- Create a view for easier zone queries
CREATE OR REPLACE VIEW office_zones_with_agents AS
SELECT 
  oz.*,
  a.name as agent_name,
  a.department as agent_department
FROM office_zones oz
LEFT JOIN agents a ON oz.agent_slug = a.slug
WHERE oz.is_active = true;

-- Add comment to table
COMMENT ON TABLE office_zones IS 'Zones de déplacement pour les agents dans le bureau virtuel';
COMMENT ON COLUMN office_zones.bounds IS 'Définition géométrique de la zone en coordonnées normalisées (0-1)';
COMMENT ON COLUMN office_zones.is_exclusive IS 'Si vrai, les agents ne peuvent pas quitter cette zone';
COMMENT ON COLUMN office_zones.allow_crossing IS 'Si vrai, les agents peuvent traverser cette zone même si elle n''est pas la leur';