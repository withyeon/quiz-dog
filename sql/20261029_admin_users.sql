-- 관리자 계정 목록을 한곳(Supabase)에서 관리한다.
-- 예전에는 Vercel 환경변수(NEXT_PUBLIC_ADMIN_EMAILS), 코드 기본값, .env.local, 중계 서버 설정에 흩어져 있었다.
--
-- - admin_users: 관리자 이메일 목록. anon·authenticated 는 읽지도 쓰지도 못한다(서버 service role 만).
--   그래서 관리자 이메일이 더는 사이트 코드에 공개되지 않는다.
-- - is_admin(): 지금 로그인한 사람이 관리자인지 true/false 만 알려 준다. 화면과 중계 서버(rt.quizdog.kr)가 쓴다.
-- - 관리자 추가·삭제는 관리자 화면 /admin/admins 에서 한다(서버 API가 service role 로 쓴다).
--
-- 적용 전에는 앱이 예전 목록(환경변수 + 코드 기본값)으로 동작한다. 적용하면 이 표가 유일한 기준이 된다.
-- 여러 번 실행해도 안전하다.

CREATE TABLE IF NOT EXISTS public.admin_users (
  email       TEXT PRIMARY KEY CHECK (email = lower(btrim(email)) AND email LIKE '%_@_%'),
  note        TEXT,
  added_by    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_users FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE email = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 지금까지 관리자였던 계정 (운영 환경변수 + 코드 기본값 + 로컬 설정을 합친 것)
INSERT INTO public.admin_users (email, note, added_by) VALUES
  ('withyeonedu@gmail.com', '기존 관리자', 'sql/20261029_admin_users.sql'),
  ('tjdud3617@gmail.com', '기존 관리자', 'sql/20261029_admin_users.sql'),
  ('withyeongpt@hyeonedu.com', '기존 관리자', 'sql/20261029_admin_users.sql'),
  ('rhehdgus6744@gmail.com', '기존 관리자', 'sql/20261029_admin_users.sql')
ON CONFLICT (email) DO NOTHING;
