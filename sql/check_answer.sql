-- 퀴즈 정답 확인 함수 (학생들이 정답을 훔쳐볼 수 없도록 서버에서만 동작)
CREATE OR REPLACE FUNCTION public.check_question_answer(
  p_question_id UUID,
  p_submitted_answer TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_correct_answer TEXT;
  v_is_correct BOOLEAN;
BEGIN
  -- 1. DB에서 진짜 정답을 조회 (학생 폰으로 전송하지 않음)
  SELECT answer INTO v_correct_answer
  FROM public.questions
  WHERE id = p_question_id;

  -- 2. 만약 문제를 못 찾았으면 항상 틀린 것으로 처리
  IF v_correct_answer IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 3. 입력된 정답과 진짜 정답의 양쪽 공백을 제거하고 문자로 비교
  v_is_correct := BTRIM(p_submitted_answer::TEXT) = BTRIM(v_correct_answer::TEXT);

  RETURN v_is_correct;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 접근 권한 부여 (모든 사용자(익명 포함)가 함수를 호출할 수 있도록 허용하되, 내부 로직은 보호됨)
GRANT EXECUTE ON FUNCTION public.check_question_answer(UUID, TEXT) TO authenticated, anon;
