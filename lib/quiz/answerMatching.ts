// ⚠️ 이 파일은 서버 RPC(sql/20260922_lenient_numeric_answers.sql 의 normalize_quiz_answer /
// check_question_answer, sql/20261017_decimal_answers.sql 의 quiz_answer_numeric_core /
// quiz_single_answer_match, sql/20261012_multi_select_answers.sql 의
// quiz_multi_select_answer_match)와 규칙이 같아야 한다.
// 한쪽만 고치면 화면 표시(정답 하이라이트)와 실제 채점이 어긋난다.

// 치환 순서가 의미 있다. 두 글자짜리(여덟·다섯·하나…)를 먼저 바꿔야 '한'·'두' 같은
// 한 글자 치환이 그 안을 망가뜨리지 않는다. SQL 쪽도 같은 순서다.
const KOREAN_DIGIT_MAP: [string, string][] = [
  ['여덟', '8'],
  ['일곱', '7'],
  ['여섯', '6'],
  ['다섯', '5'],
  ['아홉', '9'],
  ['하나', '1'],
  ['둘', '2'],
  ['셋', '3'],
  ['넷', '4'],
  ['영', '0'],
  ['공', '0'],
  ['일', '1'],
  ['한', '1'],
  ['이', '2'],
  ['두', '2'],
  ['삼', '3'],
  ['세', '3'],
  ['사', '4'],
  ['네', '4'],
  ['오', '5'],
  ['육', '6'],
  ['륙', '6'],
  ['칠', '7'],
  ['팔', '8'],
  ['구', '9'],
]

/** 소문자화 + 공백·기호 제거만 한 형태 (한글 수사 → 숫자 치환은 하지 않음) */
function cleanQuizAnswer(value: string | number | null | undefined): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^0-9a-z\u1100-\u11ff\u3131-\u3163가-힣]/g, '')
}

/** cleanQuizAnswer 와 같되 숫자 사이의 소수점은 남긴다("4. 05" → "4.05", "No.5" → "no5"). 숫자 답 판정용 */
function cleanNumericAnswer(value: string | number | null | undefined): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^0-9a-z가-힣.]/g, '')
    .replace(/(?<![0-9])\.|\.(?![0-9])/g, '')
}

export function normalizeQuizAnswer(value: string | number | null | undefined): string {
  let normalized = String(value ?? '').normalize('NFKC').toLowerCase()

  for (const [korean, digit] of KOREAN_DIGIT_MAP) {
    normalized = normalized.replaceAll(korean, digit)
  }

  return normalized.replace(/[^0-9a-z\u1100-\u11ff\u3131-\u3163가-힣]/g, '')
}

// 숫자 뒤에 붙어도 무시하는 단위·조사·어미. "0개", "5명", "3cm", "0개입니다" 모두 숫자 0/5/3 으로 본다.
// 정답이 "0"인데 "0개"라고 써서 틀리는 일을 막기 위한 목록이므로, 흔한 것 위주로만 둔다.
const NUMERIC_UNIT_PATTERN =
  '개|명|마리|원|번|장|권|살|세|대|병|송이|자루|켤레|그루|척|채|줄|알|조각|칸|층|등|회|시간|분|초|일|주|개월|달|년|해|점|도|배|톨|봉지|봉|상자|통|컵|잔|그릇|판|쌍|벌|짝|가지|군데|곳|사람|바퀴|걸음|글자|문제|쪽|페이지|묶음|다발|포기|모|퍼센트|킬로그램|그램|밀리그램|톤|미터|센티미터|밀리미터|킬로미터|리터|밀리리터|제곱미터|제곱센티미터|세제곱미터|세제곱센티미터|월|학년|반|호|kg|g|mg|t|m|cm|mm|km|l|ml|m2|cm2|m3|cm3|cc'
const NUMERIC_ENDING_PATTERN = '입니다|이에요|예요|이다|요'
const NUMERIC_WITH_UNIT = new RegExp(`^([0-9]+(?:\\.[0-9]+)?)(?:${NUMERIC_UNIT_PATTERN})?(?:${NUMERIC_ENDING_PATTERN})?$`)

// 정답이 0일 때 "없음"류도 0으로 본다. (남은 송편은? → "없어요")
const ZERO_WORDS = new Set(['없음', '없다', '없어', '없어요', '없습니다', '하나도없다', '하나도없어요', '하나도없습니다'])

/**
 * 답이 "숫자(+단위)" 꼴이면 숫자 부분만 돌려준다. 아니면 null.
 * - "0개" → "0", "5 명" → "5", "3cm" → "3", "0개입니다" → "0"
 * - "4.05" → "4.05", "1.5 cm" → "1.5"  (숫자 사이의 소수점은 남긴다)
 * - "1일" → "1"  (한글 수사 치환 전에 먼저 보므로 '일'이 '1'로 바뀌어 "11"이 되지 않는다)
 * - "세개" → "3", "영 개" → "0"  (수사 치환 후 다시 시도)
 * - "이순신" → null, "3.1운동" → null  (숫자 뒤가 단위가 아니면 숫자 답으로 보지 않는다)
 */
