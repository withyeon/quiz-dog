-- ============================================
-- 눈싸움 대작전 팀전 모드: 팀 필드 추가
-- ============================================
-- Supabase SQL Editor에서 실행하세요.

ALTER TABLE players
ADD COLUMN IF NOT EXISTS team TEXT CHECK (team IN ('red', 'blue'));

ALTER TABLE players
ADD COLUMN IF NOT EXISTS revival_streak INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_players_room_team ON players(room_code, team);

-- ============================================
-- 완료!
-- ============================================
