import { NextResponse, type NextRequest } from 'next/server'

// 개발용 내부 미리보기 페이지(/dev/*)는 프로덕션에서 일반 사용자에게 노출하지 않는다.
// 단, DEV_ACCESS_KEY 비밀키를 아는 운영자는 /dev?key=<비밀키> 로 한 번 접근하면
// 쿠키가 저장되어 이후 30일간 자유롭게 /dev에 들어갈 수 있다.
const DEV_COOKIE = 'dev_access'

export function proxy(request: NextRequest) {
  // 로컬 개발 환경에서는 항상 허용
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.next()
  }

  const secret = process.env.DEV_ACCESS_KEY
  const queryKey = request.nextUrl.searchParams.get('key')
  const cookieKey = request.cookies.get(DEV_COOKIE)?.value

  // 비밀키가 설정되어 있고, URL로 올바른 키가 들어오면 쿠키를 심고 주소에서 key를 제거(히스토리에 안 남도록)
  if (secret && queryKey === secret) {
    const cleanUrl = request.nextUrl.clone()
    cleanUrl.searchParams.delete('key')
    const res = NextResponse.redirect(cleanUrl)
    res.cookies.set(DEV_COOKIE, secret, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30일
      path: '/',
    })
    return res
  }

  // 이미 유효한 쿠키를 가진 운영자는 통과
  if (secret && cookieKey === secret) {
    return NextResponse.next()
  }

  // 그 외에는 존재하지 않는 페이지처럼 404
  return new NextResponse(null, { status: 404 })
}

export const config = {
  matcher: ['/dev/:path*'],
}
