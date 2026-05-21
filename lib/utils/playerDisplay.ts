export function isAvatarPath(value: string | null | undefined): boolean {
  return /^\/?(character|public\/character)\//.test(String(value || '').trim())
}

export function getDisplayNickname(nickname: string | null | undefined, fallback = '학생'): string {
  const trimmed = String(nickname || '').trim()
  if (!trimmed || isAvatarPath(trimmed)) return fallback
  return trimmed
}

export function getPlayerDisplayNickname(
  nickname: string | null | undefined,
  avatar?: string | null,
  fallback = '학생',
): string {
  const displayNickname = getDisplayNickname(nickname, '')
  if (displayNickname) return displayNickname

  const avatarValue = String(avatar || '').trim()
  if (avatarValue && !isAvatarPath(avatarValue) && /[0-9A-Za-z가-힣]/.test(avatarValue)) {
    return avatarValue
  }

  return fallback
}

export function normalizePlayerDisplayFields<
  T extends { nickname: string; avatar: string | null },
>(player: T): T {
  const nickname = String(player.nickname || '').trim()
  const avatar = String(player.avatar || '').trim()

  if (!isAvatarPath(nickname)) return player

  const recoveredNickname = avatar && !isAvatarPath(avatar)
    ? avatar
    : '학생'

  return {
    ...player,
    nickname: recoveredNickname,
    avatar: nickname.startsWith('/') ? nickname : `/${nickname}`,
  }
}
