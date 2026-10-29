'use client'

/**
 * 관리자 화면 공용 부품. 모든 관리자 페이지가 같은 헤더·통계 카드·표·빈 상태·확인 대화상자를 쓴다.
 * 초피티 관리자(components/admin/ui)와 같은 모양. 문구는 '~합니다'체로 짧게 둔다.
 * 사이트의 Button(파란색·그림자)과 분리해 여기서 관리자용 버튼·입력을 따로 정의한다.
 */
import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, forwardRef, useEffect, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Info, RefreshCw, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ===== 버튼 / 입력 =====

export interface AdminButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  size?: 'default' | 'sm'
}

export const Button = forwardRef<HTMLButtonElement, AdminButtonProps>(function Button(
  { className, variant = 'default', size = 'default', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        {
          'bg-slate-900 text-white hover:bg-slate-800': variant === 'default',
          'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50': variant === 'outline',
          'text-slate-700 hover:bg-slate-100': variant === 'ghost',
          'bg-rose-600 text-white hover:bg-rose-700': variant === 'destructive',
          'h-10 px-4 py-2': size === 'default',
          'h-9 px-3': size === 'sm',
        },
        className,
      )}
      {...props}
    />
  )
})

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
})

/** 폼 칸(select·input·textarea)에 공통으로 붙이는 모양. */
export const FIELD = 'mt-1 block h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none'

// ===== 페이지 헤더 =====

export function PageHeader({
  title,
  description,
  actions,
  updatedAt,
}: {
  title: string
  description?: string
  actions?: ReactNode
  /** 마지막 갱신 시각(ISO). 있으면 오른쪽에 작게 보여 준다. */
  updatedAt?: string | null
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {(actions || updatedAt) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {updatedAt && <span className="text-xs text-slate-400">갱신 {formatDateTime(updatedAt)}</span>}
          {actions}
        </div>
      )}
    </div>
  )
}

export function RefreshButton({ onClick, loading, label = '새로고침' }: { onClick: () => void; loading?: boolean; label?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={loading} className="bg-white">
      <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
      {label}
    </Button>
  )
}

// ===== 통계 카드 =====

export type StatTone = 'default' | 'success' | 'warning' | 'danger' | 'info'

const STAT_TONE: Record<StatTone, string> = {
  default: 'text-slate-900',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-rose-600',
  info: 'text-sky-600',
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  loading,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  tone?: StatTone
  loading?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      {loading ? (
        <div className="mt-2 h-7 w-20 animate-pulse rounded bg-slate-100" />
      ) : (
        <div className={cn('mt-1 text-2xl font-semibold tabular-nums', STAT_TONE[tone])}>{value}</div>
      )}
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

export function StatGrid({ children, columns = 4 }: { children: ReactNode; columns?: 2 | 3 | 4 | 5 | 6 }) {
  const cols = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-2 xl:grid-cols-4', 5: 'md:grid-cols-3 xl:grid-cols-5', 6: 'md:grid-cols-3 xl:grid-cols-6' }[columns]
  return <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', cols)}>{children}</div>
}

// ===== 섹션 / 카드 =====

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(padded && 'p-5')}>{children}</div>
    </section>
  )
}

// ===== 상태 표시 =====

export type PillTone = 'slate' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet' | 'indigo'

const PILL: Record<PillTone, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
}

