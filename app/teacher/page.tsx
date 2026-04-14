'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Play,
  Edit,
  Trash2,
  Plus,
  BookOpen,
  Copy,
} from 'lucide-react'

type QuestionSet = {
  id: string
  title: string
  description?: string
  question_count: number
  created_at: string
}

type SourceType = 'topic' | 'youtube' | 'text' | 'pdf'

function TeacherPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const createType = searchParams?.get('create') as SourceType | null

  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!createType) {
      loadQuestionSets()
    }
  }, [createType])

  const loadQuestionSets = async () => {
    try {
      setLoading(true)

      // question_sets와 questions를 조인하여 문제 개수 계산
      const { data: sets, error } = await supabase
        .from('question_sets')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // 각 세트별로 문제 개수 조회
      const setsWithCount = await Promise.all(
        (sets || []).map(async (set: any) => {
          const { count } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('set_id', set.id)

          return {
            ...set,
            question_count: count || 0
          }
        })
      )

      setQuestionSets(setsWithCount as QuestionSet[])
    } catch (error) {
      console.error('Error loading question sets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartGame = (setId: string) => {
    // 게임 모드 선택 화면(대시보드)으로 이동
    router.push(`/teacher/dashboard?set=${encodeURIComponent(setId)}`)
  }

  const handleDuplicate = async (set: QuestionSet) => {
    try {
      const newSetId = `set-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

      // 1. question_sets 복사
      const { error: setError } = await ((supabase
        .from('question_sets') as any)
        .insert({
          id: newSetId,
          title: `${set.title} (복사본)`,
          description: set.description || null
        } as any))

      if (setError) throw setError

      // 2. questions 전부 복사
      const { data: questions, error: fetchError } = await ((supabase
        .from('questions') as any)
        .select('*')
        .eq('set_id', set.id) as any)

      if (fetchError) throw fetchError

      if (questions && questions.length > 0) {
        const newQuestions = questions.map((q: any) => ({
          set_id: newSetId,
          type: q.type,
          question_text: q.question_text,
          options: q.options,
          answer: q.answer,
        }))

        const { error: insertError } = await ((supabase
          .from('questions') as any)
          .insert(newQuestions) as any)

        if (insertError) throw insertError
      }

      alert('문제집이 복제되었습니다!')
      loadQuestionSets()
    } catch (error) {
      console.error('Error duplicating question set:', error)
      alert('복제에 실패했습니다.')
    }
  }

  const handleDelete = async (setId: string) => {
    if (!confirm('정말 이 문제집을 삭제하시겠습니까?')) return

    try {
      const { error } = await ((supabase
        .from('questions') as any)
        .delete()
        .eq('set_id', setId) as any)

      if (error) throw error
      alert('문제집이 삭제되었습니다.')
      loadQuestionSets()
    } catch (error) {
      console.error('Error deleting question set:', error)
      alert('삭제에 실패했습니다.')
    }
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">내 퀴즈함</h1>
          <p className="text-gray-600">내가 만든 문제집을 관리하세요</p>
        </div>
        <Button
          onClick={() => router.push('/teacher/create')}
          className="bg-sky-500 hover:bg-sky-600 text-white"
        >
          <Plus className="h-5 w-5 mr-2" />
          퀴즈 만들기
        </Button>
      </div>

      {/* 문제집 리스트 */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">로딩 중...</div>
      ) : questionSets.length === 0 ? (
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">👋</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">환영합니다, 선생님!</h2>
            <p className="text-gray-600">퀴즈독으로 수업을 재미있게 만들어보세요</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {/* 샘플 체험 */}
            <motion.div
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push('/teacher/library')}
              className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl p-6 cursor-pointer hover:shadow-lg transition-shadow text-center"
            >
              <div className="text-4xl mb-3">🎮</div>
              <h3 className="font-bold text-purple-900 text-lg mb-2">샘플 문제집 체험</h3>
              <p className="text-sm text-purple-700">라이브러리에서 문제집을 가져와 바로 게임을 시작해보세요</p>
            </motion.div>

            {/* AI 생성 */}
            <motion.div
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push('/teacher/create')}
              className="bg-gradient-to-br from-sky-50 to-sky-100 border-2 border-sky-200 rounded-xl p-6 cursor-pointer hover:shadow-lg transition-shadow text-center"
            >
              <div className="text-4xl mb-3">🤖</div>
              <h3 className="font-bold text-sky-900 text-lg mb-2">AI로 문제 만들기</h3>
              <p className="text-sm text-sky-700">주제, 파일, 유튜브, 시험지에서 문제를 자동 생성하세요</p>
            </motion.div>

            {/* 직접 만들기 */}
            <motion.div
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push('/teacher/create')}
              className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-6 cursor-pointer hover:shadow-lg transition-shadow text-center"
            >
              <div className="text-4xl mb-3">✏️</div>
              <h3 className="font-bold text-green-900 text-lg mb-2">직접 문제 만들기</h3>
              <p className="text-sm text-green-700">객관식, 주관식, OX 문제를 직접 만들어보세요</p>
            </motion.div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <p className="text-sm text-amber-800">
              💡 <strong>추천:</strong> 먼저 라이브러리에서 샘플 문제집을 가져와 게임을 체험해보세요!
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {questionSets.map((set, index) => (
            <motion.div
              key={set.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {set.title}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {set.question_count}문제
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(set.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <Button
                  size="sm"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => handleStartGame(set.id)}
                >
                  <Play className="h-4 w-4 mr-1" />
                  게임 시작
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/teacher/sets/${encodeURIComponent(set.id)}/edit`)}
                  title="편집"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDuplicate(set)}
                  title="복제"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(set.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

    </div>
  )
}

export default function TeacherPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">로딩 중...</div>}>
      <TeacherPageContent />
    </Suspense>
  )
}
