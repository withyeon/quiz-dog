/**
 * 카드 소리 내어 읽기. 브라우저 내장 음성(Web Speech API)을 쓰므로 따로 드는 비용이 없다.
 * 언어는 글자로 짐작한다 — 한글이면 한국어, 가나면 일본어, 한자만 있으면 중국어, 나머지는 영어.
 */
export function guessSpeechLang(text: string): string {
  if (/[가-힣]/.test(text)) return 'ko-KR'
  if (/[぀-ヿ]/.test(text)) return 'ja-JP'
  if (/[一-鿿]/.test(text)) return 'zh-CN'
  if (/[ñ¿¡]/i.test(text)) return 'es-ES'
  if (/[äöüß]/i.test(text)) return 'de-DE'
  if (/[àâçéèêëîïôûùœ]/i.test(text)) return 'fr-FR'
  return 'en-US'
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speak(text: string): void {
  if (!canSpeak() || !text.trim()) return
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = guessSpeechLang(text)
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
  } catch {
    // 음성이 없는 기기 — 조용히 넘어간다
  }
}
