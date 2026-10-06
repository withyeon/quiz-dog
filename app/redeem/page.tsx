import { redirect } from 'next/navigation'

/**
 * 이용 코드 등록으로 가는 짧은 주소(quizdog.kr/redeem).
 *
 * 위드현에듀테크 납품정보서·메일에 적는 주소라 짧아야 한다. 내 정보의 '내 플랜'으로 넘기고,
 * 로그인 전이면 teacher 레이아웃이 로그인 뒤 같은 곳으로 돌려보낸다. ?code=를 붙여 오면 코드 칸에 채워 둔다.
 */
export default async function RedeemEntry({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>
}) {
  const raw = (await searchParams)?.code
  const code = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 40)
  redirect(code ? `/teacher/settings?code=${encodeURIComponent(code)}` : '/teacher/settings')
}
