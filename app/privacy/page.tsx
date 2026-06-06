import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: '개인정보처리방침 - 퀴즈독',
  description: '퀴즈독 개인정보처리방침',
}

const UPDATED_AT = '2026년 6월 7일'

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-white">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 pt-32 pb-16">
        <h1 className="text-3xl font-bold text-[#1e3a8a] mb-2">개인정보처리방침</h1>
        <p className="text-sm text-gray-500 mb-10">시행일: {UPDATED_AT}</p>

        <div className="space-y-8 text-[15px] leading-7 text-gray-700">
          <p>
            퀴즈독(이하 &lsquo;서비스&rsquo;)은 「개인정보 보호법」 및 「정보통신망 이용촉진 및 정보보호 등에 관한
            법률」 등 관련 법령을 준수하며, 이용자의 개인정보를 보호하기 위해 다음과 같이 개인정보처리방침을
            수립·공개합니다. 본 서비스는 교사의 지도 아래 교실 수업에서 사용되도록 설계되었으며, 별도의 회원가입이나
            로그인 없이 최소한의 정보만을 수집합니다.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. 수집하는 개인정보 항목 및 수집 방법</h2>
            <p className="mb-2">본 서비스는 다음의 정보를 수집합니다.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>학생(참여자):</strong> 게임 참여 시 이용자가 직접 입력하는 닉네임, 선택한 캐릭터(아바타),
                게임 진행 중 생성되는 점수·응답 기록·게임 상태 정보
              </li>
              <li>
                <strong>교사(주최자):</strong> 문제집·문제 등 이용자가 작성하거나 업로드한 학습 콘텐츠(PDF·문서·이미지
                등), AI 문제 생성 시 입력한 자료
              </li>
              <li>
                <strong>자동 수집 정보:</strong> 서비스 이용 과정에서 접속 기기·브라우저 식별을 위한 임시 식별자(세션
                저장소 값), 오류·부정 이용 방지를 위한 접속 IP 및 접속 기록
              </li>
            </ul>
            <p className="mt-2">
              본 서비스는 실명, 주민등록번호, 연락처, 이메일 등 직접적인 신원 식별 정보를 학생에게 요구하지 않습니다.
              이용자가 닉네임 등에 실명이나 개인 식별 정보를 입력하지 않을 것을 권장합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. 개인정보의 수집·이용 목적</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>실시간 퀴즈 게임의 진행 및 참여자 간 상호작용 제공</li>
              <li>점수·순위·결과 리포트 등 학습 결과 제공</li>
              <li>AI 기반 문제 생성 기능 제공</li>
              <li>부정 이용 방지, 서비스 안정성 확보 및 오류 대응</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. 개인정보의 보유 및 이용 기간</h2>
            <p>
              수집된 정보는 수집·이용 목적이 달성되면 지체 없이 파기합니다. 게임 진행을 위한 닉네임·점수·게임 상태 등
              세션 데이터는 해당 게임(수업) 종료 후 또는 일정 기간(최대 1년) 경과 시 파기합니다. 단, 관계 법령에
              따라 보존할 필요가 있는 경우 해당 기간 동안 보관합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. 개인정보 처리의 위탁 및 국외 이전</h2>
            <p className="mb-2">
              본 서비스는 원활한 서비스 제공을 위해 아래와 같이 개인정보 처리 업무를 위탁하고 있으며, 일부 처리는
              국외에서 이루어집니다.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-200 px-3 py-2 text-left">수탁자</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">위탁 업무</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">이전 국가</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">Supabase, Inc.</td>
                    <td className="border border-gray-200 px-3 py-2">데이터베이스 호스팅 및 저장</td>
                    <td className="border border-gray-200 px-3 py-2">미국 등</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">Google LLC (Gemini API)</td>
                    <td className="border border-gray-200 px-3 py-2">AI 문제 생성 처리</td>
                    <td className="border border-gray-200 px-3 py-2">미국 등</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">OpenAI, L.L.C.</td>
                    <td className="border border-gray-200 px-3 py-2">AI 문제 생성 처리</td>
                    <td className="border border-gray-200 px-3 py-2">미국 등</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2">
              본 서비스는 법령에 정한 경우를 제외하고 이용자의 개인정보를 제3자에게 제공하지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. 만 14세 미만 아동의 개인정보</h2>
            <p>
              본 서비스는 초·중등 교육 현장에서 교사의 지도·감독 아래 이용되는 것을 전제로 하며, 학생으로부터 실명 등
              신원 식별 정보를 수집하지 않습니다. 만 14세 미만 아동의 개인정보가 처리될 수 있는 경우, 「개인정보 보호법」에
              따라 법정대리인의 동의가 필요할 수 있으며, 교육기관(교사)은 소속 기관의 정책 및 관련 법령에 따라 이용
              여부를 판단하여야 합니다. 본 서비스는 아동의 개인정보 보호를 위해 닉네임 외 최소한의 정보만을 처리합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. 정보주체의 권리 및 행사 방법</h2>
            <p>
              이용자는 언제든지 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요구할 수 있습니다. 권리 행사는 아래
              개인정보 보호책임자에게 서면, 전자우편 등을 통해 요청할 수 있으며, 본 서비스는 지체 없이 조치합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. 개인정보의 파기</h2>
            <p>
              보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 복구·재생이 불가능한 방법으로 지체 없이 파기합니다.
              전자적 파일 형태의 정보는 기술적 방법을 사용하여 영구 삭제합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. 개인정보의 안전성 확보 조치</h2>
            <p>
              본 서비스는 개인정보의 안전성 확보를 위해 전송 구간 암호화(HTTPS), 접근 권한 관리, 접속 기록 보관 등
              관리적·기술적 보호조치를 시행합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. 개인정보 보호책임자</h2>
            <p>
              개인정보 처리에 관한 문의·불만·피해 구제는 아래 책임자에게 연락하실 수 있습니다.
            </p>
            <ul className="list-none pl-0 mt-2 space-y-1">
              <li>· 운영자(상호): 위드현 에듀테크</li>
              <li>· 개인정보 보호책임자: 위드현 에듀테크 개인정보 보호책임자</li>
              <li>· 연락처: 010-3461-6744</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. 권익침해 구제 방법</h2>
            <p>
              개인정보 침해에 대한 신고·상담이 필요한 경우 아래 기관에 문의할 수 있습니다.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>개인정보분쟁조정위원회 (kopico.go.kr / 1833-6972)</li>
              <li>개인정보침해신고센터 (privacy.kisa.or.kr / 118)</li>
              <li>대검찰청 사이버수사과 (spo.go.kr / 1301)</li>
              <li>경찰청 사이버수사국 (cyberbureau.police.go.kr / 182)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. 개정에 관한 사항</h2>
            <p>
              본 개인정보처리방침은 법령·서비스 변경에 따라 개정될 수 있으며, 개정 시 서비스 내 공지를 통해 고지합니다.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