export function Pill({ tone = 'slate', children, className, dot }: { tone?: PillTone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', PILL[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

// ===== 알림 배너 =====

export function Banner({ tone, children, onClose, action }: { tone: 'error' | 'success' | 'info' | 'warning'; children: ReactNode; onClose?: () => void; action?: ReactNode }) {
  const styles = {
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
  }[tone]
  const Icon = tone === 'error' ? AlertTriangle : tone === 'success' ? CheckCircle2 : tone === 'warning' ? AlertTriangle : Info
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border px-4 py-3 text-sm', styles)} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
      {onClose && (
        <button type="button" onClick={onClose} className="rounded p-0.5 opacity-70 hover:opacity-100" aria-label="닫기">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

/** 잠깐 보였다 사라지는 처리 결과 알림. alert() 대신 쓴다. */
export function useNotice(timeoutMs = 4000) {
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null)
  useEffect(() => {
    if (!notice || notice.tone === 'error') return
    const t = setTimeout(() => setNotice(null), timeoutMs)
    return () => clearTimeout(t)
  }, [notice, timeoutMs])
  return {
    notice,
    success: (text: string) => setNotice({ tone: 'success', text }),
    error: (text: string) => setNotice({ tone: 'error', text }),
    info: (text: string) => setNotice({ tone: 'info', text }),
    clear: () => setNotice(null),
    element: notice ? <Banner tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Banner> : null,
  }
}

// ===== 빈 상태 / 로딩 =====

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-slate-300">{icon}</div>}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-md text-xs text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-slate-100', className)} />
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

// ===== 검색 / 필터 =====

export function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="bg-white pl-9" />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600" aria-label="검색어 지우기">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function FilterChips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string; count?: number }> }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
              active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            {opt.label}
            {typeof opt.count === 'number' && (
              <span className={cn('rounded-full px-1.5 text-xs tabular-nums', active ? 'bg-white/20' : 'bg-slate-100 text-slate-500')}>{opt.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-3 md:flex-row md:items-center md:justify-between', className)}>{children}</div>
}

// ===== 표 =====

export interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
  width?: string
  /** 있으면 머리글을 눌러 이 열로 정렬한다. DataTable의 sort·onSort와 짝. */
  sortKey?: string
}

export interface TableSort {
  key: string
  dir: 'asc' | 'desc'
}

/** 정렬 화살표가 붙은 머리글 버튼. */
export function SortButton({ label, sortKey, sort, onSort }: { label: ReactNode; sortKey: string; sort?: TableSort; onSort: (key: string) => void }) {
  const current = sort?.key === sortKey ? sort.dir : null
  const Icon = current === 'asc' ? ArrowUp : current === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn('inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-900', current && 'text-slate-900')}
    >
      {label}
      <Icon className={cn('h-3.5 w-3.5', current ? 'text-slate-700' : 'text-slate-300')} />
    </button>
  )
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  empty,
  onRowClick,
  rowClassName,
  expanded,
  sort,
  onSort,
  compact = false,
}: {
  rows: T[]
  columns: Array<Column<T>>
  rowKey: (row: T) => string
  loading?: boolean
  empty?: ReactNode
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string | undefined
  /** 행 아래 펼쳐 보일 내용. 없으면 펼치지 않는다. */
  expanded?: (row: T) => ReactNode
  /** 지금 정렬. 정렬 자체는 부르는 쪽이 한다. */
  sort?: TableSort
  onSort?: (key: string) => void
  /** 좁은 패널용: 표 최소 폭(640px)을 풀어 가로 스크롤 없이 칸을 줄인다 */
  compact?: boolean
}) {
  const align = (a?: 'left' | 'right' | 'center') => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left')
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-sm', !compact && 'min-w-[640px]')}>
        <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((c) => {
              const sortable = Boolean(c.sortKey && onSort)
              const current = sortable && sort && sort.key === c.sortKey ? sort.dir : null
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={current === 'asc' ? 'ascending' : current === 'desc' ? 'descending' : undefined}
                  style={c.width ? { width: c.width } : undefined}
                  className={cn('whitespace-nowrap px-4 py-2.5 font-medium', align(c.align), c.className)}
                >
                  {sortable && onSort ? <SortButton label={c.header} sortKey={c.sortKey as string} sort={sort} onSort={onSort} /> : c.header}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading && rows.length === 0 &&
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={`sk-${i}`}>
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3">
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-slate-500">
                {empty ?? '표시할 항목이 없습니다.'}
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const key = rowKey(row)
            const extra = expanded?.(row)
            return (
              <FragmentRow key={key}>
                <tr
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn('bg-white transition-colors', onRowClick && 'cursor-pointer hover:bg-slate-50', rowClassName?.(row))}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-4 py-3 align-middle', align(c.align), c.className)}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
                {extra && (
                  <tr className="bg-slate-50/70">
                    <td colSpan={columns.length} className="px-4 py-4">
                      {extra}
                    </td>
                  </tr>
                )}
              </FragmentRow>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>
}

// ===== 키·값 목록 =====

export function KeyValue({ items, columns = 1 }: { items: Array<{ label: ReactNode; value: ReactNode }>; columns?: 1 | 2 | 3 }) {
  const cols = { 1: 'sm:grid-cols-[10rem_1fr]', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }[columns]
  if (columns === 1) {
    return (
      <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-2 text-sm', cols)}>
        {items.map((it, i) => (
          <FragmentRow key={i}>
            <dt className="text-slate-500">{it.label}</dt>
            <dd className="min-w-0 break-words text-slate-900">{it.value}</dd>
          </FragmentRow>
        ))}
      </dl>
    )
  }
  return (
    <dl className={cn('grid grid-cols-1 gap-3 text-sm', cols)}>
      {items.map((it, i) => (
        <div key={i} className="rounded-lg bg-slate-50 px-3 py-2">
          <dt className="text-xs text-slate-500">{it.label}</dt>
          <dd className="mt-0.5 font-medium text-slate-900">{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}

// ===== 확인 대화상자 =====

export interface ConfirmRequest {
  title: string
  description: ReactNode
  confirmLabel?: string
  /** 되돌릴 수 없는 작업이면 true. 버튼이 붉게 바뀐다. */
  destructive?: boolean
  /** 이 문자열을 그대로 입력해야 확인 버튼이 열린다(계정 삭제 등). */
  typeToConfirm?: string
  /** 사유 입력란을 보여 주고 값을 run에 넘긴다. */
  reasonPlaceholder?: string
  run: (input: { reason: string }) => Promise<void>
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  const [typed, setTyped] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    setTyped('')
    setReason('')
    setError('')
    setBusy(false)
  }, [request])
  useEffect(() => {
    if (!request) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [request, busy, onClose])
  if (!request) return null
  const ready = !request.typeToConfirm || typed.trim().toLowerCase() === request.typeToConfirm.toLowerCase()
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4" onClick={() => { if (!busy) onClose() }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <h2 id="admin-confirm-title" className="text-base font-semibold text-slate-900">{request.title}</h2>
        <div className="mt-2 text-sm leading-relaxed text-slate-600">{request.description}</div>
        <div className="mt-4 space-y-3">
          {request.typeToConfirm && (
            <div>
              <label className="text-xs font-medium text-slate-600">
                확인을 위해 <span className="font-mono text-slate-900">{request.typeToConfirm}</span> 을 입력합니다.
              </label>
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-1 font-mono" autoFocus />
            </div>
          )}
          {request.reasonPlaceholder && (
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={request.reasonPlaceholder} />
          )}
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>취소</Button>
          <Button
            variant={request.destructive ? 'destructive' : 'default'}
            disabled={!ready || busy}
            autoFocus={!request.typeToConfirm}
            onClick={async () => {
              setBusy(true)
              setError('')
              try {
                await request.run({ reason: reason.trim() })
                onClose()
              } catch (e) {
                setError(e instanceof Error ? e.message : '처리하지 못했습니다.')
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? '처리 중…' : request.confirmLabel ?? '진행'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ===== 형식 =====

export function formatDateTime(value?: string | null, opts: 'short' | 'long' = 'short') {
  if (!value) return '-'
  const date = new Date(value.includes('T') || value.includes('-') ? value : value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR', opts === 'long'
    ? { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatNumber(value?: number | null) {
  return (value ?? 0).toLocaleString('ko-KR')
}

/** 지금부터 얼마나 지났는지(방금·N분 전·N시간 전·N일 전). */
export function timeAgo(value?: string | null) {
  if (!value) return '-'
  const diff = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(diff)) return value
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  return `${Math.floor(hr / 24)}일 전`
}
