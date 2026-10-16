-- ============================================
-- QuizDog 예약 구독(가입 전 프로 지급) (2026-10-16)
-- ============================================
-- 납품 때 선생님이 아직 퀴즈독에 가입하지 않은 경우가 있다(예: 교동초 구매자 계정 gudals12@gmail.com).
-- 이메일만 미리 등록해 두면, 그 이메일로 가입하는 순간(이메일 가입·구글 로그인 모두) 가입일 기준으로
-- 프로 기간을 teacher_plans 에 넣는다. 가입 전에는 아무 행도 없으니 teacher_plans 에 못 넣기 때문.
--
-- pending_plan_grants: 이메일(소문자) → 줄 기간(interval). applied_at 이 채워지면 끝난 것.
--   anon/authenticated 는 전혀 못 본다. 등록은 서버(service role)나 대시보드에서.
-- apply_pending_plan_grant(): auth.users 삽입 뒤 트리거. 실패해도 가입은 막지 않는다(EXCEPTION 블록).
--   프로필 트리거(handle_new_user)와는 별개 트리거로 둔다 — 서로 영향 없게.
--
-- 적용 후 types/database.types.ts 에 pending_plan_grants 를 추가했다. 여러 번 실행해도 안전하다.

CREATE TABLE IF NOT EXISTS public.pending_plan_grants (
  email TEXT PRIMARY KEY,                       -- 반드시 소문자
  pro_interval INTERVAL NOT NULL,               -- 가입일부터 더할 기간
  note TEXT,                                    -- 어느 주문인지
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ,
  applied_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.pending_plan_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pending_plan_grants FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_pending_plan_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant public.pending_plan_grants%ROWTYPE;
  v_until TIMESTAMPTZ;
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_grant
  FROM public.pending_plan_grants
  WHERE email = LOWER(NEW.email) AND applied_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_until := NOW() + v_grant.pro_interval;

  INSERT INTO public.teacher_plans (user_id, pro_until)
  VALUES (NEW.id, v_until)
  ON CONFLICT (user_id) DO UPDATE
    SET pro_until = GREATEST(COALESCE(public.teacher_plans.pro_until, v_until), v_until),
        updated_at = NOW();

  UPDATE public.pending_plan_grants
  SET applied_at = NOW(), applied_user_id = NEW.id
  WHERE email = v_grant.email;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- 예약 구독 때문에 가입이 막히면 안 된다. 적용 안 된 행은 applied_at 이 비어 있어 나중에 손으로 처리한다.
  RAISE WARNING 'apply_pending_plan_grant failed for %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_plan_grant ON auth.users;
CREATE TRIGGER on_auth_user_created_plan_grant
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.apply_pending_plan_grant();

-- 교동초등학교 구매자 계정(주문 2026-10-16): 가입일부터 1년 + 무료체험 2주
INSERT INTO public.pending_plan_grants (email, pro_interval, note)
VALUES ('gudals12@gmail.com', INTERVAL '1 year 2 weeks', '교동초등학교 2026-10-16 주문')
ON CONFLICT (email) DO NOTHING;
