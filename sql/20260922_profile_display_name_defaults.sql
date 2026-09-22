-- 표시 이름을 묻는 팝업 없이, 가입 때 입력한 이름으로 profiles.display_name 을 채운다.
--
-- 1) handle_new_user 트리거: 회원가입 폼의 display_name → 소셜 프로필 이름(name/full_name/
--    nickname/preferred_username/user_name) → 이메일 앞부분 순으로 기본값을 넣는다.
-- 2) 이미 가입했지만 이름이 비어 있는 선생님도 같은 규칙으로 채운다.
-- (앱 쪽도 같은 규칙으로 비어 있으면 채우므로, 이 SQL 은 새 가입자 처리를 DB 에서 끝내기 위한 것.)

CREATE OR REPLACE FUNCTION public.default_display_name(meta JSONB, email TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LEFT(
    COALESCE(
      NULLIF(TRIM(COALESCE(meta->>'display_name', '')), ''),
      NULLIF(TRIM(COALESCE(meta->>'name', '')), ''),
      NULLIF(TRIM(COALESCE(meta->>'full_name', '')), ''),
      NULLIF(TRIM(COALESCE(meta->>'nickname', '')), ''),
      NULLIF(TRIM(COALESCE(meta->>'preferred_username', '')), ''),
      NULLIF(TRIM(COALESCE(meta->>'user_name', '')), ''),
      NULLIF(TRIM(SPLIT_PART(COALESCE(email, ''), '@', 1)), ''),
      '선생님'
    ),
    20
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, public.default_display_name(NEW.raw_user_meta_data, NEW.email))
  ON CONFLICT (id) DO UPDATE
    SET display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
        updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 기존 가입자: 프로필 행이 없으면 만들고, 이름이 비어 있으면 채운다.
INSERT INTO public.profiles (id, display_name)
SELECT u.id, public.default_display_name(u.raw_user_meta_data, u.email)
  FROM auth.users u
ON CONFLICT (id) DO UPDATE
  SET display_name = COALESCE(NULLIF(TRIM(public.profiles.display_name), ''), EXCLUDED.display_name),
      updated_at = NOW();
