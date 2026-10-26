/**
 * 단어장으로 들어가는 버튼(사이드바·내 문제집의 "단어장 만들기")을 보여 줄지.
 * 공개 전에는 로컬 개발 서버에서만 보이고, 프로덕션에서는 /dev 페이지의 링크로만 들어간다.
 * 공개할 때 true 로 바꾼다. (이미 만든 단어장의 배지·공부 링크는 이 값과 상관없이 보인다)
 */
export const VOCAB_ENTRY_VISIBLE = process.env.NODE_ENV !== 'production'
