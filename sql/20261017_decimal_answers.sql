-- 소수 정답 채점 바로잡기.
--
-- 문제: normalize_quiz_answer 가 0-9·a-z·가-힣 밖의 글자를 모두 지워 소수점도 사라졌다.
--       그래서 정답이 "4.05"인 문제에서 "40.5"·"405"도 정답이 됐다(소수의 나눗셈 객관식 등).
--       주관식도 정답 "2.25"에 "225"를 써도 맞았다.
-- 변경: 숫자 답 판정(quiz_answer_numeric_core)이 숫자 사이의 소수점을 지키고 "4.05", "1.5cm" 도 숫자 답으로 본다.
--       quiz_single_answer_match 는 두 답이 모두 숫자 답이면 숫자 값부터 비교해, 값이 다르면
--       정규화 글자가 같아도("4.05" ↔ "40.5" → 둘 다 "405") 오답으로 본다. 값 비교는 숫자로 하므로 "4.50" ↔ "4.5" 는 정답.
--       덤으로 "1일" ↔ "11"(정규화하면 둘 다 "11")처럼 값이 다른 숫자 답이 맞던 것도 바로잡힌다.
--
-- normalize_quiz_answer 자체는 그대로 둔다(소수점은 여전히 지운다). 숫자 답이 아닌 정답, 예를 들어
-- "3·1 운동" ↔ "3.1운동" 은 예전처럼 같은 답으로 본다. 구성치기(다중 선택) 채점도 바뀌지 않는다.
--
-- ⚠️ lib/quiz/answerMatching.ts 의 getNumericAnswerCore / isSingleAnswerMatch 와 규칙이 같아야 한다.
-- 20260922_lenient_numeric_answers.sql(필요하면 20261012_multi_select_answers.sql)을 먼저 실행해 둔 상태에서 실행한다.
-- check_question_answer 는 건드리지 않는다(이 함수들을 부르기만 한다). 여러 번 실행해도 안전하다.

-- 답이 "숫자(+단위/어미)" 꼴이면 숫자 부분만, 아니면 NULL.
--   "0개" → "0", "5 명" → "5", "3cm" → "3", "0개입니다" → "0"
--   "4.05" → "4.05", "1.5 cm" → "1.5", "40.5" → "40.5"   (숫자 사이의 소수점은 남긴다)
--   "1일" → "1"   (수사 치환 전에 먼저 보므로 '일'→'1' 로 "11"이 되지 않는다)
--   "세개" → "3", "영 개" → "0"   (수사 치환 후 다시 시도)
--   "없어요" → "0"
--   "이순신" → NULL, "3.1운동" → NULL  (숫자 뒤가 단위가 아니면 숫자 답으로 보지 않는다)
CREATE OR REPLACE FUNCTION public.quiz_answer_numeric_core(
  p_answer TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_cleaned TEXT;
  v_pattern CONSTANT TEXT :=
    '^([0-9]+(?:\.[0-9]+)?)'
    || '(?:개|명|마리|원|번|장|권|살|세|대|병|송이|자루|켤레|그루|척|채|줄|알|조각|칸|층|등|회|시간|분|초|일|주|개월|달|년|해|점|도|배|톨|봉지|봉|상자|통|컵|잔|그릇|판|쌍|벌|짝|가지|군데|곳|사람|바퀴|걸음|글자|문제|쪽|페이지|묶음|다발|포기|모|퍼센트|킬로그램|그램|밀리그램|톤|미터|센티미터|밀리미터|킬로미터|리터|밀리리터|제곱미터|제곱센티미터|세제곱미터|세제곱센티미터|월|학년|반|호|kg|g|mg|t|m|cm|mm|km|l|ml|m2|cm2|m3|cm3|cc)?'
    || '(?:입니다|이에요|예요|이다|요)?$';
  v_match TEXT[];
BEGIN
  -- 소수점은 숫자 사이에 있을 때만 남긴다("4. 05" → "4.05", "No.5" → "no5", "5." → "5")
  v_cleaned := REGEXP_REPLACE(LOWER(COALESCE(p_answer, '')), '[^0-9a-z가-힣.]', '', 'g');
  v_cleaned := REGEXP_REPLACE(v_cleaned, '(?<![0-9])\.|\.(?![0-9])', '', 'g');

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
--   1) 둘 다 숫자 답인데 숫자 값이 다르면 오답 ("4.05" ↔ "40.5", "1일" ↔ "11")
--   2) 정규화 후 완전히 같으면 정답
--   3) 둘 다 숫자 답이고 값이 같으며, 한쪽이라도 단위 없는 맨 숫자("없어요"류 포함)면 정답
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

  v_submitted_core := public.quiz_answer_numeric_core(p_submitted);
  v_candidate_core := public.quiz_answer_numeric_core(p_candidate);
  IF v_submitted_core IS NOT NULL AND v_candidate_core IS NOT NULL
     AND v_submitted_core::NUMERIC <> v_candidate_core::NUMERIC THEN
    RETURN FALSE;
  END IF;

  IF v_candidate_norm = v_submitted_norm THEN
    RETURN TRUE;
  END IF;

  IF v_submitted_core IS NULL OR v_candidate_core IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN v_submitted_norm ~ '^[0-9]+$' OR public.quiz_answer_is_zero_word(p_submitted)
      OR v_candidate_norm ~ '^[0-9]+$' OR public.quiz_answer_is_zero_word(p_candidate);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION public.quiz_answer_numeric_core(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.quiz_single_answer_match(TEXT, TEXT) TO authenticated, anon;

-- 확인용 (실행 후 SQL Editor 에서 아래 SELECT 만 따로 돌려 보면 된다. 모두 true 여야 한다)
--   SELECT public.quiz_single_answer_match('40.5', '4.05') = FALSE;
--   SELECT public.quiz_single_answer_match('405', '4.05') = FALSE;
--   SELECT public.quiz_single_answer_match('4.05', '4.05') = TRUE;
--   SELECT public.quiz_single_answer_match('4.50', '4.5') = TRUE;
--   SELECT public.quiz_single_answer_match('1.5cm', '1.5') = TRUE;
--   SELECT public.quiz_single_answer_match('0개', '0') = TRUE;
--   SELECT public.quiz_single_answer_match('3.1운동', '3·1 운동') = TRUE;
--   SELECT public.quiz_single_answer_match('11', '1일') = FALSE;
