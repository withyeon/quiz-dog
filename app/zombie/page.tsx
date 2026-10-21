'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import ZombieView from '@/components/ZombieView'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AnimatedBackground from '@/components/AnimatedBackground'
import { Button } from '@/components/ui/button'
import ZombieIcon from '@/components/zombie/ZombieIcon'
import {
  computeZombieRadio,
  createLateJoinerPatch,
  getZombieMeta,
  parseZombieSettings,
  resolveZombieOutcome,
  roomPlayerToZombiePlayer,
  ZOMBIE_ACTION_LIMITS,
  type ZombieActionKind,
} from '@/lib/game/zombie'
import {
  zombieApplyAction,
  zombieSabotage,
  zombieStrike,
  zombieVaccinate,
  pickDeltaFields,
  type ZombieAttackResult,
} from '@/lib/services/playerMutations'
import { useGameBase } from '@/hooks/useGameBase'
import { useZombieRadioDirector } from '@/hooks/useZombieRadioDirector'
import type { Database, Json } from '@/types/database.types'

export default function ZombiePage() {
  const router = useRouter()
  const {
    roomCode,
    playerId,
    currentView,
    setCurrentView,
    room,
    players,
    currentPlayer,
    currentQuestion,
    questionsLoading,
    questionsError,
    questionSetTitle,
    preStartQuizQuestion,
    preStartSubmittedCount,
    preStartQuizTotal,
    shouldShowPreStartQuiz,
    isPreStartQuizComplete,
    handlePreStartQuizAnswer,
    checkAnswer,
    goToNextQuestion,
    sendRoomEvent,
    applyRoomPatch,
    applyPlayerPatch,
    commitPlayerPatch,
    roomLoading,
    playersLoading,
  } = useGameBase({
    expectedGameMode: 'zombie',
    preStartQuizTotal: 0,
    redirectToResultPage: false,
  })
  const [showRoleReveal, setShowRoleReveal] = useState(false)

  // 서버가 소유하는 좀비 상태. 클라이언트는 RPC가 돌려준 이 값만 반영·전파한다.
  const broadcastAuthoritativeRow = useCallback((
    row: Database['public']['Tables']['players']['Row'],
    reason: string,
  ) => {
    const patch = pickDeltaFields(row, ['health', 'attack_power', 'score', 'active_item'])
    applyPlayerPatch(row.id, patch)
    void sendRoomEvent('player:patch', { playerId: row.id, patch, reason })
  }, [applyPlayerPatch, sendRoomEvent])

  const activeRoomPlayers = useMemo(
    () => players.filter((player) => !player.is_kicked),
    [players],
  )

  // 좀비 감염 공격 — 숨기/방어막/체력/역할 전이를 서버에서 원자적으로 처리하고,
  // 두 행의 권위 있는 결과를 broadcast 해 모든 화면을 정합적으로 수렴시킨다.
  // (동시에 여러 좀비가 같은 인간을 공격해도 데미지가 누적된다.)
  const handleZombieAttack = useCallback(async (
    zombieId: string,
    targetId: string,
  ): Promise<ZombieAttackResult> => {
    const result = await zombieStrike(zombieId, targetId, { ...ZOMBIE_ACTION_LIMITS })
    result.players.forEach((row) => broadcastAuthoritativeRow(row, 'zombie_attack'))
    return result
  }, [broadcastAuthoritativeRow])

  const handleZombieVaccinate = useCallback(async (humanId: string, targetId: string) => {
    const result = await zombieVaccinate(humanId, targetId, { ...ZOMBIE_ACTION_LIMITS })
    result.players.forEach((row) => broadcastAuthoritativeRow(row, 'zombie_vaccine'))
    return result
  }, [broadcastAuthoritativeRow])

  const handleZombieSabotage = useCallback(async (zombieId: string) => {
    const result = await zombieSabotage(zombieId, { ...ZOMBIE_ACTION_LIMITS })
    if (result.player) broadcastAuthoritativeRow(result.player, 'zombie_sabotage')
    return result
  }, [broadcastAuthoritativeRow])

  // 퀴즈 결과·인간 행동도 서버가 판정한다. 클라이언트는 역할·체력을 절대값으로
  // 쓰지 않는다 — 감염 직후의 오래된 로컬 스냅샷이 감염을 되돌리기 때문.
  const handleZombieAction = useCallback(async (action: ZombieActionKind) => {
    if (!playerId) return null
    const row = await zombieApplyAction(playerId, action, { ...ZOMBIE_ACTION_LIMITS })
    if (!row) return null
    broadcastAuthoritativeRow(row, `zombie_${action}`)
    return row
  }, [broadcastAuthoritativeRow, playerId])
  // 게임 시작 전 입장한 플레이어만 (도중 입장자는 active_item이 null)
  const playersWithRoles = useMemo(
    () => activeRoomPlayers.filter((player) => getZombieMeta(player)),
    [activeRoomPlayers],
  )
  const zombiePlayers = useMemo(
    () => playersWithRoles.map(roomPlayerToZombiePlayer),
    [playersWithRoles],
  )
  const myPlayer = useMemo(
    () => (currentPlayer ? roomPlayerToZombiePlayer(currentPlayer) : null),
    [currentPlayer],
  )
  const humanSurvivors = zombiePlayers.filter((player) => player.role === 'human')
  const zombies = zombiePlayers.filter((player) => player.role === 'zombie')
  const zombieSettings = useMemo(() => parseZombieSettings(room?.settings), [room?.settings])
  const { winner, message: winReason } = resolveZombieOutcome(zombiePlayers, zombieSettings)
  const myWon = myPlayer ? myPlayer.role === winner : false
  const hasAssignedRoles = playersWithRoles.length > 0

  // 구조 무전기. 방 단위 이벤트(목표 확정·헬기 호출)는 선생님 화면이 맡고, 이 화면은 예비다
  // (선생님 화면이 없는 1분 체험에서도 돌아가게).
  const roomStartedAt = room?.started_at ?? null
  const roomDurationSeconds = room?.duration_seconds ? Number(room.duration_seconds) : null
  const radio = useMemo(() => {
    const startedAtMs = roomStartedAt ? Date.parse(roomStartedAt) : null
    return computeZombieRadio(zombiePlayers, zombieSettings, {
      startedAtMs,
      gameEndMs: startedAtMs !== null && roomDurationSeconds !== null ? startedAtMs + roomDurationSeconds * 1000 : null,
      durationSeconds: roomDurationSeconds,
    })
  }, [roomDurationSeconds, roomStartedAt, zombiePlayers, zombieSettings])
  const handleZombieRoomSettings = useCallback((settings: Json) => {
    applyRoomPatch({ settings })
    void sendRoomEvent('room:patch', { patch: { settings }, reason: 'zombie_radio' })
  }, [applyRoomPatch, sendRoomEvent])
  useZombieRadioDirector({
    roomCode,
    roomStatus: room?.status,
    durationSeconds: zombieSettings.durationSeconds ?? roomDurationSeconds,
    radio,
    role: 'backup',
    onSettings: handleZombieRoomSettings,
  })
  // 게임이 시작된 뒤 들어온 학생은 시작 때의 역할 배정을 놓친다. 로비가 행을 만들 때 인간 역할을
  // 같이 넣어 주지만(createPlayerForRoom), 시작 직전에 들어와 배정 사이에 낀 학생은 여전히 역할이
  // 없을 수 있다. 그런 학생은 아래 효과에서 스스로 인간으로 참여한다.
  const isLateJoiner = hasAssignedRoles && !(currentPlayer && getZombieMeta(currentPlayer))
  const lateJoinRequestedRef = useRef(false)
  useEffect(() => {
    if (room?.status !== 'playing' || !isLateJoiner || !playerId) return
    if (lateJoinRequestedRef.current) return
    lateJoinRequestedRef.current = true
    commitPlayerPatch(playerId, createLateJoinerPatch(), 'zombie_late_join').catch((error) => {
      // 한 번 실패하면 다음 players 갱신 때 다시 시도한다
      lateJoinRequestedRef.current = false
      console.error('도중 입장 역할 배정 실패:', error)
    })
  }, [commitPlayerPatch, isLateJoiner, playerId, room?.status])

  useEffect(() => {
    if (room?.status === 'waiting' && currentView !== 'lobby') {
      setShowRoleReveal(false)
      setCurrentView('lobby')
      return
    }

    if (room?.status === 'finished' && currentView !== 'result') {
      setShowRoleReveal(false)
      setCurrentView('result')
      return
    }

    if (room?.status === 'playing' && currentView === 'lobby' && isPreStartQuizComplete) {
      setCurrentView('playing')
    }
  }, [currentView, isPreStartQuizComplete, room?.status, setCurrentView])

  const roleRevealKey = useMemo(() => {
    if (!roomCode || !playerId || !room?.started_at) return null
    return `zombie_role_reveal_${roomCode}_${playerId}_${room.started_at}`
  }, [playerId, room?.started_at, roomCode])

  // 역할 공개 트리거. 의존성은 전부 원시값이어야 한다 — 이전에는 매 렌더마다 새로 만들어지는
  // myPlayer 객체가 들어가 있어, 아래 3초 타이머가 cleanup으로 매번 취소되고 sessionStorage
  // 가드 때문에 다시 걸리지도 않아 역할 화면에서 영원히 멈췄다.
  useEffect(() => {
    if (room?.status !== 'playing' || isLateJoiner || !hasAssignedRoles || !roleRevealKey) return
    if (typeof window === 'undefined') return
    try {
      if (window.sessionStorage.getItem(roleRevealKey) === '1') return
      window.sessionStorage.setItem(roleRevealKey, '1')
    } catch {
      // 비공개 모드 등에서 sessionStorage가 막혀도 한 번은 보여준다.
    }
    setShowRoleReveal(true)
  }, [hasAssignedRoles, isLateJoiner, roleRevealKey, room?.status])

  // 3초 뒤 자동으로 게임 화면으로. 트리거 효과와 분리해 재렌더에 타이머가 흔들리지 않게 한다.
  useEffect(() => {
    if (!showRoleReveal) return
    const timer = window.setTimeout(() => setShowRoleReveal(false), 3000)
    return () => window.clearTimeout(timer)
  }, [showRoleReveal])

  useEffect(() => {
    if (room?.status !== 'playing' || !hasAssignedRoles || zombiePlayers.length === 0) return
    if (humanSurvivors.length > 0) return
    // 학생은 자기 화면만 로컬 종료. 방의 finished 기록은 교사 대시보드(유일한 권위자)가 담당.
    setCurrentView('result')
  }, [hasAssignedRoles, humanSurvivors.length, room?.status, setCurrentView, zombiePlayers.length])

  if (!roomCode || !playerId) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black p-6 text-white">
        방 코드와 플레이어 정보가 필요합니다.
      </div>
    )
  }

  if (roomLoading || playersLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black p-6 text-2xl font-black text-green-300">
        좀비 모드를 준비하는 중
      </div>
    )
  }

  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{
        fontFamily: "'DNFBitBitv2', sans-serif",
        backgroundImage: "linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.65)), url('/zombie/background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <AnimatedBackground />
      {shouldShowPreStartQuiz && (
        <PreStartQuizGate
          question={preStartQuizQuestion}
          submittedCount={preStartSubmittedCount}
          total={preStartQuizTotal}
          onAnswer={handlePreStartQuizAnswer}
          questionsLoading={questionsLoading}
          questionsError={questionsError}
        />
      )}

      <AnimatePresence mode="wait">
        {currentView === 'lobby' && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-dvh items-center justify-center p-4">
            <Card className="w-full max-w-2xl border-4 border-green-600 bg-black/90 shadow-2xl">
              <CardHeader className="pb-4 text-center">
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="mb-4 flex justify-center">
                  <ZombieIcon name="zombie" size={80} alt="좀비" />
                </motion.div>
                <CardTitle className="mb-2 text-5xl font-bold text-green-400">좀비를 피해라!</CardTitle>
                <p className="text-xl text-gray-300">반 친구들과 함께 감염을 막고 생존하세요.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-xl border-2 border-green-600 bg-gray-800/50 p-4">
                  <h3 className="mb-2 text-xl font-bold text-green-400">참가자 {activeRoomPlayers.length}명</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {activeRoomPlayers.map((player) => (
                      <div key={player.id} className="rounded-lg bg-black/40 px-3 py-2 font-bold text-white">
                        {player.nickname}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border-2 border-green-600 bg-gray-800/50 p-4">
                  <ul className="space-y-3 text-base text-gray-300">
                    <li className="flex items-start gap-3">
                      <ZombieIcon name="zombie" size={22} className="mt-0.5 shrink-0" alt="" />
                      <span>15~20%가 랜덤으로 좀비가 됩니다.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <ZombieIcon name="quiz" size={22} className="mt-0.5 shrink-0" alt="" />
                      <span>퀴즈를 맞히면 역할에 맞는 행동을 할 수 있어요.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <ZombieIcon name="heal" size={22} className="mt-0.5 shrink-0" alt="" />
                      <span>인간은 정답으로 구조 무전기를 고쳐요. 시간 안에 다 고쳐야 헬기가 와요.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <ZombieIcon name="scan" size={22} className="mt-0.5 shrink-0" alt="" />
                      <span>스캔으로 감염된 친구를 찾아 백신 3발을 맞히면 다시 인간이 돼요.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <ZombieIcon name="attack" size={22} className="mt-0.5 shrink-0" alt="" />
                      <span>좀비는 친구를 공격해 감염시키거나 무전기를 방해합니다.</span>
                    </li>
                  </ul>
                </div>
                <p className="text-center text-lg font-black text-green-300">선생님이 시작하면 역할이 공개됩니다.</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {room?.status === 'playing' && currentView !== 'lobby' && showRoleReveal && myPlayer && (
          <motion.div key="role_reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-dvh items-center justify-center p-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.8 }} className="text-center">
              <motion.div animate={{ y: [0, -20, 0] }} transition={{ duration: 1, repeat: Infinity }} className="flex justify-center">
                <ZombieIcon
                  name={myPlayer.role === 'zombie' ? 'zombie' : 'human'}
                  size={120}
                  alt={myPlayer.role === 'zombie' ? '좀비' : '인간'}
                />
              </motion.div>
              <h1 className={`mt-6 text-6xl font-bold ${myPlayer.role === 'zombie' ? 'text-green-400' : 'text-blue-400'}`}>
                당신은 {myPlayer.role === 'zombie' ? '좀비' : '인간'}입니다!
              </h1>
              <p className="mt-4 text-2xl text-gray-400">
                {myPlayer.role === 'zombie' ? '인간을 감염시키고 무전기를 방해하세요!' : '무전기를 고쳐 구조 헬기를 부르세요!'}
              </p>
            </motion.div>
          </motion.div>
        )}

        {/* 일시정지 중에도 화면을 내리지 않는다(ZombieView 가 isPaused 덮개를 그린다). 예전엔 playing 일 때만 그려서
            선생님이 멈추면 학생 화면이 검게 비었다 (2026-10-18 25명 검수) */}
        {/* 결과로 넘어간 뒤(헬기 도착·전원 감염·시간 끝)에는 방이 아직 playing 이어도 게임 화면을 내린다 —
            선생님 화면이 방을 끝내기 전까지 결과 카드 위에 게임 화면이 겹쳐 있었다 */}
        {(room?.status === 'playing' || room?.status === 'paused') && currentView !== 'lobby' && currentView !== 'result' && !showRoleReveal && (
          hasAssignedRoles && !isLateJoiner ? (
            <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-dvh w-full">
              <ZombieView
                roomCode={roomCode}
                questionSetTitle={questionSetTitle}
                playerId={playerId}
                roomStatus={room?.status ?? 'waiting'}
                roomStartedAt={room?.started_at ?? null}
                roomDurationSeconds={room?.duration_seconds ?? null}
                roomPlayers={playersWithRoles}
                showHumanStatusToZombies={zombieSettings.showHumanStatus}
                radio={radio}
                currentQuestion={currentQuestion}
                onAnswer={checkAnswer}
                onNextQuestion={goToNextQuestion}
                onGameEnd={() => setCurrentView('result')}
                // 학생은 방을 종료(DB 기록)할 권한이 없다. 자기 화면만 로컬 종료하고,
                // 방의 finished 기록은 교사 대시보드(유일한 권위자)가 담당한다.
                onFinishRoom={async () => { setCurrentView('result'); return false }}
                onZombieAction={handleZombieAction}
                onZombieAttack={handleZombieAttack}
                onZombieVaccinate={handleZombieVaccinate}
                onZombieSabotage={handleZombieSabotage}
              />
            </motion.div>
          ) : (
            <motion.div key="assigning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-dvh items-center justify-center p-6 text-center">
              <div className="rounded-2xl border-4 border-green-600 bg-black/80 p-8 text-3xl font-black text-green-300">
                역할을 배정하는 중
              </div>
            </motion.div>
          )
        )}

        {currentView === 'result' && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex min-h-dvh items-center justify-center p-4">
            <Card className={`w-full max-w-3xl border-4 ${winner === 'human' ? 'border-blue-500' : 'border-green-500'} bg-black/90 shadow-2xl`}>
              <CardHeader className="pb-4 text-center">
                <div className="mb-4 flex justify-center">
                  {/* 폰에서는 한 단계 작게 — 결과 카드 아래 목록이 화면 안에 들어오도록 */}
                  <ZombieIcon name={winner === 'human' ? 'winHuman' : 'winZombie'} size={176} className="h-32 w-32 sm:h-44 sm:w-44" alt={winner === 'human' ? '인간 승리' : '좀비 승리'} />
                </div>
                <CardTitle className={`mb-2 text-5xl font-bold ${winner === 'human' ? 'text-blue-400' : 'text-green-400'}`}>
                  {winner === 'human' ? '인간 팀 승리!' : '좀비 팀 승리!'}
                </CardTitle>
                <p className="text-xl text-gray-300">{winReason}</p>
                {myPlayer && (
                  <p className={`mt-2 text-2xl font-bold ${myWon ? 'text-yellow-400' : 'text-red-400'}`}>
                    {myWon ? '당신이 이겼습니다!' : '당신은 졌습니다'}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="mb-3 text-2xl font-bold text-blue-400">생존자 ({humanSurvivors.length}명)</h3>
                  <div className="space-y-2">
                    {humanSurvivors.map((player) => (
                      <div key={player.id} className="flex items-center justify-between rounded-xl border-2 border-blue-500/50 bg-blue-950/30 p-3">
                        <span className="font-bold text-white">{player.name}</span>
                        <span className="text-sm text-gray-300">
                          수리 {player.radioParts}칸{player.rescues > 0 ? ` · 구출 ${player.rescues}` : ''}
                        </span>
                      </div>
                    ))}
                    {humanSurvivors.length === 0 && <p className="text-center text-gray-500">생존자 없음</p>}
                  </div>
                </div>
                <div>
                  <h3 className="mb-3 text-2xl font-bold text-green-400">좀비 ({zombies.length}명)</h3>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {zombies.map((player) => (
                      <div key={player.id} className={`flex items-center justify-between rounded-xl border-2 p-3 ${player.originalRole === 'zombie' ? 'border-red-500/50 bg-red-950/30' : 'border-green-500/30 bg-green-950/20'}`}>
                        <span className="font-bold text-white">{player.name}</span>
                        <span className="text-sm text-gray-400">
                          감염 {player.infectCount}{player.sabotageCount > 0 ? ` · 방해 ${player.sabotageCount}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* 이 화면은 학생용이다. 교사 대시보드가 아니라 학생 결과 페이지(정답률·복습 문제)로 보낸다. */}
                <Button
                  onClick={() => router.replace(`/student/game/${roomCode}/result?playerId=${playerId}&reason=zombie_finished`)}
                  size="lg"
                  variant="outline"
                  className="w-full border-4 border-gray-600 py-6 text-xl font-bold text-gray-300"
                >
                  결과 보기
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
