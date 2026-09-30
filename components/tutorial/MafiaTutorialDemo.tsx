'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DollarSign, Eye, Gem, Radio, ShieldAlert, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import PixelIcon from '@/components/ui/PixelIcon'
import QuizSetName from '@/components/game/QuizSetName'
import VaultIcon, { getVaultDisplay, VaultReveal } from '@/components/mafia/VaultIcon'
import {
  VAULT_COUNT,
  attemptInvestigate,
  calculateLaunderedCash,
  formatTime,
  openSafeVault,
  type Player as MafiaPlayer,
  type SafeVault,
} from '@/lib/game/mafia'
import {
  TutorialDemoFrame,
  GlassQuizStep,
  StageCard,
  TapPointer,
  CountUp,
  DEMO_SET_NAME,
  PLAYER_NAME,
  RIVALS,
} from '@/components/tutorial/TutorialDemoFrame'

/**
 * 쉿! 마피아 튜토리얼 데모.
 *   (components/MafiaView.tsx · components/mafia/VaultIcon.tsx · lib/game/mafia.ts)
 * 장면 5개는 튜토리얼 규칙 5장과 1:1로 맞춰 두었습니다.
 *
 * 실제 화면과 같은 재료로 그립니다:
 *   - 상단 바(남은 시간·자금·다이아몬드·문제집·인원)는 MafiaView 헤더와 같은 클래스
 *   - 행동 선택·금고 선택·금고 결과·조사 카드는 MafiaView 의 Card/Button 마크업 그대로, 금고 아이콘은 실제 VaultIcon
 *   - 하단 도청 장치 로그와 조직원 목록도 MafiaView 와 같은 구성
 * 자금 변화와 로그 문장은 실제 규칙 함수(openSafeVault · attemptInvestigate · calculateLaunderedCash)로 계산하므로
 * 밸런스가 바뀌면 데모도 따라 바뀝니다.
 */

const FONT = { fontFamily: "'DNFBitBitv2', sans-serif" } as const
const PLAYER_COUNT = RIVALS.length + 1

function demoPlayer(id: string, name: string, cash: number, extra: Partial<MafiaPlayer> = {}): MafiaPlayer {
  return { id, name, isAi: false, cash, diamonds: 0, status: 'active', isCheating: false, multipliers: [], ...extra }
}

/** 2장에서 여는 금고 — generateSafeVaults 의 '중간 현금' 구간 */
const FIRST_VAULT: SafeVault = { id: 'demo-vault-first', reward: 'cash', amount: 100 }
/** 3장 몰래보기로 드러나는 금고들 — 소액 현금 · 다이아몬드 · 대액 현금 */
const PEEKED_VAULTS: SafeVault[] = (
  [
    { id: 'demo-peek-0', reward: 'cash', amount: 25 },
    { id: 'demo-peek-1', reward: 'diamond', amount: 2 },
    { id: 'demo-peek-2', reward: 'cash', amount: 250 },
  ] as SafeVault[]
).slice(0, VAULT_COUNT)
const BEST_VAULT_INDEX = PEEKED_VAULTS.length - 1
const BEST_VAULT = PEEKED_VAULTS[BEST_VAULT_INDEX]
/** 아직 안 연 금고 — 실제 화면처럼 잠긴 금고 그림만 보인다 */
const LOCKED_VAULTS: SafeVault[] = Array.from({ length: VAULT_COUNT }, (_, index) => ({
  id: `demo-locked-${index}`,
  reward: 'cash',
  amount: 0,
}))
const OPEN_VAULT_INDEX = Math.floor(VAULT_COUNT / 2)

// ───────────── 자금 흐름: 실제 규칙 함수로 계산한다 ─────────────
const ME = demoPlayer('me', PLAYER_NAME, 0)
const firstOpen = openSafeVault(FIRST_VAULT, ME)
const CASH_AFTER_FIRST = firstOpen.newPlayer.cash
const peekOpen = openSafeVault(BEST_VAULT, firstOpen.newPlayer)
const CASH_AFTER_PEEK = peekOpen.newPlayer.cash

