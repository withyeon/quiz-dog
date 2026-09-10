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

/**
 * 아바타 경로를 실제로 내려받을 이미지 주소로 바꾼다.
 *
 * DB의 players.avatar에는 `/character/12.webp` 같은 값이 그대로 저장돼 있는데,
 * 이 SVG들은 벡터가 아니라 PNG를 base64로 감싼 것이라 한 장에 800KB나 된다.
 * 학생 30명이 모인 대기실·게임 화면에서는 그게 15MB 넘는 다운로드가 된다.
 *
 * 저장된 값은 건드리지 않고(기존 기록과 매칭이 깨지므로) 화면에 그릴 때만
 * 같은 그림의 256px webp로 바꿔 준다. 장당 800KB → 9KB.
 */
export function resolveAvatarSrc(value: string | null | undefined): string {
  const trimmed = String(value || '').trim()
  if (!isAvatarPath(trimmed)) return trimmed

  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const normalized = withSlash.replace(/^\/public\//, '/')

  const match = normalized.match(/^\/character\/(\d+)\.svg$/i)
  return match ? `/character/webp/${match[1]}.webp` : normalized
}
