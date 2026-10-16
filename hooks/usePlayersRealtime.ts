import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, checkSupabaseConfig } from '@/lib/supabase/client'
import { releaseRealtimeChannel } from '@/lib/supabase/realtimeLifecycle'
import {
  subscribeRoomRuntimeEvent,
  type PlayerPatchPayload,
} from '@/lib/realtime/roomChannel'
import { sortPlayersByScore } from '@/lib/utils/playerSorting'
import { normalizePlayerDisplayFields } from '@/lib/utils/playerDisplay'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']
type PlayerPatch = Partial<Player> & Record<string, unknown>

interface UsePlayersRealtimeOptions {
  roomCode: string
  enabled?: boolean
  onPlayerInsert?: (player: Player) => void
  onPlayerDelete?: (player: Player) => void
  /**
   * 주기적 재동기화 간격(ms). 점수/상태는 평소 player:patch broadcast로 즉시 반영되지만,
   * broadcast는 전달 보장이 없어(fire-and-forget) 패킷이 누락되면 게임이 끝날 때까지
   * 점수가 멈춰 보일 수 있다. 시간 기반으로 가볍게 DB를 다시 읽어 누락분을 메운다.
   * (액션마다가 아니라 시간 기반이라 write 폭증과 무관) 0이면 비활성.
   */
  reconcileIntervalMs?: number
}

const DEFAULT_RECONCILE_INTERVAL_MS = 3000

type RefreshOptions = {
  silent?: boolean
}

function normalizePlayer(player: Player): Player {
  return normalizePlayerDisplayFields(player)
}

/**
 * 같은 점수 변화가 두 경로로 중복 도착한다:
 *   (1) player:patch broadcast  (2) 3초 주기 재동기화 SELECT
 * 매번 새 배열을 만들면 내용이 똑같아도 참조가 바뀌어 참가자 목록을 쓰는 화면 전체가
 * 다시 그려진다. 학생 30명 방에서는 이게 초당 여러 번 일어나 저사양 태블릿에서 끊긴다.
 * 내용이 같으면 이전 배열을 그대로 돌려줘서 리렌더를 건너뛴다.
 */
function isSamePlayer(a: Player | undefined, b: Player): boolean {
  return a !== undefined && JSON.stringify(a) === JSON.stringify(b)
}

function isSamePlayerList(prev: Player[], next: Player[]): boolean {
  if (prev.length !== next.length) return false
  for (let i = 0; i < prev.length; i += 1) {
    if (JSON.stringify(prev[i]) !== JSON.stringify(next[i])) return false
  }
  return true
}

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || 'Failed to load players')
  }
  return 'Failed to load players'
}

function isTransientFetchFailure(error: unknown): boolean {
  const message = getLoadErrorMessage(error)
  return message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('Load failed')
}

