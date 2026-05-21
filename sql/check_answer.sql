-- 정답 비교용 정규화 함수
-- 예: "3.15 부정 선거", "315부정선거", "삼일오부정선거"를 같은 값으로 비교
CREATE OR REPLACE FUNCTION public.normalize_quiz_answer(
  p_answer TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_answer TEXT;
BEGIN
  v_answer := LOWER(COALESCE(p_answer, ''));

  v_answer := REPLACE(v_answer, '여덟', '8');
  v_answer := REPLACE(v_answer, '일곱', '7');
  v_answer := REPLACE(v_answer, '여섯', '6');
  v_answer := REPLACE(v_answer, '다섯', '5');
  v_answer := REPLACE(v_answer, '아홉', '9');
  v_answer := REPLACE(v_answer, '둘', '2');
  v_answer := REPLACE(v_answer, '셋', '3');
  v_answer := REPLACE(v_answer, '넷', '4');
  v_answer := REPLACE(v_answer, '영', '0');
  v_answer := REPLACE(v_answer, '공', '0');
  v_answer := REPLACE(v_answer, '일', '1');
  v_answer := REPLACE(v_answer, '한', '1');
  v_answer := REPLACE(v_answer, '이', '2');
  v_answer := REPLACE(v_answer, '삼', '3');
  v_answer := REPLACE(v_answer, '사', '4');
  v_answer := REPLACE(v_answer, '오', '5');
  v_answer := REPLACE(v_answer, '육', '6');
  v_answer := REPLACE(v_answer, '륙', '6');
  v_answer := REPLACE(v_answer, '칠', '7');
  v_answer := REPLACE(v_answer, '팔', '8');
  v_answer := REPLACE(v_answer, '구', '9');

  RETURN REGEXP_REPLACE(v_answer, '[^0-9a-z가-힣]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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

  -- 3. 입력된 정답과 진짜 정답을 정규화하여 비교
  v_is_correct := public.normalize_quiz_answer(p_submitted_answer) = public.normalize_quiz_answer(v_correct_answer);

  RETURN v_is_correct;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 접근 권한 부여 (모든 사용자(익명 포함)가 함수를 호출할 수 있도록 허용하되, 내부 로직은 보호됨)
GRANT EXECUTE ON FUNCTION public.normalize_quiz_answer(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_question_answer(UUID, TEXT) TO authenticated, anon;
