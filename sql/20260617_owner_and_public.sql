-- 출시 전 데이터 분리 + 자료실 공개 + 좋아요 테이블
-- Supabase 대시보드 → SQL Editor 에서 한 번 실행하세요.
-- (이 프로젝트는 RLS 비활성 + anon/authenticated 풀 권한 정책을 따릅니다. docs/SECURITY.md 참고)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ────────────────────────────────────────────────────────────
-- 1) question_sets: 소유자(owner_id) + 자료실 공개 여부(is_public)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.question_sets
  ADD COLUMN IF NOT EXISTS owner_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_question_sets_owner_id  ON public.question_sets(owner_id);
CREATE INDEX IF NOT EXISTS idx_question_sets_is_public ON public.question_sets(is_public);

-- 기존 문제집(소유자 없음)은 자료실 공개 콘텐츠로 전환해 둡니다.
-- → 신규 선생님의 "내 문제집"에는 안 보이고, 자료실에는 그대로 노출됩니다.
-- 특정 계정의 개인 문제집으로 가져가고 싶다면 아래 한 줄을 대신 실행하세요:
--   UPDATE public.question_sets SET owner_id = '<선생님 auth.users.id>' WHERE owner_id IS NULL;
UPDATE public.question_sets
  SET is_public = true
  WHERE owner_id IS NULL;

-- ────────────────────────────────────────────────────────────
-- 2) question_set_likes: 자료실 좋아요/인기글 (라이브 DB에 누락되어 있던 테이블)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.question_set_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id     TEXT NOT NULL REFERENCES public.question_sets(id) ON DELETE CASCADE,
  client_id  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT question_set_likes_set_client_unique UNIQUE (set_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_question_set_likes_set_id
  ON public.question_set_likes(set_id);
CREATE INDEX IF NOT EXISTS idx_question_set_likes_created_at
  ON public.question_set_likes(created_at DESC);

-- 이 프로젝트는 RLS 비활성 정책. 새 테이블은 Supabase가 RLS를 자동으로 켜는 경우가 있어
-- 명시적으로 끄고, 혹시 켜져 있어도 동작하도록 허용 정책도 함께 둔다.
ALTER TABLE public.question_set_likes DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON TABLE public.question_set_likes TO anon, authenticated;

DROP POLICY IF EXISTS question_set_likes_all_access ON public.question_set_likes;
CREATE POLICY question_set_likes_all_access
  ON public.question_set_likes
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
