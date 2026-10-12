/**
 * /dev 페이지의 "봇 친구" — 혼자 테스트할 때 같은 방에 들어오는 가짜 학생.
 *
 * 봇은 진짜 players 행이다(createPlayerForRoom). 게임 화면을 여는 대신, 사람이 게임을 하는 탭 안에서
 * components/dev/DevBotRunner.tsx 가 봇마다 "문제를 풀고(난이도만큼 맞히고) 점수를 올리는" 일을 대신 한다.
 * 그래서 순위표·결과·리포트에는 다른 학생과 똑같이 나온다.
 *
 * 설정은 /dev 에서 게임 시작을 누른 탭의 sessionStorage 에만 둔다(lib/dev/devPlayFlags.ts 와 같은 방식).
 * 다른 학생·다른 탭에는 영향이 없고, 탭을 닫으면 봇도 멈춘다.
 *
 * 게임 시간도 여기서 정한다. /dev 방에는 선생님 화면이 없어서, 시간이 끝나면 같은 실행기가 선생님 대신
 * 방을 끝내 결과 화면으로 넘어가게 한다(봇이 없어도 한다).
 */

export type DevBotDifficulty = 'easy' | 'medium' | 'hard'

export type DevBotDifficultyProfile = {
  label: string
  /** 한 문제를 맞힐 확률 */
  accuracy: number
  /** 모드별 기본 주기(초)에 곱하는 값. 클수록 느리다 */
  pace: number
  description: string
}

// 정답률은 /dev 플레이 기록(개발자 닉네임 481판, 문제 5개 이상 푼 127판)에서 잡았다.
// 판별 정답률이 하위 25% 40% · 가운데 77% · 상위 25% 93% 라서 초·중·고를 그 언저리에 둔다.
export const DEV_BOT_DIFFICULTIES: Record<DevBotDifficulty, DevBotDifficultyProfile> = {
  easy: { label: '초', accuracy: 0.45, pace: 1.4, description: '절반쯤 틀리고 느긋하게 풀어요' },
  medium: { label: '중', accuracy: 0.75, pace: 1, description: '내 평소 실력쯤이에요' },
  hard: { label: '고', accuracy: 0.92, pace: 0.75, description: '거의 다 맞히고 빨라요' },
}

export const DEV_BOT_MAX_COUNT = 8

/** 게임 시간(분). 선생님 화면(GameDurationPicker)과 같은 선택지에 무제한(null)을 더했다 */
export const DEV_GAME_DURATION_MINUTES = [3, 5, 7, 10] as const

// 봇 이름. 실제 학생과 헷갈리지 않게 '봇'을 붙인다.
const BOT_NAMES = ['뭉치', '보리', '초코', '콩이', '두부', '호두', '라떼', '모카', '쿠키', '젤리', '구름', '마루']

/** 이번 판 봇 닉네임 n개. 이름이 겹치지 않게 섞어서 뽑는다. 예) '뭉치봇(중)' */
export function createDevBotNicknames(count: number, difficulty: DevBotDifficulty): string[] {
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5)
  const label = DEV_BOT_DIFFICULTIES[difficulty].label
  return Array.from({ length: count }, (_, i) => `${names[i % names.length]}봇(${label})`)
}

// ─── /dev 에서 고른 값(다음에 /dev 를 열어도 그대로) ───
export type DevBotSettings = {
  count: number
  difficulty: DevBotDifficulty
  /**
   * 공격 자주: 방해·공격 아이템이 나올 때까지 기다리지 않고 훨씬 자주 쓴다(공격 화면 테스트용).
   * 끄면 게임 규칙의 확률 그대로라, 봇이 몇 명뿐이면 공격이 드물다(골드퀘스트 강탈은 정답의 약 10%).
   */
  aggressive: boolean
  /** 게임 시간(분). null 이면 무제한(예전 /dev 처럼 끝나지 않는다) */
  durationMinutes: number | null
}
export const DEFAULT_DEV_BOT_SETTINGS: DevBotSettings = { count: 0, difficulty: 'medium', aggressive: false, durationMinutes: 5 }
const SETTINGS_KEY = 'quizdog:devBotSettings'

function isDifficulty(value: unknown): value is DevBotDifficulty {
  return value === 'easy' || value === 'medium' || value === 'hard'
}

export function readDevBotSettings(): DevBotSettings {
  if (typeof window === 'undefined') return DEFAULT_DEV_BOT_SETTINGS
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<DevBotSettings> | null
    const count = Math.max(0, Math.min(DEV_BOT_MAX_COUNT, Math.floor(Number(parsed?.count) || 0)))
    return {
      count,
      difficulty: isDifficulty(parsed?.difficulty) ? parsed.difficulty : DEFAULT_DEV_BOT_SETTINGS.difficulty,
      aggressive: parsed?.aggressive === true,
      durationMinutes: parsed && 'durationMinutes' in parsed
        ? (DEV_GAME_DURATION_MINUTES as readonly number[]).includes(Number(parsed.durationMinutes)) ? Number(parsed.durationMinutes) : null
        : DEFAULT_DEV_BOT_SETTINGS.durationMinutes,
    }
  } catch {
    return DEFAULT_DEV_BOT_SETTINGS
  }
}

export function writeDevBotSettings(settings: DevBotSettings): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // 시크릿 모드 등에서 저장이 막혀도 이번 화면에서는 동작한다
  }
}

// ─── 지금 돌아가는 판(봇 실행기가 읽는다) ───
export type DevBot = { playerId: string; nickname: string; difficulty: DevBotDifficulty }
export type DevBotSession = {
  roomCode: string
  gameMode: string
  setId: string | null
  /** 공격 자주(DevBotSettings.aggressive) */
  aggressive?: boolean
  bots: DevBot[]
}
const SESSION_KEY = 'quizdog:devBotSession'

export function readDevBotSession(): DevBotSession | null {
  if (typeof window === 'undefined') return null
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? 'null') as DevBotSession | null
    // 봇이 없어도 세션은 쓴다(시간이 끝나면 방을 끝내는 일)
    if (!parsed?.roomCode || !Array.isArray(parsed.bots)) return null
    return parsed
  } catch {
    return null
  }
}

/** /dev 에서 새 판을 시작할 때마다 덮어쓴다. 그래서 앞 판 봇이 새 판에 따라오지 않는다. */
export function writeDevBotSession(session: DevBotSession | null): void {
  if (typeof window === 'undefined') return
  try {
    if (session) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else window.sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // 저장이 막히면 봇이 움직이지 않을 뿐 게임은 그대로다
  }
}
