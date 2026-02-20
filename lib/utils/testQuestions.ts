import { supabase } from '@/lib/supabase/client'

/**
 * 테스트용 문제 생성
 * 실제 개발 시에는 삭제하거나 별도 스크립트로 분리
 */
export async function createTestQuestions() {
  const testQuestions = [
    {
      set_id: 'test-set-1',
      type: 'CHOICE' as const,
      question_text: '한국의 수도는?',
      options: ['서울', '부산', '대구', '인천'],
      answer: '서울',
    },
    {
      set_id: 'test-set-1',
      type: 'OX' as const,
      question_text: '지구는 둥글다.',
      options: ['O', 'X'],
      answer: 'O',
    },
    {
      set_id: 'test-set-1',
      type: 'CHOICE' as const,
      question_text: '태양계의 행성 중 가장 큰 행성은?',
      options: ['지구', '목성', '토성', '화성'],
      answer: '목성',
    },
    {
      set_id: 'test-set-1',
      type: 'CHOICE' as const,
      question_text: '한국의 대통령은?',
      options: ['윤석열', '문재인', '박근혜', '이명박'],
      answer: '윤석열',
    },
  ]

  try {
    const { data, error } = await ((supabase
      .from('questions') as any)
      .upsert(testQuestions as any, { onConflict: 'id' })
      .select() as any)

    if (error) throw error
    console.log('Test questions created:', data)
    return data
  } catch (err) {
    console.error('Error creating test questions:', err)
    throw err
  }
}
