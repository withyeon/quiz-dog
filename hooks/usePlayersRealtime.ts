import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, checkSupabaseConfig } from '@/lib/supabase/client'
import { releaseRealtimeChannel } from '@/lib/supabase/realtimeLifecycle'
import {
  subscribeRoomRuntimeEvent,
  type PlayerJoinedPayload,
  type PlayerPatchPayload,
} from '@/lib/realtime/roomChannel'
import { isRelayRoomTransport } from '@/lib/realtime/transport'
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

/**
 * 중계 서버 모드는 DB 변경 구독이 없어 재동기화가 유일한 안전망이지만, 학생 한 명당 쿼리 수가
 * 방 수만큼 곱해지므로 5초로 둔다(점수는 broadcast로 즉시 오고, 이건 누락분만 메운다).
 */
const DEFAULT_RECONCILE_INTERVAL_MS = isRelayRoomTransport ? 5000 : 3000
/** 바뀐 행만 읽는 재동기화 사이사이에, 이 간격마다 한 번은 방 전체 목록을 읽어 삭제·누락을 바로잡는다 */
const FULL_LIST_INTERVAL_MS = 30_000
/**
 * updated_at은 트랜잭션 시작 시각이라 커밋이 늦은 행은 이미 읽은 시각보다 과거 값으로 나타날 수 있다.
 * 바뀐 행을 찾을 때 이만큼 겹쳐 읽는다.
 */
const DELTA_OVERLAP_MS = 2000

/**
 * 주기 재동기화가 읽지 않는 컬럼. answer_history·attempts는 문제를 풀수록 커지는 JSON이라,
 * 학생마다 몇 초에 한 번씩 방 전체 것을 받으면 DB egress 대부분을 차지한다.
 * 게임 화면은 이 둘을 처음 불러올 때(새로고침 복구)만 읽으므로, 재동기화 때는 기존 값을 그대로 둔다.
 * 결과·리포트 화면과 눈싸움 팀 배정처럼 최신 값이 필요한 곳은 따로 새로 읽는다.
 */
const LEAN_PLAYER_COLUMNS = [
  'id', 'room_code', 'nickname', 'score', 'gold', 'avatar', 'is_online',
  'current_question_index', 'combo_count', 'has_umbrella', 'pending_attacks', 'is_kicked', 'position',
  'active_item', 'item_effects', 'health', 'attack_power', 'defense', 'player_class', 'team', 'revival_streak',
  'caught_dolls', 'claw_points', 'caught_fishes', 'fishing_points', 'factories', 'factory_money',
  'convenience_products', 'convenience_money', 'cafe_cash', 'cafe_customers_served', 'mafia_cash', 'mafia_diamonds',
  'created_at', 'updated_at', 'started_at',
].join(',')
const HEAVY_PLAYER_COLUMNS = ['answer_history', 'attempts'] as const

type RefreshOptions = {
  silent?: boolean
}

function normalizePlayer(player: Player): Player {
  return normalizePlayerDisplayFields(player)
}

/**
 * 같은 점수 변화가 두 경로로 중복 도착한다:
 *   (1) player:patch broadcast  (2) 주기 재동기화 SELECT
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

/** 컬럼을 골라 읽었는데 그 컬럼이 없는 구형 스키마 (PostgREST 42703) */
function isMissingColumnError(error: unknown): boolean {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : ''
  return code === '42703' || /column .* does not exist/i.test(getLoadErrorMessage(error))
}

function newestUpdatedAt(rows: Player[]): number | null {
  let newest: number | null = null
  for (const row of rows) {
    const at = row.updated_at ? Date.parse(row.updated_at) : NaN
    if (!Number.isNaN(at) && (newest === null || at > newest)) newest = at
  }
  return newest
}