export function usePlayersRealtime({
  roomCode,
  enabled = true,
  onPlayerInsert,
  onPlayerDelete,
  reconcileIntervalMs = DEFAULT_RECONCILE_INTERVAL_MS,
}: UsePlayersRealtimeOptions) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadSeqRef = useRef(0)
  // 비-silent 조회가 loading=true를 켠 뒤, silent 재동기화가 seq를 앞질러도 마지막에 끝나는
  // 조회가 loading을 꺼주도록 한다. (안 그러면 초기 조회가 silent에 추월당해 '로딩 중'에 영원히 갇힘)
  const loadingPendingRef = useRef(false)
  const onPlayerInsertRef = useRef(onPlayerInsert)
  const onPlayerDeleteRef = useRef(onPlayerDelete)

  useEffect(() => {
    onPlayerInsertRef.current = onPlayerInsert
  }, [onPlayerInsert])

  useEffect(() => {
    onPlayerDeleteRef.current = onPlayerDelete
  }, [onPlayerDelete])

  const applyPlayerPatch = useCallback((playerId: string, patch: PlayerPatch) => {
    setPlayers((prev) => {
      let didPatch = false
      const next = prev.map((player) => {
        if (player.id !== playerId) return player
        const patched = normalizePlayer({ ...player, ...patch, id: player.id } as Player)
        if (isSamePlayer(player, patched)) return player
        didPatch = true
        return patched
      })
      return didPatch ? sortPlayersByScore(next) : prev
    })
  }, [])

  const refreshPlayers = useCallback(async ({ silent = false }: RefreshOptions = {}) => {
    if (!enabled) {
      setPlayers([])
      setLoading(false)
      setError(null)
      return
    }

    if (!roomCode) {
      setPlayers([])
      setLoading(false)
      setError(null)
      return
    }

    const configCheck = checkSupabaseConfig()
    if (!configCheck.isValid) {
      setError(new Error(configCheck.error || 'Supabase 환경 변수가 설정되지 않았습니다.'))
      setLoading(false)
      return
    }

    const seq = ++loadSeqRef.current
    if (!silent) {
      loadingPendingRef.current = true
      setLoading(true)
    }

    try {
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('players')
        .select('*')
        .eq('room_code', roomCode)
        .order('score', { ascending: false })

      if (fetchError) throw fetchError

      if (seq === loadSeqRef.current) {
        const fetched = sortPlayersByScore(((data ?? []) as Player[]).map(normalizePlayer))
        setPlayers((prev) => (isSamePlayerList(prev, fetched) ? prev : fetched))
      }
    } catch (err) {
      if (seq === loadSeqRef.current) {
        const errorMessage = getLoadErrorMessage(err)
        if (isTransientFetchFailure(err)) {
          // Supabase 네트워크가 잠깐 흔들리는 동안 Next dev overlay가 뜨지 않도록 기존 목록을 유지합니다.
          console.warn('플레이어 실시간 갱신 일시 실패:', errorMessage)
          setError(null)
          return
        }

        console.warn('플레이어 로드 실패:', errorMessage)
        setError(new Error(errorMessage))
      }
    } finally {
      if (seq === loadSeqRef.current && loadingPendingRef.current) {
        loadingPendingRef.current = false
        setLoading(false)
      }
    }
  }, [enabled, roomCode])

  useEffect(() => {
    if (!enabled || !roomCode) {
      setPlayers([])
      setLoading(false)
      setError(null)
      return
    }

    const configCheck = checkSupabaseConfig()
    if (!configCheck.isValid) {
      setError(new Error(configCheck.error || 'Supabase 환경 변수가 설정되지 않았습니다.'))
      setLoading(false)
      return
    }

    void refreshPlayers()

    // 점수·상태 변경(UPDATE)은 postgres_changes로 받지 않는다. 행 하나가 바뀔 때마다 방 전체
    // 구독자 수만큼 Realtime 메시지가 나가서(답 하나에 broadcast와 합쳐 약 3N개) 메시지 한도를
    // 가장 먼저 잡아먹던 경로다. 대신 player:patch broadcast가 즉시 반영을, 3초 재동기화가
    // 누락분을 맡는다. 그래서 players를 바꾸는 코드는 commitPlayerPatch처럼 반드시 broadcast해야 한다.
    // 입장(INSERT)과 퇴장(DELETE)은 드물어서 그대로 구독한다.
    const channel = supabase
      .channel(`players:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'players',
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          if (payload.new) {
            const newPlayer = normalizePlayer(payload.new as Player)
            setPlayers((prev) => {
              const exists = prev.some((player) => player.id === newPlayer.id)
              if (exists) return prev
              return sortPlayersByScore([...prev, newPlayer])
            })
            onPlayerInsertRef.current?.(newPlayer)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'players',
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          if (!payload.old) return
          const deletedPlayer = normalizePlayer(payload.old as Player)
          setPlayers((prev) => prev.filter((player) => player.id !== deletedPlayer.id))
          onPlayerDeleteRef.current?.(deletedPlayer)
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          void refreshPlayers({ silent: true })
        }
      })

    return () => {
      releaseRealtimeChannel(channel)
    }
  }, [enabled, refreshPlayers, roomCode])

  useEffect(() => {
    if (!enabled || !roomCode) return

    return subscribeRoomRuntimeEvent((event) => {
      if (event.roomCode !== roomCode) return

      if (event.type === 'player:patch') {
        const payload = event.payload as PlayerPatchPayload | undefined
        if (payload?.playerId && payload.patch) {
          applyPlayerPatch(payload.playerId, payload.patch)
        }
        return
      }

      // game:finished 때만 최종 점수를 DB에서 새로 읽는다.
      // room:snapshot-hint는 player:patch broadcast로 이미 반영됐으므로 전체 재조회 불필요.
      if (event.type === 'game:finished') {
        void refreshPlayers({ silent: true })
      }
    })
  }, [applyPlayerPatch, enabled, refreshPlayers, roomCode])

  // 주기적 재동기화: broadcast로 못 받은(누락된) 점수/상태 변화를 메우는 안전망.
  // 탭이 보일 때만 돌려 백그라운드 낭비를 막는다.
  useEffect(() => {
    if (!enabled || !roomCode || reconcileIntervalMs <= 0) return
    if (typeof window === 'undefined') return

    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void refreshPlayers({ silent: true })
    }

    const intervalId = window.setInterval(tick, reconcileIntervalMs)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [enabled, roomCode, reconcileIntervalMs, refreshPlayers])

  return {
    players,
    loading,
    error,
    refreshPlayers,
    applyPlayerPatch,
  }
}
