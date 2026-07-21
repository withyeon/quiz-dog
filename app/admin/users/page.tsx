'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search, Mail, Library } from 'lucide-react'
import { fetchAdminJson } from '@/lib/admin/fetchAdmin'

interface Teacher {
  id: string
  email: string
  provider: string
  createdAt: string
  lastSignInAt: string | null
  setCount: number
}

const PROVIDER_LABEL: Record<string, string> = {
  email: '이메일',
  google: '구글',
  kakao: '카카오',
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function AdminUsersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchAdminJson<{ users: Teacher[] }>('/api/admin/users')
      .then((d) => setTeachers(d.users))
      .catch((e) => setError(e instanceof Error ? e.message : '오류'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return teachers
    return teachers.filter((t) => t.email.toLowerCase().includes(q))
  }, [teachers, query])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">교사 관리</h1>
          <p className="mt-1 text-sm text-slate-500">가입한 교사 {teachers.length}명</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이메일 검색"
            className="w-64 rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {/* 데스크탑 테이블 */}
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">이메일</th>
                <th className="px-5 py-3 font-medium">가입 방법</th>
                <th className="px-5 py-3 font-medium">가입일</th>
                <th className="px-5 py-3 font-medium">최근 로그인</th>
                <th className="px-5 py-3 text-right font-medium">문제 세트</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-medium text-slate-800">{t.email}</td>
                  <td className="px-5 py-3 text-slate-600">{PROVIDER_LABEL[t.provider] ?? t.provider}</td>
                  <td className="px-5 py-3 text-slate-600">{formatDate(t.createdAt)}</td>
                  <td className="px-5 py-3 text-slate-600">{formatDate(t.lastSignInAt)}</td>
                  <td className="px-5 py-3 text-right text-slate-700">{t.setCount}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                    결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* 모바일 카드 */}
          <div className="divide-y divide-slate-50 md:hidden">
            {filtered.map((t) => (
              <div key={t.id} className="p-4">
                <div className="flex items-center gap-2 font-medium text-slate-800">
                  <Mail className="h-4 w-4 text-slate-400" />
                  {t.email}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>{PROVIDER_LABEL[t.provider] ?? t.provider}</span>
                  <span>가입 {formatDate(t.createdAt)}</span>
                  <span>최근 {formatDate(t.lastSignInAt)}</span>
                  <span className="flex items-center gap-1">
                    <Library className="h-3.5 w-3.5" />
                    {t.setCount}
                  </span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="p-8 text-center text-slate-400">결과가 없습니다.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
