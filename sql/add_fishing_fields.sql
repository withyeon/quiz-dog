-- ============================================
-- Fishing Frenzy 게임 모드를 위한 필드 추가
-- ============================================
-- 이 파일은 Supabase SQL Editor에서 실행하세요.

-- rooms 테이블에 game_mode 확장 (fishing 추가)
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS game_mode TEXT CHECK (game_mode IN ('gold_quest', 'battle_royale', 'fishing'));

-- players 테이블에 낚시 관련 필드 추가
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS caught_fishes JSONB DEFAULT '[]'::jsonb;

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS fishing_points INTEGER DEFAULT 0;

-- 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_players_fishing_points ON players(fishing_points);

-- ============================================
-- 완료!
-- ============================================
