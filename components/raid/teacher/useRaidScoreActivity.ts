'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { RaidPlayerLike } from '@/lib/game/raid'
import { getPlayerDisplayNickname } from '@/lib/utils/playerDisplay'

export type RaidFeedItem = {
  id: string
  nickname: string
  damage: number
  role: string | null
}

type ActivityPlayer = RaidPlayerLike & { avatar?: string | null }

/** "반 전체 화력"을 세는 창 길이 */
export const FIREPOWER_WINDOW_MS = 10_000
const FEED_LIMIT = 10
/** 한 번의 스냅샷에 합쳐진 명중이 이보다 많아도 화력에는 이 수까지만 센다 (재접속 직후 한꺼번에 들어오는 값 방지) */
const MAX_HITS_PER_SNAPSHOT = 4

/**
 * players 스냅샷 차이로 만든 선생님 화면용 활동 기록.
 *  - feed: 최근 공격 목록 (기여만)
 *  - pulses: 친구별 "방금 때렸다" 카운터 — 파티 벽 카드가 잠깐 빛나는 신호
 *  - recentHits: 최근 10초 안의 명중 수 (순전히 시각적인 "반 전체 화력")
 * 실시간 이벤트가 아니라 점수 차이를 보므로, 이벤트가 하나 유실돼도 다음 갱신에서 합쳐져 반영된다.
 */
export function useRaidScoreActivity(activePlayers: ActivityPlayer[], isPlaying: boolean) {
  const [feed, setFeed] = useState<RaidFeedItem[]>([])
  const [pulses, setPulses] = useState<Record<string, number>>({})
  const [hitTimes, setHitTimes] = useState<number[]>([])
  const [now, setNow] = useState(() => Date.now())
  const previousRef = useRef<Map<string, { score: number; gold: number }> | null>(null)
  const feedIdRef = useRef(0)

  useEffect(() => {
    const previous = previousRef.current
    previousRef.current = new Map(
      activePlayers.map((player) => [player.id, { score: player.score ?? 0, gold: player.gold ?? 0 }]),
    )
    if (!previous || !isPlaying) return

    const stamp = Date.now()
    const added: RaidFeedItem[] = []
    const pulsed: string[] = []
    const stamps: number[] = []
    for (const player of activePlayers) {
      const before = previous.get(player.id)
      if (!before) continue
      const damageDiff = (player.score ?? 0) - before.score
      if (damageDiff <= 0) continue
      added.push({
        id: `feed-${++feedIdRef.current}`,
        nickname: getPlayerDisplayNickname(player.nickname, player.avatar),
        damage: damageDiff,
        role: player.player_class ?? null,
      })
      pulsed.push(player.id)
      const hitDiff = Math.min(MAX_HITS_PER_SNAPSHOT, Math.max(1, (player.gold ?? 0) - before.gold))
      for (let i = 0; i < hitDiff; i += 1) stamps.push(stamp)
    }
    if (added.length === 0) return

    setFeed((prev) => [...added.reverse(), ...prev].slice(0, FEED_LIMIT))
    setPulses((prev) => {
      const next = { ...prev }
      pulsed.forEach((id) => {
        next[id] = (next[id] ?? 0) + 1
      })
      return next
    })
    setHitTimes((prev) => [...prev.filter((time) => stamp - time <= FIREPOWER_WINDOW_MS), ...stamps])
  }, [activePlayers, isPlaying])

  // 창 밖으로 밀려나는 명중이 게이지에서 빠지도록 1초마다 다시 센다
  useEffect(() => {
    if (!isPlaying) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [isPlaying])

  const recentHits = useMemo(
    () => hitTimes.filter((time) => now - time <= FIREPOWER_WINDOW_MS).length,
    [hitTimes, now],
  )

  return { feed, pulses, recentHits }
}
