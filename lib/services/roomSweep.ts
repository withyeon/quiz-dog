import { supabase } from '@/lib/supabase/client'

/**
 * 선생님 화면에서 부르는 방치된 방 보조 정리 (/api/teacher/sweep-rooms).
 * 주 정리는 15분 크론이 맡고, 이건 선생님이 들어온 순간의 안전망이라 결과를 기다리지도, 실패를 알리지도 않는다.
 */
export async function requestStaleRoomSweep(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    await fetch('/api/teacher/sweep-rooms', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      keepalive: true,
    })
  } catch {
    // 안전망이 실패해도 화면은 그대로 간다. 다음 크론이 정리한다.
  }
}
