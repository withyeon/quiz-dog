-- ============================================
-- 눈싸움 대작전 팀전 모드: 팀 필드 추가
-- ============================================
-- ⚠️ 이 파일은 20260910_battle_team_fields.sql 로 대체되었다.
--    (날짜 없는 파일이라 마이그레이션 순서에서 누락돼 라이브에 실행된 적이 없었다.)
--    새 파일 쪽을 실행할 것. 내용은 같고 둘 다 여러 번 실행해도 안전하다.

ALTER TABLE players
ADD COLUMN IF NOT EXISTS team TEXT CHECK (team IN ('red', 'blue'));

ALTER TABLE players
ADD COLUMN IF NOT EXISTS revival_streak INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_players_room_team ON players(room_code, team);

-- ============================================
-- 완료!
-- ============================================
