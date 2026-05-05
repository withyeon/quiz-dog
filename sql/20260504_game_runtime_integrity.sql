-- ============================================
-- QuizDog game runtime integrity migration
-- ============================================
-- Run after setup.sql and migration_question_sets.sql.
-- This consolidates columns that current game pages read/write at runtime.

-- rooms: all currently registered modes and timed-game metadata
ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS game_mode TEXT DEFAULT 'gold_quest',
ADD COLUMN IF NOT EXISTS set_id TEXT,
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rooms_game_mode_check'
      AND conrelid = 'rooms'::regclass
  ) THEN
    ALTER TABLE rooms DROP CONSTRAINT rooms_game_mode_check;
  END IF;
END $$;

ALTER TABLE rooms
ADD CONSTRAINT rooms_game_mode_check
CHECK (
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
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rooms_set_id_fkey'
      AND conrelid = 'rooms'::regclass
  ) THEN
    ALTER TABLE rooms
    ADD CONSTRAINT rooms_set_id_fkey
    FOREIGN KEY (set_id)
    REFERENCES question_sets(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- players: shared and per-mode runtime state
ALTER TABLE players
ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS active_item JSONB,
ADD COLUMN IF NOT EXISTS item_effects JSONB,
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

CREATE INDEX IF NOT EXISTS idx_rooms_game_mode ON rooms(game_mode);
CREATE INDEX IF NOT EXISTS idx_rooms_set_id ON rooms(set_id);
CREATE INDEX IF NOT EXISTS idx_players_room_position ON players(room_code, position);
CREATE INDEX IF NOT EXISTS idx_players_room_health ON players(room_code, health);
CREATE INDEX IF NOT EXISTS idx_players_claw_points ON players(claw_points);
CREATE INDEX IF NOT EXISTS idx_players_convenience_money ON players(convenience_money);
CREATE INDEX IF NOT EXISTS idx_players_factory_money ON players(factory_money);
