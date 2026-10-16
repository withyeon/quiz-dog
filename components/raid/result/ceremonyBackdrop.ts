/**
 * 결과 화면 배경. 승리하면 승리 그림, 다 못 잡았으면 차분한 얼음 무대.
 * 그림 파일이 아직 없거나 늦게 떠도 맨 아래 색 층이 받쳐 주므로 글씨가 읽힌다.
 * (위쪽은 제목, 아래쪽은 숫자가 올라오는 자리라 위아래를 더 어둡게 덮는다)
 */
const VICTORY_BACKDROP =
  "linear-gradient(180deg, rgba(6, 22, 44, 0.6) 0%, rgba(6, 22, 44, 0.2) 38%, rgba(6, 22, 44, 0.3) 62%, rgba(6, 22, 44, 0.82) 100%), url('/raid/victory.webp') center / cover no-repeat, linear-gradient(160deg, #24598a, #0b2d4d)"

const COOL_BACKDROP =
  "linear-gradient(180deg, rgba(8, 24, 48, 0.72) 0%, rgba(8, 24, 48, 0.5) 42%, rgba(8, 24, 48, 0.9) 100%), url('/raid/arena.webp') center 60% / cover no-repeat, linear-gradient(160deg, #123a5e, #081a30)"

export function getCeremonyBackdrop(victory: boolean): string {
  return victory ? VICTORY_BACKDROP : COOL_BACKDROP
}
