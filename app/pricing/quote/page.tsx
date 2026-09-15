'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { toPng } from 'html-to-image'
import download from 'downloadjs'
import { ArrowLeft, Check, Download, Minus, Plus, Printer, RotateCcw, Sparkles } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import QuoteDocument, { type QuoteDocumentData, type QuoteRecipient } from '@/components/pricing/QuoteDocument'
import { toast } from '@/components/ui/Toaster'
import {
  GROUP_MIN_SEATS,
  GROUP_TIERS,
  MAX_MONTHS,
  MAX_SEATS,
  MIN_MONTHS,
  MIN_SEATS,
  MONTH_OPTIONS,
  PRO_MONTHLY_LIST_PRICE,
  QUOTE_VALID_DAYS,
  calculateQuote,
  formatKrw,
  generateQuoteNumber,
  getQuoteHints,
  isValidEmail,
  isValidPhone,
  parseDateInputValue,
  toDateInputValue,
  type QuoteBreakdown,
} from '@/lib/pricing/quote'

const FONT = "'DNFBitBitv2', sans-serif"
const SESSION_KEY = 'quizdog_quote_result'
const CARD_SHADOW = '0 4px 6px rgba(0,0,0,0.04), 0 12px 32px rgba(148,163,184,0.12)'

type FormState = QuoteRecipient & {
  seats: string
  months: string
  startDate: string
  agreed: boolean
}

type StoredQuote = Omit<QuoteDocumentData, 'issuedAt' | 'startDate'> & { issuedAt: string; startDate: string }

function tomorrow(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(0, 0, 0, 0)
  return d
}

const INITIAL_FORM: FormState = {
  organization: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  note: '',
  seats: '1',
  months: '12',
  startDate: '',
  agreed: false,
}

