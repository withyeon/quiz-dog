-- ============================================
-- QuizDog 선생님 요금제 + 위드현 이용 코드 (2026-10-06)
-- ============================================
-- 위드현에듀테크가 학교 납품 때 계정마다 초피티·퀴즈독 프로 1개월 이용 코드를 1개씩 준다.
-- 지금까지 퀴즈독에는 요금제를 저장하는 곳이 없었다(가격표에만 Pro). 그래서 여기서 처음 만든다.
--
-- teacher_plans: 선생님별 프로 만료일(pro_until). profiles에 두지 않는다 — profiles는 본인이 브라우저에서
--   바로 고칠 수 있고 누구나 읽을 수 있어서, 거기 두면 스스로 프로를 줄 수 있다.
--   이 표는 본인 행 읽기만 열고, 쓰기는 서버(service role)와 아래 함수만 한다.
-- promo_code_redemptions: 코드 사용 기록. 코드당 한 번(code 기본 키). 같은 코드는 초피티에서도 한 번 쓸 수 있다
--   (초피티는 자기 DB에 따로 남긴다). 탈퇴해도 지우지 않고 user_id만 비운다 — 코드를 다시 못 쓰게 막는 기록이다.
-- redeem_promo_code(): 사용 기록과 기간 연장을 한 트랜잭션에서 한다. 프로가 남아 있으면 그 뒤에 잇는다.
--   코드 서명 확인은 서버(lib/promoCode.ts, WITHYEON_PROMO_CODE_SECRET)가 먼저 하고, 이 함수는 service_role만 부른다.
--
-- 적용 후 types/database.types.ts 도 함께 갱신되어 있다. 여러 번 실행해도 안전하다.

CREATE TABLE IF NOT EXISTS public.teacher_plans (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pro_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.teacher_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.teacher_plans FROM anon, authenticated;
GRANT SELECT ON TABLE public.teacher_plans TO authenticated;
DROP POLICY IF EXISTS teacher_plans_self_read ON public.teacher_plans;
CREATE POLICY teacher_plans_self_read ON public.teacher_plans
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.promo_code_redemptions (
  code TEXT PRIMARY KEY,                -- 하이픈 없는 대문자 16자
  kind TEXT NOT NULL,                   -- pro_1m
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pro_until_before TIMESTAMPTZ,
  pro_until_after TIMESTAMPTZ NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS promo_code_redemptions_user_idx ON public.promo_code_redemptions (user_id);

ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.promo_code_redemptions FROM anon, authenticated;

-- 코드를 쓰고 프로 기간을 더한다. 새 만료일을 돌려준다.
-- 이미 쓴 코드면 promo_code_redemptions 기본 키에 걸려 unique_violation(23505)으로 전체가 되돌려진다.
CREATE OR REPLACE FUNCTION public.redeem_promo_code(
  p_code TEXT,
  p_kind TEXT,
  p_user_id UUID,
  p_months INT
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before TIMESTAMPTZ;
  v_after TIMESTAMPTZ;
BEGIN
  IF p_months IS NULL OR p_months < 1 OR p_months > 24 THEN
    RAISE EXCEPTION 'invalid_months' USING ERRCODE = 'P0001';
  END IF;

  -- 선생님 행을 만들고 잠근다. 같은 선생님의 등록 두 개가 겹쳐도 기간은 하나씩 더해진다.
  INSERT INTO teacher_plans (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT pro_until INTO v_before FROM teacher_plans WHERE user_id = p_user_id FOR UPDATE;

  v_after := GREATEST(NOW(), COALESCE(v_before, NOW())) + make_interval(months => p_months);

  INSERT INTO promo_code_redemptions (code, kind, user_id, pro_until_before, pro_until_after)
  VALUES (p_code, p_kind, p_user_id, v_before, v_after);

  UPDATE teacher_plans SET pro_until = v_after, updated_at = NOW() WHERE user_id = p_user_id;
  RETURN v_after;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_promo_code(TEXT, TEXT, UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(TEXT, TEXT, UUID, INT) TO service_role;
