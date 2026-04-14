-- Add 'allin' (올인 퀴즈) to game_mode enum (if used) and rooms check constraint
-- Run this in Supabase SQL Editor if dev/올인 방 생성 시 CHECK 위반 오류가 납니다.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_mode') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'allin'
              AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'game_mode')
        ) THEN
            ALTER TYPE game_mode ADD VALUE 'allin';
        END IF;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'rooms_game_mode_check'
    ) THEN
        ALTER TABLE rooms DROP CONSTRAINT rooms_game_mode_check;
    END IF;

    ALTER TABLE rooms ADD CONSTRAINT rooms_game_mode_check
        CHECK (game_mode IN (
            'gold_quest',
            'racing',
            'battle_royale',
            'fishing',
            'factory',
            'cafe',
            'mafia',
            'pool',
            'tower',
            'dontlookdown',
            'allin'
        ));
END $$;
