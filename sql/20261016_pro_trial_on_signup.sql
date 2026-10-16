-- ============================================
-- QuizDog 가입 시 프로 무료 체험 2주 (2026-10-16)
-- ============================================
-- 새로 가입하는 선생님은 가입한 순간부터 14일 동안 프로다(teacher_plans.pro_until = 가입 시각 + 14일).
-- 이미 가입한 선생님에게는 소급하지 않는다(가입 트리거라 새 가입만).
--
-- 예약 구독(20261016_pending_plan_grants.sql)과 같이 걸리면 더 긴 쪽이 남는다 — 두 트리거 모두
-- GREATEST 로 쓰기 때문에 실행 순서와 상관없다. 관리자가 계정을 만들 때 기간을 직접 정하면
-- 서버(app/api/admin/users POST)가 그 값으로 덮어쓴다.
-- 체험 일수는 아래 pro_trial_days() 한 곳에서 바꾼다. 관리자 화면 문구(TRIAL_DAYS=14)도 같이 맞춘다.
-- 실패해도 가입은 막지 않는다(EXCEPTION 블록). 여러 번 실행해도 안전하다.

CREATE OR REPLACE FUNCTION public.pro_trial_days()
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 14 $$;

CREATE OR REPLACE FUNCTION public.apply_signup_pro_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_until TIMESTAMPTZ := NOW() + make_interval(days => public.pro_trial_days());
BEGIN
  INSERT INTO public.teacher_plans (user_id, pro_until)
  VALUES (NEW.id, v_until)
  ON CONFLICT (user_id) DO UPDATE
    SET pro_until = GREATEST(COALESCE(public.teacher_plans.pro_until, EXCLUDED.pro_until), EXCLUDED.pro_until),
        updated_at = NOW();
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'apply_signup_pro_trial failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_pro_trial ON auth.users;
CREATE TRIGGER on_auth_user_created_pro_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.apply_signup_pro_trial();
