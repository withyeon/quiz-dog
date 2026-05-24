-- Sync rooms.game_mode CHECK constraint with all current game modes in code
-- Run this in the Supabase SQL Editor of the production project.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'rooms_game_mode_check'
    ) THEN
        ALTER TABLE public.rooms DROP CONSTRAINT rooms_game_mode_check;
    END IF;

    ALTER TABLE public.rooms ADD CONSTRAINT rooms_game_mode_check
        CHECK (game_mode IN (
            'gold_quest',
            'battle_royale',
            'fishing',
            'factory',
            'cafe',
            'mafia',
            'dontlookdown',
            'tower',
            'zombie',
            'treat_rush',
            'poop_dodge'
        ));
END $$;
