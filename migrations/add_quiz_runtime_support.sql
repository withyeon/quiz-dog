-- Add quiz runtime support objects used by client gameplay
-- 1) players.answer_history column
-- 2) public.check_question_answer(UUID, TEXT) RPC

ALTER TABLE players
ADD COLUMN IF NOT EXISTS answer_history JSONB DEFAULT '[]'::jsonb;

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

CREATE OR REPLACE FUNCTION public.check_question_answer(
  p_question_id UUID,
  p_submitted_answer TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_correct_answer TEXT;
  v_is_correct BOOLEAN;
BEGIN
  SELECT answer INTO v_correct_answer
  FROM public.questions
  WHERE id = p_question_id;

  IF v_correct_answer IS NULL THEN
    RETURN FALSE;
  END IF;

  v_is_correct := public.normalize_quiz_answer(p_submitted_answer) = public.normalize_quiz_answer(v_correct_answer);

  RETURN v_is_correct;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.normalize_quiz_answer(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_question_answer(UUID, TEXT) TO authenticated, anon;
