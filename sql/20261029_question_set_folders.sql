-- 내 문제집 폴더 (2026-10-29)
--
-- 문제집이 쌓이면 목록이 길어져서, 선생님이 폴더를 만들어 문제집을 나눠 담는다.
--   question_set_folders   선생님 한 명의 폴더 (한 단계만, 폴더 안 폴더 없음)
--   question_sets.folder_id 문제집이 들어 있는 폴더 (NULL 이면 '폴더 없음')
-- 폴더를 지우면 안에 있던 문제집은 지워지지 않고 '폴더 없음'으로 돌아간다 (ON DELETE SET NULL).
--
-- 실행 전에는 내 문제집 화면의 폴더 줄이 "DB 업데이트가 필요해요" 안내만 보이고,
-- 문제집 목록·게임 등 나머지 기능은 그대로 동작한다.

CREATE TABLE IF NOT EXISTS public.question_set_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 한 선생님 안에서 같은 이름의 폴더는 하나만
CREATE UNIQUE INDEX IF NOT EXISTS question_set_folders_owner_name_key
  ON public.question_set_folders (owner_id, name);

ALTER TABLE public.question_sets
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.question_set_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_question_sets_folder_id ON public.question_sets (folder_id);

-- 폴더는 학생·자료실이 볼 일이 없으므로 자기 폴더만 읽고 쓴다.
ALTER TABLE public.question_set_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS question_set_folders_select_own ON public.question_set_folders;
CREATE POLICY question_set_folders_select_own
  ON public.question_set_folders FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS question_set_folders_insert_own ON public.question_set_folders;
CREATE POLICY question_set_folders_insert_own
  ON public.question_set_folders FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS question_set_folders_update_own ON public.question_set_folders;
CREATE POLICY question_set_folders_update_own
  ON public.question_set_folders FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS question_set_folders_delete_own ON public.question_set_folders;
CREATE POLICY question_set_folders_delete_own
  ON public.question_set_folders FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

REVOKE ALL ON TABLE public.question_set_folders FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.question_set_folders TO authenticated;

-- PostgREST 가 새 표·컬럼을 바로 알아보게 스키마 캐시를 새로 읽힌다.
NOTIFY pgrst, 'reload schema';
