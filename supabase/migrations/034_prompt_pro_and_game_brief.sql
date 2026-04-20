-- Migration 034: promptPro on agents + game_brief on brainstorming_sessions
-- Part of the pipeline redesign: Brief template → One Page → GDD pipeline

-- ============================================================
-- 1. prompt_pro on agents
-- Each agent now has a professional prompt (promptPro) distinct from
-- their personality (backstory / personality_*). Used for task execution
-- (One Page generation, pipeline tasks, reviews...).
-- ============================================================
ALTER TABLE agents ADD COLUMN IF NOT EXISTS prompt_pro TEXT DEFAULT NULL;

-- ============================================================
-- 2. game_brief on brainstorming_sessions
-- Stores the structured brief filled by the user in Phase 1.
-- Shape: { genre, sessionDuration, referenceGame, theme }
-- ============================================================
ALTER TABLE brainstorming_sessions ADD COLUMN IF NOT EXISTS game_brief JSONB DEFAULT NULL;

-- ============================================================
-- 3. one_page on brainstorming_sessions
-- Stores the current version of the One Page Design Document (markdown).
-- one_page_comments stores per-section comments before regeneration.
-- Shape: { elevatorPitch, playerFantasy, coreLoop, univers, perimetreV1, risques, integrationVN }
-- ============================================================
ALTER TABLE brainstorming_sessions ADD COLUMN IF NOT EXISTS one_page TEXT DEFAULT NULL;
ALTER TABLE brainstorming_sessions ADD COLUMN IF NOT EXISTS one_page_comments JSONB DEFAULT NULL;
ALTER TABLE brainstorming_sessions ADD COLUMN IF NOT EXISTS one_page_validated BOOLEAN NOT NULL DEFAULT false;
