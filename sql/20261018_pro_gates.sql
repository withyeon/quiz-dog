-- ============================================
-- QuizDog 프로 전용 기능 잠금 (2026-10-18)
-- ============================================
-- 요금제 페이지가 약속한 차이를 실제로 건다(그동안은 아무것도 막지 않았다).
--   1) 게임당 참여 인원: 무료 30명 / 프로 무제한  → players BEFORE INSERT 트리거
--   2) AI 문제 생성 횟수: 무료 월 10회 / 프로 300회 → ai_generation_logs (서버가 세고 막는다)
--   3) 문항별 분석·엑셀 내보내기는 서버/화면에서 teacher_plans 로 가른다(SQL 없음)
-- 여러 번 실행해도 안전하다.

-- ────────────────────────────────────────────
-- 1) 참여 인원 제한
-- ────────────────────────────────────────────
-- 방 주인(rooms.owner_id)이 프로가 아니면 한 방에 free_player_limit() 명까지만 들어간다.
-- 주인이 없는 방(옛 방·테스트 방)은 무료로 본다. 인원 수는 그 방의 players 행 수(나갔다 들어와도 행을 다시 쓰므로 같다).
-- 조회 중 다른 오류가 나면 입장을 막지 않는다(수업이 요금제 조회 때문에 멈추면 안 된다). 한도 초과만 QD001 로 거절한다.
-- 한도 값은 lib/plans.ts FREE_PLAYER_LIMIT 과 같아야 한다.

CREATE OR REPLACE FUNCTION public.free_player_limit()
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 30 $$;

CREATE OR REPLACE FUNCTION public.players_enforce_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_is_pro BOOLEAN := false;
  v_count INT;
BEGIN
  BEGIN
    SELECT owner_id INTO v_owner FROM public.rooms WHERE room_code = NEW.room_code;
    IF v_owner IS NOT NULL THEN
      SELECT COALESCE(pro_until > NOW(), false) INTO v_is_pro
      FROM public.teacher_plans WHERE user_id = v_owner;
    END IF;
    IF COALESCE(v_is_pro, false) THEN
      RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.players WHERE room_code = NEW.room_code;
    IF v_count >= public.free_player_limit() THEN
      RAISE EXCEPTION 'PLAYER_LIMIT: this room allows up to % players on the free plan', public.free_player_limit()
        USING ERRCODE = 'QD001';
    END IF;
    RETURN NEW;
  EXCEPTION
    WHEN SQLSTATE 'QD001' THEN
      RAISE;
    WHEN OTHERS THEN
      RAISE WARNING 'players_enforce_limit skipped for room %: %', NEW.room_code, SQLERRM;
      RETURN NEW;
  END;
END;
$$;

DROP TRIGGER IF EXISTS players_enforce_limit_trigger ON public.players;
CREATE TRIGGER players_enforce_limit_trigger
  BEFORE INSERT ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.players_enforce_limit();

-- ────────────────────────────────────────────
-- 2) AI 문제 생성 기록
-- ────────────────────────────────────────────
-- 서버(/api/generate-questions)가 "새로 만들기" 한 번마다 한 줄 넣고, 이번 달(KST) 줄 수로 한도를 본다.
-- 한 문제 다시 만들기·몇 개 더 만들기는 세지 않는다. 쓰기/읽기 모두 service role 만.

CREATE TABLE IF NOT EXISTS public.ai_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,            -- topic | youtube | text | file | pdf | exam
  question_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_generation_logs_user_month_idx
  ON public.ai_generation_logs (user_id, created_at DESC);

ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_generation_logs FROM anon, authenticated;
