-- 1) 주관식 복수 정답 인정: answer 필드를 줄바꿈(\n) 또는 파이프(|)로 구분된
--    여러 정답 후보로 보고, 그 중 하나라도 일치하면 정답 처리한다.
--    (구분자가 없는 기존 단일 정답은 그대로 동작 — 하위호환)
-- 2) 오답 시 정답을 보여주기 위한 get_question_answer RPC 추가.

CREATE OR REPLACE FUNCTION public.check_question_answer(
  p_question_id UUID,
  p_submitted_answer TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_correct_answer TEXT;
  v_submitted_norm TEXT;
  v_candidate TEXT;
BEGIN
  SELECT answer INTO v_correct_answer
  FROM public.questions
  WHERE id = p_question_id;

  IF v_correct_answer IS NULL THEN
    RETURN FALSE;
  END IF;

  v_submitted_norm := public.normalize_quiz_answer(p_submitted_answer);
  IF v_submitted_norm = '' THEN
    RETURN FALSE;
  END IF;

  -- 줄바꿈 또는 | 로 구분된 각 정답 후보와 비교
  FOR v_candidate IN
    SELECT regexp_split_to_table(v_correct_answer, '[\n|]')
  LOOP
    IF public.normalize_quiz_answer(v_candidate) <> ''
       AND public.normalize_quiz_answer(v_candidate) = v_submitted_norm THEN
      RETURN TRUE;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 오답 시 정답을 보여주기 위해 정답 텍스트를 반환한다.
-- (학습용 퀴즈이므로 제출 이후 정답 공개를 허용)
CREATE OR REPLACE FUNCTION public.get_question_answer(
  p_question_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_correct_answer TEXT;
BEGIN
  SELECT answer INTO v_correct_answer
  FROM public.questions
  WHERE id = p_question_id;

  RETURN v_correct_answer;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_question_answer(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_question_answer(UUID) TO authenticated, anon;
