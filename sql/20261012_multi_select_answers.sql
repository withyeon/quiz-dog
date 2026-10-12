-- 숨겨진 "구성치기(다중 선택)" 채점.
--
-- 한의대 방제학 처방 구성(약재 목록)을 외우는 용도다. 아래 셋을 모두 만족하는 문제만 다중 선택으로 채점한다.
--   1) 문제집 제목(question_sets.title)에 '구성치기'가 들어 있다
--   2) 문제 type 이 'CHOICE' 다
--   3) answer 에 쉼표(,)가 들어 있다            예) answer = '마황, 계지, 행인, 감초'
-- 하나라도 아니면 기존 채점(20260922_lenient_numeric_answers.sql) 그대로다. 다른 문제집에는 영향이 없다.
--
-- 채점: 순서 무관 집합 비교. 학생은 고른 약재를 쉼표로 이어 한 문자열로 낸다('계지, 마황, 감초, 행인').
--       각 항목을 normalize_quiz_answer 로 정규화한 뒤, 고른 집합 = 정답 집합이면 정답(부분 점수 없음).
--       answer 의 | 와 줄바꿈은 "복수 정답 후보" 구분자라 다중 선택에서는 쓰지 않는다. 구분자는 쉼표뿐이다.
--
-- ⚠️ lib/quiz/multiSelect.ts(isMultiSelectQuestion)·lib/quiz/answerMatching.ts(isMultiSelectAnswerMatch) 와
--    규칙이 같아야 한다. 한쪽만 고치면 정답 하이라이트와 실제 채점이 어긋난다.
-- 기존 check_question_answer(UUID, TEXT) 시그니처·반환형·GRANT 는 그대로라 구버전 앱과 공존한다.
-- 20260922_lenient_numeric_answers.sql 을 먼저 실행해 둔 상태에서 실행한다. 여러 번 실행해도 안전하다.

-- 판정 규칙. 제목은 NFC 로 맞춘 뒤 본다 — macOS 에서 올린 파일 이름(NFD)이 그대로 문제집 이름이 될 수 있어서.
CREATE OR REPLACE FUNCTION public.quiz_is_multi_select(
  p_set_title TEXT,
  p_type TEXT,
  p_answer TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN POSITION('구성치기' IN NORMALIZE(COALESCE(p_set_title, ''), NFC)) > 0
     AND COALESCE(p_type, '') = 'CHOICE'
     AND POSITION(',' IN COALESCE(p_answer, '')) > 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 쉼표로 이은 답을 정규화한 항목 집합(정렬·중복 제거한 배열)으로 바꿔 비교한다.
-- 정규화 후 빈 항목('麻黃'처럼 한자만 있는 항목 등)은 버린다. 그래서 검수 화면이 그런 보기를 막는다.
CREATE OR REPLACE FUNCTION public.quiz_multi_select_answer_match(
  p_submitted TEXT,
  p_correct TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_submitted TEXT[];
  v_correct TEXT[];
BEGIN
  SELECT COALESCE(ARRAY_AGG(DISTINCT t.item ORDER BY t.item), '{}')
    INTO v_correct
  FROM (
    SELECT public.normalize_quiz_answer(part) AS item
    FROM regexp_split_to_table(COALESCE(p_correct, ''), ',') AS part
  ) t
  WHERE t.item <> '';

  IF CARDINALITY(v_correct) = 0 THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(ARRAY_AGG(DISTINCT t.item ORDER BY t.item), '{}')
    INTO v_submitted
  FROM (
    SELECT public.normalize_quiz_answer(part) AS item
    FROM regexp_split_to_table(COALESCE(p_submitted, ''), ',') AS part
  ) t
  WHERE t.item <> '';

  RETURN v_submitted = v_correct;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 기존 함수에 다중 선택 분기만 끼워 넣었다. 문제집 제목을 함께 읽는 것 말고는, 다중 선택이 아닌 문제는
-- 20260922 버전과 똑같이 채점한다(같은 조기 반환, 같은 후보 루프).
CREATE OR REPLACE FUNCTION public.check_question_answer(
  p_question_id UUID,
  p_submitted_answer TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_correct_answer TEXT;
  v_type TEXT;
  v_set_title TEXT;
  v_candidate TEXT;
BEGIN
  SELECT q.answer, q.type::TEXT, s.title
    INTO v_correct_answer, v_type, v_set_title
  FROM public.questions q
  LEFT JOIN public.question_sets s ON s.id = q.set_id
  WHERE q.id = p_question_id;

  IF v_correct_answer IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.normalize_quiz_answer(p_submitted_answer) = '' THEN
    RETURN FALSE;
  END IF;

  -- 구성치기 다중 선택: 순서 무관 집합 비교
  IF public.quiz_is_multi_select(v_set_title, v_type, v_correct_answer) THEN
    RETURN public.quiz_multi_select_answer_match(p_submitted_answer, v_correct_answer);
  END IF;

  -- 줄바꿈 또는 | 로 구분된 각 정답 후보와 비교
  FOR v_candidate IN
    SELECT regexp_split_to_table(v_correct_answer, '[\n|]')
  LOOP
    IF public.quiz_single_answer_match(p_submitted_answer, v_candidate) THEN
      RETURN TRUE;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 학생 화면은 정답을 받지 않아(answer: '') "answer 에 쉼표가 있는지"를 스스로 알 수 없다.
-- 그래서 서버가 같은 규칙으로 판정한 문제 id 만 알려 준다(정답 내용은 알려 주지 않는다).
-- 구성치기 문제집이 아니면 빈 배열이다.
CREATE OR REPLACE FUNCTION public.list_multi_select_question_ids(
  p_set_id TEXT
)
RETURNS UUID[] AS $$
DECLARE
  v_ids UUID[];
BEGIN
  SELECT COALESCE(ARRAY_AGG(q.id), '{}')
    INTO v_ids
  FROM public.questions q
  JOIN public.question_sets s ON s.id = q.set_id
  WHERE q.set_id = p_set_id
    AND public.quiz_is_multi_select(s.title, q.type::TEXT, q.answer);

  RETURN v_ids;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.quiz_is_multi_select(TEXT, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.quiz_multi_select_answer_match(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_question_answer(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.list_multi_select_question_ids(TEXT) TO authenticated, anon;

-- 확인용 (실행 후 SQL Editor 에서 아래 SELECT 만 따로 돌려 보면 된다. 모두 true 여야 한다)
--   SELECT public.quiz_multi_select_answer_match('계지, 마황, 감초, 행인', '마황, 계지, 행인, 감초') = TRUE;
--   SELECT public.quiz_multi_select_answer_match('마황, 계지, 행인', '마황, 계지, 행인, 감초') = FALSE;
--   SELECT public.quiz_multi_select_answer_match('마황, 계지, 행인, 감초, 석고', '마황, 계지, 행인, 감초') = FALSE;
--   SELECT public.quiz_is_multi_select('테스트 구성치기', 'CHOICE', '마황, 계지') = TRUE;
--   SELECT public.quiz_is_multi_select('방제학 복습', 'CHOICE', '마황, 계지') = FALSE;
--   SELECT public.quiz_is_multi_select('테스트 구성치기', 'SHORT', '마황, 계지') = FALSE;