export default function PricingQuotePage() {
  // 시작일 기본값은 브라우저 시각 기준이라 클라이언트에서 채운다 (SSR 불일치 방지)
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [result, setResult] = useState<QuoteDocumentData | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const documentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setForm((prev) => (prev.startDate ? prev : { ...prev, startDate: toDateInputValue(tomorrow()) }))
    // 새로고침해도 방금 발행한 견적서가 사라지지 않게 세션에 보관
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY)
      if (!raw) return
      const stored = JSON.parse(raw) as StoredQuote
      setResult({ ...stored, issuedAt: new Date(stored.issuedAt), startDate: new Date(stored.startDate) })
    } catch {
      // 세션 복구 실패는 무시 — 다시 발행하면 된다
    }
  }, [])

  const seats = Number(form.seats)
  const months = Number(form.months)
  const breakdown = useMemo(() => calculateQuote({ seats, months }), [seats, months])
  const hints = useMemo(() => getQuoteHints({ seats, months }), [seats, months])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const changeSeats = (delta: number) => {
    const next = Math.min(MAX_SEATS, Math.max(MIN_SEATS, (Number.isFinite(seats) ? seats : MIN_SEATS) + delta))
    update('seats', String(next))
  }

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {}
    if (!form.organization.trim()) next.organization = '학교·기관명(또는 이름)을 입력해 주세요.'
    if (!form.contactName.trim()) next.contactName = '담당자명을 입력해 주세요.'
    if (!isValidPhone(form.contactPhone)) next.contactPhone = '올바른 연락처를 입력해 주세요.'
    if (!isValidEmail(form.contactEmail)) next.contactEmail = '올바른 이메일을 입력해 주세요.'
    if (!Number.isFinite(seats) || seats < MIN_SEATS) next.seats = '이용 인원을 입력해 주세요.'
    else if (seats > MAX_SEATS) next.seats = `${MAX_SEATS.toLocaleString('ko-KR')}명을 넘는 도입은 따로 문의해 주세요.`
    if (!Number.isFinite(months) || months < MIN_MONTHS) next.months = '이용 기간을 입력해 주세요.'
    else if (months > MAX_MONTHS) next.months = `최대 ${MAX_MONTHS}개월까지 견적할 수 있어요.`
    if (!parseDateInputValue(form.startDate)) next.startDate = '시작일을 선택해 주세요.'
    if (!form.agreed) next.agreed = '개인정보 수집·이용에 동의해 주세요.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleIssue = async () => {
    if (!validate()) {
      toast.error('입력 내용을 다시 확인해 주세요.')
      return
    }
    const issuedAt = new Date()
    const startDate = parseDateInputValue(form.startDate) ?? tomorrow()
    const data: QuoteDocumentData = {
      quoteNumber: generateQuoteNumber(issuedAt),
      issuedAt,
      startDate,
      recipient: {
        organization: form.organization.trim(),
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
        contactEmail: form.contactEmail.trim(),
        note: form.note,
      },
      breakdown,
    }
    setResult(data)
    try {
      const stored: StoredQuote = { ...data, issuedAt: issuedAt.toISOString(), startDate: startDate.toISOString() }
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(stored))
    } catch {
      toast.error('견적서 결과를 브라우저 세션에 저장할 수 없습니다. 발행된 견적서는 지금 바로 저장해 주세요.')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })

    // 운영자가 누가 견적을 받았는지 알 수 있게 문의함에 남긴다. 실패해도 발행은 그대로 진행.
    void fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'quote',
        message: [
          `[견적서 발행] ${data.quoteNumber}`,
          `${data.recipient.organization} / 담당 ${data.recipient.contactName}`,
          `${breakdown.seats}명 × ${breakdown.months}개월 (시작 ${form.startDate})${breakdown.discountRate > 0 ? ` · 단체 할인 ${Math.round(breakdown.discountRate * 100)}%` : ''}`,
          `합계 ${formatKrw(breakdown.totalAmount)} (부가세 포함)`,
          data.recipient.note.trim() ? `비고: ${data.recipient.note.trim()}` : '',
        ].filter(Boolean).join('\n'),
        contact: `${data.recipient.contactPhone} / ${data.recipient.contactEmail}`,
        page_url: window.location.href,
      }),
    }).catch(() => {})
  }

  const handleReset = () => {
    setResult(null)
    try { window.sessionStorage.removeItem(SESSION_KEY) } catch { /* noop */ }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSaveImage = async () => {
    if (!documentRef.current || !result) return
    setIsSaving(true)
    try {
      const dataUrl = await toPng(documentRef.current, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true })
      download(dataUrl, `퀴즈독_견적서_${result.quoteNumber}.png`)
    } catch (error) {
      console.error('견적서 이미지 저장 실패:', error)
      toast.error('이미지 저장에 실패했어요. 인쇄(PDF 저장)를 이용해 주세요.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="min-h-dvh font-bitbit"
      style={{ background: 'linear-gradient(180deg, #E0EEFF 0%, #F0F4FF 60%, #F8F9FF 100%)' }}
    >
      {/* 인쇄 때는 견적서만 남긴다 */}
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: #fff !important; }
          body * { visibility: hidden; }
          .quote-print-root, .quote-print-root * { visibility: visible; }
          .quote-print-root { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; box-shadow: none !important; }
        }
      `}</style>

      <div className="print:hidden">
        <Navbar />
      </div>

      <main className="px-4 pb-20 pt-28 sm:pt-32">
        <div className="mx-auto max-w-6xl">
          {result ? (
            <ResultView
              data={result}
              documentRef={documentRef}
              isSaving={isSaving}
              onPrint={() => window.print()}
              onSaveImage={handleSaveImage}
              onReset={handleReset}
            />
          ) : (
            <>
              {/* 헤더 */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
                <Link href="/pricing" className="mb-4 inline-flex items-center gap-1 text-sm font-black text-[#1A4F9C] hover:underline" style={{ fontFamily: FONT }}>
                  <ArrowLeft className="h-4 w-4" /> 요금제로 돌아가기
                </Link>
                <h1 className="text-4xl font-black leading-tight text-[#0F172A] md:text-5xl" style={{ fontFamily: FONT }}>
                  견적서 <span style={{ color: '#2E7BD4' }}>바로 발행</span>
                </h1>
                <p className="mt-3 text-base text-slate-600" style={{ fontFamily: FONT }}>
                  선생님 인원과 기간만 고르면 부가세 포함 견적서가 바로 나와요. 예산 편성·품의에 그대로 쓰세요.
                </p>
              </motion.div>

              {/* 베타 안내 */}
              <div
                className="mx-auto mb-8 max-w-3xl rounded-2xl px-5 py-4 text-center text-sm font-black text-[#1E40AF]"
                style={{ background: 'linear-gradient(135deg, #EFF6FF, #E0F2FE)', border: '2px solid #BFDBFE', fontFamily: FONT }}
              >
                베타 기간에는 전 기능이 무료입니다.
              </div>

              <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="min-w-0 space-y-6">
                  {/* 플랜 */}
                  <Section title="플랜">
                    <div
                      className="rounded-2xl p-5"
                      style={{ background: 'linear-gradient(160deg, #F0F7FF 0%, #EFF6FF 100%)', border: '2px solid #BFDBFE' }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-2xl font-black text-[#2563EB]" style={{ fontFamily: FONT }}>⚡ Pro</p>
                          <p className="mt-1 text-sm font-black text-slate-600" style={{ fontFamily: FONT }}>
                            선생님 1명당 월 <span className="text-lg text-[#1E3A8A]">{formatKrw(PRO_MONTHLY_LIST_PRICE)}</span>
                          </p>
                        </div>
                        <p className="text-xs font-black text-slate-500" style={{ fontFamily: FONT }}>
                          {GROUP_MIN_SEATS}명 이상이면 단체 할인 자동 적용
                        </p>
                      </div>

                      {/* 단체 할인 구간 — 현재 인원에 해당하는 칸이 강조되고, 누르면 그 구간의 최소 인원이 들어간다 */}
                      <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
                        <TierChip
                          label={`1~${GROUP_MIN_SEATS - 1}명`}
                          value="정가"
                          active={breakdown.discountRate === 0}
                          onClick={() => update('seats', String(MIN_SEATS))}
                        />
                        {GROUP_TIERS.map((tier, i) => {
                          const nextTier = GROUP_TIERS[i + 1]
                          return (
                            <TierChip
                              key={tier.minSeats}
                              label={nextTier ? `${tier.minSeats}~${nextTier.minSeats - 1}명` : `${tier.minSeats}명 이상`}
                              value={`${Math.round(tier.discountRate * 100)}% 할인`}
                              active={breakdown.discountRate === tier.discountRate}
                              onClick={() => update('seats', String(tier.minSeats))}
                            />
                          )
                        })}
                      </div>

                      <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
                        {['AI 문제 생성 무제한', '학생 최대 100명 동시 접속', '엑셀 리포트 다운로드', '고급 통계 분석'].map((f) => (
                          <li key={f} className="flex items-center gap-2 text-sm font-black text-slate-700" style={{ fontFamily: FONT }}>
                            <Check className="h-4 w-4 shrink-0 text-[#2563EB]" strokeWidth={3} /> {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Section>

                  {/* 실시간 요약 (폰·태블릿: 플랜 바로 아래) */}
                  <div className="lg:hidden">
                    <QuoteSummary breakdown={breakdown} />
                  </div>

                  {/* 기본 정보 */}
                  <Section title="기본 정보">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="학교(기관)명"
                        hint="학교는 지역명까지 포함해 정확하게 입력해 주세요. 예) 제주퀴즈초등학교. 개인이면 이름을 쓰셔도 돼요."
                        error={errors.organization}
                        className="sm:col-span-2"
                      >
                        <TextInput value={form.organization} onChange={(v) => update('organization', v)} placeholder="견적서를 발행할 학교(기관)명을 입력해 주세요" maxLength={60} />
                      </Field>
                      <Field label="담당자" error={errors.contactName}>
                        <TextInput value={form.contactName} onChange={(v) => update('contactName', v)} placeholder="담당자 성함을 입력해 주세요" maxLength={30} />
                      </Field>
                      <Field label="담당자 번호" error={errors.contactPhone}>
                        <TextInput value={form.contactPhone} onChange={(v) => update('contactPhone', v)} placeholder="담당자 휴대폰 번호를 입력해 주세요" inputMode="tel" maxLength={20} />
                      </Field>
                      <Field label="담당자 이메일" error={errors.contactEmail} className="sm:col-span-2">
                        <TextInput value={form.contactEmail} onChange={(v) => update('contactEmail', v)} placeholder="담당자 이메일을 입력해 주세요" inputMode="email" maxLength={100} />
                      </Field>
                    </div>
                  </Section>

                  {/* 플랜 사용일 선택 */}
                  <Section title="플랜 사용일 선택">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="사용 기간" hint="12개월 이상이면 2개월이 무료예요." error={errors.months} className="sm:col-span-2">
                        <div className="flex flex-wrap gap-2">
                          {MONTH_OPTIONS.map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => update('months', String(m))}
                              className={`rounded-xl px-4 py-2 text-sm font-black transition ${months === m ? 'bg-[#1E3A8A] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                              style={{ fontFamily: FONT }}
                            >
                              {m}개월
                            </button>
                          ))}
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={MIN_MONTHS}
                              max={MAX_MONTHS}
                              value={form.months}
                              onChange={(e) => update('months', e.target.value)}
                              className="w-24 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-800 outline-none focus:border-[#60A5FA]"
                              aria-label="사용 기간 직접 입력(개월)"
                            />
                            <span className="text-sm font-black text-slate-500" style={{ fontFamily: FONT }}>개월</span>
                          </div>
                        </div>
                      </Field>

                      <Field label="사용 시작일" error={errors.startDate}>
                        <input
                          type="date"
                          value={form.startDate}
                          min={toDateInputValue(new Date())}
                          onChange={(e) => update('startDate', e.target.value)}
                          className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-black text-slate-800 outline-none focus:border-[#60A5FA]"
                        />
                      </Field>

                      <Field
                        label="사용 인원 (선생님 계정 수)"
                        hint={`${GROUP_MIN_SEATS}명 이상이면 단체 할인이 자동으로 적용돼요. 학생은 인원에 넣지 않아요.`}
                        error={errors.seats}
                      >
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => changeSeats(-1)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200" aria-label="인원 감소">
                            <Minus className="h-4 w-4" strokeWidth={3} />
                          </button>
                          <input
                            type="number"
                            min={MIN_SEATS}
                            max={MAX_SEATS}
                            value={form.seats}
                            onChange={(e) => update('seats', e.target.value)}
                            className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-center text-lg font-black text-slate-800 outline-none focus:border-[#60A5FA]"
                            aria-label="사용 인원"
                          />
                          <button type="button" onClick={() => changeSeats(1)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200" aria-label="인원 증가">
                            <Plus className="h-4 w-4" strokeWidth={3} />
                          </button>
                        </div>
                      </Field>
                    </div>

                    {hints.length > 0 && (
                      <div className="mt-4 space-y-1.5">
                        {hints.map((h) => (
                          <p key={h} className="flex items-center gap-2 rounded-xl bg-[#ECFDF5] px-3 py-2 text-sm font-black text-[#166534]" style={{ fontFamily: FONT }}>
                            <Sparkles className="h-4 w-4 shrink-0" /> {h}
                          </p>
                        ))}
                      </div>
                    )}
                  </Section>

                  {/* 기타 */}
                  <Section title="기타">
                    <Field label="비고 (선택)" hint="견적서 하단에 그대로 인쇄돼요. 예) 학교 예산 편성용, 담당 부서명">
                      <textarea
                        value={form.note}
                        onChange={(e) => update('note', e.target.value.slice(0, 300))}
                        placeholder="비고 내용을 입력해주세요"
                        rows={3}
                        className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-black text-slate-800 outline-none focus:border-[#60A5FA]"
                      />
                    </Field>
                  </Section>

                  {/* 동의 + 발행 */}
                  <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6" style={{ boxShadow: CARD_SHADOW }}>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={form.agreed}
                        onChange={(e) => update('agreed', e.target.checked)}
                        className="mt-1 h-5 w-5 shrink-0 accent-[#1E3A8A]"
                      />
                      <span className="text-sm font-black text-slate-700" style={{ fontFamily: FONT }}>
                        견적서 발행을 위한{' '}
                        <Link href="/privacy" target="_blank" className="text-[#1E3A8A] underline">개인정보 수집 및 이용</Link>
                        에 동의합니다. (기관명·담당자·연락처·이메일은 견적 발행과 도입 상담에만 쓰이고, 상담 종료 후 파기합니다.)
                      </span>
                    </label>
                    {errors.agreed && <p className="mt-2 text-xs font-black text-red-600" style={{ fontFamily: FONT }}>{errors.agreed}</p>}

                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleIssue}
                      className="mt-5 w-full rounded-xl px-6 py-4 text-lg font-black text-white"
                      style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', boxShadow: '0 4px 20px rgba(59,130,246,0.35)', fontFamily: FONT }}
                    >
                      견적서 발행
                    </motion.button>
                  </div>
                </div>

                {/* 실시간 요약 (데스크톱: 오른쪽 고정) */}
                <aside className="hidden lg:sticky lg:top-28 lg:block lg:self-start">
                  <QuoteSummary breakdown={breakdown} />
                </aside>
              </div>
            </>
          )}
        </div>
      </main>

      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  )
}

