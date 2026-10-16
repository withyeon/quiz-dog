import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, checkSupabaseConfig } from '@/lib/supabase/client'
import { releaseRealtimeChannel } from '@/lib/supabase/realtimeLifecycle'
import {
  subscribeRoomRuntimeEvent,
  type RoomPatchPayload,
} from '@/lib/realtime/roomChannel'
import { isRelayRoomTransport } from '@/lib/realtime/transport'
import type { Database } from '@/types/database.types'

type Room = Database['public']['Tables']['rooms']['Row']
type RoomPatch = Partial<Room> & Record<string, unknown>

interface UseRoomRealtimeOptions {
  roomCode: string
  enabled?: boolean
  onRoomUpdate?: (room: Room) => void
}

type RefreshOptions = {
  silent?: boolean
}

/**
 * 방 재조회 간격. Supabase 모드는 rooms UPDATE 구독이 있어 이건 보조라 2초 그대로 둔다.
 * 중계 서버 모드는 교사 화면의 room:patch가 주 경로고, 학생마다 쿼리가 방 수만큼 곱해지므로 5초로 둔다.
 */
const ROOM_RECONCILE_INTERVAL_MS = isRelayRoomTransport ? 5000 : 2000
/** 평소에는 updated_at이 바뀌었을 때만 행을 받고, 이 간격마다 한 번은 그냥 다시 읽는다(삭제·놓친 변경 대비) */
const ROOM_FULL_READ_INTERVAL_MS = 30_000

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || 'Failed to load room')
  }
  return 'Failed to load room'
}

function isTransientFetchFailure(error: unknown): boolean {
  const message = getLoadErrorMessage(error)
  return message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('Load failed')
}

/**
 * 방 정보는 주기적으로 다시 읽고(누락 대비 안전망) postgres_changes(또는 중계 서버의 room:patch)로도 들어온다.
 * 내용이 그대로여도 setRoom에 새 객체를 넣으면 참조가 바뀌어 게임 화면 전체가
 * 다시 그려진다 — 아무 일도 없는데 모든 기기가 2초마다 리렌더되던 원인이다.
 * 내용이 같으면 이전 객체를 유지해 리렌더를 건너뛴다.
 */
