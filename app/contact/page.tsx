import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { COMPANY } from '@/lib/legal/company'
import FeedbackForm from '@/components/FeedbackForm'

export const metadata: Metadata = {
  title: '문의하기 - 퀴즈독',
  description: '퀴즈독에 문의하기',
}

export default function ContactPage() {
  return (
    <div className="min-h-dvh bg-white">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 pt-32 pb-16">
        <h1 className="text-3xl font-bold text-[#1e3a8a] mb-2">문의하기</h1>
        <p className="text-gray-600 mb-10">
          서비스 이용 중 궁금한 점이나 불편한 점이 있으시면 아래로 연락해 주세요. 빠르게 답변드리겠습니다.
        </p>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-1">운영자</h2>
            <p className="text-lg text-gray-900 font-medium">{COMPANY.name}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-1">이메일</h2>
            <a href={`mailto:${COMPANY.email}`} className="text-lg text-[#1e3a8a] font-medium underline">
              {COMPANY.email}
            </a>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-1">전화</h2>
            <p className="text-lg text-[#1e3a8a] font-medium">{COMPANY.phone}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-1">주소</h2>
            <p className="text-gray-700">{COMPANY.address}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-1">운영 시간</h2>
            <p className="text-gray-700">평일 10:00 – 18:00 (주말·공휴일 제외)</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-1">문의 유형</h2>
            <ul className="list-disc pl-5 text-gray-700 space-y-1">
              <li>서비스 이용 및 기능 문의</li>
              <li>오류·장애 신고</li>
              <li>유료 결제·환불 문의</li>
              <li>개인정보 관련 요청(열람·정정·삭제)</li>
              <li>제휴 및 기타 제안</li>
            </ul>
          </div>
        </div>

        <p className="text-sm text-gray-500 mt-6">
          개인정보 관련 문의는{' '}
          <a href="/privacy" className="text-[#1e3a8a] underline">
            개인정보처리방침
          </a>
          의 개인정보 보호책임자 정보도 함께 확인해 주세요.
        </p>

        <div className="mt-10">
          <FeedbackForm />
        </div>
      </main>
      <Footer />
    </div>
  )
}
