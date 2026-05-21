import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, checkSupabaseConfig } from '@/lib/supabase/client'
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
  onPlayerUpdate?: (player: Player) => void
  onPlayerInsert?: (player: Player) => void
  onPlayerDelete?: (player: Player) => void
}

type RefreshOptions = {
  silent?: boolean
}

function normalizePlayer(player: Player): Player {
  return normalizePlayerDisplayFields(player)
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
        return normalizePlayer({ ...player, ...patch, id: player.id } as Player)
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
    if (!silent) setLoading(true)

    try {
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('players')
        .select('*')
        .eq('room_code', roomCode)
        .order('score', { ascending: false })

      if (fetchError) throw fetchError

      if (seq === loadSeqRef.current) {
        setPlayers(sortPlayersByScore(((data ?? []) as Player[]).map(normalizePlayer)))
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
            const newPlayer = normalizePlayer(payload.new as Player)
            setPlayers((prev) => {
              const exists = prev.some((player) => player.id === newPlayer.id)
              if (exists) return prev
              return sortPlayersByScore([...prev, newPlayer])
            })
            onPlayerInsertRef.current?.(newPlayer)
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedPlayer = normalizePlayer(payload.new as Player)
            setPlayers((prev) =>
              sortPlayersByScore(prev.map((player) => (
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
