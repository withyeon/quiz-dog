-- ============================================
-- Battle Royale 게임 모드 필드 추가
-- ============================================
-- 이 파일은 Supabase SQL Editor에서 실행하세요.

-- rooms 테이블에 game_mode 확장 (이미 있을 수 있음)
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS game_mode TEXT CHECK (game_mode IN ('gold_quest', 'battle_royale'));

-- players 테이블에 체력 필드 추가
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS health INTEGER DEFAULT 100;

-- players 테이블에 공격력 필드 추가 (선택적)
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS attack_power INTEGER DEFAULT 10;

-- players 테이블에 방어력 필드 추가 (선택적)
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS defense INTEGER DEFAULT 0;

-- 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_players_health ON players(health);
CREATE INDEX IF NOT EXISTS idx_players_room_health ON players(room_code, health);

-- ============================================
-- 완료!
-- ============================================