/** 4장에서 조사하는 친구 — 금고를 몰래봐서 수상한 상태 */
const SUSPECT = demoPlayer('rival-0', RIVALS[0].name, 200, { isCheating: true })
const OTHERS: MafiaPlayer[] = [
  SUSPECT,
  demoPlayer('rival-1', RIVALS[1].name, 120, { diamonds: 1 }),
  demoPlayer('rival-2', RIVALS[2].name, 60),
]
const investigation = attemptInvestigate(peekOpen.newPlayer, SUSPECT, 0)
const CASH_AFTER_CATCH = investigation.newInvestigator.cash
/** 5장 조직원 순위 — 실제와 같이 세탁된 자금(현금 + 다이아몬드) 순 */
const FINAL_MEMBERS: MafiaPlayer[] = [
  investigation.newInvestigator,
  investigation.newTarget,
  OTHERS[1],
  OTHERS[2],
].sort((a, b) => calculateLaunderedCash(b) - calculateLaunderedCash(a))

/** 장면별 남은 시간 (마지막 장면은 시간이 끝난 순간) */
const TIME_LEFT: Record<string, number> = {
  quiz: 6 * 60 + 52,
  vault: 6 * 60 + 40,
  peek: 6 * 60 + 21,
  investigate: 5 * 60 + 58,
  result: 0,
}

// ───────────── 도청 장치 로그 (MafiaView 가 남기는 문장 그대로) ─────────────

type LogLine = { id: string; time: string; message: string; type: 'info' | 'warning' | 'success' | 'danger' }

const LOG_COLOR: Record<LogLine['type'], string> = {
  success: 'text-green-400',
  warning: 'text-yellow-400',
  danger: 'text-red-400',
  info: 'text-gray-300',
}

const LOG_START: LogLine = {
  id: 'start',
  time: '오후 2:03:08',
  type: 'info',
  message: '게임이 시작되었습니다. 정답을 맞히고 금고를 열거나 친구를 조사하세요.',
}
const LOG_FIRST_OPEN: LogLine = { id: 'open-first', time: '오후 2:03:20', type: 'success', message: firstOpen.log }
/** 몰래보기는 본인 화면에만 경고를 남긴다 (누가 몰래봤는지는 절대 공개하지 않는다) */
const LOG_PEEK: LogLine = {
  id: 'peek',
  time: '오후 2:03:39',
  type: 'warning',
  message: '금고를 몰래 들여다봤습니다. 친구가 조사하면 들킵니다!',
}
const LOG_PEEK_OPEN: LogLine = { id: 'open-peek', time: '오후 2:03:41', type: 'success', message: peekOpen.log }
const LOG_CAUGHT: LogLine = { id: 'caught', time: '오후 2:04:02', type: 'danger', message: investigation.log }

function logsFor(phase: string, beat: number): LogLine[] {
  switch (phase) {
    case 'quiz':
      return [LOG_START]
    case 'vault':
      return beat >= 2 ? [LOG_START, LOG_FIRST_OPEN] : [LOG_START]
    case 'peek':
      return [LOG_START, LOG_FIRST_OPEN, ...(beat >= 2 ? [LOG_PEEK] : []), ...(beat >= 4 ? [LOG_PEEK_OPEN] : [])]
    case 'investigate':
      return [LOG_START, LOG_FIRST_OPEN, LOG_PEEK, LOG_PEEK_OPEN, ...(beat >= 5 ? [LOG_CAUGHT] : [])]
    default:
      return [LOG_START, LOG_FIRST_OPEN, LOG_PEEK, LOG_PEEK_OPEN, LOG_CAUGHT]
  }
}

// ───────────── 박자(beat) ─────────────
// 한 장면 안에서 "포인터 → 누름 → 결과" 순서로 연출을 나눈다. 상단 바도 같은 박자를 본다.

type BeatSetter = (beat: number) => void

