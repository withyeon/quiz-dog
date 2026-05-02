'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase, checkSupabaseConfig, testSupabaseConnection } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Pencil, CheckCircle2, MessageSquare, XCircle, ScanLine } from 'lucide-react'
import type { GeneratedQuestion } from '@/lib/ai/questionGenerator'
import { filterNickname } from '@/lib/utils/profanityFilter'
import QuestionReviewEditor from '@/components/teacher/QuestionReviewEditor'
import QuestionSourceSelector from '@/components/teacher/QuestionSourceSelector'

type SourceType = 'topic' | 'youtube' | 'file' | 'exam'

export default function CreateQuestionPage() {
  const router = useRouter()
  const [sourceType, setSourceType] = useState<SourceType | null>(null)
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual')
  const [topic, setTopic] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [examFile, setExamFile] = useState<File | null>(null)
  const [questionCount, setQuestionCount] = useState(5)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([])
  const [isReviewing, setIsReviewing] = useState(false)
  const [setName, setSetName] = useState('')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')

  const handleGenerate = async () => {
    if (sourceType === 'topic' && !topic.trim()) {
      alert('주제를 입력해주세요.')
      return
    }
    if (sourceType === 'youtube' && !youtubeUrl.trim()) {
      alert('유튜브 URL을 입력해주세요.')
      return
    }
    if (sourceType === 'file' && !file) {
      alert('파일을 선택해주세요.')
      return
    }
    if (sourceType === 'exam' && !examFile) {
      alert('시험지 파일을 선택해주세요.')
      return
    }

    setIsGenerating(true)
    try {
      const formData = new FormData()
      formData.append('sourceType', sourceType!)
      formData.append('questionCount', questionCount.toString())
      if (subject) formData.append('subject', subject)
      if (grade) formData.append('grade', grade)

      if (sourceType === 'topic') {
        formData.append('topic', topic)
      } else if (sourceType === 'youtube') {
        formData.append('youtubeUrl', youtubeUrl)
      } else if (sourceType === 'file' && file) {
        formData.append('file', file)
      } else if (sourceType === 'exam' && examFile) {
        formData.append('file', examFile)
      }

      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '문제 생성에 실패했습니다.')
      }

      if (!data.questions || data.questions.length === 0) {
        throw new Error('생성된 문제가 없습니다. 다시 시도해주세요.')
      }

      setGeneratedQuestions(data.questions)
      setIsReviewing(true)
    } catch (error) {
      console.error('Error generating questions:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      alert(`문제 생성에 실패했습니다: ${errorMessage}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveQuestions = async () => {
    if (!setName.trim()) {
      alert('문제집 이름을 입력해주세요.')
      return
    }
    if (!subject) {
      alert('과목을 선택해주세요.')
      return
    }
    if (!grade) {
      alert('대상 학년을 선택해주세요.')
      return
    }

    const nameCheck = filterNickname(setName)
    if (!nameCheck.isValid) {
      alert('문제집 이름에 부적절한 단어가 포함되어 있습니다.')
      return
    }

    const supabaseCheck = checkSupabaseConfig()
    if (!supabaseCheck.isValid) {
      alert(`Supabase 연결 오류: ${supabaseCheck.error}`)
      return
    }

    const connectionTest = await testSupabaseConnection()
    if (!connectionTest.success) {
      alert(`Supabase 연결 실패: ${connectionTest.error}\n\n환경 변수를 확인하고 개발 서버를 재시작해주세요.`)
      return
    }

    try {
      const setId = `set-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

      const questionsToSave = generatedQuestions.map((q) => {
        let optionsArray: string[] = []
        if (Array.isArray(q.options)) {
          optionsArray = q.options
        } else if (q.options && typeof q.options === 'string') {
          optionsArray = (q.options as string).split(',').map((s: string) => s.trim()).filter(Boolean)
        }

        return {
          set_id: setId,
          type: q.type,
          question_text: q.question_text.trim(),
          options: optionsArray,
          answer: q.answer.trim(),
        }
      })

      const { error: setListError } = await ((supabase
        .from('question_sets') as any)
        .insert({
          id: setId,
          title: setName.trim(),
          description: `AI로 생성된 문제집 (${sourceType})`,
          subject,
          grade,
        } as any))

      if (setListError) throw setListError

      const { data, error } = await ((supabase
        .from('questions') as any)
        .insert(questionsToSave as any)
        .select() as any)

      if (error) {
        let errorMessage = '알 수 없는 오류가 발생했습니다.'
        if (error.message) errorMessage = error.message
        else if (error.details) errorMessage = error.details
        else if (error.hint) errorMessage = error.hint
        throw new Error(errorMessage)
      }

      alert('문제가 저장되었습니다!')
      router.push('/teacher')
    } catch (error) {
      console.error('Error saving questions:', error)
      let errorMessage = '알 수 없는 오류가 발생했습니다.'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null) {
        const err = error as any
        errorMessage = err.message || err.details || err.hint || errorMessage
      }
      alert(`문제 저장에 실패했습니다: ${errorMessage}`)
    }
  }

  const handleCreateManual = (type: 'CHOICE' | 'SHORT' | 'OX') => {
    const newQuestion: GeneratedQuestion = {
      type,
      question_text: '',
      options: type === 'OX' ? ['O', 'X'] : type === 'CHOICE' ? ['', '', '', ''] : [],
      answer: '',
    }
    setGeneratedQuestions((prev) => [...prev, newQuestion])
    setIsReviewing(true)
  }

  // ======= 검수(리뷰) 화면 =======
  if (isReviewing) {
    return (
      <QuestionReviewEditor
        generatedQuestions={generatedQuestions}
        setGeneratedQuestions={setGeneratedQuestions}
        setName={setName}
        setSetName={setSetName}
        subject={subject}
        setSubject={setSubject}
        grade={grade}
        setGrade={setGrade}
        onBack={() => setIsReviewing(false)}
        onSave={handleSaveQuestions}
        onCreateManual={handleCreateManual}
      />
    )
  }

  // ======= 메인 생성 화면 =======
  return (
    <div className="max-w-5xl mx-auto p-6">
      <Button
        variant="outline"
        onClick={() => router.push('/teacher')}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        뒤로 가기
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          새로운 문제집 만들기
        </h1>
        <p className="text-gray-600">
          원하는 방식으로 문제를 추가하고 새로운 퀴즈 세트를 만들어보세요.
        </p>
      </div>

      {/* 탭 버튼 */}
      <div className="flex bg-gray-100 p-1.5 rounded-xl mb-8 w-fit mx-auto md:mx-0">
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-1 flex items-center justify-center gap-2 px-8 py-3 rounded-lg font-bold text-[15px] transition-all whitespace-nowrap ${activeTab === 'manual'
            ? 'bg-white text-purple-700 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <Pencil className="w-4 h-4" />
          직접 만들기
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 flex items-center justify-center gap-2 px-8 py-3 rounded-lg font-bold text-[15px] transition-all whitespace-nowrap ${activeTab === 'ai'
            ? 'bg-white text-purple-700 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <ScanLine className="w-4 h-4" />
          자료에서 자동 생성
        </button>
      </div>

      {activeTab === 'manual' ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl p-8 border-2 border-purple-100 text-center shadow-sm">
            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Pencil className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">직접 문제 만들기</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              원하는 문제 유형을 선택하면 빈 문제집이 생성됩니다. 생성 후 검토 화면에서 추가 문제를 자유롭게 작성할 수 있습니다.
            </p>
            <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {/* 직접 문제 만들기 버튼들 */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCreateManual('CHOICE')}
                className="bg-green-500 hover:bg-green-600 text-white rounded-2xl p-6 text-center transition-all shadow hover:shadow-lg flex flex-col items-center gap-3"
              >
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="font-bold">선택형 문제 +</div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCreateManual('SHORT')}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-2xl p-6 text-center transition-all shadow hover:shadow-lg flex flex-col items-center gap-3"
              >
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div className="font-bold">단답형/빈칸 문제 +</div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCreateManual('OX')}
                className="bg-purple-500 hover:bg-purple-600 text-white rounded-2xl p-6 text-center transition-all shadow hover:shadow-lg flex flex-col items-center gap-3"
              >
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <XCircle className="h-6 w-6" />
                </div>
                <div className="font-bold">OX 문제 +</div>
              </motion.button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* AI 생성 카드들 */}
          <QuestionSourceSelector
            sourceType={sourceType}
            setSourceType={setSourceType}
            topic={topic}
            setTopic={setTopic}
            youtubeUrl={youtubeUrl}
            setYoutubeUrl={setYoutubeUrl}
            file={file}
            setFile={setFile}
            examFile={examFile}
            setExamFile={setExamFile}
          />

          {/* AI 생성 버튼 */}
          {sourceType && (
            <div className="mb-8">
              <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">과목 (선택사항)</label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-32 px-2 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-sm"
                    >
                      <option value="">전체/해당없음</option>
                      <option value="국어">국어</option>
                      <option value="영어">영어</option>
                      <option value="수학">수학</option>
                      <option value="사회">사회</option>
                      <option value="과학">과학</option>
                      <option value="역사">역사</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">대상 학년 (선택사항)</label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-32 px-2 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-sm"
                    >
                      <option value="">전체/해당없음</option>
                      <option value="초등 저학년">초등 저학년</option>
                      <option value="초등 고학년">초등 고학년</option>
                      <option value="중학교">중학교</option>
                      <option value="고등학교">고등학교</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {sourceType === 'exam' ? '최대 문제 수' : '생성 문제 수'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(parseInt(e.target.value) || 5)}
                      className="w-24 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-6 text-lg font-bold"
                  size="lg"
                >
                  {isGenerating
                    ? sourceType === 'exam'
                      ? '시험지 분석 중...'
                      : '문제 생성 중...'
                    : sourceType === 'exam'
                      ? '시험지에서 문제 추출하기'
                      : '문제 생성하기'
                  }
                </Button>
                {sourceType === 'exam' && (
                  <p className="text-xs text-gray-500 mt-3 text-center">
                    AI가 시험지를 읽고 문제를 추출합니다. 추출 후 검토 화면에서 수정할 수 있습니다.
                  </p>
                )}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
