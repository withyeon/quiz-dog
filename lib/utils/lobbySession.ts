const LOBBY_PLAYER_KEY_PREFIX = 'quizdog_lobby_player'

function getKey(roomCode: string): string {
  return `${LOBBY_PLAYER_KEY_PREFIX}:${roomCode}`
}

export function loadLobbyPlayerId(roomCode: string): string | null {
  if (typeof window === 'undefined' || !roomCode) return null
  return window.sessionStorage.getItem(getKey(roomCode))
}

export function saveLobbyPlayerId(roomCode: string, playerId: string): void {
  if (typeof window === 'undefined' || !roomCode || !playerId) return
  window.sessionStorage.setItem(getKey(roomCode), playerId)
}

export function clearLobbyPlayerId(roomCode: string): void {
  if (typeof window === 'undefined' || !roomCode) return
  window.sessionStorage.removeItem(getKey(roomCode))
}
