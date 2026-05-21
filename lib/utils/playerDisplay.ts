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