function isSameRoom(a: Room | null, b: Room | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

export function useRoomRealtime({
  roomCode,
  enabled = true,
  onRoomUpdate,
}: UseRoomRealtimeOptions) {
  const [room, setRoom] = useState<Room | null>(null)
  // setRoom 갱신 함수는 언제 실행될지 보장되지 않으므로,
  // "내용이 바뀌었는가" 판단은 항상 이 ref로 동기적으로 한다.
  const roomRef = useRef<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadSeqRef = useRef(0)
  // 비-silent 조회가 loading=true를 켠 뒤, silent 재동기화가 seq를 앞질러도 마지막에 끝나는
  // 조회가 loading을 꺼주도록 한다. (안 그러면 초기 조회가 silent에 추월당해 '로딩 중'에 영원히 갇힘)
  const loadingPendingRef = useRef(false)
  /** DB에서 마지막으로 받은 방 행의 updated_at 원문. 바뀐 경우에만 행을 받는 재조회의 기준 */
  const serverUpdatedAtRef = useRef<string | null>(null)
  const lastFullReadAtRef = useRef(0)
  const onRoomUpdateRef = useRef(onRoomUpdate)

  useEffect(() => {
    onRoomUpdateRef.current = onRoomUpdate
  }, [onRoomUpdate])

  /** 내용이 실제로 바뀔 때만 상태를 교체하고 onRoomUpdate를 알린다. */
  const commitRoom = useCallback((next: Room | null) => {
    if (isSameRoom(roomRef.current, next)) return false
    roomRef.current = next
    setRoom(next)
    if (next) onRoomUpdateRef.current?.(next)
    return true
  }, [])

  const applyRoomPatch = useCallback((patch: RoomPatch) => {
    const prev = roomRef.current
    if (!prev) return
    commitRoom({ ...prev, ...patch, room_code: prev.room_code } as Room)
  }, [commitRoom])

  const refreshRoom = useCallback(async ({ silent = false }: RefreshOptions = {}) => {
    if (!enabled) {
      roomRef.current = null
      setRoom(null)
      setLoading(false)
      setError(null)
      return
    }

    if (!roomCode) {
      roomRef.current = null
      setRoom(null)
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
        .from('rooms')
        .select('*')
        .eq('room_code', roomCode)
        .maybeSingle()

      if (fetchError) throw fetchError

      if (seq === loadSeqRef.current) {
        commitRoom(data)
        serverUpdatedAtRef.current = (data as Room | null)?.updated_at ?? null
        lastFullReadAtRef.current = Date.now()
      }
    } catch (err) {
      if (seq === loadSeqRef.current) {
        const errorMessage = getLoadErrorMessage(err)
        if (isTransientFetchFailure(err)) {
          // 일시적인 REST fetch 실패는 기존 room 상태를 유지하고 개발 오버레이를 띄우지 않습니다.
          console.warn('방 실시간 갱신 일시 실패:', errorMessage)
          setError(null)
          return
        }

        setError(new Error(errorMessage))
        console.warn('방 로드 실패:', errorMessage)
      }
    } finally {
      if (seq === loadSeqRef.current && loadingPendingRef.current) {
        loadingPendingRef.current = false
        setLoading(false)
      }
    }
  }, [commitRoom, enabled, roomCode])

  useEffect(() => {
    if (!enabled || !roomCode) {
      roomRef.current = null
      setRoom(null)
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

    serverUpdatedAtRef.current = null
    lastFullReadAtRef.current = 0
    void refreshRoom()

    // 중계 서버 모드: Supabase Realtime 소켓을 열지 않는다. 방 상태 변경은 room:patch 이벤트와 재조회로 받는다.
    if (isRelayRoomTransport) return

    const channel = supabase
      .channel(`room:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          if (payload.new) {
            commitRoom(payload.new as Room)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          void refreshRoom({ silent: true })
        }
      })

    return () => {
      releaseRealtimeChannel(channel)
    }
  }, [commitRoom, enabled, refreshRoom, roomCode])

  useEffect(() => {
    if (!enabled || !roomCode) return

    return subscribeRoomRuntimeEvent((event) => {
      if (event.roomCode !== roomCode) return

      if (event.type === 'room:patch') {
        const payload = event.payload as RoomPatchPayload | undefined
        if (payload?.patch) {
          applyRoomPatch(payload.patch)
        }
        return
      }

      if (event.type === 'game:finished') {
        applyRoomPatch({ status: 'finished' })
        void refreshRoom({ silent: true })
        return
      }

      // room:patch broadcast로 이미 로컬 상태가 반영됐으므로 snapshot-hint마다 재조회 불필요.
    })
  }, [applyRoomPatch, enabled, refreshRoom, roomCode])

  // Realtime은 가장 빠른 경로지만, 모바일 절전·교실 Wi-Fi 전환·DB publication
  // 지연으로 이벤트 하나가 빠질 수 있다. 짧은 스냅샷 재조정을 함께 두어 모든
  // 클라이언트가 종료/일시정지 같은 권위 상태로 빠르게 수렴하게 한다.
  // 재조회는 마지막으로 본 updated_at보다 새로울 때만 행을 받는다(안 바뀌었으면 빈 응답).
  // 학생 수 × 방 수만큼 도는 쿼리라 응답 크기를 줄이는 게 egress에 크다.
  const reconcileRoom = useCallback(async () => {
    if (!enabled || !roomCode || !checkSupabaseConfig().isValid) return
    const since = serverUpdatedAtRef.current
    if (!since || Date.now() - lastFullReadAtRef.current >= ROOM_FULL_READ_INTERVAL_MS) {
      await refreshRoom({ silent: true })
      return
    }

    const seq = loadSeqRef.current
    try {
      const { data, error: fetchError } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', roomCode)
        .gt('updated_at', since)
        .maybeSingle()
      if (fetchError) throw fetchError
      if (!data || seq !== loadSeqRef.current) return
      commitRoom(data as Room)
      serverUpdatedAtRef.current = (data as Room).updated_at ?? since
    } catch (err) {
      console.warn('방 재조회 실패:', getLoadErrorMessage(err))
    }
  }, [commitRoom, enabled, refreshRoom, roomCode])

  useEffect(() => {
    if (!enabled || !roomCode || typeof window === 'undefined') return

    const reconcile = () => {
      if (document.visibilityState === 'visible') {
        void reconcileRoom()
      }
    }
    // 탭으로 돌아오면 그냥 다시 읽는다
    const onReturn = () => {
      if (document.visibilityState === 'visible') {
        void refreshRoom({ silent: true })
      }
    }

    const intervalId = window.setInterval(reconcile, ROOM_RECONCILE_INTERVAL_MS)
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onReturn)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onReturn)
    }
  }, [enabled, reconcileRoom, refreshRoom, roomCode])

  return {
    room,
    loading,
    error,
    refreshRoom,
    applyRoomPatch,
  }
}
