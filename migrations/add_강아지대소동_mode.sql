-- Add the puppy chaos classroom mode.
-- This keeps the existing rooms/players runtime model and adds only the
-- per-session fields this mode needs.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_game_mode_check;

ALTER TABLE rooms ADD CONSTRAINT rooms_game_mode_check
  CHECK (
    game_mode IS NULL OR game_mode IN (
      'gold_quest',
      'battle_royale',
      'fishing',
      'factory',
      'cafe',
      'mafia',
      'tower',
      'dontlookdown',
      'zombie',
      'treat_rush',
      'poop_dodge'
    )
  );

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_status_check;

ALTER TABLE rooms ADD CONSTRAINT rooms_status_check
  CHECK (status IN ('waiting', 'playing', 'paused', 'finished', 'ended'));

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS current_question_index INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS combo_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_umbrella BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_attacks JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_kicked BOOLEAN DEFAULT false;

ALTER TABLE players
  ALTER COLUMN current_question_index SET DEFAULT 0,
  ALTER COLUMN combo_count SET DEFAULT 0,
  ALTER COLUMN has_umbrella SET DEFAULT false,
  ALTER COLUMN pending_attacks SET DEFAULT '[]'::jsonb,
  ALTER COLUMN is_kicked SET DEFAULT false;

CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES public.rooms(room_code) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (
    type IN ('attack_poop', 'attack_steal', 'legendary', 'combo', 'rank_change')
  ),
  actor_nickname TEXT NOT NULL,
  target_nickname TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_events_session_created
  ON public.events(session_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.events TO anon, authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
