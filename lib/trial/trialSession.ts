import { TEAM_MIN_PLAYERS } from '@/lib/game/battleRoyale'
import { VISIBLE_GAME_MODES, type GameModeId } from '@/lib/game/modes'

/** 체험 한 판의 최대 시간(초). 방을 이 길이로 시작하고, 봇 실행기(DevBotRunner)가 시간이 끝나면 선생님 대신 방을 끝낸다 */
export const TRIAL_DURATION_SECONDS = 120

/** 체험 방의 참가자 이름 */
export const TRIAL_NICKNAME = '체험 선생님'

/** 함께 노는 봇 친구 수. 봇은 /dev 와 같은 실행기(components/dev/DevBotRunner.tsx)가 이 탭에서 움직인다 */
export const TRIAL_BOT_COUNT = 4

/** 게임별 봇 수 — 눈싸움은 TEAM_MIN_PLAYERS 명부터 팀이 나뉘므로 그만큼 채운다 */
export function trialBotCount(mode: GameModeId): number {
  if (mode === 'battle_royale') return Math.max(TRIAL_BOT_COUNT, TEAM_MIN_PLAYERS - 1)
  return TRIAL_BOT_COUNT
}

/** 체험으로 열 수 있는 게임 — 공개된 게임 전부(봇 친구가 있어 팀전·역할전·협동전도 된다). 공부 모드는 게임이 아니라 뺀다 */
export const TRIAL_GAME_MODES: readonly GameModeId[] = VISIBLE_GAME_MODES
  .map((mode) => mode.id)
  .filter((id) => id !== 'study')

/** 게임 화면에 떠 있는 "체험 중" 띠와 끝난 뒤 안내가 읽는 이 탭의 체험 정보 */
export type TrialSession = {
  roomCode: string
  gameMode: GameModeId
  setId: string
  setTitle: string
  startedAt: string
}

const KEY = 'quizdog_trial_session'

export function writeTrialSession(session: TrialSession): void {
  try { window.sessionStorage.setItem(KEY, JSON.stringify(session)) } catch {}
}

export function readTrialSession(): TrialSession | null {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<TrialSession>
    if (!parsed.roomCode || !parsed.gameMode || !parsed.setId) return null
    return parsed as TrialSession
  } catch {
    return null
  }
}

export function clearTrialSession(): void {
  try { window.sessionStorage.removeItem(KEY) } catch {}
}
