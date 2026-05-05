-- ============================================
-- Remove deprecated game modes from active room schema
-- ============================================
-- Deletes support for:
-- - racing   (미션: 등교 임파서블)
-- - pool     (포켓볼)
-- - allin    (올인 퀴즈)
--
-- Existing rooms using those modes are reassigned to gold_quest so the
-- tighter check constraint can be applied without failing.

BEGIN;

UPDATE public.rooms
SET game_mode = 'gold_quest'
WHERE game_mode::text IN ('racing', 'pool', 'allin');

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

COMMIT;
