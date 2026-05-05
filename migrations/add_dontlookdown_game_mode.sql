-- Add Don't Look Down game mode
-- This migration adds 'dontlookdown' to the game_mode enum
-- If the enum doesn't exist, it creates it first

DO $$ 
BEGIN
    -- Check if the enum type exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_mode') THEN
        -- Create the enum with all values if it doesn't exist
        CREATE TYPE game_mode AS ENUM (
            'gold_quest',
            'battle_royale',
            'fishing',
            'factory',
            'cafe',
            'mafia',
            'tower',
            'dontlookdown'
        );
    ELSE
        -- Check if the value already exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'dontlookdown' 
            AND enumtypid = (
                SELECT oid FROM pg_type WHERE typname = 'game_mode'
            )
        ) THEN
            ALTER TYPE game_mode ADD VALUE 'dontlookdown';
        END IF;
    END IF;
END $$;

-- Update the check constraint on rooms table if it exists
DO $$
BEGIN
    -- Drop the existing check constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'rooms_game_mode_check'
    ) THEN
        ALTER TABLE rooms DROP CONSTRAINT rooms_game_mode_check;
    END IF;
    
    -- Add the updated check constraint with all game modes including dontlookdown
    ALTER TABLE rooms ADD CONSTRAINT rooms_game_mode_check 
        CHECK (game_mode IN ('gold_quest', 'battle_royale', 'fishing', 'factory', 'cafe', 'mafia', 'tower', 'dontlookdown'));
END $$;

-- Add comment
COMMENT ON TYPE game_mode IS 'Game modes: gold_quest, battle_royale, fishing, factory, cafe, mafia, tower, dontlookdown';
