import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { COMPANY } from '@/lib/legal/company'

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
            {COMPANY.name}(이하 &lsquo;회사&rsquo;)이 운영하는 {COMPANY.serviceName}(이하 &lsquo;서비스&rsquo;)은
            「개인정보 보호법」 및 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등 관련 법령을 준수하며,
            이용자의 개인정보를 보호하기 위해 다음과 같이 개인정보처리방침을 수립·공개합니다. 본 서비스는 교사의
            지도 아래 교실 수업에서 사용되도록 설계되었으며, 학생의 별도 회원가입이나 로그인 없이 최소한의 정보만을
            수집합니다.
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
                <strong>유료 서비스 이용자:</strong> 유료 요금제 결제 시 결제대행사(PG사)를 통해 처리되는 결제 정보.
                회사는 카드번호 등 결제 수단 정보를 직접 저장하지 않으며, 결제 승인·취소 처리에 필요한 거래 식별
                정보만을 전달받습니다.
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
              <li>유료 서비스 제공, 요금 결제·정산 및 환불 처리</li>
              <li>부정 이용 방지, 서비스 안정성 확보 및 오류 대응</li>
              <li>고객 문의 응대 및 공지사항 전달</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. 개인정보의 보유 및 이용 기간</h2>
            <p className="mb-2">
              수집된 정보는 수집·이용 목적이 달성되면 지체 없이 파기합니다. 항목별 보유 기간은 다음과 같습니다.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-200 px-3 py-2 text-left">항목</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">보유 기간</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">게임 세션 데이터(닉네임·점수·게임 상태)</td>
                    <td className="border border-gray-200 px-3 py-2">해당 게임(수업) 종료 후 또는 최대 1년 경과 시 파기</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">교사가 업로드한 학습 콘텐츠</td>
                    <td className="border border-gray-200 px-3 py-2">이용자의 삭제 요청 또는 이용 종료 시까지</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">접속 IP·접속 기록</td>
                    <td className="border border-gray-200 px-3 py-2">「통신비밀보호법」에 따라 3개월</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">결제·거래 기록</td>
                    <td className="border border-gray-200 px-3 py-2">「전자상거래 등에서의 소비자보호에 관한 법률」에 따라 5년</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2">
              관계 법령에 따라 보존할 필요가 있는 경우 해당 법령이 정한 기간 동안 보관합니다.
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
                    <td className="border border-gray-200 px-3 py-2">Vercel Inc.</td>
                    <td className="border border-gray-200 px-3 py-2">웹 서비스 호스팅 및 운영</td>
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
              유료 결제 기능 도입 시 결제대행사(PG사)가 결제 처리 수탁자로 추가되며, 변경 사항은 본 방침을 통해
              사전에 고지합니다. 본 서비스는 법령에 정한 경우를 제외하고 이용자의 개인정보를 제3자에게 제공하지
              않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. 쿠키 및 세션 저장소의 사용</h2>
            <p>
              본 서비스는 게임 진행 상태 유지, 접근 권한 확인 등을 위해 브라우저의 세션 저장소(sessionStorage) 및
              쿠키를 사용합니다. 이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 게임 참여 등
              일부 기능의 이용이 제한될 수 있습니다. 본 서비스는 광고 목적의 추적 쿠키를 사용하지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. 만 14세 미만 아동의 개인정보</h2>
            <p>
              본 서비스는 초·중등 교육 현장에서 교사의 지도·감독 아래 이용되는 것을 전제로 하며, 학생으로부터 실명 등
              신원 식별 정보를 수집하지 않습니다. 만 14세 미만 아동의 개인정보가 처리될 수 있는 경우, 「개인정보 보호법」에
              따라 법정대리인의 동의가 필요할 수 있으며, 교육기관(교사)은 소속 기관의 정책 및 관련 법령에 따라 이용
              여부를 판단하여야 합니다. 본 서비스는 아동의 개인정보 보호를 위해 닉네임 외 최소한의 정보만을 처리합니다.
              유료 결제는 교사(성인)를 대상으로 하며, 미성년자의 결제는 법정대리인의 동의를 전제로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. 정보주체의 권리 및 행사 방법</h2>
            <p>
              이용자는 언제든지 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요구할 수 있습니다. 권리 행사는 아래
              개인정보 보호책임자에게 서면, 전자우편 등을 통해 요청할 수 있으며, 본 서비스는 지체 없이 조치합니다.
              이용자는 법정대리인이나 위임을 받은 자를 통하여도 권리를 행사할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. 개인정보의 파기</h2>
            <p>
              보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 복구·재생이 불가능한 방법으로 지체 없이 파기합니다.
              전자적 파일 형태의 정보는 기술적 방법을 사용하여 영구 삭제합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. 개인정보의 안전성 확보 조치</h2>
            <p>
              본 서비스는 개인정보의 안전성 확보를 위해 전송 구간 암호화(HTTPS), 접근 권한 관리·최소화, 접속 기록 보관,
              내부 관리계획 수립 등 관리적·기술적 보호조치를 시행합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. 개인정보 보호책임자</h2>
            <p>
              개인정보 처리에 관한 문의·불만·피해 구제는 아래 책임자에게 연락하실 수 있습니다.
            </p>
            <ul className="list-none pl-0 mt-2 space-y-1">
              <li>· 운영자(상호): {COMPANY.name}</li>
              <li>· 개인정보 보호책임자: {COMPANY.privacyOfficer}</li>
              <li>· 이메일: {COMPANY.email}</li>
              <li>· 전화: {COMPANY.phone}</li>
              <li>· 주소: {COMPANY.address}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. 권익침해 구제 방법</h2>
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
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. 개정에 관한 사항</h2>
            <p>
              본 개인정보처리방침은 법령·서비스 변경에 따라 개정될 수 있으며, 개정 시 시행일자 및 변경 내용을 서비스
              내 공지를 통해 고지합니다.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
