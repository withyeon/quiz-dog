-- ============================================
-- QuizDog latest remote schema patch
-- ============================================
-- Safe to re-run. This preserves existing data and fills schema gaps used by
-- the current app code.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Keep the question set catalog available for teacher library flows.
CREATE TABLE IF NOT EXISTS public.question_sets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.question_sets
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS grade TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.question_sets
  ALTER COLUMN tags SET DEFAULT '[]'::jsonb;

INSERT INTO public.question_sets (id, title, created_at)
SELECT
  q.set_id,
  '문제집 ' || q.set_id,
  MIN(q.created_at)
FROM public.questions AS q
WHERE q.set_id IS NOT NULL
GROUP BY q.set_id
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_question_sets_updated_at'
      AND tgrelid = 'public.question_sets'::regclass
  ) THEN
    CREATE TRIGGER update_question_sets_updated_at
      BEFORE UPDATE ON public.question_sets
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_questions_set'
      AND conrelid = 'public.questions'::regclass
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT fk_questions_set
      FOREIGN KEY (set_id)
      REFERENCES public.question_sets(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

-- Rooms: all current game modes plus timed-game metadata.
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS game_mode TEXT DEFAULT 'gold_quest',
  ADD COLUMN IF NOT EXISTS set_id TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE public.rooms
  ALTER COLUMN game_mode SET DEFAULT 'gold_quest';

DO $$
DECLARE
  mode_value TEXT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'game_mode'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    FOREACH mode_value IN ARRAY ARRAY[
      'gold_quest',
      'battle_royale',
      'fishing',
      'factory',
      'cafe',
      'mafia',
      'tower',
      'dontlookdown'
    ]
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = mode_value
          AND enumtypid = 'public.game_mode'::regtype
      ) THEN
        EXECUTE format('ALTER TYPE public.game_mode ADD VALUE %L', mode_value);
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rooms_game_mode_check'
      AND conrelid = 'public.rooms'::regclass
  ) THEN
    ALTER TABLE public.rooms DROP CONSTRAINT rooms_game_mode_check;
  END IF;
END $$;

ALTER TABLE public.rooms
  ADD CONSTRAINT rooms_game_mode_check
  CHECK (
    game_mode IS NULL OR game_mode::text IN (
      'gold_quest',
      'battle_royale',
      'fishing',
      'factory',
      'cafe',
      'mafia',
      'tower',
      'dontlookdown'
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rooms_set_id_fkey'
      AND conrelid = 'public.rooms'::regclass
  ) THEN
    ALTER TABLE public.rooms
      ADD CONSTRAINT rooms_set_id_fkey
      FOREIGN KEY (set_id)
      REFERENCES public.question_sets(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN public.rooms.duration_seconds IS 'Game duration in seconds.';
COMMENT ON COLUMN public.rooms.started_at IS 'Timestamp when the room starts playing.';

-- Players: shared runtime state for all registered game modes.
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_item JSONB,
  ADD COLUMN IF NOT EXISTS item_effects JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS health INTEGER,
  ADD COLUMN IF NOT EXISTS attack_power INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS defense INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS player_class TEXT,
  ADD COLUMN IF NOT EXISTS caught_dolls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS claw_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS caught_fishes JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fishing_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS factories JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS factory_money INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS convenience_products JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS convenience_money INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cafe_cash INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cafe_customers_served INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mafia_cash INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mafia_diamonds INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS answer_history JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.players
  ALTER COLUMN position SET DEFAULT 0,
  ALTER COLUMN item_effects SET DEFAULT '[]'::jsonb,
  ALTER COLUMN attack_power SET DEFAULT 10,
  ALTER COLUMN defense SET DEFAULT 0,
  ALTER COLUMN caught_dolls SET DEFAULT '[]'::jsonb,
  ALTER COLUMN claw_points SET DEFAULT 0,
  ALTER COLUMN caught_fishes SET DEFAULT '[]'::jsonb,
  ALTER COLUMN fishing_points SET DEFAULT 0,
  ALTER COLUMN factories SET DEFAULT '[]'::jsonb,
  ALTER COLUMN factory_money SET DEFAULT 0,
  ALTER COLUMN convenience_products SET DEFAULT '[]'::jsonb,
  ALTER COLUMN convenience_money SET DEFAULT 0,
  ALTER COLUMN cafe_cash SET DEFAULT 0,
  ALTER COLUMN cafe_customers_served SET DEFAULT 0,
  ALTER COLUMN mafia_cash SET DEFAULT 0,
  ALTER COLUMN mafia_diamonds SET DEFAULT 0,
  ALTER COLUMN answer_history SET DEFAULT '[]'::jsonb;

-- Server-side answer checking RPC.
CREATE OR REPLACE FUNCTION public.check_question_answer(
  p_question_id UUID,
  p_submitted_answer TEXT
)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_question_answer(UUID, TEXT) TO authenticated, anon;

-- Current app flow uses the anon client for classroom room/player/question CRUD.
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

-- Game report archive used by teacher analytics/report pages.
CREATE TABLE IF NOT EXISTS public.game_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL,
  set_id TEXT,
  game_mode TEXT,
  player_count INTEGER NOT NULL DEFAULT 0,
  players_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

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

-- Indexes used by runtime queries and leaderboards.
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
CREATE INDEX IF NOT EXISTS idx_rooms_game_mode ON public.rooms(game_mode);
CREATE INDEX IF NOT EXISTS idx_rooms_set_id ON public.rooms(set_id);
CREATE INDEX IF NOT EXISTS idx_questions_set_id ON public.questions(set_id);
CREATE INDEX IF NOT EXISTS idx_question_sets_created_at ON public.question_sets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_reports_created_at ON public.game_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_reports_room_code ON public.game_reports(room_code);

-- Realtime publication membership, guarded for idempotent re-runs.
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
