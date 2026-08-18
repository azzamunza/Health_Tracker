-- ============================================================
-- Health_Tracker — Dev: schema addendum for EXISTING databases
--
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- against a database that already ran an earlier version of
-- schema.sql — i.e. one created BEFORE the Calendar / Diet /
-- Peptides / Exercise pages and the recurring-schedule feature
-- were added.
--
-- Safe to run while the app is live; existing rows are kept.
-- Safe to RE-RUN at any time: every statement uses IF NOT EXISTS,
-- so running it again produces no errors and changes nothing.
-- ============================================================

alter table public.user_data
  add column if not exists peptides jsonb not null default '[]'::jsonb;

alter table public.user_data
  add column if not exists exercises jsonb not null default '[]'::jsonb;

alter table public.user_data
  add column if not exists diet jsonb not null default '{}'::jsonb;

-- Unified recurring-schedule array (Diet / Peptide / Exercise items).
alter table public.user_data
  add column if not exists schedule jsonb not null default '[]'::jsonb;

-- ============================================================
-- Note: a FRESH database should use schema.sql directly (it already
-- includes all of the columns above). This addendum is only needed
-- for databases created before the columns existed.
-- ============================================================