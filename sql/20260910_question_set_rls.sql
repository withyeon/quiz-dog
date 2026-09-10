-- 문제집 쓰기 권한 잠금 (question_sets, questions)
--
-- ⚠ 먼저 20260910_share_links_and_profiles.sql 를 실행하고,
--   공유 링크가 정상 동작하는 것을 확인한 뒤에 이 파일을 실행하세요.
--
-- 왜 필요한가:
--   지금은 RLS 가 꺼져 있고 anon 에게 풀 권한이 있어서, 로그인하지 않은 누구나
--   문제집 id 만 알면 남의 문제집을 수정·삭제할 수 있다. 지금까지는 id 를 알 방법이
--   사실상 없어서 문제가 안 됐지만, 공유 링크(/s/<code>)를 열면 id 노출이 정상 동작이
--   된다. 인기 문제집일수록 id 가 많이 알려지므로 여기만 먼저 잠근다.
--
-- 무엇을 안 건드리는가:
--   rooms, players, game_reports 등 게임 런타임 테이블은 그대로 둔다.
--   학생은 로그인하지 않으므로 여기에 RLS 를 걸면 게임이 통째로 멈춘다.
--   (docs/SECURITY.md 의 "부분 잠금이 선생님 플로우를 깨뜨린다"는 경고는
--    런타임 테이블을 잠갔을 때의 이야기다.)
--
-- 되돌리려면 맨 아래 롤백 블록을 실행하세요.

-- ────────────────────────────────────────────────────────────
-- question_sets
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.question_sets ENABLE ROW LEVEL SECURITY;

-- 읽기: 전부 허용.
--  · 학생 게임 화면이 anon 으로 문제집을 읽는다
--  · 공유 페이지(/s/<code>)도 비로그인이다
--  · 자료실 목록도 비로그인으로 열 예정이다
DROP POLICY IF EXISTS question_sets_read ON public.question_sets;
CREATE POLICY question_sets_read
  ON public.question_sets FOR SELECT
  TO anon, authenticated
  USING (true);

-- 만들기: 로그인한 선생님이 자기 소유로만.
DROP POLICY IF EXISTS question_sets_insert_own ON public.question_sets;
CREATE POLICY question_sets_insert_own
  ON public.question_sets FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- 고치기·지우기: 자기 문제집만.
--   owner_id 가 NULL 인 기존 자료실 콘텐츠는 아무도 못 고친다(의도한 것).
--   운영자는 /admin 의 service-role 경로로 관리한다 — service_role 은 RLS 를 우회한다.
DROP POLICY IF EXISTS question_sets_update_own ON public.question_sets;
CREATE POLICY question_sets_update_own
  ON public.question_sets FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS question_sets_delete_own ON public.question_sets;
CREATE POLICY question_sets_delete_own
  ON public.question_sets FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- anon 에게 남아 있던 쓰기 권한을 회수한다. 정책보다 GRANT 가 먼저이므로
-- 이걸 안 하면 RLS 를 켜도 anon 이 INSERT 를 시도할 수 있다.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.question_sets FROM anon;
GRANT SELECT ON TABLE public.question_sets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.question_sets TO authenticated;

-- ────────────────────────────────────────────────────────────
-- questions
--   문제는 소유자 정보를 직접 갖고 있지 않으므로 부모 문제집을 통해 판단한다.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS questions_read ON public.questions;
CREATE POLICY questions_read
  ON public.questions FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS questions_insert_own_set ON public.questions;
CREATE POLICY questions_insert_own_set
  ON public.questions FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.question_sets s
     WHERE s.id = questions.set_id
       AND s.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS questions_update_own_set ON public.questions;
CREATE POLICY questions_update_own_set
  ON public.questions FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.question_sets s
     WHERE s.id = questions.set_id
       AND s.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.question_sets s
     WHERE s.id = questions.set_id
       AND s.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS questions_delete_own_set ON public.questions;
CREATE POLICY questions_delete_own_set
  ON public.questions FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.question_sets s
     WHERE s.id = questions.set_id
       AND s.owner_id = auth.uid()
  ));

REVOKE INSERT, UPDATE, DELETE ON TABLE public.questions FROM anon;
GRANT SELECT ON TABLE public.questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.questions TO authenticated;

-- 정책 조회를 빠르게 하기 위한 인덱스(없으면 문제 저장이 느려진다)
CREATE INDEX IF NOT EXISTS idx_questions_set_id ON public.questions(set_id);


-- ════════════════════════════════════════════════════════════
-- 롤백 — 문제가 생기면 아래를 통째로 실행하면 원래대로 돌아갑니다.
-- ════════════════════════════════════════════════════════════
-- ALTER TABLE public.question_sets DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.questions     DISABLE ROW LEVEL SECURITY;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.question_sets TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.questions     TO anon, authenticated;