/** 재동기화로 받은 가벼운 행에, 이전에 들고 있던 큰 컬럼을 그대로 붙인다 */
function withKeptHeavyColumns(row: Player, previous: Player | undefined): Player {
  if (!previous) return row
  const merged: Record<string, unknown> = { ...row }
  for (const column of HEAVY_PLAYER_COLUMNS) {
    if (!(column in row) && column in previous) merged[column] = previous[column]
  }
  return merged as Player
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
  // 전체 조회(첫 로드·게임 종료·재동기화 요청)가 끝나기 전에는 가벼운 재동기화를 돌리지 않는다.
  // 가벼운 결과가 첫 로드를 앞지르면 큰 컬럼 없이 목록이 채워져 새로고침 복구가 빈 기록을 읽게 된다.
  const fullLoadsInFlightRef = useRef(0)
  const hasFullLoadRef = useRef(false)
  /** DB에서 받은 행 중 가장 최근 updated_at(ms). 바뀐 행만 읽을 때 기준이 된다 */
  const cursorRef = useRef<number | null>(null)
  const lastFullListAtRef = useRef(0)
  const leanColumnsSupportedRef = useRef(true)
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
    fullLoadsInFlightRef.current += 1
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
        const rows = (data ?? []) as Player[]
        const fetched = sortPlayersByScore(rows.map(normalizePlayer))
        setPlayers((prev) => (isSamePlayerList(prev, fetched) ? prev : fetched))
        hasFullLoadRef.current = true
        lastFullListAtRef.current = Date.now()
        const newest = newestUpdatedAt(rows)
        if (newest !== null) cursorRef.current = Math.max(cursorRef.current ?? 0, newest)
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
      fullLoadsInFlightRef.current -= 1
      if (seq === loadSeqRef.current && loadingPendingRef.current) {
        loadingPendingRef.current = false
        setLoading(false)
      }
    }
  }, [enabled, roomCode])

  /**
   * 주기 재동기화. 큰 컬럼을 빼고(LEAN_PLAYER_COLUMNS), 평소에는 마지막으로 본 updated_at 이후 바뀐 행만 읽는다.
   * FULL_LIST_INTERVAL_MS마다(또는 forceFullList일 때) 방 전체 목록을 읽어 삭제된 행과 놓친 행을 바로잡는다.
   * 결과는 기존 목록에 합치고, 큰 컬럼은 들고 있던 값을 유지한다.
   */
  const reconcilePlayers = useCallback(async ({ forceFullList = false }: { forceFullList?: boolean } = {}) => {
    if (!enabled || !roomCode) return
    if (!hasFullLoadRef.current || fullLoadsInFlightRef.current > 0) return
    if (!checkSupabaseConfig().isValid) return

    const seq = loadSeqRef.current
    const cursor = cursorRef.current
    const fullList = forceFullList || cursor === null || Date.now() - lastFullListAtRef.current >= FULL_LIST_INTERVAL_MS
    const columns = leanColumnsSupportedRef.current ? LEAN_PLAYER_COLUMNS : '*'

    try {
      // 고르는 컬럼이 문자열 변수라 supabase-js의 행 타입 추론을 쓸 수 없다
      let query = (supabase.from('players') as any).select(columns).eq('room_code', roomCode)
      if (!fullList && cursor !== null) {
        query = query.gte('updated_at', new Date(cursor - DELTA_OVERLAP_MS).toISOString())
      }
      const { data, error: fetchError } = await query
      if (fetchError) {
        if (leanColumnsSupportedRef.current && isMissingColumnError(fetchError)) {
          // 구형 스키마: 이후로는 전체 컬럼을 읽는다
          leanColumnsSupportedRef.current = false
          return
        }
        throw fetchError
      }
      // 그사이 전체 조회가 시작됐으면 그 결과가 더 권위 있다
      if (seq !== loadSeqRef.current || fullLoadsInFlightRef.current > 0) return

      const rows = (data ?? []) as Player[]
      if (fullList) lastFullListAtRef.current = Date.now()
      const newest = newestUpdatedAt(rows)
      if (newest !== null) cursorRef.current = Math.max(cursorRef.current ?? 0, newest)
      if (!fullList && rows.length === 0) return

      setPlayers((prev) => {
        const previousById = new Map(prev.map((player) => [player.id, player]))
        const merge = (row: Player): Player => {
          const previous = previousById.get(row.id)
          const merged = normalizePlayer(withKeptHeavyColumns(row, previous))
          return previous && isSamePlayer(previous, merged) ? previous : merged
        }
        let next: Player[]
        if (fullList) {
          next = rows.map(merge)
        } else {
          const byId = new Map(previousById)
          for (const row of rows) byId.set(row.id, merge(row))
          next = [...byId.values()]
        }
        next = sortPlayersByScore(next)
        return isSamePlayerList(prev, next) ? prev : next
      })
    } catch (err) {
      if (seq !== loadSeqRef.current) return
      const errorMessage = getLoadErrorMessage(err)
      if (isTransientFetchFailure(err)) {
        console.warn('플레이어 실시간 갱신 일시 실패:', errorMessage)
        return
      }
      console.warn('플레이어 재동기화 실패:', errorMessage)
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

    hasFullLoadRef.current = false
    cursorRef.current = null
    lastFullListAtRef.current = 0
    void refreshPlayers()

    // 중계 서버 모드: Supabase Realtime 소켓을 열지 않는다. 입장은 player:joined 이벤트로,
    // 퇴장(행 삭제, 드묾)은 주기 재동기화의 전체 목록으로 반영한다.
    if (isRelayRoomTransport) return

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

      if (event.type === 'player:joined') {
        const joined = (event.payload as PlayerJoinedPayload | undefined)?.player
        if (!joined?.id || joined.room_code !== roomCode) return
        const newPlayer = normalizePlayer(joined)
        setPlayers((prev) => {
          if (prev.some((player) => player.id === newPlayer.id)) return prev
          return sortPlayersByScore([...prev, newPlayer])
        })
        onPlayerInsertRef.current?.(newPlayer)
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
  // 탭이 보일 때만 돌려 백그라운드 낭비를 막는다. 탭으로 돌아오면 전체 목록을 한 번 읽는다.
  useEffect(() => {
    if (!enabled || !roomCode || reconcileIntervalMs <= 0) return
    if (typeof window === 'undefined') return

    const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'
    const tick = () => {
      if (isHidden()) return
      void reconcilePlayers()
    }
    const onReturn = () => {
      if (isHidden()) return
      void reconcilePlayers({ forceFullList: true })
    }

    const intervalId = window.setInterval(tick, reconcileIntervalMs)
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onReturn)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onReturn)
    }
  }, [enabled, roomCode, reconcileIntervalMs, reconcilePlayers])

  return {
    players,
    loading,
    error,
    refreshPlayers,
    applyPlayerPatch,
  }
}
