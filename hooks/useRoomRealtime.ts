import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Room = Database['public']['Tables']['rooms']['Row']

interface UseRoomRealtimeOptions {
  roomCode: string
  onRoomUpdate?: (room: Room) => void
}

export function useRoomRealtime({ roomCode, onRoomUpdate }: UseRoomRealtimeOptions) {
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // 초기 데이터 로드
    const loadInitialRoom = async () => {
      try {
        setLoading(true)
        const { data, error: fetchError } = await supabase
          .from('rooms')
          .select('*')
          .eq('room_code', roomCode)
          .single()

        if (fetchError) throw fetchError
        setRoom(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load room'))
        console.error('Error loading room:', err)
      } finally {
        setLoading(false)
      }
    }

    if (roomCode) {
      loadInitialRoom()
    } else {
      setLoading(false)
    }

    // Realtime 구독 설정
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
          console.log('Room update event:', payload)
          if (payload.new) {
            const updatedRoom = payload.new as Room
            setRoom(updatedRoom)
            onRoomUpdate?.(updatedRoom)
          }
        }
      )
      .subscribe((status) => {
        console.log('Room subscription status:', status)
      })

    // 클린업
    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomCode, onRoomUpdate])

  return { room, loading, error }
}
