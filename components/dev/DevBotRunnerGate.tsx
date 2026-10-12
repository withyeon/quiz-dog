'use client'

/**
 * /dev "봇 친구"를 움직이는 실행기의 문지기. 루트 레이아웃에 한 번만 둔다.
 *
 * 게임 페이지가 열 군데가 넘어 페이지마다 실행기를 붙이지 않으려고 레이아웃에 둔다.
 * 이 탭에 /dev 에서 시작한 봇 판(sessionStorage)이 있을 때만 실행기 코드를 불러오므로,
 * 일반 학생·선생님은 실행기 코드를 받지도 않는다(lib/dev/devBots.ts).
 */

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { readDevBotSession } from '@/lib/dev/devBots'

const DevBotRunner = dynamic(() => import('@/components/dev/DevBotRunner'), { ssr: false })

export default function DevBotRunnerGate() {
  const pathname = usePathname()
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    setHasSession(readDevBotSession() !== null)
  }, [pathname])

  // 페이지가 바뀔 때마다 새로 띄워, 그 판의 게임 화면(URL 의 room)이 아니면 실행기가 멈추게 한다
  return hasSession ? <DevBotRunner key={pathname} /> : null
}
