import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: '이용약관 - 퀴즈독',
  description: '퀴즈독 서비스 이용약관',
}

const UPDATED_AT = '2026년 6월 7일'

export default function TermsPage() {
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
              본 약관은 퀴즈독(이하 &lsquo;서비스&rsquo;)이 제공하는 실시간 퀴즈 게임 및 관련 제반 서비스의 이용과
              관련하여 서비스와 이용자 간의 권리·의무 및 책임사항, 이용 조건 및 절차 등 기본적인 사항을 규정함을 목적으로
              합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제2조 (정의)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>&lsquo;이용자&rsquo;란 본 약관에 따라 서비스를 이용하는 교사(주최자) 및 학생(참여자)을 말합니다.</li>
              <li>&lsquo;콘텐츠&rsquo;란 이용자가 서비스 내에서 작성·업로드하는 문제, 문제집, 학습자료 등을 말합니다.</li>
              <li>&lsquo;게임방&rsquo;이란 교사가 생성하여 학생이 코드로 참여하는 실시간 게임 단위를 말합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제3조 (약관의 효력 및 변경)</h2>
            <p>
              본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다. 서비스는 관련 법령을 위배하지 않는 범위에서 약관을
              개정할 수 있으며, 개정 시 적용일자 및 사유를 명시하여 사전 공지합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제4조 (서비스의 제공)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>실시간 퀴즈 게임 및 다양한 게임 모드 제공</li>
              <li>AI 기반 문제 생성 및 문제집 관리 기능</li>
              <li>게임 결과 및 학습 리포트 제공</li>
            </ul>
            <p className="mt-2">
              서비스는 운영상·기술상 필요에 따라 제공하는 서비스의 내용을 변경하거나 중단할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제5조 (이용자의 의무)</h2>
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
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제6조 (콘텐츠의 권리와 책임)</h2>
            <p>
              이용자가 작성·업로드한 콘텐츠의 권리와 책임은 해당 이용자에게 있습니다. 이용자는 자신이 적법한 권리를 보유한
              콘텐츠만을 업로드하여야 하며, 제3자의 권리를 침해하지 않을 책임을 부담합니다. 서비스는 게임 진행 및 기능
              제공에 필요한 범위에서 콘텐츠를 저장·처리할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제7조 (서비스 이용의 제한)</h2>
            <p>
              이용자가 본 약관을 위반하거나 서비스의 정상적인 운영을 방해한 경우, 서비스는 사전 통지 없이 해당 이용자의
              게임방 참여를 제한하거나 콘텐츠를 삭제할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제8조 (면책조항)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                서비스는 천재지변, 통신사·호스팅 사업자의 장애, 이용자의 귀책사유 등 불가항력으로 인한 서비스 중단에
                대하여 책임을 지지 않습니다.
              </li>
              <li>
                서비스는 이용자가 게재한 콘텐츠의 정확성·신뢰성, 이용자 간 상호작용으로 발생한 분쟁에 대하여 책임을 지지
                않습니다.
              </li>
              <li>
                AI로 생성된 문제·답안은 부정확할 수 있으며, 이용자는 이를 검토·수정할 책임이 있습니다.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">제9조 (준거법 및 관할)</h2>
            <p>
              본 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련하여 분쟁이 발생할 경우 관련 법령이 정한 절차에
              따릅니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">부칙</h2>
            <p>본 약관은 {UPDATED_AT}부터 시행합니다.</p>
            <p className="mt-1">운영자(상호): 위드현 에듀테크</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