function ResultView({
  data,
  documentRef,
  isSaving,
  onPrint,
  onSaveImage,
  onReset,
}: {
  data: QuoteDocumentData
  documentRef: React.Ref<HTMLDivElement>
  isSaving: boolean
  onPrint: () => void
  onSaveImage: () => void
  onReset: () => void
}) {
  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6 text-center print:hidden">
        <p className="inline-block rounded-full px-5 py-1.5 text-sm font-black text-[#166534]" style={{ background: '#DCFCE7', border: '2px solid #86EFAC', fontFamily: FONT }}>
          ✅ 견적서가 발행됐어요
        </p>
        <h1 className="mt-4 text-3xl font-black text-[#0F172A] md:text-4xl" style={{ fontFamily: FONT }}>
          견적번호 <span style={{ color: '#2E7BD4' }}>{data.quoteNumber}</span>
        </h1>
        <p className="mt-2 text-sm font-black text-slate-500" style={{ fontFamily: FONT }}>
          인쇄 창에서 &quot;PDF로 저장&quot;을 고르면 PDF 파일로도 받을 수 있어요.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <ActionButton onClick={onPrint} color="blue"><Printer className="h-4 w-4" /> 인쇄 · PDF 저장</ActionButton>
          <ActionButton onClick={onSaveImage} color="blue" disabled={isSaving}><Download className="h-4 w-4" /> {isSaving ? '저장 중' : '이미지로 저장'}</ActionButton>
          <ActionButton onClick={onReset} color="white"><RotateCcw className="h-4 w-4" /> 다시 작성</ActionButton>
        </div>
      </motion.div>

      <div className="quote-print-root overflow-x-auto rounded-2xl bg-white shadow-xl print:overflow-visible print:rounded-none print:shadow-none">
        <QuoteDocument ref={documentRef} data={data} />
      </div>
    </div>
  )
}

