'use client'

import { useEffect, useRef } from 'react'
import type { Json } from '@/types/database.types'
import { buildRadioGoalLimits, type ZombieRadioState } from '@/lib/game/zombie'
import { zombieCallHeli, zombieLockRadioGoal } from '@/lib/services/playerMutations'

type UseZombieRadioDirectorInput = {
  roomCode: string | null | undefined
  roomStatus: string | null | undefined
  /** 목표 계산에 쓰는 게임 길이(초) — rooms.settings.zombie.durationSeconds, 없으면 rooms.duration_seconds */
  durationSeconds: number | null
  radio: ZombieRadioState
  /**
   * 'host' = 선생님 화면(제때 바로 부른다). 'backup' = 학생 화면(선생님 화면이 없는 1분 체험 등을 위한 예비,
   * 몇 초 늦게 · 학생마다 다른 시각에 부른다 — 25명이 같은 순간 RPC 를 쏘지 않게).
   */
  role: 'host' | 'backup'
  /** RPC 가 돌려준 rooms.settings 를 로컬 반영 + room:patch 로 방송한다 */
  onSettings: (settings: Json) => void
}

/**
 * 좀비를 피해라 무전기의 방 단위 이벤트 두 가지를 맡는다.
 *   1) 시작 1분 뒤 무전기 목표 확정 (zombie_lock_radio_goal)
 *   2) 진행도가 목표에 닿으면 헬기 호출 (zombie_call_heli)
 * 두 RPC 모두 한 번만 기록되고 누가 불러도 결과가 같아서, 여러 화면이 불러도 안전하다.
 */
export function useZombieRadioDirector({
  roomCode,
  roomStatus,
  durationSeconds,
  radio,
  role,
  onSettings,
}: UseZombieRadioDirectorInput) {
  // 부모가 인라인 콜백을 넘겨도 아래 타이머가 다시 걸리지 않게 ref 로 들고 있는다
  const onSettingsRef = useRef(onSettings)
  useEffect(() => {
    onSettingsRef.current = onSettings
  }, [onSettings])
  const inFlightRef = useRef(false)
  const lastTryRef = useRef(0)
  // 학생 화면은 선생님 화면보다 4~9초 늦게. 한 번 정한 값을 계속 쓴다.
  const backupDelayRef = useRef(role === 'backup' ? 4000 + Math.random() * 5000 : 0)

  const { phase, goal, progress, goalLockAtMs } = radio
  const needsGoal = phase === 'searching'
  const needsHeli = phase === 'repairing' && goal !== null && progress >= goal

  useEffect(() => {
    if (!roomCode || roomStatus !== 'playing' || !durationSeconds) return
    if (!needsGoal && !needsHeli) return

    let reachedAt = 0
    const tick = () => {
      const now = Date.now()
      if (needsGoal) {
        if (goalLockAtMs === null || now < goalLockAtMs + backupDelayRef.current) return
      } else {
        if (!reachedAt) reachedAt = now
        if (now < reachedAt + backupDelayRef.current) return
      }
      // 실패하거나(네트워크) 서버가 아직 이르다고 돌려주면 3초 뒤 다시
      if (inFlightRef.current || now - lastTryRef.current < 3000) return
      inFlightRef.current = true
      lastTryRef.current = now
      const request = needsGoal
        ? zombieLockRadioGoal(roomCode, buildRadioGoalLimits(durationSeconds))
        : zombieCallHeli(roomCode)
      request
        .then((settings) => { if (settings) onSettingsRef.current(settings) })
        .catch((error) => { console.error(needsGoal ? '무전기 목표 확정 실패:' : '헬기 호출 실패:', error) })
        .finally(() => { inFlightRef.current = false })
    }

    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [durationSeconds, goalLockAtMs, needsGoal, needsHeli, roomCode, roomStatus])
}
