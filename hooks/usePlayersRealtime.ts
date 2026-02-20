import { useEffect, useState } from 'react'
import { supabase, checkSupabaseConfig } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

interface UsePlayersRealtimeOptions {
  roomCode: string
  onPlayerUpdate?: (player: Player) => void
  onPlayerInsert?: (player: Player) => void
  onPlayerDelete?: (player: Player) => void
}

export function usePlayersRealtime({
  roomCode,
  onPlayerUpdate,
  onPlayerInsert,
  onPlayerDelete,
}: UsePlayersRealtimeOptions) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Supabase 설정 확인
    const configCheck = checkSupabaseConfig()
    if (!configCheck.isValid) {
      setError(new Error(configCheck.error || 'Supabase 환경 변수가 설정되지 않았습니다.'))
      setLoading(false)
      return
    }

    // roomCode가 없으면 로드하지 않음
    if (!roomCode) {
      setLoading(false)
      return
    }

    // 초기 데이터 로드
    const loadInitialPlayers = async () => {
      try {
        setLoading(true)
        setError(null)
        
        console.log('플레이어 로드 시도:', roomCode)
        const { data, error: fetchError } = await supabase
          .from('players')
          .select('*')
          .eq('room_code', roomCode)
          .order('score', { ascending: false })

        if (fetchError) {
          console.error('Supabase 에러:', fetchError)
          throw new Error(fetchError.message || 'Failed to load players')
        }
        
        console.log('플레이어 로드 성공:', data?.length || 0, '명')
        setPlayers(data || [])
        setError(null)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load players'
        console.error('플레이어 로드 실패:', errorMessage, err)
        setError(new Error(errorMessage))
      } finally {
        setLoading(false)
      }
    }

    loadInitialPlayers()

    // Realtime 구독 설정
    const channel = supabase
      .channel(`players:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          console.log('Realtime event:', payload)

          if (payload.eventType === 'INSERT' && payload.new) {
            const newPlayer = payload.new as Player
            setPlayers((prev) => {
              const exists = prev.find((p) => p.id === newPlayer.id)
              if (exists) return prev
              return [...prev, newPlayer].sort((a, b) => b.score - a.score)
            })
            onPlayerInsert?.(newPlayer)
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedPlayer = payload.new as Player
            setPlayers((prev) =>
              prev
                .map((p) => (p.id === updatedPlayer.id ? updatedPlayer : p))
                .sort((a, b) => b.score - a.score)
            )
            onPlayerUpdate?.(updatedPlayer)
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const deletedPlayer = payload.old as Player
            setPlayers((prev) => prev.filter((p) => p.id !== deletedPlayer.id))
            onPlayerDelete?.(deletedPlayer)
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to players changes')
        }
      })

    // 클린업
    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomCode, onPlayerUpdate, onPlayerInsert, onPlayerDelete])

  return { players, loading, error }
}

