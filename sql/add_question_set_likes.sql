-- 자료실 문제집 좋아요와 인기글 집계를 위한 테이블
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.question_set_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id TEXT NOT NULL REFERENCES public.question_sets(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT question_set_likes_set_client_unique UNIQUE (set_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_question_set_likes_set_id
  ON public.question_set_likes(set_id);

CREATE INDEX IF NOT EXISTS idx_question_set_likes_created_at
  ON public.question_set_likes(created_at DESC);

GRANT SELECT, INSERT, DELETE ON TABLE public.question_set_likes TO anon, authenticated;
