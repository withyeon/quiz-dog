-- 문제집 공유 링크 + 선생님 표시 이름
-- Supabase 대시보드 → SQL Editor 에서 한 번 실행하세요.
--
-- 이 파일은 "스키마만" 바꿉니다. 쓰기 권한 잠금(RLS)은 짝 파일인
-- 20260910_question_set_rls.sql 에 따로 두었습니다. 공유 기능이 정상 동작하는 것을
-- 확인한 뒤에 그 파일을 실행하세요. (docs/SECURITY.md 참고)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ────────────────────────────────────────────────────────────
-- 1) 공유 링크
--
--    is_public  = 자료실 목록에 등재 (누구나 검색·탐색 가능)
--    is_shared  = 링크를 아는 사람만 열람 (목록에는 안 뜸)
--    두 개는 독립이다. 링크만 공유하고 자료실에는 안 올릴 수 있다.
--
--    share_code 는 한 번 발급하면 계속 유지한다. 공유를 껐다가 다시 켜도
--    같은 주소가 살아나야 이미 뿌린 링크가 죽지 않는다.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.question_sets
  ADD COLUMN IF NOT EXISTS share_code TEXT,
  ADD COLUMN IF NOT EXISTS is_shared  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_at  TIMESTAMPTZ;

-- 같은 코드가 두 번 나오면 안 된다. NULL 은 여러 개 허용(아직 공유 안 한 문제집).
CREATE UNIQUE INDEX IF NOT EXISTS idx_question_sets_share_code
  ON public.question_sets(share_code)
  WHERE share_code IS NOT NULL;

-- 코드 생성기.
-- 0/O, 1/l/I 처럼 눈으로 헷갈리는 글자는 뺐다. 링크는 보통 눌러서 가지만
-- 인디스쿨 댓글이나 메신저에서 손으로 옮겨 적는 선생님이 반드시 나온다.
CREATE OR REPLACE FUNCTION public.generate_share_code(len INT DEFAULT 8)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet TEXT := 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result   TEXT := '';
  i        INT;
BEGIN
  FOR i IN 1..len LOOP
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::INT, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- 새 문제집은 만들 때부터 코드를 갖는다. 나중에 공유를 켤 때 추가 작업이 필요 없다.
-- (55^8 ≈ 84조 가지라 충돌은 사실상 나지 않는다)
ALTER TABLE public.question_sets
  ALTER COLUMN share_code SET DEFAULT public.generate_share_code(8);

-- 기존 문제집에도 코드를 채운다. 충돌이 나면 그 행만 다시 뽑는다.
DO $$
DECLARE
  target RECORD;
  candidate TEXT;
  attempts INT;
BEGIN
  FOR target IN SELECT id FROM public.question_sets WHERE share_code IS NULL LOOP
    attempts := 0;
    LOOP
      attempts := attempts + 1;
      candidate := public.generate_share_code(8);
      BEGIN
        UPDATE public.question_sets SET share_code = candidate WHERE id = target.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF attempts >= 5 THEN
          RAISE EXCEPTION '공유 코드 생성 실패: %', target.id;
        END IF;
      END;
    END LOOP;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_question_sets_is_shared
  ON public.question_sets(is_shared)
  WHERE is_shared = true;

-- ────────────────────────────────────────────────────────────
-- 2) 사본의 출처
--    남의 문제집을 가져오면 새 문제집이 만들어진다. 이때 원본을 가리켜 두면
--    사본에도 "OO 선생님 문제집에서 가져옴"을 표시할 수 있다.
--    원본이 지워져도 사본은 남아야 하므로 ON DELETE SET NULL.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.question_sets
  ADD COLUMN IF NOT EXISTS forked_from TEXT
    REFERENCES public.question_sets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_question_sets_forked_from
  ON public.question_sets(forked_from)
  WHERE forked_from IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 3) 유입 통계
--    인디스쿨에 뿌린 링크가 실제로 수업으로 이어졌는지 보려면
--    "몇 명이 열었나"와 "몇 번 게임이 됐나"를 나눠서 봐야 한다.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.question_sets
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS play_count INTEGER NOT NULL DEFAULT 0;

-- 조회수는 페이지를 열 때마다 늘어나므로 RLS 를 켜도 anon 이 올릴 수 있어야 한다.
-- UPDATE 권한을 통째로 주지 않기 위해 함수로 감싼다(SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.bump_question_set_view(p_share_code TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.question_sets
     SET view_count = view_count + 1
   WHERE share_code = p_share_code
     AND (is_shared = true OR is_public = true);
$$;

CREATE OR REPLACE FUNCTION public.bump_question_set_play(p_set_id TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.question_sets
     SET play_count = play_count + 1
   WHERE id = p_set_id;
$$;

GRANT EXECUTE ON FUNCTION public.bump_question_set_view(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_question_set_play(TEXT) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 4) 선생님 표시 이름
--    지금은 owner_id 가 auth.users 의 uuid 뿐이라 "원작: OO 선생님"을 못 쓴다.
--    auth.users 는 anon 이 읽을 수 없으므로 공개용 프로필 테이블을 따로 둔다.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 공유 페이지(비로그인)에서 원작자 이름을 읽어야 하므로 SELECT 는 anon 에게 연다.
-- 자기 행만 쓰게 하는 건 아래 RLS 로 막는다. 표시 이름 외에는 아무것도 담지 않는다.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS profiles_public_read ON public.profiles;
CREATE POLICY profiles_public_read
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS profiles_self_insert ON public.profiles;
CREATE POLICY profiles_self_insert
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 가입하면 빈 프로필을 만들어 둔다. 표시 이름은 나중에 채운다.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'display_name', '')), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 이미 가입한 선생님들 몫도 채워 둔다(표시 이름은 비어 있음 → 앱에서 한 번 물어본다).
INSERT INTO public.profiles (id, display_name)
SELECT u.id, NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'display_name', '')), '')
  FROM auth.users u
ON CONFLICT (id) DO NOTHING;
