'use client'

import { RECOMMENDATION_FILTERS, type RecommendationTag } from '@/lib/game/modeGuide'

/**
 * "처음에 뭘 골라야 하지?"를 풀어 주는 상황 선택 칩. 랜딩·기능 소개·선생님 게임 선택 화면이 같이 쓴다.
 * 고른 상황에 맞는 게임만 남기고, 아래에 그 이유를 한 줄 보여 준다.
 */
export default function GameRecommendationPicker({
  value,
  onChange,
  compact = false,
}: {
  value: RecommendationTag | null
  onChange: (tag: RecommendationTag | null) => void
  /** 선생님 화면용 — 글자·여백을 줄인다 */
  compact?: boolean
}) {
  const active = RECOMMENDATION_FILTERS.find((filter) => filter.id === value) ?? null
  const chipBase = compact
    ? 'rounded-full px-3 py-1.5 text-xs font-bold transition'
    : 'rounded-full px-4 py-2 text-sm font-black transition sm:text-[15px]'

  return (
    <div className={compact ? 'mb-3' : 'mb-8'}>
      <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'justify-center'}`}>
        <span className={`${compact ? 'text-xs' : 'text-sm sm:text-base'} font-bold`} style={{ color: '#475569' }}>
          어떤 수업인가요?
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className={chipBase}
          style={value === null
            ? { backgroundColor: '#0EA5E9', color: '#FFFFFF', boxShadow: '0 3px 0 #0369A1' }
            : { backgroundColor: '#FFFFFF', color: '#334155', border: '2px solid #E2E8F0' }}
        >
          전체
        </button>
        {RECOMMENDATION_FILTERS.map((filter) => {
          const selected = value === filter.id
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => onChange(selected ? null : filter.id)}
              className={chipBase}
              aria-pressed={selected}
              style={selected
                ? { backgroundColor: '#0EA5E9', color: '#FFFFFF', boxShadow: '0 3px 0 #0369A1' }
                : { backgroundColor: '#FFFFFF', color: '#334155', border: '2px solid #E2E8F0' }}
            >
              {filter.label}
            </button>
          )
        })}
      </div>
      <p
        className={`${compact ? 'mt-2 text-xs' : 'mt-3 text-center text-sm sm:text-base'} font-semibold`}
        style={{ color: '#0369A1', minHeight: compact ? undefined : '1.5rem' }}
      >
        {active ? active.hint : (compact ? '' : '카드의 추천 학년·예상 시간·조작 난도를 보고 우리 반에 맞는 게임을 골라 보세요')}
      </p>
    </div>
  )
}
