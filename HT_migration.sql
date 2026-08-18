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

alter table public.HT_user_data enable row level security;

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

alter table public.HT_default_nodes enable row level security;

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

alter table public.HT_exercise_library enable row level security;

-- Seed the shared library from the curated list, INCLUDING description + how-to
-- so the rows carry the full data (not just name/activity/sets/reps).
-- Idempotent: rows unchanged if the name already exists.
insert into public.ht_exercise_library (name, activity, sets, reps, description, howto)
select seed.name, seed.activity, seed.sets, seed.reps, seed.description, seed.howto
from (
  select unnest(array[
    'Push-ups',
    'Squats (bodyweight)',
    'Lunges',
    'Plank hold',
    'Glute bridge',
    'Burpees',
    'Mountain climbers',
    'High knees',
    'Star jumps',
    'Dumbbell goblet squat',
    'Dumbbell shoulder press',
    'Dumbbell bicep curl',
    'Dumbbell row',
    'Dumbbell deadlift',
    'Dumbbell chest press',
    'Dumbbell lateral raise',
    'Dumbbell reverse fly',
    'Dumbbell tricep extension',
    'Dumbbell farmer carry',
    'Dumbbell renegade row',
    'Bulgarian split squat',
    'Side plank',
    'Dead bug',
    'Russian twist (weighted)',
    'Step-ups',
    'Calf raises',
    'Band pull-apart',
    'Cat-cow stretch'
  ]) as name,
  unnest(array[
    'strength','strength','strength','core','strength','cardio','cardio','cardio',
    'cardio','strength','strength','strength','strength','strength','strength',
    'strength','strength','strength','cardio','strength','strength','core','core',
    'core','strength','strength','mobility','mobility'
  ]) as activity,
  unnest(array[4,4,3,3,4,3,4,3,4,4,4,4,4,4,4,4,3,3,4,3,3,3,3,3,4,4,3,2]) as sets,
  unnest(array[15,20,15,60,15,12,30,45,20,12,10,12,12,10,12,12,12,12,60,10,10,40,12,20,12,20,15,12]) as reps,
  unnest(array[
    'Foundational upper-body push movement. Builds chest, shoulders, triceps and core stability.',
    'Lower-body strength builder targeting the quads, glutes and hamstrings.',
    'Unilateral leg exercise improving single-leg strength, balance and hip stability.',
    'Isometric core hold building trunk stability and posture endurance.',
    'Glute and hamstring activation while reinforcing posterior-chain strength.',
    'Full-body conditioning and heart-rate builder combining squat, plank and jump.',
    'Dynamic core and cardio move driven by quick alternating knee drives.',
    'Lower-intensity cardio that raises heart rate and improves rhythm.',
    'Explosive full-body jump for conditioning, power and mobility.',
    'Weighted squat variation strengthening the legs and upper back.',
    'Vertical press building shoulder and upper-arm strength.',
    'Isolates the biceps for arm strength and size.',
    'Horizontal pulling for the back, rear shoulders and grip strength.',
    'Hip-hinge strength targeting the posterior chain and grip.',
    'Horizontal press for chest, triceps and shoulder strength.',
    'Isolation move for the side deltoids to widen the shoulder line.',
    'Trains the rear deltoids and upper-back posture muscles.',
    'Extends the triceps straighten to build upper-arm mass.',
    'Loaded walk for grip, core and posture endurance and conditioning.',
    'Plank-based row combining core stability with back pulling.',
    'Single-leg squat building lower-body strength and stability.',
    'Lateral core stability for the obliques and the side body.',
    'Anti-extension core move strengthening the deep core without hip posting.',
    'Rotational core work for the obliques.',
    'Stair-style unilateral leg strength and balance exercise.',
    'Isolates the calf and soleus for ankle strength and definition.',
    'Stretches and strengthens the upper back and rear delts for posture.',
    'Spinal mobility drill to warm up the back and core.'
  ]) as description,
  unnest(array[
    'Start in a high plank with hands shoulder-width apart. Lower your chest toward the floor keeping a straight line from head to heels, elbows at ~45°. Push back up to full arm extension. Scale down by supporting on knees if needed.',
    'Stand with feet shoulder-width, toes slightly out. Sit the hips back and down as if into a chair, keep the chest up, then drive through the heels to stand. Keep knees tracking over the toes.',
    'Step forward into a lunge, lowering the back knee toward the floor while the front thigh ends roughly parallel. Push off the front foot to return. Alternate legs each rep.',
    'Assume a forearm plank with elbows under shoulders. Brace the core and glutes so the body forms a straight line from head to heels. Hold for the target time without letting the hips sag.',
    'Lie on your back, feet flat and hip-width. Drive through the heels to lift the hips until the body forms a line from shoulders to knees, squeeze the glutes at the top, then lower slowly.',
    'From standing, squat to the floor, jump or step the feet back to a plank, drop to a push-up (optional), jump the feet back in and leap up with a small jump. Keep it continuous and controlled.',
    'From a high plank, drive one knee toward the chest, then switch legs rapidly as if running in place. Keep the hips level and the core braced for the whole set.',
    'March or jog on the spot while driving each knee up to hip height. Keep an upright torso and pump the arms in time. Move faster as your form stays consistent.',
    'Start with feet together and arms at your sides. Jump while spreading feet wide and raising both arms overhead to form an X, then land softly and return to the start.',
    'Hold a dumbbell at your chest with both hands. Squat down with back straight and elbows inside the knees, then drive back up to standing. Keep the weight close to the chest.',
    'Sit or stand with a dumbbell in each hand at shoulder height. Press overhead until the arms are straight, keeping the core braced, then lower back with control.',
    'Stand with a dumbbell in each hand, palms facing forward. Curl the weights toward your shoulders without swinging the elbows, then lower slowly under control.',
    'Hinge forward with a flat back, holding a dumbbell in each hand. Pull the weights toward your hips, squeezing the shoulder blades, then lower under control.',
    'Stand with dumbbells at your thighs. Push the hips back and lower the weights toward the floor, keeping a flat back, then stand tall by driving the hips forward and squeezing glutes.',
    'Lie on a bench holding a dumbbell in each hand above your chest. Lower the weights to the sides of your chest, then press back up to full extension.',
    'Stand with a dumbbell in each hand at your sides. Raise the arms out to the sides till shoulder height, leading with the elbows, then lower slowly without momentum.',
    'Hinge forward with a flat back, dumbbells hanging. Open the arms out to the sides keeping a slight elbow bend, then lower with control.',
    'Hold one dumbbell overhead with both hands. Lower it behind your head by bending the elbows, keeping the elbows pointing up, then extend back overhead.',
    'Hold a heavy dumbbell in each hand with shoulders pulled back. Walk upright in a straight line for the allotted time, swapping sides if you go far.',
    'From a high plank with a dumbbell in each hand, row one weight to your ribs while the body stays level, then switch sides after the rep pattern.',
    'Place your rear foot on a bench or surface. Lower straight up and increase the strength of the hips until the front thigh is about level, then drive back up through the front leg alone.',
    'Lie on your side propped on your forearm with feet stacked. Lift your hips so the body forms a straight line and hold. Keep the elbow under the shoulder.',
    'Lie on your back, arms to the ceiling and knees bent at 90°. Slowly lower the opposite arm and leg toward the floor while keeping the lower back pressed down, then return.',
    'Sit with knees bent and feet hovering. Rotate the torso side to side while holding a weight, tapping the floor beside each hip while keeping the chest lifted.',
    'Step one foot onto a sturdy surface, drive through that leg to bring the other foot up, then steps. alternate legs and keep the hips square.',
    'Stand tall and rise onto the balls of your feet as high as possible, hold briefly, then lower the heels, under control. Add weight in a goblet position to progress.',
    'Hold a light band at chest height with both hands this width. Keeping the arms straight, pull the band outward until the shoulder blades squeeze, then return slowly.',
    'On all fours, alternate arching the back (cow) and rounding it (cat) by timing the movement with breathing and moving the tailbone with the head.'
  ]) as howto
) seed
where not exists (select 1 from public.ht_exercise_library h where h.name = seed.name);


