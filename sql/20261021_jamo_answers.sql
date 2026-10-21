-- 한방병리 기출퀴즈처럼 보기가 "ㄱ, ㄷ" 같은 자모뿐인 문제에서 정답을 골라도 오답이 되던 문제.
-- 원인: normalize_quiz_answer 가 0-9·a-z·가-힣 밖의 글자를 모두 지워서 "ㄱ, ㄷ" 이 빈 문자열이 됐고,
--       빈 문자열은 늘 오답이다(check_question_answer 의 조기 반환).
-- 변경: 한글 자모(ㄱ-ㅣ)도 지우지 않는다. 그 밖의 규칙(수사 → 숫자 치환 등)은 20260922 버전과 같다.
--       자모가 섞인 주관식 답("ㅋㅋ", "가ㄱ")은 이제 자모까지 비교한다. 그 외 답의 채점은 그대로다.
--
-- ⚠️ lib/quiz/answerMatching.ts 의 normalizeQuizAnswer·cleanQuizAnswer 와 규칙이 같아야 한다.
-- 20260922_lenient_numeric_answers.sql 을 먼저 실행해 둔 상태에서 실행한다. 여러 번 실행해도 안전하다.

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

  RETURN REGEXP_REPLACE(v_answer, '[^0-9a-zㄱ-ㅣ가-힣]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION public.normalize_quiz_answer(TEXT) TO authenticated, anon;
