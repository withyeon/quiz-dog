import { forwardRef } from 'react'
import { COMPANY } from '@/lib/legal/company'
import {
  QUOTE_VALID_DAYS,
  addDays,
  addMonths,
  formatDateKo,
  formatKrw,
  type QuoteBreakdown,
} from '@/lib/pricing/quote'

export type QuoteRecipient = {
  organization: string
  contactName: string
  contactPhone: string
  contactEmail: string
  note: string
}

export type QuoteDocumentData = {
  quoteNumber: string
  issuedAt: Date
  startDate: Date
  recipient: QuoteRecipient
  breakdown: QuoteBreakdown
}

/**
 * 견적서 본문. 화면·인쇄·이미지 저장이 전부 이 하나를 그린다.
 * 게임 화면과 달리 공문에 붙는 서류라 픽셀 폰트를 쓰지 않고 시스템 글꼴로 단정하게 둔다.
 */
const QuoteDocument = forwardRef<HTMLDivElement, { data: QuoteDocumentData }>(
  function QuoteDocument({ data }, ref) {
    const { quoteNumber, issuedAt, startDate, recipient, breakdown } = data
    const endDate = addMonths(startDate, breakdown.months)
    const validUntil = addDays(issuedAt, QUOTE_VALID_DAYS - 1)
    const discountPercent = Math.round(breakdown.discountRate * 100)

    return (
      <div
        ref={ref}
        className="quote-document font-plain relative mx-auto w-full min-w-0 max-w-[794px] bg-white px-5 py-8 text-slate-900 sm:px-10 sm:py-12"
      >
        {/* 제목 */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black tracking-[0.5em] text-slate-900 sm:text-4xl">견 적 서</h1>
          <p className="mt-2 text-xs font-semibold text-slate-500">QUOTATION</p>
        </div>

        {/* 수신 / 공급자 */}
        <div className="mb-8 grid min-w-0 gap-6 sm:grid-cols-2">
          <table className="w-full table-fixed border-collapse text-sm">
            <tbody>
              <Row label="견적번호" value={quoteNumber} />
              <Row label="견적일자" value={formatDateKo(issuedAt)} />
              <Row label="수신" value={`${recipient.organization} 귀중`} strong />
              <Row label="담당자" value={recipient.contactName} />
              <Row label="연락처" value={recipient.contactPhone} />
              <Row label="이메일" value={recipient.contactEmail} />
            </tbody>
          </table>

          <table className="w-full table-fixed border-collapse text-sm">
            <tbody>
              <tr>
                <th colSpan={2} className="border border-slate-300 bg-slate-100 px-3 py-2 text-left text-xs font-bold tracking-wider text-slate-600">
                  공급자
                </th>
              </tr>
              <Row label="상호" value={COMPANY.name} strong />
              {COMPANY.representative && <Row label="대표자" value={COMPANY.representative} />}
              <Row label="사업자등록번호" value={COMPANY.bizRegNo} />
              <Row label="주소" value={COMPANY.address} />
              <Row label="전화" value={COMPANY.phone} />
              <Row label="이메일" value={COMPANY.email} />
            </tbody>
          </table>
        </div>

        <p className="mb-3 text-sm text-slate-700">아래와 같이 견적합니다.</p>

        {/* 합계 강조 */}
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 rounded-lg border-2 border-slate-800 px-4 py-3">
          <span className="text-sm font-bold text-slate-700">합계 금액 (부가세 포함)</span>
          <span className="text-2xl font-black tabular-nums text-slate-900">{formatKrw(breakdown.totalAmount)}</span>
        </div>

        {/* 품목 */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-xs font-bold text-slate-600">
                <th className="border border-slate-300 px-3 py-2 text-left">품목</th>
                <th className="border border-slate-300 px-3 py-2 text-right">단가 (인/월)</th>
                <th className="border border-slate-300 px-3 py-2 text-right">인원</th>
                <th className="border border-slate-300 px-3 py-2 text-right">과금 개월</th>
                <th className="border border-slate-300 px-3 py-2 text-right">공급가액</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-300 px-3 py-3 align-top">
                  <p className="font-bold text-slate-900">{breakdown.planLabel}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    사용 기간 {formatDateKo(startDate)} ~ {formatDateKo(endDate)} ({breakdown.months}개월)
                  </p>
                  {discountPercent > 0 && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      단체 할인 {discountPercent}% 적용 (정가 {formatKrw(breakdown.listUnitPrice)}/인/월)
                    </p>
                  )}
                  {breakdown.freeMonths > 0 && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      장기 계약 혜택: {breakdown.freeMonths}개월 무료 (과금 {breakdown.billableMonths}개월)
                    </p>
                  )}
                </td>
                <td className="border border-slate-300 px-3 py-3 text-right tabular-nums align-top">{formatKrw(breakdown.unitPrice)}</td>
                <td className="border border-slate-300 px-3 py-3 text-right tabular-nums align-top">{breakdown.seats.toLocaleString('ko-KR')}명</td>
                <td className="border border-slate-300 px-3 py-3 text-right tabular-nums align-top">{breakdown.billableMonths}개월</td>
                <td className="border border-slate-300 px-3 py-3 text-right tabular-nums align-top">{formatKrw(breakdown.supplyAmount)}</td>
              </tr>
            </tbody>
            <tfoot className="text-sm">
              <tr>
                <td colSpan={4} className="border border-slate-300 bg-slate-50 px-3 py-2 text-right font-semibold text-slate-600">공급가액</td>
                <td className="border border-slate-300 px-3 py-2 text-right tabular-nums">{formatKrw(breakdown.supplyAmount)}</td>
              </tr>
              <tr>
                <td colSpan={4} className="border border-slate-300 bg-slate-50 px-3 py-2 text-right font-semibold text-slate-600">부가세 (10%)</td>
                <td className="border border-slate-300 px-3 py-2 text-right tabular-nums">{formatKrw(breakdown.vatAmount)}</td>
              </tr>
              <tr>
                <td colSpan={4} className="border border-slate-300 bg-slate-100 px-3 py-2 text-right font-black text-slate-900">합계</td>
                <td className="border border-slate-300 bg-slate-100 px-3 py-2 text-right font-black tabular-nums text-slate-900">{formatKrw(breakdown.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 비고·조건 */}
        <div className="mt-6 space-y-1.5 text-xs leading-relaxed text-slate-600">
          <p>· 견적 유효기간: 견적일로부터 {QUOTE_VALID_DAYS}일 ({formatDateKo(validUntil)}까지)</p>
          <p>· 위 금액은 부가가치세(10%)가 포함된 금액이며, 인원·기간이 달라지면 금액도 달라집니다.</p>
          <p>· 학생 계정은 인원에 포함되지 않습니다. 학생은 별도 비용 없이 참여합니다.</p>
          <p>· 결제·계약 문의: {COMPANY.email} / {COMPANY.phone}</p>
          {recipient.note.trim() && (
            <p className="whitespace-pre-wrap break-words">· 비고: {recipient.note.trim()}</p>
          )}
        </div>

        {/* 서명 */}
        <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm text-slate-500">{formatDateKo(issuedAt)}</p>
          <div className="text-right">
            <p className="text-base font-black text-slate-900">{COMPANY.name}</p>
            <p className="text-xs text-slate-500">{COMPANY.serviceName} 운영 · {COMPANY.email}</p>
          </div>
        </div>
      </div>
    )
  },
)

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr>
      <th className="w-24 border border-slate-300 bg-slate-50 px-2 py-2 text-left text-xs font-bold text-slate-600 sm:w-28 sm:px-3">
        {label}
      </th>
      <td className={`break-all border border-slate-300 px-2 py-2 sm:px-3 ${strong ? 'font-bold text-slate-900' : 'text-slate-800'}`}>
        {value}
      </td>
    </tr>
  )
}

export default QuoteDocument
