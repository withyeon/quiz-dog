-- 주관식 숫자 정답 채점을 관대하게.
--
-- 문제: 정답이 "0"인데 학생이 "0개"·"0 개"라고 쓰면 오답 처리됐다.
-- 변경:
--   1) 정답 또는 제출 답이 "숫자(+단위/어미)" 꼴이면 숫자만 비교한다.
--      "0" ↔ "0개" / "0 개" / "0개입니다" / "영 개" / "없어요"  → 정답
--      "5명"(교사) ↔ "5"(학생) → 정답,  "5명" ↔ "5개" 처럼 단위가 서로 다르면 오답
--   2) 우리말 수사 하나·두·세·네 도 숫자로 인식 ("세 개" → 3)
--
-- ⚠️ lib/quiz/answerMatching.ts 의 규칙과 같아야 한다. 한쪽만 고치지 말 것.
-- 기존 check_question_answer(UUID, TEXT) 시그니처·반환형은 그대로라 구버전 앱과 공존한다.

CREATE OR REPLACE FUNCTION public.normalize_quiz_answer(
  p_answer TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_answer TEXT;
BEGIN
  v_answer := LOWER(COALESCE(p_answer, ''));

  -- 두 글자 수사를 먼저 바꿔야 '한'·'두' 같은 한 글자 치환이 그 안을 망가뜨리지 않는다.
  v_answer := REPLACE(v_answer, '여덟', '8');
  v_answer := REPLACE(v_answer, '일곱', '7');
  v_answer := REPLACE(v_answer, '여섯', '6');
  v_answer := REPLACE(v_answer, '다섯', '5');
  v_answer := REPLACE(v_answer, '아홉', '9');
  v_answer := REPLACE(v_answer, '하나', '1');
  v_answer := REPLACE(v_answer, '둘', '2');
  v_answer := REPLACE(v_answer, '셋', '3');
  v_answer := REPLACE(v_answer, '넷', '4');
  v_answer := REPLACE(v_answer, '영', '0');
  v_answer := REPLACE(v_answer, '공', '0');
  v_answer := REPLACE(v_answer, '일', '1');
  v_answer := REPLACE(v_answer, '한', '1');
  v_answer := REPLACE(v_answer, '이', '2');
  v_answer := REPLACE(v_answer, '두', '2');
  v_answer := REPLACE(v_answer, '삼', '3');
  v_answer := REPLACE(v_answer, '세', '3');
  v_answer := REPLACE(v_answer, '사', '4');
  v_answer := REPLACE(v_answer, '네', '4');
  v_answer := REPLACE(v_answer, '오', '5');
  v_answer := REPLACE(v_answer, '육', '6');
  v_answer := REPLACE(v_answer, '륙', '6');
  v_answer := REPLACE(v_answer, '칠', '7');
  v_answer := REPLACE(v_answer, '팔', '8');
  v_answer := REPLACE(v_answer, '구', '9');

  RETURN REGEXP_REPLACE(v_answer, '[^0-9a-z가-힣]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 정답이 0일 때 "없음"류도 0으로 본다. (남은 송편은? → "없어요")
CREATE OR REPLACE FUNCTION public.quiz_answer_is_zero_word(
  p_answer TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN REGEXP_REPLACE(LOWER(COALESCE(p_answer, '')), '[^0-9a-z가-힣]', '', 'g')
    IN ('없음', '없다', '없어', '없어요', '없습니다', '하나도없다', '하나도없어요', '하나도없습니다');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 답이 "숫자(+단위/어미)" 꼴이면 숫자 부분만, 아니면 NULL.
--   "0개" → "0", "5 명" → "5", "3cm" → "3", "0개입니다" → "0"
--   "1일" → "1"   (수사 치환 전에 먼저 보므로 '일'→'1' 로 "11"이 되지 않는다)
--   "세개" → "3", "영 개" → "0"   (수사 치환 후 다시 시도)
--   "없어요" → "0"
--   "이순신" → NULL  (숫자 뒤가 단위가 아니면 숫자 답으로 보지 않는다)
CREATE OR REPLACE FUNCTION public.quiz_answer_numeric_core(
  p_answer TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_cleaned TEXT;
  v_pattern CONSTANT TEXT :=
    '^([0-9]+)'
    || '(?:개|명|마리|원|번|장|권|살|세|대|병|송이|자루|켤레|그루|척|채|줄|알|조각|칸|층|등|회|시간|분|초|일|주|개월|달|년|해|점|도|배|톨|봉지|봉|상자|통|컵|잔|그릇|판|쌍|벌|짝|가지|군데|곳|사람|바퀴|걸음|글자|문제|쪽|페이지|묶음|다발|포기|모|퍼센트|킬로그램|그램|밀리그램|톤|미터|센티미터|밀리미터|킬로미터|리터|밀리리터|제곱미터|제곱센티미터|세제곱미터|세제곱센티미터|월|학년|반|호|kg|g|mg|t|m|cm|mm|km|l|ml|m2|cm2|m3|cm3|cc)?'
    || '(?:입니다|이에요|예요|이다|요)?$';
  v_match TEXT[];
BEGIN
  v_cleaned := REGEXP_REPLACE(LOWER(COALESCE(p_answer, '')), '[^0-9a-z가-힣]', '', 'g');

  IF public.quiz_answer_is_zero_word(p_answer) THEN
    RETURN '0';
  END IF;

  v_match := REGEXP_MATCH(v_cleaned, v_pattern);
  IF v_match IS NOT NULL THEN
    RETURN v_match[1];
  END IF;

  v_match := REGEXP_MATCH(public.normalize_quiz_answer(p_answer), v_pattern);
  IF v_match IS NOT NULL THEN
    RETURN v_match[1];
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 정답 후보 하나와 제출 답 비교.
--   1) 정규화 후 완전히 같으면 정답
--   2) 둘 다 숫자 답이고 숫자가 같으며, 한쪽이라도 단위 없는 맨 숫자("없어요"류 포함)면 정답
CREATE OR REPLACE FUNCTION public.quiz_single_answer_match(
  p_submitted TEXT,
  p_candidate TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_submitted_norm TEXT;
  v_candidate_norm TEXT;
  v_submitted_core TEXT;
  v_candidate_core TEXT;
BEGIN
  v_submitted_norm := public.normalize_quiz_answer(p_submitted);
  IF v_submitted_norm = '' THEN
    RETURN FALSE;
  END IF;

  v_candidate_norm := public.normalize_quiz_answer(p_candidate);
  IF v_candidate_norm = '' THEN
    RETURN FALSE;
  END IF;
  IF v_candidate_norm = v_submitted_norm THEN
    RETURN TRUE;
  END IF;

  v_submitted_core := public.quiz_answer_numeric_core(p_submitted);
  v_candidate_core := public.quiz_answer_numeric_core(p_candidate);
  IF v_submitted_core IS NULL OR v_candidate_core IS NULL THEN
    RETURN FALSE;
  END IF;
  IF v_submitted_core <> v_candidate_core THEN
    RETURN FALSE;
  END IF;

  RETURN v_submitted_norm ~ '^[0-9]+$' OR public.quiz_answer_is_zero_word(p_submitted)
      OR v_candidate_norm ~ '^[0-9]+$' OR public.quiz_answer_is_zero_word(p_candidate);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.check_question_answer(
  p_question_id UUID,
  p_submitted_answer TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_correct_answer TEXT;
  v_candidate TEXT;
BEGIN
  SELECT answer INTO v_correct_answer
  FROM public.questions
  WHERE id = p_question_id;

  IF v_correct_answer IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.normalize_quiz_answer(p_submitted_answer) = '' THEN
    RETURN FALSE;
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

GRANT EXECUTE ON FUNCTION public.normalize_quiz_answer(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.quiz_answer_is_zero_word(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.quiz_answer_numeric_core(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.quiz_single_answer_match(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_question_answer(UUID, TEXT) TO authenticated, anon;
