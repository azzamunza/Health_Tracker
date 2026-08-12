-- ============================================================
-- Health_Tracker — Admin policy addendum
-- Run this once in your Supabase SQL Editor if you already ran
-- schema.sql before the Admin layout editor feature was added.
-- It lets the app owner (azzamunza@gmail.com) save the shared
-- default node positions from the web app.
-- ============================================================
create policy "App owner can update default nodes"
  on public.default_nodes for update
  to authenticated
  using (auth.jwt() ->> 'email' = 'azzamunza@gmail.com')
  with check (auth.jwt() ->> 'email' = 'azzamunza@gmail.com');

create policy "App owner can insert default nodes"
  on public.default_nodes for insert
  to authenticated
  with check (auth.jwt() ->> 'email' = 'azzamunza@gmail.com');