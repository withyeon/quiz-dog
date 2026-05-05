-- Add 'tower' to the game_mode check constraint in the rooms table

-- First, drop the existing constraint
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_game_mode_check;

-- Then, add the new constraint with 'tower' included
ALTER TABLE rooms ADD CONSTRAINT rooms_game_mode_check 
  CHECK (game_mode IN ('gold_quest', 'battle_royale', 'fishing', 'factory', 'cafe', 'mafia', 'tower'));
