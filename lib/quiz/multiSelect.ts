/**
 * 숨겨진 "구성치기" 모드 — 다중 선택 + 오답 때 해설 보여주기.
 *
 * 한의대 방제학 처방 구성(약재 목록)을 외우는 용도다. 아래 셋을 모두 만족하는 문제만 다중 선택으로 동작하고,
 * 하나라도 아니면 지금과 100% 똑같이 동작한다(다른 문제집·다른 유형에는 영향이 없다).
 *   1) 문제집 제목에 '구성치기'가 들어 있다
 *   2) 문제 type 이 CHOICE 다
 *   3) answer 에 쉼표(,)가 들어 있다            예) answer = '마황, 계지, 행인, 감초'
 *
 * 판정은 isMultiSelectQuestion 한 곳에서만 한다. 서버(sql/20261012_multi_select_answers.sql 의
 * quiz_is_multi_select)도 같은 규칙이라, 한쪽만 고치면 화면과 채점이 어긋난다.
 *
 * 어디서 어떻게 쓰는가
 * - 선생님 화면(검수·세트 편집·품질 검사): 정답을 들고 있으므로 isMultiSelectQuestion(question, 제목)을 직접 부른다.
 * - 학생 화면: 정답을 받지 않으므로(listQuestionsForGame 이 answer 를 '' 로 가린다) "answer 에 쉼표"를 스스로
 *   알 수 없다. 그래서 서버가 같은 규칙으로 판정한 문제에 listQuestionsForGame 이 multiSelect: true 를 붙여 주고,
 *   화면은 isMultiSelectGameQuestion 으로 그 표시만 읽는다. 서버 판정에 제목 조건이 이미 들어 있어
 *   QuizView 를 쓰는 게임 페이지마다 제목을 내려보낼 필요가 없다.
 * - 채점 규칙(순서 무관 집합 비교)은 lib/quiz/answerMatching.ts 의 isMultiSelectAnswerMatch.
 * - 오답 해설: 구성치기 문제집(isGusungchigiSet)이면 QuizView 가 "정답: …" 아래에 question.explanation 을 보여준다.
 *   QuizView 는 게임 훅이 올린 문제집 제목을 hooks/useQuestionSetTitle.ts 로 읽는다.
 */

import {
  normalizeQuizAnswer,
  splitMultiSelectAnswer,
  toMultiSelectAnswerSet,
} from '@/lib/quiz/answerMatching'

export const MULTI_SELECT_SET_KEYWORD = '구성치기'
/** 다중 선택 정답 구분자. | 와 줄바꿈은 일반 문제의 "복수 정답 후보" 구분자라 쓰지 않는다. */
export const MULTI_SELECT_ANSWER_SEPARATOR = ','
/** 보기(약재 후보) 개수 범위. 20개가 휴대폰 세로 화면에서 스크롤 없이 보이는 한계다. */
export const MULTI_SELECT_MIN_OPTIONS = 4
export const MULTI_SELECT_MAX_OPTIONS = 20
/** 정답 약재는 2개 이상(1개면 쉼표가 없어 일반 객관식이다) */
export const MULTI_SELECT_MIN_ANSWERS = 2
/** 다중 선택 문제는 여러 개를 골라야 해서 기본 제한 시간에 이 배수를 곱해 준다 */
export const MULTI_SELECT_TIME_MULTIPLIER = 2

/**
 * 구성치기 문제집인지(제목에 '구성치기'가 있는지). 구성치기 전용 동작은 전부 이 함수 하나로 가른다.
 * - 다중 선택 판정(isMultiSelectQuestion)의 첫 조건
 * - 오답 때 해설 보여주기(QuizView). 다중 선택뿐 아니라 그 문제집의 빈칸·주관식 등 모든 유형에 적용된다
 * macOS 파일 이름(NFD)에서 온 제목도 잡도록 NFC 로 맞춘 뒤 본다(서버 quiz_is_multi_select 도 같다).
 */
export function isGusungchigiSet(setTitle: string | null | undefined): boolean {
  return String(setTitle ?? '').normalize('NFC').includes(MULTI_SELECT_SET_KEYWORD)
}

/**
 * 오답 화면을 띄워 두는 시간(ms). 구성치기 문제집이면 해설(말야마)을 읽을 시간을 주려고 5초로 늘린다.
 * 그 외 문제집은 모드마다 원래 시간(defaultMs) 그대로다.
 */
export const GUSUNGCHIGI_WRONG_SCREEN_MS = 5000

export function getWrongScreenMs(setTitle: string | null | undefined, defaultMs: number): number {
  return isGusungchigiSet(setTitle) ? GUSUNGCHIGI_WRONG_SCREEN_MS : defaultMs
}

/** 다중 선택 판정(유일한 기준). 정답을 아는 곳(선생님 화면)에서 쓴다. */
export function isMultiSelectQuestion(
  question: { type?: string | null; answer?: string | null },
  setTitle: string | null | undefined,
): boolean {
  return isGusungchigiSet(setTitle)
    && question.type === 'CHOICE'
    && String(question.answer ?? '').includes(MULTI_SELECT_ANSWER_SEPARATOR)
}

/**
 * 학생 화면용. 서버가 isMultiSelectQuestion 과 같은 규칙으로 판정해 붙인 표시(multiSelect)를 읽는다.
 * (lib/services/questions.ts 의 listQuestionsForGame 이 붙인다)
 */
export function isMultiSelectGameQuestion(question: { multiSelect?: boolean } | null | undefined): boolean {
  return question?.multiSelect === true
}

/** 정답 항목을 쉼표로 이어 answer 에 저장할 문자열로 만든다. */
export function joinMultiSelectAnswer(items: string[]): string {
  return items.map((item) => item.trim()).filter(Boolean).join(`${MULTI_SELECT_ANSWER_SEPARATOR} `)
}

export { splitMultiSelectAnswer }

/**
 * 제출 후 보기마다 어떻게 보여줄지.
 * - correct: 맞게 고름 / wrong: 잘못 고름 / missed: 빠뜨린 정답 / idle: 안 골랐고 정답도 아님
 * 보기와 정답 항목은 채점과 같은 normalizeQuizAnswer 로 맞춘다.
 */
export type MultiSelectOptionResult = 'correct' | 'wrong' | 'missed' | 'idle'

export function getMultiSelectOptionResults(
  options: string[],
  selectedIndexes: ReadonlySet<number>,
  correctAnswer: string,
): MultiSelectOptionResult[] {
  const correct = toMultiSelectAnswerSet(correctAnswer)
  return options.map((option, index) => {
    const isAnswer = correct.has(normalizeQuizAnswer(option))
    const isSelected = selectedIndexes.has(index)
    if (isSelected) return isAnswer ? 'correct' : 'wrong'
    return isAnswer ? 'missed' : 'idle'
  })
}
