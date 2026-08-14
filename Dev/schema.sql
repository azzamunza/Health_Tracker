-- ============================================================
-- Health_Tracker — Supabase schema
-- Run this file in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Shared default body nodes (referenced when a new user joins)
create table if not exists public.default_nodes (
  id integer primary key check (id = 1),
  nodes jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2. Per-user data (node layout, profile, goals, measurements)
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nodes jsonb,
  profile jsonb,
  goals jsonb,
  entries jsonb not null default '[]'::jsonb,
  peptides jsonb not null default '[]'::jsonb,   -- Peptide profile + schedule entries
  exercises jsonb not null default '[]'::jsonb,  -- Exercise log entries
  diet jsonb not null default '{}'::jsonb,       -- Meal plans keyed by date
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index to keep reads cheap on the shared defaults
create index if not exists default_nodes_pkey on public.default_nodes (id);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.default_nodes enable row level security;
alter table public.user_data enable row level security;

-- All authenticated users may read the shared default nodes.
create policy "Default nodes readable by authenticated users"
  on public.default_nodes for select
  to authenticated
  using (true);

-- Only the app owner (admin) may change the shared default nodes.
create policy "App owner can update default nodes"
  on public.default_nodes for update
  to authenticated
  using (auth.jwt() ->> 'email' = 'azzamunza@gmail.com')
  with check (auth.jwt() ->> 'email' = 'azzamunza@gmail.com');

create policy "App owner can insert default nodes"
  on public.default_nodes for insert
  to authenticated
  with check (auth.jwt() ->> 'email' = 'azzamunza@gmail.com');

-- Each user can only access their own row.
create policy "Users can select own user data"
  on public.user_data for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own user data"
  on public.user_data for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own user data"
  on public.user_data for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- Seed the default nodes (id = 1). On conflict: no-op.
-- ============================================================
insert into public.default_nodes (id, nodes)
values (1, '{
  "all":            { "label": "Full Body", "system": true, "active": true, "showInForm": false, "unit": "%", "color": "#ec4899" },
  "bmi":            { "label": "BMI", "system": true, "active": true, "showInForm": false, "unit": "kg/m²", "color": "#a78bfa" },
  "weight":         { "label": "Weight", "system": true, "active": false, "showInForm": true, "unit": "kg", "color": "#22d3ee" },
  "bodyFat":        { "label": "ABI", "system": true, "active": false, "showInForm": true, "unit": "kg/m²", "color": "#f59e0b" },
  "restingHR":      { "label": "Resting Heart Rate", "system": true, "active": false, "showInForm": true, "unit": "bpm", "color": "#fb7185" },
  "oxygen":         { "label": "Oxygen (SpO₂)", "system": true, "active": false, "showInForm": true, "unit": "%", "color": "#38bdf8" },
  "bloodPressure":  { "label": "Blood Pressure", "system": true, "active": false, "showInForm": true, "unit": "mmHg", "color": "#e11d48" },
  "height":         { "label": "Height", "x": 16, "y": 14, "active": false, "showInForm": true, "unit": "cm", "color": "#818cf8" },
  "chest":          { "label": "Chest", "x": 50, "y": 31, "active": false, "showInForm": true, "unit": "cm", "color": "#a855f7" },
  "waist":          { "label": "Waist", "x": 50, "y": 47, "active": false, "showInForm": true, "unit": "cm", "color": "#34d399" },
  "hips":           { "label": "Hips", "x": 50, "y": 63, "active": false, "showInForm": true, "unit": "cm", "color": "#fb7185" },
  "arms":           { "label": "Arm", "x": 24, "y": 37, "active": false, "showInForm": true, "unit": "cm", "color": "#60a5fa", "mirrorColor": "#38bdf8" },
  "thighs":         { "label": "Thigh", "x": 38, "y": 72, "active": false, "showInForm": true, "unit": "cm", "color": "#f472b6", "mirrorColor": "#fb7185" }
}'::jsonb)
on conflict (id) do nothing;
