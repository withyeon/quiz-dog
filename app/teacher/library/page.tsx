'use client'

import LibraryBrowser from '@/components/library/LibraryBrowser'

/**
 * 선생님 자료실. 본문은 공개 자료실(/explore)과 같은 LibraryBrowser 이고,
 * 여기서는 로그인한 선생님이라 담기·게임 시작이 바로 된다.
 * 로그인 없이 이 주소로 오면 TeacherLayout 이 /explore 로 보낸다.
 */
export default function LibraryPage() {
  return <LibraryBrowser mode="teacher" />
}