function QuoteSummary({ breakdown }: { breakdown: QuoteBreakdown }) {
  return (
    <div className="rounded-2xl bg-white p-5 sm:p-6" style={{ boxShadow: '0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(59,130,246,0.14)' }}>
      <div className="mb-4 h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg, #2563EB, #3B82F6, #60A5FA)' }} />
      <h2 className="text-xl font-black text-[#0F172A]" style={{ fontFamily: FONT }}>예상 견적</h2>
      <p className="mt-1 text-xs font-black text-slate-500" style={{ fontFamily: FONT }}>{breakdown.planLabel}</p>

      <dl className="mt-4 space-y-2 text-sm font-black" style={{ fontFamily: FONT }}>
        <SummaryRow label="인원" value={`${breakdown.seats.toLocaleString('ko-KR')}명`} />
        <SummaryRow label="사용 기간" value={`${breakdown.months}개월${breakdown.freeMonths > 0 ? ` (${breakdown.freeMonths}개월 무료)` : ''}`} />
        <SummaryRow label="인당 월 요금" value={formatKrw(breakdown.unitPrice)} sub={breakdown.discountRate > 0 ? `단체 ${Math.round(breakdown.discountRate * 100)}% 할인` : undefined} />
        <div className="my-3 border-t-2 border-dashed border-slate-200" />
        <SummaryRow label="공급가액" value={formatKrw(breakdown.supplyAmount)} />
        <SummaryRow label="부가세 (10%)" value={formatKrw(breakdown.vatAmount)} />
      </dl>

      <div className="mt-4 rounded-2xl bg-[#EFF6FF] px-4 py-3">
        <p className="text-xs font-black text-slate-500" style={{ fontFamily: FONT }}>합계 (부가세 포함)</p>
        <p className="text-3xl font-black tabular-nums text-[#2563EB]" style={{ fontFamily: FONT }}>{formatKrw(breakdown.totalAmount)}</p>
        {breakdown.listTotal > breakdown.supplyAmount && (
          <p className="mt-1 text-xs font-black text-[#16A34A]" style={{ fontFamily: FONT }}>
            정가 대비 {formatKrw(breakdown.listTotal - breakdown.supplyAmount)} 절약
          </p>
        )}
      </div>

      <p className="mt-4 text-xs font-black leading-relaxed text-slate-400" style={{ fontFamily: FONT }}>
        견적 유효기간은 발행일로부터 {QUOTE_VALID_DAYS}일이에요. 발행 즉시 인쇄·PDF·이미지로 저장할 수 있어요.
      </p>
    </div>
  )
}

