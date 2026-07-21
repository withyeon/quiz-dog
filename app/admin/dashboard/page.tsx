'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Users,
  UserPlus,
  Radio,
  Library,
  Gamepad2,
  MessageSquare,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { fetchAdminJson } from '@/lib/admin/fetchAdmin'

interface Stats {
  totalTeachers: number
  newTeachersToday: number
  newTeachersThisWeek: number
  newTeachersThisMonth: number
  totalQuestionSets: number
  totalGames: number
  activeRooms: number
  openFeedback: number
  trend: { date: string; signups: number }[]
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAdminJson<Stats>('/api/admin/stats')
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : '오류'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error || !stats) {
    return <p className="text-sm text-red-500">{error || '데이터 없음'}</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">대시보드</h1>
        <p className="mt-1 text-sm text-slate-500">퀴즈독 서비스 현황 요약</p>
      </div>

      {/* 핵심 지표 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="총 교사 수"
          value={stats.totalTeachers}
          accent="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          icon={<UserPlus className="h-5 w-5" />}
          label="오늘 신규 가입"
          value={stats.newTeachersToday}
          sub={`이번 주 +${stats.newTeachersThisWeek} · 이번 달 +${stats.newTeachersThisMonth}`}
          accent="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          icon={<Radio className="h-5 w-5" />}
          label="진행 중 게임"
          value={stats.activeRooms}
          accent="bg-rose-50 text-rose-600"
          href="/admin/sessions"
        />
        <StatCard
          icon={<Gamepad2 className="h-5 w-5" />}
          label="누적 게임 수"
          value={stats.totalGames}
          accent="bg-amber-50 text-amber-600"
        />
        <StatCard
          icon={<Library className="h-5 w-5" />}
          label="문제 세트"
          value={stats.totalQuestionSets}
          accent="bg-sky-50 text-sky-600"
        />
        <StatCard
          icon={<MessageSquare className="h-5 w-5" />}
          label="미처리 신고"
          value={stats.openFeedback}
          accent="bg-orange-50 text-orange-600"
          href="/admin/feedback"
        />
      </div>

      {/* 가입 추이 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">최근 14일 신규 가입 추이</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                labelStyle={{ color: '#475569' }}
                formatter={(v) => [`${v ?? 0}명`, '신규 가입']}
              />
              <Area type="monotone" dataKey="signups" stroke="#6366f1" strokeWidth={2} fill="url(#signupGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  href,
}: {
  icon: React.ReactNode
  label: string
  value: number
  sub?: string
  accent: string
  href?: string
}) {
  const inner = (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>{icon}</div>
        {href && <ArrowRight className="h-4 w-4 text-slate-300" />}
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
      <p className="text-sm text-slate-500">{label}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}