-- =====================================================================
-- Row Level Security Policies
-- =====================================================================

-- HT_user_data: users access only their own row (same as legacy user_data).
drop policy if exists "HT users select own" on public.HT_user_data;
create policy "HT users select own"
  on public.HT_user_data for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "HT users insert own" on public.HT_user_data;
create policy "HT users insert own"
  on public.HT_user_data for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "HT users update own" on public.HT_user_data;
create policy "HT users update own"
  on public.HT_user_data for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- HT_default_nodes: readable by all authenticated, only owner writes.
drop policy if exists "HT default readable" on public.HT_default_nodes;
create policy "HT default readable"
  on public.HT_default_nodes for select to authenticated using (true);
drop policy if exists "HT default owner insert" on public.HT_default_nodes;
create policy "HT default owner insert"
  on public.HT_default_nodes for insert to authenticated
  with check (auth.jwt() ->> 'email' = 'azzamunza@gmail.com');
drop policy if exists "HT default owner update" on public.HT_default_nodes;
create policy "HT default owner update"
  on public.HT_default_nodes for update to authenticated
  using (auth.jwt() ->> 'email' = 'azzamunza@gmail.com')
  with check (auth.jwt() ->> 'email' = 'azzamunza@gmail.com');

-- HT_exercise_library: everyone can read, everyone can add.
drop policy if exists "HT_exercise readable by all" on public.HT_exercise_library;
create policy "HT_exercise readable by all"
  on public.HT_exercise_library for select to authenticated using (true);
drop policy if exists "HT_exercise insertable by all" on public.HT_exercise_library;
create policy "HT_exercise insertable by all"
  on public.HT_exercise_library for insert to authenticated
  with check (true);

-- =====================================================================
-- Sanity checks (run and confirm) — these warn if seeds are missing.
-- =====================================================================
-- select count(*) as users_migrated from public.HT_user_data;
-- select count(*) as shared_exercises_seeded from public.HT_exercise_library;