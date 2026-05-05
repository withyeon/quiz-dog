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
        setError(err instanceof Error ? err : new Error('Failed to load room'))
        console.error('Error loading room:', err)
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

      if (event.type === 'room:snapshot-hint') {
        void refreshRoom({ silent: true })
      }
    })
  }, [applyRoomPatch, enabled, refreshRoom, roomCode])

  return {
    room,
    loading,
    error,
    refreshRoom,
    applyRoomPatch,
  }
}
