-- 문제에 그림 붙이기 (2026-09-10)
--
-- 1) questions.image_url — 문제 그림의 공개 URL. NULL이면 그림 없음.
--    그림은 Supabase Storage의 'question-images' 버킷에 들어간다.
-- 2) 'question-images' 공개 버킷 — 읽기는 공개 URL로 누구나(학생 포함),
--    쓰기는 서버 API(app/api/question-image, 서비스 키)만 한다.
--    브라우저는 버킷에 직접 쓰지 않으므로 storage.objects 정책은 필요 없다.
--
-- 앱 코드는 이 컬럼이 없어도 그림 없는 문제는 그대로 동작한다.
-- 다만 그림을 넣고 저장하려면 이 마이그레이션이 먼저 적용돼 있어야 한다.

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.questions.image_url
  IS '문제 그림 공개 URL (Storage question-images 버킷). NULL이면 그림 없음';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'question-images',
  'question-images',
  true,
  5242880,
  ARRAY['image/webp', 'image/png', 'image/jpeg', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
