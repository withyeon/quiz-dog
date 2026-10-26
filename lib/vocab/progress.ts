import type { AnswerSide, LearnLevel } from '@/lib/vocab/study'

/**
 * 단어장 공부 기록. 학생은 로그인하지 않으므로 이 기기 브라우저(localStorage)에만 남긴다.
 * 사생활 보호 창 등에서 저장소가 막혀도 공부는 그대로 되고, 기록만 안 남는다.
 */
export type VocabProgress = {
  /** 별표한 카드 id */
  stars: string[]
  /** 카드 뒤집기에서 "알아요"로 넘긴 카드 id */
  known: string[]
  /** 익히기 단계 */
  learn: Record<string, LearnLevel>
  prefs: {
    /** 카드 뒤집기 앞면 */
    front: 'term' | 'definition'
    answerWith: AnswerSide
    starredOnly: boolean
    shuffle: boolean
  }
}

export const DEFAULT_VOCAB_PROGRESS: VocabProgress = {
  stars: [],
  known: [],
  learn: {},
  prefs: { front: 'term', answerWith: 'definition', starredOnly: false, shuffle: false },
}

const keyOf = (setId: string) => `quizdog:vocab:${setId}`

export function loadVocabProgress(setId: string): VocabProgress {
  try {
    const raw = window.localStorage.getItem(keyOf(setId))
    if (!raw) return DEFAULT_VOCAB_PROGRESS
    const parsed = JSON.parse(raw) as Partial<VocabProgress>
    return {
      stars: Array.isArray(parsed.stars) ? parsed.stars.map(String) : [],
      known: Array.isArray(parsed.known) ? parsed.known.map(String) : [],
      learn: parsed.learn && typeof parsed.learn === 'object' ? parsed.learn : {},
      prefs: { ...DEFAULT_VOCAB_PROGRESS.prefs, ...(parsed.prefs ?? {}) },
    }
  } catch {
    return DEFAULT_VOCAB_PROGRESS
  }
}

export function saveVocabProgress(setId: string, progress: VocabProgress): void {
  try {
    window.localStorage.setItem(keyOf(setId), JSON.stringify(progress))
  } catch {
    // 저장소가 막힌 브라우저 — 기록 없이 계속 공부한다
  }
}
