/**
 * 사업자/운영자 정보 단일 소스.
 * 법적 페이지(개인정보처리방침·이용약관·문의)와 Footer가 모두 이 값을 참조한다.
 * 값을 한 곳에서만 관리해 문서 간 불일치를 방지한다.
 *
 * ⚠️ 빈 문자열인 필드는 화면에 렌더되지 않는다(조건부). 확보되는 대로 채울 것:
 *   - representative(대표자명)
 *   - mailOrderNo(통신판매업 신고번호) — 유료(구독) 판매 시 전자상거래법상 표시 의무
 */
export const COMPANY = {
  serviceName: '퀴즈독',
  /** 상호 */
  name: '위드현 에듀테크',
  /** 대표자명 — TODO: 확보 후 입력 */
  representative: '',
  /** 사업자등록번호 */
  bizRegNo: '473-75-00604',
  /** 통신판매업 신고번호 — TODO: 신고 후 입력 */
  mailOrderNo: '',
  /** 사업장 소재지 */
  address: '제주특별자치도 제주시 고마로 11길 28-1',
  /** 문의 이메일 */
  email: 'withyeonedu@naver.com',
  /** 문의 전화 */
  phone: '010-3461-6744',
  /** 개인정보 보호책임자 직함/이름 */
  privacyOfficer: '개인정보 보호책임자',
} as const

/** 사업자 정보를 라벨-값 배열로 — 빈 값은 제외. Footer/문의 페이지 공용. */
export function getBusinessInfoLines(): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [
    { label: '상호', value: COMPANY.name },
    { label: '대표자', value: COMPANY.representative },
    { label: '사업자등록번호', value: COMPANY.bizRegNo },
    { label: '통신판매업신고번호', value: COMPANY.mailOrderNo },
    { label: '주소', value: COMPANY.address },
    { label: '전화', value: COMPANY.phone },
    { label: '이메일', value: COMPANY.email },
  ]
  return lines.filter((line) => line.value.trim() !== '')
}