/** 장면이 붙은 뒤 times[i] ms 가 지나면 beat 가 i+1 이 된다 */
function useBeats(times: number[], onBeat?: BeatSetter): number {
  const [beat, setBeat] = useState(0)
  useEffect(() => {
    onBeat?.(0)
    const timers = times.map((time, index) =>
      setTimeout(() => {
        setBeat(index + 1)
        onBeat?.(index + 1)
      }, time),
    )
    return () => timers.forEach(clearTimeout)
    // 장면이 붙는 순간부터 한 번만 잰다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return beat
}

/** 장면이 바뀌면 박자를 0으로 되돌린다 (이전 장면의 박자가 새 장면 상단 바에 새지 않게) */
function BeatReset({ phase, onReset }: { phase: string; onReset: () => void }) {
  useEffect(() => {
    onReset()
  }, [phase, onReset])
  return null
}

type ButtonMatch = { text: string } | { index: number }

/** 실제 DOM 버튼(글자 또는 순서로 찾음) 위에 손가락 포인터를 올린다 — GlassQuizStep 과 같은 방식 */
function useButtonPointer(
  boxRef: RefObject<HTMLDivElement | null>,
  match: ButtonMatch | null,
): { left: number; top: number } | null {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const key = match === null ? '' : 'text' in match ? `text:${match.text}` : `index:${match.index}`
  useEffect(() => {
    if (!key) {
      setPos(null)
      return
    }
    const box = boxRef.current
    if (!box) return
    const buttons = [...box.querySelectorAll('button')]
    const button = key.startsWith('text:')
      ? buttons.find((b) => (b.textContent ?? '').includes(key.slice(5)))
      : buttons[Number(key.slice(6))]
    if (!button) return
    const boxRect = box.getBoundingClientRect()
    const rect = button.getBoundingClientRect()
    // 조상에 zoom 이 걸려 있으면 화면 px 과 이 상자의 px 이 다르다 — 비율로 되돌린다
    const scale = box.offsetWidth > 0 ? boxRect.width / box.offsetWidth : 1
    setPos({ left: (rect.right - boxRect.left) / scale - 44, top: (rect.bottom - boxRect.top) / scale - 22 })
  }, [boxRef, key])
  return pos
}

function PointerAt({ pos }: { pos: { left: number; top: number } }) {
  return (
    <div className="pointer-events-none absolute z-20" style={{ left: pos.left, top: pos.top }}>
      <TapPointer className="left-0 top-0" />
    </div>
  )
}

/** 무대가 실제 화면보다 작으니 폰에서는 줄인다 (zoom 은 레이아웃도 같이 줄어 잘리지 않는다) */
function Zoomed({ children }: { children: ReactNode }) {
  return <div className="[zoom:0.78] sm:[zoom:1]">{children}</div>
}

// ───────────── 상단 바 (MafiaView 헤더) ─────────────

type HudState = { time: number; cash: number; cashFrom?: number }

function hudState(phase: string, beat: number): HudState {
  const time = TIME_LEFT[phase] ?? TIME_LEFT.quiz
  switch (phase) {
    case 'vault':
      return beat >= 2 ? { time, cash: CASH_AFTER_FIRST, cashFrom: 0 } : { time, cash: 0 }
    case 'peek':
      return beat >= 4 ? { time, cash: CASH_AFTER_PEEK, cashFrom: CASH_AFTER_FIRST } : { time, cash: CASH_AFTER_FIRST }
    case 'investigate':
      return beat >= 5 ? { time, cash: CASH_AFTER_CATCH, cashFrom: CASH_AFTER_PEEK } : { time, cash: CASH_AFTER_PEEK }
    case 'result':
      return { time, cash: CASH_AFTER_CATCH }
    default:
      return { time, cash: 0 }
  }
}

function MafiaHeader({ time, cash, cashFrom }: HudState) {
  const isUrgent = time <= 30
  return (
    <div className="border-b-2 border-yellow-600 bg-black/85 shadow-lg backdrop-blur-sm" style={FONT}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-5">
          <span
            className={`whitespace-nowrap text-2xl font-bold tabular-nums sm:text-3xl ${
              isUrgent ? 'animate-pulse text-red-500' : 'text-yellow-400'
            }`}
          >
            {formatTime(time)}
          </span>
          <div className="flex items-center gap-1.5 whitespace-nowrap text-xl font-bold text-yellow-400 sm:text-2xl">
            <DollarSign className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
            <motion.span
              key={cash}
              initial={{ scale: cashFrom !== undefined ? 1.2 : 1 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 16 }}
              className="tabular-nums"
            >
              {cashFrom !== undefined ? <CountUp from={cashFrom} to={cash} duration={900} /> : cash.toLocaleString()}
            </motion.span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap text-lg font-bold text-cyan-300 sm:text-xl">
            <Gem className="h-5 w-5 shrink-0" />0
          </div>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap text-base font-bold text-white">
          <QuizSetName title={DEMO_SET_NAME} tone="dark" className="hidden sm:flex" />
          <Users className="h-5 w-5 shrink-0 text-yellow-300" />
          {PLAYER_COUNT}명
        </div>
      </div>
    </div>
  )
}

// ───────────── 하단 도청 장치 (MafiaView 하단 바) ─────────────

function WiretapLog({ lines }: { lines: LogLine[] }) {
  const shown = lines.slice(-3)
  return (
    <div className="border-t-2 border-yellow-600 bg-black/90 shadow-lg" style={FONT}>
      <div className="px-3 py-1 sm:px-4">
        <h3 className="mb-0.5 flex items-center gap-2 text-sm font-bold text-yellow-400 sm:text-base">
          <Radio className="h-4 w-4" /> 도청 장치
        </h3>
        <div className="flex h-14 flex-col justify-end overflow-hidden rounded-lg bg-black/55 px-1.5 py-1 font-mono text-[11px] leading-snug sm:text-xs">
          <AnimatePresence initial={false}>
            {shown.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`truncate ${LOG_COLOR[log.type]}`}
              >
                [{log.time}] {log.message}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ───────────── 카드들 (MafiaView 의 각 화면) ─────────────

/** 정답 뒤 행동 선택 (MafiaView actionSelect) */
function ActionCard({ pointerOn }: { pointerOn: '금고 열기' | '친구 조사' | null }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const pointer = useButtonPointer(boxRef, pointerOn ? { text: pointerOn } : null)
  return (
    <div ref={boxRef} className="pointer-events-none relative w-full max-w-xl">
      <Zoomed>
        <Card className="border-4 border-yellow-600 bg-black/90" style={FONT}>
          <CardContent className="p-4 text-center sm:p-6">
            <h2 className="mb-4 text-2xl font-bold text-yellow-400 sm:text-3xl">정답입니다. 다음 행동을 고르세요.</h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-5">
              <Button tabIndex={-1} className="h-28 bg-yellow-500 text-xl font-black text-black hover:bg-yellow-400 sm:text-2xl">
                <span className="flex flex-col items-center gap-2">
                  <PixelIcon name="vaultOpen" size={48} alt="" className="h-10 w-10 sm:h-12 sm:w-12" />금고 열기
                </span>
              </Button>
              <Button tabIndex={-1} className="h-28 bg-blue-600 text-xl font-black text-white hover:bg-blue-500 sm:text-2xl">
                <span className="flex flex-col items-center gap-2">
                  <PixelIcon name="scan" size={48} alt="" className="h-10 w-10 sm:h-12 sm:w-12" />친구 조사
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </Zoomed>
      {pointer && <PointerAt pos={pointer} />}
    </div>
  )
}

type VaultPointer = { vault: number } | { peek: true } | null

/** 금고 선택 (MafiaView vaultSelection) — 몰래보기 뒤에는 세 금고가 전부 파랗게 열려 보인다 */
function VaultCard({ vaults, revealed, pointerOn }: { vaults: SafeVault[]; revealed: boolean; pointerOn: VaultPointer }) {
  const boxRef = useRef<HTMLDivElement>(null)
  let match: ButtonMatch | null = null
  if (pointerOn && 'peek' in pointerOn) match = { text: '금고 몰래보기' }
  else if (pointerOn && 'vault' in pointerOn) {
    // 안 연 금고는 글자가 없어 순서로 찾고, 열린 금고는 내용물 글자로 찾는다
    match = revealed ? { text: getVaultDisplay(vaults[pointerOn.vault], true).text } : { index: pointerOn.vault }
  }
  const pointer = useButtonPointer(boxRef, match)
  return (
    <div ref={boxRef} className="pointer-events-none relative w-full max-w-xl">
      <Zoomed>
        <Card className="border-4 border-yellow-600 bg-black/90 shadow-2xl" style={FONT}>
          <CardContent className="p-4 sm:p-6">
            <h2 className="mb-4 text-center text-2xl font-bold text-yellow-400 sm:text-3xl">금고를 선택하세요</h2>
            <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-4">
              {vaults.map((vault) => {
                const display = getVaultDisplay(vault, revealed)
                return (
                  <motion.button
                    key={vault.id}
                    type="button"
                    tabIndex={-1}
                    animate={revealed ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                    transition={{ duration: 0.45 }}
                    className={`aspect-square rounded-xl border-4 p-2 transition sm:p-4 ${
                      revealed ? 'border-cyan-400 bg-cyan-900' : 'border-yellow-600 bg-yellow-900'
                    }`}
                  >
                    <div className="text-4xl sm:text-6xl">
                      <VaultIcon display={display} size={display.text ? 40 : 72} className="sm:hidden" />
                      <VaultIcon display={display} size={display.text ? 64 : 104} className="hidden sm:inline-block" />
                    </div>
                    {display.text && <div className="mt-1.5 text-base font-black text-white sm:mt-3 sm:text-xl">{display.text}</div>}
                  </motion.button>
                )
              })}
            </div>
            <Button tabIndex={-1} className="w-full bg-red-600 py-4 text-lg font-black text-white hover:bg-red-500 sm:text-xl">
              <Eye className="mr-2 h-5 w-5" /> 금고 몰래보기
            </Button>
          </CardContent>
        </Card>
      </Zoomed>
      {pointer && <PointerAt pos={pointer} />}
    </div>
  )
}

/** 금고를 연 결과 (MafiaView vaultResult) — 문장은 openSafeVault 가 만든 로그 그대로 */
function VaultResult({ vault, log }: { vault: SafeVault; log: string }) {
  return (
    <Zoomed>
      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center text-center"
        style={FONT}
      >
        <VaultReveal vault={vault} className="mb-4 w-36 sm:w-48" />
        <div className="max-w-xl break-keep rounded-xl border-4 border-yellow-600 bg-black/90 p-6 text-2xl font-black text-yellow-300 sm:text-3xl">
          {log}
        </div>
      </motion.div>
    </Zoomed>
  )
}

/** 친구 조사 (MafiaView investigation): 대상 고르기 → 조사 중 → CHEATER */
function InvestigationCard({ stage, pointerOn }: { stage: 'pick' | 'scanning' | 'caught'; pointerOn: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const pointer = useButtonPointer(boxRef, pointerOn && stage === 'pick' ? { text: SUSPECT.name } : null)
  return (
    <div ref={boxRef} className="pointer-events-none relative w-full max-w-xl">
      <Zoomed>
        <Card className="border-4 border-blue-600 bg-black/90" style={FONT}>
          <CardContent className="p-5 sm:p-8">
            <h2 className="mb-4 text-center text-3xl font-bold text-blue-300 sm:mb-6 sm:text-4xl">누구를 조사할까요?</h2>
            {stage === 'pick' ? (
              <div className="space-y-3">
                {OTHERS.map((target) => (
                  <Button
                    key={target.id}
                    tabIndex={-1}
                    className="w-full justify-between bg-gray-800 px-5 py-6 text-xl font-bold text-white hover:bg-gray-700"
                  >
                    <span className="flex items-center gap-3">
                      <ShieldAlert className="h-6 w-6 text-gray-400" />
                      {target.name}
                    </span>
                    <span className="text-yellow-300">${calculateLaunderedCash(target).toLocaleString()}</span>
                  </Button>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center sm:py-12">
                {stage === 'caught' ? (
                  <>
                    <div className="mb-4 flex justify-center">
                      <PixelIcon name="siren" size={112} alt="" />
                    </div>
                    <p className="text-4xl font-black text-red-400">CHEATER</p>
                  </>
                ) : (
                  <>
                    <div className="mb-4 flex justify-center">
                      <PixelIcon name="scan" size={112} alt="조사" />
                    </div>
                    <p className="text-3xl text-gray-200">조사 중</p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </Zoomed>
      {pointer && <PointerAt pos={pointer} />}
    </div>
  )
}

/** 조사에 성공한 순간 조사자 화면에 뜨는 붉은 경고 (MafiaView showCheatCaught) — 프레임 안에 갇힌 fixed */
function CaughtOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7 }}
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      style={FONT}
    >
      <div className="absolute inset-0 bg-red-600/50" />
      <div className="relative flex flex-col items-center gap-2">
        <PixelIcon name="siren" size={160} alt="" className="h-28 w-28 drop-shadow-2xl sm:h-40 sm:w-40" />
        <div className="text-6xl font-black text-white drop-shadow-2xl sm:text-8xl">발각!</div>
      </div>
    </motion.div>
  )
}

/**
 * 조직원 목록 (MafiaView 오른쪽 aside) — 순위는 세탁된 자금 순, 내 카드는 노란 테두리.
 * 무대가 낮아 이름과 자금을 한 줄에 놓는다 (색·테두리는 실제 카드와 같다).
 */
function MembersPanel() {
  return (
    <div className="w-full max-w-sm">
      <Zoomed>
        <div className="rounded-lg border-2 border-yellow-600 bg-black/70 p-4" style={FONT}>
          <h2 className="mb-3 flex items-center gap-2 text-2xl font-bold text-yellow-400 sm:text-3xl">
            <Users className="h-6 w-6 sm:h-7 sm:w-7" /> 조직원
          </h2>
          <div className="space-y-2">
            {FINAL_MEMBERS.map((member, index) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + index * 0.15 }}
              >
                <Card className={`border-2 ${member.id === ME.id ? 'border-yellow-400 bg-yellow-950/40' : 'border-gray-700 bg-gray-900/70'}`}>
                  <CardContent className="flex items-center justify-between gap-3 p-3">
                    <div className="font-bold text-white">
                      #{index + 1} {member.name}
                    </div>
                    <div className="text-xl font-black text-yellow-300">${calculateLaunderedCash(member).toLocaleString()}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </Zoomed>
    </div>
  )
}

// ───────────── 장면 ─────────────

/** 실제 화면 배치: 가운데 카드 + 하단 도청 장치 */
function Scene({ id, lines, children }: { id: string; lines: LogLine[]; children: ReactNode }) {
  return (
    <StageCard id={id} className="absolute inset-0 flex flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-2 sm:px-5">{children}</div>
      <WiretapLog lines={lines} />
    </StageCard>
  )
}

/** 1장: 퀴즈 정답 → 금고 열기 / 친구 조사 */
function QuizScene({ onBeat }: { onBeat: BeatSetter }) {
  const beat = useBeats([1000, 2400, 3100], onBeat)
  return (
    <Scene id="mafia-quiz" lines={logsFor('quiz', beat)}>
      {beat < 2 ? (
        <div className="flex w-full justify-center [zoom:0.75] sm:[zoom:1]">
          <GlassQuizStep question="비밀을 지킬 때 내는 소리는?" options={['쉿', '와', '쾅', '딩동']} correctIndex={0} answered={beat >= 1} zoom={0.65} />
        </div>
      ) : (
        <ActionCard pointerOn={beat >= 3 ? '금고 열기' : null} />
      )}
    </Scene>
  )
}

/** 2장: 금고 하나를 골라 연다 */
function VaultScene({ onBeat }: { onBeat: BeatSetter }) {
  const beat = useBeats([900, 1800], onBeat)
  return (
    <Scene id="mafia-vault" lines={logsFor('vault', beat)}>
      {beat < 2 ? (
        <VaultCard vaults={LOCKED_VAULTS} revealed={false} pointerOn={beat >= 1 ? { vault: OPEN_VAULT_INDEX } : null} />
      ) : (
        <VaultResult vault={FIRST_VAULT} log={firstOpen.log} />
      )}
    </Scene>
  )
}

/** 3장: 금고 몰래보기 → 속이 다 보인 채로 제일 좋은 금고를 연다 (대신 수상한 상태가 된다) */
function PeekScene({ onBeat }: { onBeat: BeatSetter }) {
  const beat = useBeats([800, 1600, 2700, 3600], onBeat)
  const pointerOn: VaultPointer = beat === 1 ? { peek: true } : beat === 3 ? { vault: BEST_VAULT_INDEX } : null
  return (
    <Scene id="mafia-peek" lines={logsFor('peek', beat)}>
      {beat < 4 ? (
        <VaultCard vaults={PEEKED_VAULTS} revealed={beat >= 2} pointerOn={pointerOn} />
      ) : (
        <VaultResult vault={BEST_VAULT} log={peekOpen.log} />
      )}
    </Scene>
  )
}

/** 4장: 친구 조사 → 몰래본 친구를 잡으면 자금 환수 + 발각! */
function InvestigateScene({ onBeat }: { onBeat: BeatSetter }) {
  const beat = useBeats([700, 1400, 2200, 2900, 4300], onBeat)
  return (
    <Scene id="mafia-investigate" lines={logsFor('investigate', beat)}>
      {beat < 2 ? (
        <ActionCard pointerOn={beat >= 1 ? '친구 조사' : null} />
      ) : (
        <InvestigationCard stage={beat < 4 ? 'pick' : beat < 5 ? 'scanning' : 'caught'} pointerOn={beat === 3} />
      )}
      <AnimatePresence>{beat >= 5 && <CaughtOverlay key="caught" />}</AnimatePresence>
    </Scene>
  )
}

/** 5장: 시간이 끝났을 때 자금이 가장 많은 사람이 1등 */
function ResultScene({ onBeat }: { onBeat: BeatSetter }) {
  useBeats([], onBeat)
  return (
    <Scene id="mafia-result" lines={logsFor('result', 0)}>
      <MembersPanel />
    </Scene>
  )
}

export default function MafiaTutorialDemo() {
  const [beat, setBeat] = useState(0)
  const resetBeat = useCallback(() => setBeat(0), [])
  const onBeat = useCallback((next: number) => setBeat(next), [])

  return (
    <TutorialDemoFrame
      backgroundSrc="/background/mafia.webp"
      dim
      header={({ phase }) => (
        <>
          <BeatReset phase={phase} onReset={resetBeat} />
          <MafiaHeader {...hudState(phase, beat)} />
        </>
      )}
      /* 규칙 5장과 1:1 — lib/game/tutorials.ts 의 mafia 슬라이드 순서와 같습니다 */
      phases={[
        { key: 'quiz', duration: 4600, step: 1, caption: '정답! 금고 열기 또는 친구 조사를 골라요' },
        { key: 'vault', duration: 4200, step: 2, caption: `금고 ${VAULT_COUNT}개 중 하나를 열어요` },
        { key: 'peek', duration: 5400, step: 3, caption: '금고 몰래보기 — 속이 다 보이지만 조사당하면 들켜요' },
        { key: 'investigate', duration: 6200, step: 4, caption: '친구 조사로 몰래본 친구를 잡으면 자금을 가져와요' },
        { key: 'result', duration: 4000, step: 5, caption: '시간이 끝났을 때 자금이 가장 많으면 1등!' },
      ]}
    >
      {({ phase }) => {
        if (phase === 'quiz') return <QuizScene key="quiz" onBeat={onBeat} />
        if (phase === 'vault') return <VaultScene key="vault" onBeat={onBeat} />
        if (phase === 'peek') return <PeekScene key="peek" onBeat={onBeat} />
        if (phase === 'investigate') return <InvestigateScene key="investigate" onBeat={onBeat} />
        return <ResultScene key="result" onBeat={onBeat} />
      }}
    </TutorialDemoFrame>
  )
}
