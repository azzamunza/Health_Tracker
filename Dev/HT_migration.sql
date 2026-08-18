-- =====================================================================
-- Health_Tracker — Schema migration to HT_ prefixed tables
-- Create copies of the existing tables (with all current data) under the
-- "HT_" prefix, plus the new shared exercise library table.
--
-- After running this in the Supabase SQL Editor, the Dev app automatically
-- reads/writes the HT_ tables (Dev/app.js detectHTTables + DB()/DB_SHARED()).
-- The legacy tables (user_data, default_nodes) are left untouched as a fallback.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. HT_user_data — per-user copy (all existing users + their data)
-- ---------------------------------------------------------------------
create table if not exists public.HT_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nodes jsonb,
  profile jsonb,
  goals jsonb,
  entries jsonb not null default '[]'::jsonb,
  peptides jsonb not null default '[]'::jsonb,
  exercises jsonb not null default '[]'::jsonb,
  diet jsonb not null default '{}'::jsonb,
  schedule jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Copy over every existing user's row so logins after migration keep all data
-- (including profiles, favourites and the user's own exercise library, which
-- live inside the profile jsonb column).
insert into public.HT_user_data (
  user_id, nodes, profile, goals, entries, peptides, exercises, diet, schedule, created_at, updated_at
)
select
  user_id, nodes, profile, goals, entries, peptides, exercises, diet, schedule, created_at, updated_at
from public.user_data
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------
-- 2. HT_default_nodes — shared default body-node layout (single row id=1)
-- ---------------------------------------------------------------------
create table if not exists public.HT_default_nodes (
  id integer primary key check (id = 1),
  nodes jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.HT_default_nodes (id, nodes, updated_at)
select id, nodes, updated_at from public.default_nodes
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 3. HT_exercise_library — shared (community) exercise library.
--    Anyone may add exercises; everyone can read them.
--    Favourites + the user's own (non-shared) exercise library are stored
--    per-user in HT_user_data.profile (exerciseFavs / exerciseLibrary).
--    Rich descriptions/howto are self-seeded by the app from EXERCISE_LIBRARY
--    (Dev/app.js) on first load, so this table only guarantees row existence.
-- ---------------------------------------------------------------------
create table if not exists public.HT_exercise_library (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  activity text not null default 'other',
  sets integer not null default 0,
  reps integer not null default 0,
  description text,
  howto text,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (name)
);

-- Seed the shared library from the curated list (idempotent).
insert into public.HT_exercise_library (name, activity, sets, reps)
select seed.name, seed.activity, seed.sets, seed.reps
from (
  select unnest(array[
    'Push-ups', 'Squats (bodyweight)', 'Lunges', 'Plank hold', 'Glute bridge',
    'Burpees', 'Mountain climbers', 'High knees', 'Star jumps',
    'Dumbbell goblet squat', 'Dumbbell shoulder press', 'Dumbbell bicep curl',
    'Dumbbell row', 'Dumbbell deadlift', 'Dumbbell chest press',
    'Dumbbell lateral raise', 'Dumbbell reverse fly', 'Dumbbell tricep extension',
    'Dumbbell farmer carry', 'Dumbbell renegade row', 'Bulgarian split squat',
    'Side plank', 'Dead bug', 'Russian twist (weighted)', 'Step-ups', 'Calf raises',
    'Band pull-apart', 'Cat-cow stretch'
  ]) as name,
  unnest(array[
    'strength','strength','strength','core','strength','cardio','cardio','cardio',
    'cardio','strength','strength','strength','strength','strength','strength',
    'strength','strength','strength','cardio','strength','strength','core','core',
    'core','strength','strength','mobility','mobility'
  ]) as activity,
  unnest(array[4,4,3,3,4,3,4,3,4,4,4,4,4,4,4,4,3,3,4,3,3,3,3,3,4,4,3,2]) as sets,
  unnest(array[15,20,15,60,15,12,30,45,20,12,10,12,12,10,12,12,12,12,60,10,10,40,12,20,12,20,15,12]) as reps
) seed
where not exists (select 1 from public.HT_exercise_library h where h.name = seed.name);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.HT_user_data enable row level security;
alter table public.HT_default_nodes enable row level security;
alter table public.HT_exercise_library enable row level security;

-- HT_user_data: users access only their own row (same as legacy user_data).
create policy "HT users select own"
  on public.HT_user_data for select to authenticated
  using (auth.uid() = user_id);
create policy "HT users insert own"
  on public.HT_user_data for insert to authenticated
  with check (auth.uid() = user_id);
create policy "HT users update own"
  on public.HT_user_data for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- HT_default_nodes: readable by all authenticated, only owner writes.
create policy "HT default readable"
  on public.HT_default_nodes for select to authenticated using (true);
create policy "HT default owner insert"
  on public.HT_default_nodes for insert to authenticated
  with check (auth.jwt() ->> 'email' = 'azzamunza@gmail.com');
create policy "HT default owner update"
  on public.HT_default_nodes for update to authenticated
  using (auth.jwt() ->> 'email' = 'azzamunza@gmail.com')
  with check (auth.jwt() ->> 'email' = 'azzamunza@gmail.com');

-- HT_exercise_library: everyone can read, everyone can add.
create policy "HT_exercise readable by all"
  on public.HT_exercise_library for select to authenticated using (true);
create policy "HT_exercise insertable by all"
  on public.HT_exercise_library for insert to authenticated
  with check (true);

-- =====================================================================
-- Sanity checks (run and confirm) — these warn if seeds are missing.
-- =====================================================================
-- select count(*) as users_migrated from public.HT_user_data;
-- select count(*) as shared_exercises_seeded from public.HT_exercise_library;