-- Migration 032: Drop legacy tables from abandoned features.
drop table if exists agent_conflicts;
drop table if exists onboarding_choices;
drop table if exists pending_moments;