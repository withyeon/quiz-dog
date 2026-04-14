-- Add quiz runtime support objects used by client gameplay
-- 1) players.answer_history column
-- 2) public.check_question_answer(UUID, TEXT) RPC

ALTER TABLE players
ADD COLUMN IF NOT EXISTS answer_history JSONB DEFAULT '[]'::jsonb;

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

  v_is_correct := BTRIM(p_submitted_answer::TEXT) = BTRIM(v_correct_answer::TEXT);

  RETURN v_is_correct;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_question_answer(UUID, TEXT) TO authenticated, anon;
