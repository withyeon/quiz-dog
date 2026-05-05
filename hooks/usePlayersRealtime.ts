import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, checkSupabaseConfig } from '@/lib/supabase/client'
import {
  subscribeRoomRuntimeEvent,
  type PlayerPatchPayload,
} from '@/lib/realtime/roomChannel'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']
type PlayerPatch = Partial<Player> & Record<string, unknown>

interface UsePlayersRealtimeOptions {
  roomCode: string
  enabled?: boolean
  onPlayerUpdate?: (player: Player) => void
  onPlayerInsert?: (player: Player) => void
  onPlayerDelete?: (player: Player) => void
}

type RefreshOptions = {
  silent?: boolean
}

function sortPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const scoreCompare = (b.score ?? 0) - (a.score ?? 0)
    if (scoreCompare !== 0) return scoreCompare
    return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
  })
}

export function usePlayersRealtime({
  roomCode,
  enabled = true,
  onPlayerUpdate,
  onPlayerInsert,
  onPlayerDelete,
}: UsePlayersRealtimeOptions) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadSeqRef = useRef(0)
  const onPlayerUpdateRef = useRef(onPlayerUpdate)
  const onPlayerInsertRef = useRef(onPlayerInsert)
  const onPlayerDeleteRef = useRef(onPlayerDelete)

  useEffect(() => {
    onPlayerUpdateRef.current = onPlayerUpdate
  }, [onPlayerUpdate])

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
        didPatch = true
        return { ...player, ...patch, id: player.id } as Player
      })
      return didPatch ? sortPlayers(next) : prev
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
    if (!silent) setLoading(true)

    try {
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('players')
        .select('*')
        .eq('room_code', roomCode)
        .order('score', { ascending: false })

      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to load players')
      }

      if (seq === loadSeqRef.current) {
        setPlayers(sortPlayers((data ?? []) as Player[]))
      }
    } catch (err) {
      if (seq === loadSeqRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load players'
        console.error('플레이어 로드 실패:', errorMessage, err)
        setError(new Error(errorMessage))
      }
    } finally {
      if (seq === loadSeqRef.current && !silent) {
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
          if (payload.eventType === 'INSERT' && payload.new) {
            const newPlayer = payload.new as Player
            setPlayers((prev) => {
              const exists = prev.some((player) => player.id === newPlayer.id)
              if (exists) return prev
              return sortPlayers([...prev, newPlayer])
            })
            onPlayerInsertRef.current?.(newPlayer)
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedPlayer = payload.new as Player
            setPlayers((prev) =>
              sortPlayers(prev.map((player) => (
                player.id === updatedPlayer.id ? updatedPlayer : player
              )))
            )
            onPlayerUpdateRef.current?.(updatedPlayer)
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const deletedPlayer = payload.old as Player
            setPlayers((prev) => prev.filter((player) => player.id !== deletedPlayer.id))
            onPlayerDeleteRef.current?.(deletedPlayer)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          void refreshPlayers({ silent: true })
        }
      })

    return () => {
      supabase.removeChannel(channel)
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

      if (
        event.type === 'room:snapshot-hint'
        || event.type === 'game:finished'
        || event.type === 'room:patch'
      ) {
        void refreshPlayers({ silent: true })
      }
    })
  }, [applyPlayerPatch, enabled, refreshPlayers, roomCode])

  return {
    players,
    loading,
    error,
    refreshPlayers,
    applyPlayerPatch,
  }
}
