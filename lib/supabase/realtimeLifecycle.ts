import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

/**
 * 실시간 채널을 닫을 때 `supabase.removeChannel(channel)` 대신 쓴다.
 *
 * removeChannel은 채널을 떠난 뒤 "남은 채널이 0개면 웹소켓까지 끊는다(disconnect)".
 * 로비 → 게임 화면처럼 한 화면이 내려가며 채널 3개를 닫고, 같은 커밋에서 새 화면이
 * 같은 방 채널을 다시 구독하는 흐름에서는 이렇게 된다:
 *   1) 로비 채널 3개 제거 → 목록이 비어 소켓 disconnect 시작('disconnecting', 닫힘 확인까지 100~200ms)
 *   2) 게임 화면이 새 채널을 subscribe → realtime-js의 connect()가 '끊는 중'이면 아무것도 안 하고 리턴
 *   3) 소켓이 닫힌 뒤에는 아무도 connect()를 다시 부르지 않는다(rejoin 타이머는 "연결돼 있을 때만" join)
 * 결과: 게임 내내 방송(공격 아이템·player:patch·game:finished)과 presence를 하나도 못 받는다.
 * 점수는 2~3초 REST 재조회로 따라와서 티가 안 났고, 화면 뒤집기·축소·카페 방해 아이템만 "안 먹히는"
 * 것으로 보였다(2026-10-09 인형뽑기 2탭 재현으로 확인). 게임 URL을 바로 열면 로비 정리가 없어 멀쩡했다.
 *
 * unsubscribe는 채널만 떠나고(소켓 채널 목록에서도 빠진다) 소켓은 그대로 둔다. 소켓 하나가
 * 잠시 비어 있는 비용은 심장박동 메시지뿐이다.
 */
export function releaseRealtimeChannel(channel: RealtimeChannel): void {
  void channel.unsubscribe().catch(() => {
    // 떠나기 실패는 무시한다 — 다음 subscribe가 새 채널을 만든다.
  })
}

/**
 * 소켓이 끊긴 채 멈춰 있으면 다시 연결한다. 연결 중·끊는 중이면 건드리지 않는다.
 * realtime-js는 join 타임아웃 뒤 "소켓이 연결돼 있을 때만" 다시 join하므로, 소켓 자체가
 * 닫힌 채 남으면 채널은 영원히 'joining'에 머문다. 구독이 안 된 채널의 감시 타이머에서 부른다.
 * @returns 이번 호출로 connect()를 실제로 불렀으면 true
 */
export function ensureRealtimeSocketConnected(): boolean {
  const realtime = supabase.realtime
  if (realtime.isConnected() || realtime.isConnecting() || realtime.isDisconnecting()) return false
  realtime.connect()
  return true
}
