-- ============================================
-- Mafia Heist: Betrayal 게임 모드를 위한 필드 추가
-- ============================================
-- 이 파일은 Supabase SQL Editor에서 실행하세요.

-- rooms 테이블에 game_mode 확장 (mafia 추가)
-- 기존 CHECK 제약조건을 제거하고 새로운 것으로 교체
ALTER TABLE rooms 
DROP CONSTRAINT IF EXISTS rooms_game_mode_check;

ALTER TABLE rooms 
ADD CONSTRAINT rooms_game_mode_check 
CHECK (game_mode IN ('gold_quest', 'battle_royale', 'fishing', 'factory', 'cafe', 'mafia'));

-- players 테이블에 마피아 관련 필드 추가 (선택적, 단일 플레이어 게임이지만 통계용)
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS mafia_cash INTEGER DEFAULT 0;

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS mafia_diamonds INTEGER DEFAULT 0;

-- 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_players_mafia_cash ON players(mafia_cash);

-- ============================================
-- 완료!
-- ============================================
