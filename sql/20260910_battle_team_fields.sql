-- ============================================
-- QuizDog 눈싸움 대작전 — 팀전 컬럼 (누락분 보강)
-- ============================================
-- players.team / players.revival_streak 은 add_battle_team_field.sql 에 있었지만
-- 라이브 DB에 실행된 적이 없다. 20260504_game_runtime_integrity.sql 이 다른 모드의
-- 런타임 컬럼을 몰아서 보강할 때도 이 둘은 빠졌다.
--
-- 그 결과 프로덕션에서 팀전이 한 번도 동작하지 않았다:
--   · 호스트의 팀 배정 update 가 42703(column does not exist)으로 전부 실패
--   · 팀이 없으니 isTeamGame=false → 개인전으로 조용히 폴백
--   · revival_streak 도 없어 탈락자 부활(3연속 정답)이 동작하지 않음
--
-- 여러 번 실행해도 안전하다.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS team TEXT CHECK (team IN ('red', 'blue'));

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS revival_streak INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_players_room_team ON public.players(room_code, team);

-- 확인용
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'players' AND column_name IN ('team', 'revival_streak');
