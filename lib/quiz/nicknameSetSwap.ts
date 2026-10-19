/**
 * 숨겨진 "닉네임별 문제집" — 한 방에서 닉네임에 따라 서로 다른 문제집을 푼다.
 *
 * 방 문제집이 아래 NICKNAME_SET_PAIRS 중 하나일 때만 동작하고, 그 외 방은 지금과 100% 똑같다
 * (room.set_id 를 그대로 쓴다). 같은 번호끼리 짝이다.
 *   닉네임에 '구성' → 구성치기(취약) n
 *   닉네임에 '탕'   → 탕치기(취약) n
 *   둘 다 있으면 '구성'이 먼저, 둘 다 없으면 방 문제집 그대로.
 * 닉네임 장난(hooks/usePlayFlags.ts 의 '한의대우등생'·'한의대최강')과는 따로 판정하므로 함께 켜진다.
 *   예) '한의대최강탕' → 탕치기 + 한글 없애기 + 객관식→단답식
 *
 * 판정은 resolvePlayerSetId 한 곳에서만 한다. 쓰는 곳:
 * - hooks/useGameBase.ts·hooks/useConvenienceStoreGame.ts: 문제·문제집 제목을 이 id 로 읽는다.
 * - app/study/page.tsx: 공부 모드 정답표(useGameBase 가 돌려준 playSetId).
 * - 학생 결과 화면(StudentGameResultPageClient): answer_history 의 문제 번호를 같은 문제집에 맞춘다.
 * 채점(check_question_answer)은 문제 id 로만 하므로 서버는 바꿀 것이 없다.
 *
 * 켜고 끄기: NICKNAME_SET_SWAP_ENABLED 만 바꾸면 된다.
 */

export const NICKNAME_SET_SWAP_ENABLED = true

const NICKNAME_SET_PAIRS: ReadonlyArray<{ 구성: string; 탕: string }> = [
  { 구성: 'set-1792411205592-h3o9e8d', 탕: 'set-1792409868251-2f18s4w' }, // 구성치기(취약) 1 ↔ 탕치기(취약) 1
  { 구성: 'set-1792411206025-epngkse', 탕: 'set-1792412352117-n88e6a8' }, // 구성치기(취약) 2 ↔ 탕치기(취약) 2
]

function findPair(setId: string | null | undefined) {
  if (!NICKNAME_SET_SWAP_ENABLED || !setId) return null
  return NICKNAME_SET_PAIRS.find((pair) => pair.구성 === setId || pair.탕 === setId) ?? null
}

/** 닉네임에 따라 문제집이 바뀌는 방인지. 이런 방은 닉네임을 알기 전에 문제를 읽지 않는다. */
export function isNicknameSetSwapRoom(roomSetId: string | null | undefined): boolean {
  return findPair(roomSetId) !== null
}

/** 이 플레이어가 풀 문제집 id. 대상 방이 아니면 roomSetId 그대로. 공백은 무시한다. */
export function resolvePlayerSetId<T extends string | null | undefined>(
  roomSetId: T,
  nickname: string | null | undefined,
): T | string {
  const pair = findPair(roomSetId)
  if (!pair || !nickname) return roomSetId
  const compact = nickname.normalize('NFC').replace(/\s+/g, '')
  if (compact.includes('구성')) return pair.구성
  if (compact.includes('탕')) return pair.탕
  return roomSetId
}
