-- ============================================
-- Factory 게임 모드를 위한 필드 추가
-- ============================================
-- 이 파일은 Supabase SQL Editor에서 실행하세요.

-- rooms 테이블에 game_mode 확장 (factory 추가)
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS game_mode TEXT CHECK (game_mode IN ('gold_quest', 'battle_royale', 'fishing', 'factory'));

-- players 테이블에 팩토리 관련 필드 추가
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS factories JSONB DEFAULT '[]'::jsonb;

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS factory_money INTEGER DEFAULT 0;

-- 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_players_factory_money ON players(factory_money);

-- ============================================
-- 완료!
-- ============================================
