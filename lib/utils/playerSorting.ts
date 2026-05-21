import type { Database } from '@/types/database.types'

type PlayerRow = Database['public']['Tables']['players']['Row']
type ScoreSortablePlayer = Pick<PlayerRow, 'created_at' | 'score'>

export function comparePlayersByScore<T extends ScoreSortablePlayer>(a: T, b: T): number {
  const scoreCompare = (b.score ?? 0) - (a.score ?? 0)
  if (scoreCompare !== 0) return scoreCompare
  return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
}

export function sortPlayersByScore<T extends ScoreSortablePlayer>(players: T[]): T[] {
  return [...players].sort(comparePlayersByScore)
}
