import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { COMPANY, getBusinessInfoLines } from '@/lib/legal/company'

export const metadata: Metadata = {
  title: '이용약관 - 퀴즈독',
  description: '퀴즈독 서비스 이용약관',
}

const UPDATED_AT = '2026년 6월 7일'

export default function TermsPage() {
  const businessInfo = getBusinessInfoLines()
  return (
    <div className="min-h-dvh bg-white">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 pt-32 pb-16">
        <h1 className="text-3xl font-bold text-[#1e3a8a] mb-2">이용약관</h1>
        <p className="text-sm text-gray-500 mb-10">시행일: {UPDATED_AT}</p>

        <div className="space-y-8 text-[15px] leading-7 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제1조 (목적)</h2>
            <p>
              본 약관은 {COMPANY.name}(이하 &lsquo;회사&rsquo;)이 제공하는 {COMPANY.serviceName}(이하 &lsquo;서비스&rsquo;)의
              이용과 관련하여 회사와 이용자 간의 권리·의무 및 책임사항, 이용 조건 및 절차 등 기본적인 사항을 규정함을
              목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제2조 (정의)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>&lsquo;이용자&rsquo;란 본 약관에 따라 서비스를 이용하는 교사(주최자) 및 학생(참여자)을 말합니다.</li>
              <li>&lsquo;콘텐츠&rsquo;란 이용자가 서비스 내에서 작성·업로드하는 문제, 문제집, 학습자료 등을 말합니다.</li>
              <li>&lsquo;게임방&rsquo;이란 교사가 생성하여 학생이 코드로 참여하는 실시간 게임 단위를 말합니다.</li>
              <li>&lsquo;유료 서비스&rsquo;란 회사가 정한 요금을 지급하고 이용하는 서비스(예: Pro 요금제)를 말합니다.</li>
              <li>&lsquo;정기결제&rsquo;란 이용자가 선택한 결제 주기(월·연 등)에 따라 요금이 자동으로 청구되는 방식을 말합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제3조 (약관의 효력 및 변경)</h2>
            <p>
              본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다. 회사는 「약관의 규제에 관한 법률」, 「전자상거래
              등에서의 소비자보호에 관한 법률」 등 관련 법령을 위배하지 않는 범위에서 약관을 개정할 수 있으며, 개정 시
              적용일자 및 사유를 명시하여 적용일 7일 전(이용자에게 불리한 변경은 30일 전)부터 사전 공지합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제4조 (서비스의 제공 및 변경)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>실시간 퀴즈 게임 및 다양한 게임 모드 제공</li>
              <li>AI 기반 문제 생성 및 문제집 관리 기능</li>
              <li>게임 결과 및 학습 리포트 제공</li>
            </ul>
            <p className="mt-2">
              회사는 운영상·기술상 필요에 따라 제공하는 서비스의 내용을 변경하거나 중단할 수 있으며, 이 경우 변경 내용을
              사전에 공지합니다. 무료로 제공되는 서비스의 일부 또는 전부는 회사의 정책에 따라 수정·중단될 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제5조 (유료 서비스 및 요금)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>유료 서비스의 종류, 요금, 결제 주기 등 세부 내용은 서비스 내 요금제 안내 화면에 게시합니다.</li>
              <li>
                정기결제형 유료 서비스는 이용자가 해지하지 않는 한 결제 주기마다 자동으로 갱신·청구되며, 이용자는
                언제든지 다음 결제일 전에 해지를 신청할 수 있습니다.
              </li>
              <li>회사는 요금을 변경할 수 있으며, 변경 시 적용일 및 내용을 사전에 공지합니다. 변경된 요금은 공지된 적용일 이후의 결제 주기부터 적용됩니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제6조 (청약철회 및 환불)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                이용자는 유료 서비스 결제일로부터 7일 이내에, 서비스(디지털 콘텐츠)를 이용하지 않은 경우 청약을 철회하고
                전액 환불을 요청할 수 있습니다.
              </li>
              <li>
                「전자상거래 등에서의 소비자보호에 관한 법률」 제17조 제2항에 따라, 이용을 개시한 디지털 콘텐츠 등
                청약철회가 제한되는 경우 환불이 제한될 수 있습니다. 다만 가분적 서비스의 미이용 부분에 대해서는 잔여
                기간에 비례하여 환불합니다.
              </li>
              <li>
                정기결제 해지 시 다음 결제 주기부터 청구가 중단되며, 이미 결제되어 이용 중인 기간의 요금은 원칙적으로
                환불되지 않습니다. 단, 회사의 귀책사유 또는 서비스의 중대한 하자로 정상 이용이 불가능했던 경우에는
                해당 기간에 대해 환불합니다.
              </li>
              <li>환불은 원칙적으로 결제 시 사용한 결제수단의 취소 또는 동일 수단으로의 환급을 통해 처리합니다.</li>
              <li>환불 및 청약철회 요청은 본 약관 말미의 연락처 또는 문의하기 채널을 통해 접수합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제7조 (이용자의 의무)</h2>
            <p className="mb-2">이용자는 다음 행위를 하여서는 안 됩니다.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>타인의 개인정보·명예를 침해하거나 모욕·비방하는 행위</li>
              <li>음란·폭력적이거나 공서양속에 반하는 닉네임·콘텐츠 등록 행위</li>
              <li>서비스의 정상적인 운영을 방해하는 행위(부정한 점수 조작, 비정상적 접근 등)</li>
              <li>타인의 저작권 등 지식재산권을 침해하는 콘텐츠 업로드 행위</li>
              <li>관련 법령 및 본 약관을 위반하는 행위</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제8조 (콘텐츠의 권리와 책임)</h2>
            <p>
              이용자가 작성·업로드한 콘텐츠의 권리와 책임은 해당 이용자에게 있습니다. 이용자는 자신이 적법한 권리를 보유한
              콘텐츠만을 업로드하여야 하며, 제3자의 권리를 침해하지 않을 책임을 부담합니다. 회사는 게임 진행 및 기능
              제공에 필요한 범위에서 콘텐츠를 저장·처리할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제9조 (서비스 이용의 제한)</h2>
            <p>
              이용자가 본 약관을 위반하거나 서비스의 정상적인 운영을 방해한 경우, 회사는 사전 통지 없이 해당 이용자의
              게임방 참여를 제한하거나 콘텐츠를 삭제할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제10조 (미성년자의 결제)</h2>
            <p>
              유료 서비스는 원칙적으로 성인(교사)을 대상으로 합니다. 미성년자가 법정대리인의 동의 없이 유료 서비스를
              결제한 경우, 본인 또는 법정대리인은 「민법」에 따라 해당 계약을 취소할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제11조 (면책조항)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                회사는 천재지변, 통신사·호스팅 사업자의 장애, 이용자의 귀책사유 등 불가항력으로 인한 서비스 중단에
                대하여 책임을 지지 않습니다.
              </li>
              <li>
                회사는 이용자가 게재한 콘텐츠의 정확성·신뢰성, 이용자 간 상호작용으로 발생한 분쟁에 대하여 책임을 지지
                않습니다.
              </li>
              <li>
                AI로 생성된 문제·답안은 부정확할 수 있으며, 이용자는 이를 검토·수정할 책임이 있습니다.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제12조 (준거법 및 관할)</h2>
            <p>
              본 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련하여 회사와 이용자 간에 분쟁이 발생할 경우
              「민사소송법」상의 관할 법원에 제소합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">부칙</h2>
            <p>본 약관은 {UPDATED_AT}부터 시행합니다.</p>
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 font-semibold text-gray-900">서비스 제공자 정보</p>
              <ul className="list-none pl-0 space-y-0.5 text-sm">
                {businessInfo.map((line) => (
                  <li key={line.label}>· {line.label}: {line.value}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
