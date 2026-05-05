'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, Reorder } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  GripVertical,
  Edit,
  X,
  Search,
} from 'lucide-react'
import MergeQuestionsModal from '@/components/MergeQuestionsModal'
import {
  copyQuestionsIntoSet,
  createQuestionInSet,
  deleteQuestion as deleteQuestionRecord,
  getQuestionSetWithQuestions,
  updateQuestion as updateQuestionRecord,
  updateQuestionSetMetadata,
} from '@/lib/services/questionSets'
import { formatServiceError } from '@/lib/services/errors'
import type { Database } from '@/types/database.types'

type Question = Database['public']['Tables']['questions']['Row']

export default function EditQuestionSetPage() {
  const router = useRouter()
  const params = useParams()
  // URL 디코딩 처리
  const rawSetId = params.id as string
  const setId = rawSetId ? decodeURIComponent(rawSetId) : ''

  const [questions, setQuestions] = useState<Question[]>([])
  const [setName, setSetName] = useState('')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [newQuestion, setNewQuestion] = useState<Partial<Question> | null>(null)
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false)

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true)
      const { set, questions: loadedQuestions } = await getQuestionSetWithQuestions(setId)

      if (!set) {
        // DB에 없다면 ID에서 유추 (fallback)
        setSetName(setId.replace('set-', '').replace(/-/g, ' '))
      } else {
        setSetName(set.title)
        setSubject(set.subject || '')
        setGrade(set.grade || '')
      }

      setQuestions(loadedQuestions)
    } catch (error) {
      console.error('Error loading questions:', error)
      alert('문제를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [setId])

  useEffect(() => {
    if (setId) {
      loadQuestions()
    }
  }, [setId, loadQuestions])

  const handleSaveSetInfo = async () => {
    try {
      if (!setName.trim()) { alert('문제집 이름을 입력하세요.'); return }
      await updateQuestionSetMetadata(setId, {
        title: setName.trim(),
        subject,
        grade,
      })
      setIsEditingInfo(false)
      alert('문제집 정보가 저장되었습니다.')
    } catch (e) {
      console.error(e)
      alert('문제집 정보 저장 중 오류가 발생했습니다.')
    }
  }

  const handleSaveQuestion = async (index: number) => {
    const question = questions[index]
    if (!question) return

    try {
      await updateQuestionRecord(question.id, question)
      setEditingIndex(null)
      alert('문제가 저장되었습니다.')
    } catch (error) {
      console.error('Error saving question:', error)
      alert('문제 저장에 실패했습니다: ' + formatServiceError(error))
    }
  }

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('정말 이 문제를 삭제하시겠습니까?')) return

    try {
      await deleteQuestionRecord(id)
      setQuestions(questions.filter(q => q.id !== id))
      alert('문제가 삭제되었습니다.')
    } catch (error) {
      console.error('Error deleting question:', error)
      alert('문제 삭제에 실패했습니다.')
    }
  }

  const handleAddQuestion = async () => {
    if (!newQuestion) return

    try {
      const createdQuestion = await createQuestionInSet(setId, newQuestion)
      setQuestions([...questions, createdQuestion])
      setNewQuestion(null)
      alert('문제가 추가되었습니다.')
    } catch (error) {
      console.error('Error adding question:', error)
      alert('문제 추가에 실패했습니다: ' + formatServiceError(error))
    }
  }

  const handleMergeQuestions = async (selectedQs: Question[]) => {
    try {
      const copiedQuestions = await copyQuestionsIntoSet(setId, selectedQs)
      setQuestions([...questions, ...copiedQuestions])
      setIsMergeModalOpen(false)
      alert(`${copiedQuestions.length}개의 문제를 성공적으로 가져왔습니다!`)
    } catch (err) {
      console.error(err)
      alert('문제를 가져오는 중 오류가 발생했습니다: ' + formatServiceError(err))
    }
  }

  const handleReorder = async (newOrder: Question[]) => {
    setQuestions(newOrder)
    // 순서는 created_at으로 관리되므로, 필요시 별도 order 필드 추가 가능
  }

  const updateQuestionField = (index: number, field: keyof Question, value: any) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    setQuestions(updated)
  }

  const updateNewQuestion = (field: keyof Question, value: any) => {
    if (!newQuestion) return
    setNewQuestion({ ...newQuestion, [field]: value })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl font-bold text-gray-800">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push('/teacher')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로 가기
          </Button>
          <div className="flex-1 w-full max-w-2xl">
            {isEditingInfo ? (
              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-3">
                <input
                  type="text"
                  value={setName}
                  onChange={(e) => setSetName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded font-bold text-gray-900"
                  placeholder="문제집 이름"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 bg-white"
                  >
                    <option value="">과목 선택</option>
                    <option value="국어">국어</option>
                    <option value="영어">영어</option>
                    <option value="수학">수학</option>
                    <option value="사회">사회</option>
                    <option value="과학">과학</option>
                    <option value="역사">역사</option>
                    <option value="기타">기타</option>
                  </select>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 bg-white"
                  >
                    <option value="">학년 선택</option>
                    <option value="초등 저학년">초등 저학년</option>
                    <option value="초등 고학년">초등 고학년</option>
                    <option value="중학교">중학교</option>
                    <option value="고등학교">고등학교</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={handleSaveSetInfo} className="bg-purple-600 hover:bg-purple-700 text-white">저장</Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditingInfo(false)}>취소</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 group">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 cursor-pointer hover:text-purple-600 transition-colors" onClick={() => setIsEditingInfo(true)}>{setName}</h1>
                  <div className="flex items-center gap-2 mt-1.5 cursor-pointer" onClick={() => setIsEditingInfo(true)}>
                    {subject ? <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">{subject}</span> : ''}
                    {grade ? <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-xs font-semibold">{grade}</span> : ''}
                    {(!subject && !grade) && <span className="text-xs text-gray-400">과목/학년 미설정</span>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setIsEditingInfo(true)}>
                  수정
                </Button>
              </div>
            )}
          </div>
          <span className="text-sm text-gray-600">
            총 {questions.length}문제
          </span>
        </div>
      </div>

      {/* 문제 목록 */}
      <div className="space-y-4 mb-6">
        <Reorder.Group
          axis="y"
          values={questions}
          onReorder={handleReorder}
          className="space-y-4"
        >
          {questions.map((question, index) => (
            <Reorder.Item
              key={question.id}
              value={question}
              className="bg-white rounded-lg shadow-md border-2 border-gray-200 p-6"
            >
              <div className="flex items-start gap-4">
                {/* 드래그 핸들 */}
                <div className="flex-shrink-0 pt-2 cursor-grab active:cursor-grabbing">
                  <GripVertical className="h-6 w-6 text-gray-400" />
                </div>

                {/* 문제 번호 */}
                <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center font-bold text-purple-600">
                  {index + 1}
                </div>

                {/* 문제 내용 */}
                <div className="flex-1">
                  {editingIndex === index ? (
                    <div className="space-y-4">
                      {/* 문제 유형 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          문제 유형
                        </label>
                        <select
                          value={question.type}
                          onChange={(e) => updateQuestionField(index, 'type', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="CHOICE">객관식</option>
                          <option value="OX">OX</option>
                          <option value="SHORT">주관식</option>
                          <option value="BLANK">빈칸</option>
                        </select>
                      </div>

                      {/* 문제 텍스트 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          문제
                        </label>
                        <textarea
                          value={question.question_text}
                          onChange={(e) => updateQuestionField(index, 'question_text', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                          rows={3}
                        />
                      </div>

                      {/* 보기 (객관식일 때만) */}
                      {question.type === 'CHOICE' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            보기 (쉼표로 구분)
                          </label>
                          <input
                            type="text"
                            value={Array.isArray(question.options) ? question.options.join(', ') : ''}
                            onChange={(e) => {
                              const options = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                              updateQuestionField(index, 'options', options)
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            placeholder="보기1, 보기2, 보기3, 보기4"
                          />
                        </div>
                      )}

                      {/* 정답 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          정답
                        </label>
                        <input
                          type="text"
                          value={question.answer}
                          onChange={(e) => updateQuestionField(index, 'answer', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>

                      {/* 저장/취소 버튼 */}
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleSaveQuestion(index)}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          저장
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingIndex(null)
                            loadQuestions() // 원래 상태로 복원
                          }}
                        >
                          취소
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                            {question.type === 'CHOICE' ? '객관식' :
                              question.type === 'OX' ? 'OX' :
                                question.type === 'SHORT' ? '주관식' : '빈칸'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingIndex(index)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            수정
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteQuestion(question.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            삭제
                          </Button>
                        </div>
                      </div>
                      <p className="text-lg font-medium text-gray-900">
                        {question.question_text}
                      </p>
                      {question.type === 'CHOICE' && Array.isArray(question.options) && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600 mb-1">보기:</p>
                          <div className="flex flex-wrap gap-2">
                            {question.options.map((option, i) => (
                              <span
                                key={i}
                                className="px-3 py-1 bg-gray-100 rounded text-sm"
                              >
                                {String(option)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-sm text-gray-600 mt-2">
                        <span className="font-semibold">정답:</span> {question.answer}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>

      {/* 새 문제 추가 */}
      {newQuestion ? (
        <Card className="border-2 border-purple-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>새 문제 추가</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNewQuestion(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                문제 유형
              </label>
              <select
                value={newQuestion.type || 'CHOICE'}
                onChange={(e) => updateNewQuestion('type', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="CHOICE">객관식</option>
                <option value="OX">OX</option>
                <option value="SHORT">주관식</option>
                <option value="BLANK">빈칸</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                문제
              </label>
              <textarea
                value={newQuestion.question_text || ''}
                onChange={(e) => updateNewQuestion('question_text', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                rows={3}
                placeholder="문제를 입력하세요"
              />
            </div>

            {newQuestion.type === 'CHOICE' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  보기 (쉼표로 구분)
                </label>
                <input
                  type="text"
                  value={Array.isArray(newQuestion.options) ? newQuestion.options.join(', ') : ''}
                  onChange={(e) => {
                    const options = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    updateNewQuestion('options', options)
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="보기1, 보기2, 보기3, 보기4"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                정답
              </label>
              <input
                type="text"
                value={newQuestion.answer || ''}
                onChange={(e) => updateNewQuestion('answer', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="정답을 입력하세요"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleAddQuestion}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                추가
              </Button>
              <Button
                variant="outline"
                onClick={() => setNewQuestion(null)}
              >
                취소
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button
            onClick={() => setNewQuestion({
              type: 'CHOICE',
              question_text: '',
              options: [],
              answer: '',
            })}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-6 text-lg font-bold shadow-sm"
          >
            <Plus className="h-5 w-5 mr-2" />
            새 문제 직접 추가
          </Button>
          <Button
            onClick={() => setIsMergeModalOpen(true)}
            className="w-full bg-white text-purple-600 border-2 border-purple-200 hover:bg-purple-50 py-6 text-lg font-bold shadow-sm"
          >
            <Search className="h-5 w-5 mr-2 text-purple-600" />
            다른 문제집에서 픽(Pick) 해오기
          </Button>
        </div>
      )}

      {isMergeModalOpen && (
        <MergeQuestionsModal
          currentSetId={setId}
          onClose={() => setIsMergeModalOpen(false)}
          onMerge={handleMergeQuestions}
        />
      )}
    </div>
  )
}
