'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity, ArrowRight, BadgeCheck, CalendarClock, Gamepad2, Library, MessageSquare, TrendingUp, UserPlus, Users } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchAdminJson } from '@/lib/admin/fetchAdmin'
import { ADMIN_NAV } from '@/components/admin/nav'
import { Banner, PageHeader, Panel, Pill, RefreshButton, StatCard, StatGrid, formatNumber } from '@/components/admin/ui'

interface Stats {
  totalTeachers: number
  newTeachersToday: number
  newTeachersThisWeek: number
  newTeachersThisMonth: number
  totalQuestionSets: number
  totalGames: number
  totalRooms: number
  activeRooms: number
  openFeedback: number
  proTeachers: number
  pendingGrants: number
  trend: { date: string; signups: number }[]
  timestamp: string
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setStats(await fetchAdminJson<Stats>('/api/admin/stats'))
    } catch (e) {
      setError(e instanceof Error ? e.message : '현황을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const skeleton = loading && !stats

  return (
    <>
      <PageHeader title="대시보드" description="가입, 게임, 요금제 현황을 한눈에 봅니다." updatedAt={stats?.timestamp} actions={<RefreshButton onClick={load} loading={loading} />} />
      {error && <Banner tone="error" action={<RefreshButton onClick={load} loading={loading} label="다시 시도" />}>{error}</Banner>}

      <StatGrid columns={6}>
        <StatCard label="총 교사" value={formatNumber(stats?.totalTeachers)} icon={<Users className="h-4 w-4" />} loading={skeleton} />
        <StatCard label="오늘 신규" value={formatNumber(stats?.newTeachersToday)} icon={<UserPlus className="h-4 w-4" />} tone="info" loading={skeleton} />
        <StatCard label="이번 주 신규" value={formatNumber(stats?.newTeachersThisWeek)} icon={<TrendingUp className="h-4 w-4" />} loading={skeleton} />
        <StatCard label="이번 달 신규" value={formatNumber(stats?.newTeachersThisMonth)} icon={<TrendingUp className="h-4 w-4" />} loading={skeleton} />
        <StatCard label="진행 중 게임" value={formatNumber(stats?.activeRooms)} icon={<Activity className="h-4 w-4" />} tone="success" loading={skeleton} />
        <StatCard label="미처리 신고" value={formatNumber(stats?.openFeedback)} icon={<MessageSquare className="h-4 w-4" />} tone={(stats?.openFeedback ?? 0) > 0 ? 'danger' : 'default'} loading={skeleton} />
      </StatGrid>

      <Panel title="서비스 현황" description="누적 수치와 요금제 현황입니다.">
        <StatGrid columns={4}>
          <StatCard label="문제 세트" value={formatNumber(stats?.totalQuestionSets)} icon={<Library className="h-4 w-4" />} loading={skeleton} />
          <StatCard label="누적 게임" value={formatNumber(stats?.totalGames)} icon={<Gamepad2 className="h-4 w-4" />} hint={stats ? `만든 방 ${formatNumber(stats.totalRooms)}개` : undefined} loading={skeleton} />
          <StatCard label="프로 교사" value={formatNumber(stats?.proTeachers)} icon={<BadgeCheck className="h-4 w-4" />} tone="info" hint="오늘 기준 프로 기간이 남은 계정" loading={skeleton} />
          <StatCard label="가입 대기 예약" value={formatNumber(stats?.pendingGrants)} icon={<CalendarClock className="h-4 w-4" />} tone={(stats?.pendingGrants ?? 0) > 0 ? 'warning' : 'default'} hint="가입하면 프로가 자동으로 붙는 이메일" loading={skeleton} />
        </StatGrid>
      </Panel>

      <Panel title="최근 14일 신규 가입" description="날짜는 한국 시간 기준입니다.">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={stats?.trend ?? []} margin={{ left: 8, right: 16, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
            <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={12} width={32} />
            <Tooltip formatter={(value) => [`${value ?? 0}명`, '신규 가입']} contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 12 }} />
            <Line type="monotone" dataKey="signups" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="신규 가입" />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="바로가기" padded={false}>
        <ul className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-y-0">
          {ADMIN_NAV.flatMap((g) => g.items)
            .filter((item) => item.href !== '/admin/dashboard')
            .map((item) => {
              const Icon = item.icon
              return (
                <li key={item.href} className="md:border-b md:border-slate-100 md:odd:border-r">
                  <Link href={item.href} className="group flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-800">{item.label}</span>
                      <span className="block truncate text-xs text-slate-500">{item.description}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600" />
                  </Link>
                </li>
              )
            })}
        </ul>
      </Panel>

      {stats && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <Pill tone="slate" dot>교사 계정 {formatNumber(stats.totalTeachers)}명</Pill>
          <Pill tone="emerald" dot>진행 중 게임 {formatNumber(stats.activeRooms)}개</Pill>
          <Pill tone="sky" dot>프로 {formatNumber(stats.proTeachers)}명</Pill>
        </div>
      )}
    </>
  )
}
