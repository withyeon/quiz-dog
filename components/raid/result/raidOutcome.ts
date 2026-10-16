import { getRaidTeamStars, type RaidState } from '@/lib/game/raid'

export type RaidOutcome = {
  /** 펭귄 군단을 모두 쓰러뜨렸는지 */
  victory: boolean
  stars: 0 | 1 | 2 | 3
  /** 군단 전체 체력 중 막은 비율(%). 다 못 잡았는데 100으로 반올림되지 않게 99에서 멈춘다 */
  percent: number
  headline: string
  message: string
}

/**
 * 결과 문구. 선생님 의식 화면과 학생 결과 화면이 같은 말을 하도록 한곳에 둔다.
 * 못 잡았을 때도 "얼마나 막았는지"를 성과로 말하고, 누구 탓도 하지 않는다.
 */
export function getRaidOutcome(state: Pick<RaidState, 'allDefeated' | 'progressRatio'>): RaidOutcome {
  const stars = getRaidTeamStars(state)
  if (state.allDefeated) {
    return {
      victory: true,
      stars,
      percent: 100,
      headline: '모두 물리쳤어요!',
      message: '반 전체가 힘을 합쳐 황제 펭귄까지 쓰러뜨렸어요.',
    }
  }
  const percent = Math.max(0, Math.min(99, Math.round(state.progressRatio * 100)))
  const message =
    stars === 2
      ? '거의 다 왔어요! 한 번만 더 힘을 모으면 돼요.'
      : stars === 1
        ? '좋은 출발이었어요! 다음엔 더 멀리 가 봐요.'
        : '도전 도장을 받았어요! 다음 도전이 기대돼요.'
  return { victory: false, stars, percent, headline: `펭귄 군단 ${percent}% 저지!`, message }
}
