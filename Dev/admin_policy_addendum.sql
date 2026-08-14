-- ============================================================
-- Health_Tracker — Dev: add new-page storage columns
-- Run this ONCE in your Supabase SQL Editor against an EXISTING
-- database that already ran schema.sql (before the Calendar /
-- Diet / Peptides / Exercise pages were added).
-- It is safe to run while the app is live; existing rows are kept.
-- ============================================================

alter table public.user_data
  add column if not exists peptides jsonb not null default '[]'::jsonb;

alter table public.user_data
  add column if not exists exercises jsonb not null default '[]'::jsonb;

alter table public.user_data
  add column if not exists diet jsonb not null default '{}'::jsonb;

-- ============================================================
-- Note for future reference / fresh databases:
-- schema.sql already includes these three columns, so a fresh
-- setup does NOT need to run this file. This addendum is only
-- for databases created before the columns existed.
-- ============================================================