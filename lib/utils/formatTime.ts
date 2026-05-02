/**
 * 시간 포맷팅 (MM:SS)
 * 공통 유틸리티 — cafe, mafia 등에서 공유
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