function TierChip({ label, value, active, onClick }: { label: string; value: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`whitespace-nowrap rounded-xl px-3 py-2 text-center text-xs font-black transition sm:text-sm ${active ? 'bg-[#2563EB] text-white' : 'bg-white text-slate-600 hover:-translate-y-0.5 hover:border-[#60A5FA] hover:bg-[#EFF6FF]'}`}
      style={{ border: active ? '2px solid #1D4ED8' : '2px solid #DBEAFE', fontFamily: FONT }}
    >
      {label}
      <span className="ml-1.5">{value}</span>
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 sm:p-6" style={{ boxShadow: CARD_SHADOW }}>
      <h2 className="mb-4 text-xl font-black text-[#0F172A]" style={{ fontFamily: FONT }}>{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, hint, error, className = '', children }: { label: string; hint?: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-black text-slate-700" style={{ fontFamily: FONT }}>{label}</label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-black text-red-600" style={{ fontFamily: FONT }}>{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs font-black text-slate-400" style={{ fontFamily: FONT }}>{hint}</p>
      ) : null}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, inputMode, maxLength }: { value: string; onChange: (v: string) => void; placeholder: string; inputMode?: 'tel' | 'email' | 'text'; maxLength?: number }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      maxLength={maxLength}
      className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-black text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-[#60A5FA]"
    />
  )
}

function SummaryRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">
        {value}
        {sub && <span className="ml-1.5 rounded-full bg-[#DCFCE7] px-2 py-0.5 text-xs text-[#166534]">{sub}</span>}
      </dd>
    </div>
  )
}

function ActionButton({ children, onClick, color, disabled = false }: { children: React.ReactNode; onClick: () => void; color: 'blue' | 'white'; disabled?: boolean }) {
  const style = {
    blue: { background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: '#fff', boxShadow: '0 4px 20px rgba(59,130,246,0.35)' },
    white: { background: '#fff', color: '#1E3A8A', boxShadow: '0 4px 16px rgba(148,163,184,0.25)' },
  }[color]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition hover:opacity-90 disabled:opacity-60"
      style={{ ...style, fontFamily: FONT }}
    >
      {children}
    </button>
  )
}
