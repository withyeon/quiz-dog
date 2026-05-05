-- ============================================
-- QuizDog full schema for a fresh Supabase DB
-- ============================================
-- Run this once in a new Supabase project's SQL Editor.
-- It creates the complete schema needed by the current app without sample data.
-- Safe to re-run on the same project; existing data is preserved.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Shared updated_at trigger function.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Question set catalog used by teacher library and room creation.
CREATE TABLE IF NOT EXISTS public.question_sets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  grade TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quiz questions. Answers stay in DB and are checked through an RPC.
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id TEXT NOT NULL REFERENCES public.question_sets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('CHOICE', 'SHORT', 'OX', 'BLANK')),
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rooms for live game sessions.
CREATE TABLE IF NOT EXISTS public.rooms (
  room_code TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  current_q_index INTEGER NOT NULL DEFAULT 0,
  game_mode TEXT NOT NULL DEFAULT 'gold_quest',
  set_id TEXT REFERENCES public.question_sets(id) ON DELETE SET NULL,
  duration_seconds INTEGER,
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rooms_game_mode_check CHECK (
    game_mode IN (
      'gold_quest',
      'battle_royale',
      'fishing',
      'factory',
      'cafe',
      'mafia',
      'tower',
      'dontlookdown'
    )
  )
);

-- Players and per-mode runtime state.
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL REFERENCES public.rooms(room_code) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  gold INTEGER NOT NULL DEFAULT 0,
  avatar TEXT,
  is_online BOOLEAN NOT NULL DEFAULT true,
  position INTEGER DEFAULT 0,
  active_item JSONB,
  item_effects JSONB DEFAULT '[]'::jsonb,
  health INTEGER,
  attack_power INTEGER DEFAULT 10,
  defense INTEGER DEFAULT 0,
  player_class TEXT,
  caught_dolls JSONB DEFAULT '[]'::jsonb,
  claw_points INTEGER DEFAULT 0,
  caught_fishes JSONB DEFAULT '[]'::jsonb,
  fishing_points INTEGER DEFAULT 0,
  factories JSONB DEFAULT '[]'::jsonb,
  factory_money INTEGER DEFAULT 0,
  convenience_products JSONB DEFAULT '[]'::jsonb,
  convenience_money INTEGER DEFAULT 0,
  cafe_cash INTEGER DEFAULT 0,
  cafe_customers_served INTEGER DEFAULT 0,
  mafia_cash INTEGER DEFAULT 0,
  mafia_diamonds INTEGER DEFAULT 0,
  answer_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Finished-game archive for teacher report pages.
CREATE TABLE IF NOT EXISTS public.game_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL,
  set_id TEXT,
  game_mode TEXT,
  player_count INTEGER NOT NULL DEFAULT 0,
  players_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Keep updated_at fresh.
DROP TRIGGER IF EXISTS update_question_sets_updated_at ON public.question_sets;
CREATE TRIGGER update_question_sets_updated_at
  BEFORE UPDATE ON public.question_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_rooms_updated_at ON public.rooms;
CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_players_updated_at ON public.players;
CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Server-side answer checking RPC.
CREATE OR REPLACE FUNCTION public.check_question_answer(
  p_question_id UUID,
  p_submitted_answer TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_correct_answer TEXT;
BEGIN
  SELECT answer INTO v_correct_answer
  FROM public.questions
  WHERE id = p_question_id;

  IF v_correct_answer IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN BTRIM(p_submitted_answer::TEXT) = BTRIM(v_correct_answer::TEXT);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_question_answer(UUID, TEXT) TO authenticated, anon;

-- Core tables intentionally keep RLS disabled for the current classroom flow.
-- New Supabase projects or pre-created tables can have RLS enabled, so force the
-- expected app behavior explicitly.
ALTER TABLE public.question_sets NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.questions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rooms NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.players NO FORCE ROW LEVEL SECURITY;

ALTER TABLE public.question_sets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.players DISABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.question_sets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.questions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rooms TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.players TO anon, authenticated;

-- game_reports uses permissive policies because RLS is enabled on that archive.
ALTER TABLE public.game_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'game_reports'
      AND policyname = 'Anyone can insert game reports'
  ) THEN
    CREATE POLICY "Anyone can insert game reports"
      ON public.game_reports
      FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'game_reports'
      AND policyname = 'Anyone can view game reports'
  ) THEN
    CREATE POLICY "Anyone can view game reports"
      ON public.game_reports
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Runtime/query indexes.
CREATE INDEX IF NOT EXISTS idx_question_sets_created_at ON public.question_sets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_set_id ON public.questions(set_id);
CREATE INDEX IF NOT EXISTS idx_rooms_game_mode ON public.rooms(game_mode);
CREATE INDEX IF NOT EXISTS idx_rooms_set_id ON public.rooms(set_id);
CREATE INDEX IF NOT EXISTS idx_players_room_code ON public.players(room_code);
CREATE INDEX IF NOT EXISTS idx_players_score ON public.players(score DESC);
CREATE INDEX IF NOT EXISTS idx_players_room_position ON public.players(room_code, position);
CREATE INDEX IF NOT EXISTS idx_players_health ON public.players(health);
CREATE INDEX IF NOT EXISTS idx_players_room_health ON public.players(room_code, health);
CREATE INDEX IF NOT EXISTS idx_players_claw_points ON public.players(claw_points);
CREATE INDEX IF NOT EXISTS idx_players_fishing_points ON public.players(fishing_points);
CREATE INDEX IF NOT EXISTS idx_players_factory_money ON public.players(factory_money);
CREATE INDEX IF NOT EXISTS idx_players_convenience_money ON public.players(convenience_money);
CREATE INDEX IF NOT EXISTS idx_players_cafe_cash ON public.players(cafe_cash);
CREATE INDEX IF NOT EXISTS idx_players_mafia_cash ON public.players(mafia_cash);
CREATE INDEX IF NOT EXISTS idx_game_reports_created_at ON public.game_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_reports_room_code ON public.game_reports(room_code);

COMMENT ON COLUMN public.rooms.duration_seconds IS 'Game duration in seconds.';
COMMENT ON COLUMN public.rooms.started_at IS 'Timestamp when the room starts playing.';

-- Supabase Realtime publication membership.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'players'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'rooms'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'question_sets'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.question_sets;
    END IF;
  END IF;
END $$;

COMMIT;
