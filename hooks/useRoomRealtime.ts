import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, checkSupabaseConfig } from '@/lib/supabase/client'
import {
  subscribeRoomRuntimeEvent,
  type RoomPatchPayload,
} from '@/lib/realtime/roomChannel'
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

export function useRoomRealtime({
  roomCode,
  enabled = true,
  onRoomUpdate,
}: UseRoomRealtimeOptions) {
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadSeqRef = useRef(0)
  const onRoomUpdateRef = useRef(onRoomUpdate)

  useEffect(() => {
    onRoomUpdateRef.current = onRoomUpdate
  }, [onRoomUpdate])

  const applyRoomPatch = useCallback((patch: RoomPatch) => {
    setRoom((prev) => {
      if (!prev) return prev
      const nextRoom = { ...prev, ...patch, room_code: prev.room_code } as Room
      onRoomUpdateRef.current?.(nextRoom)
      return nextRoom
    })
  }, [])

  const refreshRoom = useCallback(async ({ silent = false }: RefreshOptions = {}) => {
    if (!enabled) {
      setRoom(null)
      setLoading(false)
      setError(null)
      return
    }

    if (!roomCode) {
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
    if (!silent) setLoading(true)

    try {
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', roomCode)
        .maybeSingle()

      if (fetchError) throw fetchError

      if (seq === loadSeqRef.current) {
        setRoom(data)
        if (data) onRoomUpdateRef.current?.(data)
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
      if (seq === loadSeqRef.current && !silent) {
        setLoading(false)
      }
    }
  }, [enabled, roomCode])

  useEffect(() => {
    if (!enabled || !roomCode) {
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

    void refreshRoom()

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
            const updatedRoom = payload.new as Room
            setRoom(updatedRoom)
            onRoomUpdateRef.current?.(updatedRoom)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          void refreshRoom({ silent: true })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, refreshRoom, roomCode])

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
  useEffect(() => {
    if (!enabled || !roomCode || typeof window === 'undefined') return

    const reconcile = () => {
      if (document.visibilityState === 'visible') {
        void refreshRoom({ silent: true })
      }
    }

    const intervalId = window.setInterval(reconcile, 2000)
    window.addEventListener('focus', reconcile)
    document.addEventListener('visibilitychange', reconcile)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', reconcile)
      document.removeEventListener('visibilitychange', reconcile)
    }
  }, [enabled, refreshRoom, roomCode])

  return {
    room,
    loading,
    error,
    refreshRoom,
    applyRoomPatch,
  }
}
