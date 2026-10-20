-- 화면 오류 기록 (2026-10-20)
--
-- 학생·선생님 브라우저에서 터진 오류(window.onerror, unhandledrejection, Next.js error.tsx)를
-- /api/client-errors 가 받아 여기에 쌓는다. 관리자 '수업 점검' 페이지가 날짜별로 읽는다.
--
-- 쓰기·읽기 모두 서버(service role)만 한다. anon·authenticated 에게는 아무 권한도 주지 않아
-- 브라우저가 직접 넣거나 읽을 수 없다(API 가 크기·개수를 제한한 뒤 넣는다).
--
-- 여러 번 실행해도 안전하다.

CREATE TABLE IF NOT EXISTS public.client_error_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind        TEXT NOT NULL DEFAULT 'error',   -- error | unhandledrejection | page_error | global_error
  message     TEXT NOT NULL,
  stack       TEXT,
  path        TEXT,                            -- 오류가 난 페이지 경로(쿼리 제외)
  room_code   TEXT,                            -- 게임 화면이면 방 코드
  nickname    TEXT,                            -- 학생 화면이면 닉네임
  user_id     UUID,                            -- 로그인한 선생님이면 그 id
  user_agent  TEXT,
  extra       JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS client_error_logs_created_at_idx
  ON public.client_error_logs (created_at DESC);

ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_error_logs FROM anon, authenticated;

-- 30일 지난 오류는 지운다. (pg_cron 이 없으면 관리자 API 가 조회할 때 같이 지운다)
CREATE OR REPLACE FUNCTION public.prune_client_error_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.client_error_logs WHERE created_at < NOW() - INTERVAL '30 days';
$$;
REVOKE ALL ON FUNCTION public.prune_client_error_logs() FROM PUBLIC, anon, authenticated;
