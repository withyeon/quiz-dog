const LIBRARY_CLIENT_ID_KEY = 'quizdog_library_client_id'
const LIBRARY_LIKED_SET_IDS_KEY = 'quizdog_library_liked_set_ids'

export function getLibraryClientId(): string {
  if (typeof window === 'undefined') return 'server'

  const existing = window.localStorage.getItem(LIBRARY_CLIENT_ID_KEY)
  if (existing) return existing

  const nextId = typeof window.crypto?.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  window.localStorage.setItem(LIBRARY_CLIENT_ID_KEY, nextId)
  return nextId
}

export function getLocalLikedQuestionSetIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()

  try {
    const raw = window.localStorage.getItem(LIBRARY_LIKED_SET_IDS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.map((setId) => String(setId)).filter(Boolean))
  } catch {
    return new Set()
  }
}

export function setLocalQuestionSetLiked(setId: string, liked: boolean): void {
  if (typeof window === 'undefined') return

  const likedSetIds = getLocalLikedQuestionSetIds()
  if (liked) {
    likedSetIds.add(setId)
  } else {
    likedSetIds.delete(setId)
  }

  window.localStorage.setItem(
    LIBRARY_LIKED_SET_IDS_KEY,
    JSON.stringify([...likedSetIds]),
  )
}
