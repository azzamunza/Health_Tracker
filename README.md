# HealthTracker

A mobile-friendly, database-driven health tracking web app. Record body measurements, define goals, plot progress on an improvement chart, and access your data from any device.

## Features

- **Google login (Supabase Auth)** — sign in with your Google account; data is scoped to your user.
- **Database-driven (Supabase/Postgres)** — default body nodes live in `default_nodes`; each user's node layout, profile, goals, and measurements are stored in their own `user_data` row.
- **Default nodes → default goals** — a new user's possible goals are derived from the default nodes, all active by default.
- **Body zones** — toggle/customise measurement nodes, add custom nodes, edit layout, and plot them on the improvement chart.
- **Profile & goals** — read-only profile view with a gear icon opening a combined editor.
- **Responsive mobile-first design** and PWA-ready.

## Setup

1. **Supabase schema:** run `schema.sql` in your Supabase SQL Editor (Dashboard → SQL Editor). This creates the `default_nodes` and `user_data` tables, enables Row Level Security, and seeds the default nodes.
2. **Google OAuth provider:** in Supabase → Authentication → Providers, enable **Google** and add your Google OAuth client credentials.
3. **Redirect URLs:** in Supabase → Authentication → URL Configuration, add your deployed URL to **Redirect URLs**, e.g. `https://azzamunza.github.io/Health_Tracker/`.
4. **Keys:** `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set at the top of `app.js` (currently Aaron's defaults).
5. **Deploy:** this repo is served by GitHub Pages at:
   `https://azzamunza.github.io/Health_Tracker/`

## Security

All data access is protected by Row Level Security — users can only read/write their own `user_data` row, and any authenticated user can read the shared `default_nodes`.

## Run locally

Serve the folder (e.g. `npx http-server .`) and open the local URL. Login requires the local URL to be added to the Supabase Redirect URLs list.