'use client'

import {
  DEFAULT_STUDY_SETTINGS,
  STUDY_ATTEMPT_OPTIONS,
  type StudyFeedbackMode,
  type StudyQuestionOrder,
  type StudySettings,
} from '@/lib/game/studySettings'

type StudyOptionsFieldsProps = {
  value: StudySettings
  onChange: (next: StudySettings) => void
  /** 실시간 수업은 한 번 도는 세션이라 재도전 횟수를 고르지 않는다 */
  context: 'homework' | 'live'
}

function OptionButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border px-3 py-2.5 text-sm font-black transition ${
        active ? 'border-sky-400 bg-sky-50 text-sky-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * 공부 모드 옵션. 과제 패널과 실시간 수업 방 설정에서 같이 쓴다.
 * 옵션 뜻은 lib/game/studySettings.ts 의 StudySettings 참고.
 */
export default function StudyOptionsFields({ value, onChange, context }: StudyOptionsFieldsProps) {
  const set = <K extends keyof StudySettings>(key: K, next: StudySettings[K]) => onChange({ ...value, [key]: next })
  const feedbackOptions: Array<{ id: StudyFeedbackMode; label: string; hint: string }> = [
    { id: 'instant', label: '문제마다 바로', hint: '답하면 바로 정답과 해설이 보여요' },
    { id: 'end', label: '끝나고 한 번에', hint: '시험처럼 다 풀고 나서 채점해요' },
  ]
  const orderOptions: Array<{ id: StudyQuestionOrder; label: string }> = [
    { id: 'set', label: '문제집 순서' },
    { id: 'shuffle', label: '학생마다 섞기' },
  ]

  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-semibold text-slate-600">정답 확인</div>
          <div className="grid grid-cols-2 gap-2">
            {feedbackOptions.map((option) => (
              <OptionButton key={option.id} active={value.feedback === option.id} onClick={() => set('feedback', option.id)}>
                {option.label}
              </OptionButton>
            ))}
          </div>
          <p className="mt-1.5 text-xs font-semibold text-slate-400">
            {feedbackOptions.find((option) => option.id === value.feedback)?.hint}
          </p>
        </div>

        <div>
          <div className="mb-2 text-sm font-semibold text-slate-600">틀린 문제 다시 풀기</div>
          <div className="grid grid-cols-2 gap-2">
            <OptionButton active={value.retryWrong} onClick={() => set('retryWrong', true)}>다 맞힐 때까지</OptionButton>
            <OptionButton active={!value.retryWrong} onClick={() => set('retryWrong', false)}>한 바퀴만</OptionButton>
          </div>
          <p className="mt-1.5 text-xs font-semibold text-slate-400">
            {value.retryWrong ? '한 바퀴 끝나면 틀린 문제만 다시 나와요' : '한 바퀴 풀면 끝나요'}
          </p>
        </div>

        {context === 'homework' && (
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-600">처음부터 다시 풀기</div>
            <div className="grid grid-cols-3 gap-2">
              {STUDY_ATTEMPT_OPTIONS.map((option) => (
                <OptionButton key={option.value} active={value.maxAttempts === option.value} onClick={() => set('maxAttempts', option.value)}>
                  {option.label}
                </OptionButton>
              ))}
            </div>
            <p className="mt-1.5 text-xs font-semibold text-slate-400">
              {value.maxAttempts === 1 ? '한 번만 풀어요' : '여러 번 풀면 가장 잘 푼 기록이 남아요'}
            </p>
          </div>
        )}

        <div>
          <div className="mb-2 text-sm font-semibold text-slate-600">문제 순서</div>
          <div className="grid grid-cols-2 gap-2">
            {orderOptions.map((option) => (
              <OptionButton key={option.id} active={value.questionOrder === option.id} onClick={() => set('questionOrder', option.id)}>
                {option.label}
              </OptionButton>
            ))}
          </div>
        </div>
      </div>
      {context === 'live' && value.maxAttempts !== DEFAULT_STUDY_SETTINGS.maxAttempts && (
        <p className="mt-3 text-xs font-semibold text-slate-400">실시간 수업은 한 번만 풀어요.</p>
      )}
    </div>
  )
}