export function getNumericAnswerCore(value: string | number | null | undefined): string | null {
  if (ZERO_WORDS.has(cleanQuizAnswer(value))) return '0'

  const direct = cleanNumericAnswer(value).match(NUMERIC_WITH_UNIT)
  if (direct) return direct[1]

  const converted = normalizeQuizAnswer(value).match(NUMERIC_WITH_UNIT)
  return converted ? converted[1] : null
}

function isBareNumber(value: string | number | null | undefined): boolean {
  return /^[0-9]+$/.test(normalizeQuizAnswer(value)) || ZERO_WORDS.has(cleanQuizAnswer(value))
}

/**
 * 정답 후보 하나와 제출 답을 비교한다.
 * 1) 둘 다 숫자 답인데 숫자 값이 다르면 오답. 정규화하면 소수점이 사라져 "4.05" ↔ "40.5" 가 같아지므로 먼저 본다.
 *    값은 숫자로 비교한다("4.50" ↔ "4.5" 는 같은 값).
 * 2) 정규화 후 완전히 같으면 정답.
 * 3) 둘 다 숫자 답이고 숫자가 같으며, 한쪽이라도 단위 없는 맨 숫자("없어요"류 포함)면 정답.
 *    ("0" ↔ "0개", "5명" ↔ "5" 는 인정, "5명" ↔ "5개" 처럼 단위가 서로 다르면 불인정)
 */
export function isSingleAnswerMatch(submittedAnswer: string, candidate: string): boolean {
  const submitted = normalizeQuizAnswer(submittedAnswer)
  if (submitted === '') return false
  const normalizedCandidate = normalizeQuizAnswer(candidate)
  if (normalizedCandidate === '') return false

  const submittedCore = getNumericAnswerCore(submittedAnswer)
  const candidateCore = getNumericAnswerCore(candidate)
  if (submittedCore !== null && candidateCore !== null && Number(submittedCore) !== Number(candidateCore)) return false

  if (normalizedCandidate === submitted) return true
  if (submittedCore === null || candidateCore === null) return false

  return isBareNumber(submittedAnswer) || isBareNumber(candidate)
}

/**
 * 하나의 정답 필드에 여러 정답을 담을 수 있다.
 * 줄바꿈(\n) 또는 파이프(|)로 구분한다. (예: "답1|답2", 또는 줄바꿈으로 여러 줄)
 * 기존 단일 정답은 구분자가 없으므로 1개짜리 배열로 그대로 동작한다.
 */
export function splitAcceptableAnswers(correctAnswer: string | null | undefined): string[] {
  return String(correctAnswer ?? '')
    .split(/[\n|]/)
    .map((answer) => answer.trim())
    .filter(Boolean)
}

export function isQuizAnswerMatch(submittedAnswer: string, correctAnswer: string): boolean {
  if (normalizeQuizAnswer(submittedAnswer) === '') return false

  return splitAcceptableAnswers(correctAnswer).some(
    (candidate) => isSingleAnswerMatch(submittedAnswer, candidate),
  )
}

// ─── 구성치기(다중 선택) 채점 ───
// 어떤 문제가 다중 선택인지는 lib/quiz/multiSelect.ts 의 isMultiSelectQuestion 이 정한다.
// 여기에는 "다중 선택이라면 어떻게 채점하는가"만 둔다(서버 quiz_multi_select_answer_match 와 같은 규칙).

/**
 * 다중 선택 정답("마황, 계지, 행인, 감초")·제출 답을 항목으로 나눈다. 구분자는 쉼표뿐이다.
 * | 와 줄바꿈은 일반 문제의 "복수 정답 후보" 구분자라 여기서는 나누지 않는다.
 */
export function splitMultiSelectAnswer(answer: string | null | undefined): string[] {
  return String(answer ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

/** 항목마다 normalizeQuizAnswer 를 거친 집합. 정규화 후 빈 항목(한자만 있는 항목 등)은 버린다. */
export function toMultiSelectAnswerSet(answer: string | null | undefined): Set<string> {
  return new Set(splitMultiSelectAnswer(answer).map(normalizeQuizAnswer).filter(Boolean))
}

/**
 * 순서 무관 집합 비교. 고른 집합 = 정답 집합이면 정답, 하나라도 빠지거나 더 고르면 오답(부분 점수 없음).
 */
export function isMultiSelectAnswerMatch(submittedAnswer: string, correctAnswer: string): boolean {
  const correct = toMultiSelectAnswerSet(correctAnswer)
  if (correct.size === 0) return false
  const submitted = toMultiSelectAnswerSet(submittedAnswer)
  if (submitted.size !== correct.size) return false
  for (const item of correct) {
    if (!submitted.has(item)) return false
  }
  return true
}
