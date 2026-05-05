'use client'

import { useState, useEffect } from 'react'
import type { Database } from '@/types/database.types'
import { X, Search, ChevronRight, CheckSquare, Square, ChevronLeft } from 'lucide-react'
import { Button } from './ui/button'
import {
    getQuestionSetWithQuestions,
    listQuestionSetsExcept,
} from '@/lib/services/questionSets'

type QuestionSet = Database['public']['Tables']['question_sets']['Row']
type Question = Database['public']['Tables']['questions']['Row']

interface MergeQuestionsModalProps {
    currentSetId: string
    onClose: () => void
    onMerge: (questions: Question[]) => void
}

export default function MergeQuestionsModal({ currentSetId, onClose, onMerge }: MergeQuestionsModalProps) {
    const [sets, setSets] = useState<QuestionSet[]>([])
    const [filteredSets, setFilteredSets] = useState<QuestionSet[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(true)

    const [selectedSet, setSelectedSet] = useState<QuestionSet | null>(null)
    const [questionsMenu, setQuestionsMenu] = useState<Question[]>([])
    const [loadingQuestions, setLoadingQuestions] = useState(false)

    const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())

    // Load all question sets except the current one
    useEffect(() => {
        const fetchSets = async () => {
            try {
                const loadedSets = await listQuestionSetsExcept(currentSetId)
                setSets(loadedSets)
                setFilteredSets(loadedSets)
            } catch (err) {
                console.error('Failed to load sets', err)
            } finally {
                setLoading(false)
            }
        }
        fetchSets()
    }, [currentSetId])

    // Local Search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredSets(sets)
            return
        }
        const lowerQ = searchQuery.toLowerCase()
        setFilteredSets(sets.filter(s => s.title.toLowerCase().includes(lowerQ)))
    }, [searchQuery, sets])

    const handleSelectSet = async (set: QuestionSet) => {
        setSelectedSet(set)
        setLoadingQuestions(true)
        try {
            const { questions } = await getQuestionSetWithQuestions(set.id)
            setQuestionsMenu(questions)
        } catch (err) {
            console.error('Failed to load questions', err)
        } finally {
            setLoadingQuestions(false)
        }
    }

    const handleToggleQuestion = (qId: string) => {
        const newSelected = new Set(selectedQuestions)
        if (newSelected.has(qId)) {
            newSelected.delete(qId)
        } else {
            newSelected.add(qId)
        }
        setSelectedQuestions(newSelected)
    }

    const handleToggleAll = () => {
        if (selectedQuestions.size === questionsMenu.length) {
            setSelectedQuestions(new Set())
        } else {
            setSelectedQuestions(new Set(questionsMenu.map(q => q.id)))
        }
    }

    const handleMerge = () => {
        const questionsToMerge = questionsMenu.filter(q => selectedQuestions.has(q.id))
        onMerge(questionsToMerge)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">
                        {selectedSet ? '가져올 문제 선택' : '내 다른 퀴즈함 열기'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto bg-gray-50/50">
                    {!selectedSet ? (
                        <div className="p-6">
                            <div className="relative mb-6">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="문제집 이름 검색..."
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                />
                            </div>

                            {loading ? (
                                <div className="py-12 text-center text-gray-500 font-medium">문제집을 불러오는 중...</div>
                            ) : filteredSets.length === 0 ? (
                                <div className="py-12 text-center text-gray-500">다른 문제집이 없습니다.</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {filteredSets.map(set => (
                                        <div
                                            key={set.id}
                                            onClick={() => handleSelectSet(set)}
                                            className="bg-white p-5 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md cursor-pointer transition-all group"
                                        >
                                            <h3 className="font-bold text-gray-900 mb-1 group-hover:text-purple-600 transition-colors">{set.title}</h3>
                                            <div className="flex items-center text-xs font-medium text-gray-500 gap-2 mt-2">
                                                {set.subject && <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{set.subject}</span>}
                                                {set.grade && <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">{set.grade}</span>}
                                            </div>
                                            <div className="flex items-center justify-end mt-2 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-sm font-bold mr-1">열기</span>
                                                <ChevronRight className="w-4 h-4" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between">
                                <button
                                    onClick={() => { setSelectedSet(null); setSelectedQuestions(new Set()); setQuestionsMenu([]); }}
                                    className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4 mr-1" />
                                    목록으로
                                </button>
                                <span className="font-bold text-gray-900">{selectedSet.title}</span>
                            </div>

                            <div className="p-6 flex-1 overflow-y-auto">
                                {loadingQuestions ? (
                                    <div className="py-12 text-center text-gray-500">문제를 불러오는 중...</div>
                                ) : questionsMenu.length === 0 ? (
                                    <div className="py-12 text-center text-gray-500">이 문제집에는 문제가 없습니다.</div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-sm font-medium text-gray-500">총 {questionsMenu.length}문제</span>
                                            <button onClick={handleToggleAll} className="text-sm font-bold text-purple-600 hover:text-purple-800 transition-colors">
                                                {selectedQuestions.size === questionsMenu.length ? '전체 해제' : '전체 선택'}
                                            </button>
                                        </div>
                                        {questionsMenu.map((q, idx) => {
                                            const isSelected = selectedQuestions.has(q.id)
                                            return (
                                                <div
                                                    key={q.id}
                                                    onClick={() => handleToggleQuestion(q.id)}
                                                    className={`bg-white p-4 rounded-xl border-2 cursor-pointer transition-all flex gap-4 ${isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-200'}`}
                                                >
                                                    <div className="mt-0.5">
                                                        {isSelected ? <CheckSquare className="w-5 h-5 text-purple-600" /> : <Square className="w-5 h-5 text-gray-300" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <span className="text-xs font-bold text-gray-400">Q{idx + 1}</span>
                                                            <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-600">
                                                                {q.type === 'CHOICE' ? '객관식' : q.type === 'OX' ? 'OX' : q.type === 'SHORT' ? '주관식' : q.type === 'BLANK' ? '빈칸' : q.type}
                                                            </span>
                                                        </div>
                                                        <p className="font-medium text-gray-900 truncate">{q.question_text}</p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {selectedSet && (
                    <div className="p-5 border-t border-gray-100 bg-white flex justify-end items-center gap-3">
                        <span className="text-sm font-medium text-gray-600">
                            <strong className="text-purple-600">{selectedQuestions.size}</strong>개 선택됨
                        </span>
                        <Button variant="outline" onClick={onClose}>취소</Button>
                        <Button
                            onClick={handleMerge}
                            disabled={selectedQuestions.size === 0}
                            className="bg-purple-600 hover:bg-purple-700 text-white min-w-[120px]"
                        >
                            문제 가져오기
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
