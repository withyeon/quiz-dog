// 간식런 스프라이트 로더
//
// public/gansik-run/<이름>.webp (없으면 .png)를 한 번만 불러온다.
// 파일이 없으면 해당 항목은 비어 있고, 렌더러가 캔버스 도형으로 대신 그린다.
// 그래서 이미지를 폴더에 넣기만 하면 코드 수정 없이 바로 반영된다.
// 규격은 public/gansik-run/README.md 참고.

export type SpriteKey =
  | 'dog'          // 플레이어 강아지 (달리는 모습)
  | 'dogJump'      // 점프 중 (없으면 dog를 띄워서 사용)
  | 'dogSlide'     // 슬라이드 중 (없으면 dog를 납작하게 사용)
  | 'cat'          // 뒤에서 쫓아오는 고양이
  | 'bone'         // 뼈다귀 (+1)
  | 'boneGold'     // 황금 뼈다귀 (+10)
  | 'box'          // 아이템 박스
  | 'obstacle'     // 일반 장애물 (차선 바꿔 피함)
  | 'obstacleLow'  // 바닥 장애물 (점프로 피함)
  | 'obstacleHigh' // 공중 장애물 (슬라이드로 피함)

export const SPRITE_FILES: Record<SpriteKey, string> = {
  dog: 'dog',
  dogJump: 'dog-jump',
  dogSlide: 'dog-slide',
  cat: 'cat',
  bone: 'bone',
  boneGold: 'bone-gold',
  box: 'box',
  obstacle: 'obstacle',
  obstacleLow: 'obstacle-low',
  obstacleHigh: 'obstacle-high',
}

export const SPRITE_DIR = '/gansik-run'

export type SpriteSet = Partial<Record<SpriteKey, HTMLImageElement>>

let cache: SpriteSet | null = null

function loadOne(set: SpriteSet, key: SpriteKey, onLoaded?: () => void) {
  const base = `${SPRITE_DIR}/${SPRITE_FILES[key]}`
  const candidates = [`${base}.webp`, `${base}.png`]

  const tryNext = (index: number) => {
    if (index >= candidates.length) return
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (img.naturalWidth > 0) {
        set[key] = img
        onLoaded?.()
      }
    }
    img.onerror = () => tryNext(index + 1)
    img.src = candidates[index]
  }

  tryNext(0)
}

/** 스프라이트 로딩을 시작하고(한 번만) 살아있는 세트를 돌려준다. 로드가 끝난 항목만 채워진다. */
export function loadSprites(): SpriteSet {
  if (cache) return cache
  cache = {}
  if (typeof window === 'undefined') return cache
  const set = cache
  for (const key of Object.keys(SPRITE_FILES) as SpriteKey[]) {
    // 점프·슬라이드 변형은 기본 강아지 그림이 있을 때만 찾는다 (없는 파일 요청을 줄임)
    if (key === 'dogJump' || key === 'dogSlide') continue
    loadOne(set, key, key === 'dog' ? () => {
      loadOne(set, 'dogJump')
      loadOne(set, 'dogSlide')
    } : undefined)
  }
  return cache
}

/** 이미지를 바닥 중앙 기준으로 그린다. 가로 폭을 주면 비율대로 세로를 정한다. */
export function drawSpriteBottom(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  bottomY: number,
  width: number,
  maxHeight?: number,
) {
  let w = width
  let h = width * (img.naturalHeight / img.naturalWidth)
  if (maxHeight && h > maxHeight) {
    h = maxHeight
    w = h * (img.naturalWidth / img.naturalHeight)
  }
  ctx.drawImage(img, x - w / 2, bottomY - h, w, h)
  return { w, h }
}
