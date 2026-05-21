import { useCallback } from 'react'

type RefreshOptions = {
  silent?: boolean
}

type RefreshFn = (options?: RefreshOptions) => Promise<unknown>

export function useRoomResync(
  refreshRoom: RefreshFn,
  refreshPlayers: RefreshFn,
) {
  return useCallback(async (reason?: string) => {
    if (reason === 'broadcast_hint') return
    await Promise.all([
      refreshRoom({ silent: true }),
      refreshPlayers({ silent: true }),
    ])
  }, [refreshPlayers, refreshRoom])
}
