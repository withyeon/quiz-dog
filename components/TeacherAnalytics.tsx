'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'
import { Question } from '@/hooks/useGameBase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { CheckCircle2, XCircle, Users, Target, Trophy, AlertTriangle, TrendingDown, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { useRef } from 'react'
import { toPng } from 'html-to-image'
import download from 'downloadjs'
import { Button } from './ui/button'
import StudentDetailModal from './StudentDetailModal'

type Player = Database['public']['Tables']['players']['Row']
type AnswerRecord = { questionIndex: number, isCorrect: boolean, selectedAnswer?: string }

interface TeacherAnalyticsProps {
    setId: string | null
    players: Player[]
}

export default function TeacherAnalytics({ setId, players }: TeacherAnalyticsProps) {
    const [questions, setQuestions] = useState<Question[]>([])
    const [loading, setLoading] = useState(true)
    const [showAllQuestions, setShowAllQuestions] = useState(false)
    const [selectedStudent, setSelectedStudent] = useState<any>(null)
    const reportRef = useRef<HTMLDivElement>(null)

    // 문제 불러오기
    useEffect(() => {
        if (!setId) {
            setLoading(false)
            return
        }

        const fetchQuestions = async () => {
            try {
                const { data, error } = await (supabase
                    .from('questions')
                    .select('*')
                    .eq('set_id', setId)
                    .order('created_at', { ascending: true }) as any)

                if (error) throw error
                setQuestions(data || [])
            } catch (err) {
                console.error('Failed to load questions:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchQuestions()
    }, [setId])

    // 통계 계산 로직
    const stats = useMemo(() => {
        if (questions.length === 0 || players.length === 0) return null

        let totalAnswers = 0
        let totalCorrect = 0

        // 문제별 통계
        const questionStats = questions.map((q, idx) => ({
            index: idx,
            text: q.question_text,
            answer: (q as any).answer || '',
            type: (q as any).type || '',
            correctCount: 0,
            incorrectCount: 0,
            totalCount: 0,
            accuracy: 0,
            wrongAnswers: {} as Record<string, number>,
        }))

        // 플레이어별 통계
        const playerStats = players.map(p => {
            const history = (p.answer_history as AnswerRecord[]) || []

            let pCorrect = 0
            let pTotal = history.length

            history.forEach(ans => {
                totalAnswers++
                if (ans.isCorrect) {
                    totalCorrect++
                    pCorrect++
                    if (questionStats[ans.questionIndex]) {
                        questionStats[ans.questionIndex].correctCount++
                        questionStats[ans.questionIndex].totalCount++
                    }
                } else {
                    if (questionStats[ans.questionIndex]) {
                        questionStats[ans.questionIndex].incorrectCount++
                        questionStats[ans.questionIndex].totalCount++
                        if (ans.selectedAnswer) {
                            const ansKey = String(ans.selectedAnswer)
                            questionStats[ans.questionIndex].wrongAnswers[ansKey] = (questionStats[ans.questionIndex].wrongAnswers[ansKey] || 0) + 1
                        }
                    }
                }
            })

            return {
                id: p.id,
                nickname: p.nickname,
                score: p.score || 0,
                correctAnswers: pCorrect,
                totalAnswered: pTotal,
                accuracy: pTotal > 0 ? Math.round((pCorrect / pTotal) * 100) : 0
            }
        }).sort((a, b) => b.score - a.score)

        // 문제별 정답률 계산
        questionStats.forEach(q => {
            if (q.totalCount > 0) {
                q.accuracy = Math.round((q.correctCount / q.totalCount) * 100)
            }
        })

        const overallAccuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0

        // 취약 문제 Top 3 (정답률 최하, 시도 1회 이상)
        const hardestQuestions = [...questionStats]
            .filter(q => q.totalCount > 0)
            .sort((a, b) => a.accuracy - b.accuracy)
            .slice(0, 3)
            .map(q => {
                const wrongAnswersArr = Object.entries(q.wrongAnswers).sort((a, b) => b[1] - a[1])
                return {
                    ...q,
                    topWrongAnswer: wrongAnswersArr.length > 0 ? wrongAnswersArr[0] : null
                }
            })

        // 평균 점수
        const avgScore = playerStats.length > 0
            ? Math.round(playerStats.reduce((sum, p) => sum + p.score, 0) / playerStats.length)
            : 0

        return {
            overallAccuracy,
            totalAnswers,
            avgScore,
            questionStats,
            playerStats,
            hardestQuestions,
        }
    }, [players, questions])

    const handleExportToImage = async () => {
        if (!reportRef.current) return
        try {
            // 잠시 화면의 폭이 짤리지 않게 처리하거나 그대로 사용
            const dataUrl = await toPng(reportRef.current, {
                cacheBust: true,
                backgroundColor: '#ffffff',
                style: { margin: '0', padding: '24px', borderRadius: '16px' }
            })
            download(dataUrl, `quiz_report_${setId}.png`)
        } catch (err) {
            console.error('Failed to export image', err)
            alert('이미지 저장 중 오류가 발생했습니다.')
        }
    }

    if (loading) {
        return <div className="p-8 text-center text-gray-500 font-bold">통계 데이터를 불러오는 중...</div>
    }

    if (!setId || questions.length === 0) {
        return <div className="p-8 text-center text-gray-500">문제 데이터가 없어 통계를 계산할 수 없습니다.</div>
    }

    if (!stats) return null

    return (
        <div className="space-y-6" ref={reportRef}>
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">📊 학습 분석 리포트</h2>
                <Button
                    onClick={handleExportToImage}
                    className="bg-gray-900 hover:bg-gray-800 text-white"
                    size="sm"
                >
                    <Download className="w-4 h-4 mr-2" />
                    이미지로 저장
                </Button>
            </div>

            {/* 요약 카드 4개 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border border-blue-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-blue-500 text-white p-2 rounded-lg">
                            <Target className="w-5 h-5" />
                        </div>
                        <span className="text-blue-800 text-sm font-bold">전체 정답률</span>
                    </div>
                    <div className="text-3xl font-black text-blue-900">{stats.overallAccuracy}%</div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-xl border border-purple-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-purple-500 text-white p-2 rounded-lg">
                            <Users className="w-5 h-5" />
                        </div>
                        <span className="text-purple-800 text-sm font-bold">참여 학생</span>
                    </div>
                    <div className="text-3xl font-black text-purple-900">{players.length}명</div>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-5 rounded-xl border border-amber-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-amber-500 text-white p-2 rounded-lg">
                            <Trophy className="w-5 h-5" />
                        </div>
                        <span className="text-amber-800 text-sm font-bold">평균 점수</span>
                    </div>
                    <div className="text-3xl font-black text-amber-900">{stats.avgScore.toLocaleString()}</div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-xl border border-green-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-green-500 text-white p-2 rounded-lg">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <span className="text-green-800 text-sm font-bold">총 응답 수</span>
                    </div>
                    <div className="text-3xl font-black text-green-900">{stats.totalAnswers}</div>
                </div>
            </div>

            {/* 취약 문제 Top 3 */}
            {stats.hardestQuestions.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
                    <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <h3 className="text-lg font-bold text-red-800">🚨 다시 풀어봐야 할 문제 Top {stats.hardestQuestions.length}</h3>
                    </div>
                    <div className="divide-y divide-red-50">
                        {stats.hardestQuestions.map((q, idx) => (
                            <div key={q.index} className="px-6 py-4 flex items-start gap-4">
                                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${q.accuracy < 30 ? 'bg-red-500' : q.accuracy < 50 ? 'bg-orange-500' : 'bg-amber-500'
                                    }`}>
                                    {q.accuracy}%
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-gray-400">Q{q.index + 1}</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${q.type === 'CHOICE' ? 'bg-green-50 text-green-600' :
                                            q.type === 'OX' ? 'bg-purple-50 text-purple-600' :
                                                q.type === 'SHORT' ? 'bg-blue-50 text-blue-600' :
                                                    'bg-gray-50 text-gray-600'
                                            }`}>{
                                                q.type === 'CHOICE' ? '객관식' :
                                                    q.type === 'OX' ? 'OX' :
                                                        q.type === 'SHORT' ? '주관식' :
                                                            q.type === 'BLANK' ? '빈칸' : q.type
                                            }</span>
                                    </div>
                                    <p className="text-gray-800 font-medium leading-snug">{q.text}</p>
                                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                        <span>정답: <span className="font-bold text-gray-700">{q.answer}</span></span>
                                        <span>맞힌 학생: <span className="text-green-600 font-bold">{q.correctCount}</span>/{q.totalCount}명</span>
                                        {q.topWrongAnswer && (
                                            <span className="ml-auto bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-semibold">
                                                가장 많이 고른 오답: <span className="font-bold">"{q.topWrongAnswer[0]}"</span> ({q.topWrongAnswer[1]}명)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 문항별 정답률 차트 */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">📝 문항별 정답률</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.questionStats} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                <XAxis dataKey="index" tickFormatter={(val) => `Q${val + 1}`} stroke="#8884d8" />
                                <YAxis domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (!active || !payload || !payload.length) return null
                                        const data = payload[0].payload
                                        return (
                                            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-xs">
                                                <p className="font-bold text-gray-900 text-sm mb-1">Q{data.index + 1}. {data.text}</p>
                                                <div className="flex items-center gap-3 text-sm">
                                                    <span className={`font-bold ${data.accuracy >= 80 ? 'text-green-600' : data.accuracy < 50 ? 'text-red-600' : 'text-blue-600'}`}>
                                                        정답률 {data.accuracy}%
                                                    </span>
                                                    <span className="text-gray-400">
                                                        ({data.correctCount}/{data.totalCount})
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    }}
                                />
                                <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                                    {stats.questionStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.accuracy < 50 ? '#ef4444' : entry.accuracy > 80 ? '#22c55e' : '#3b82f6'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 mt-4 text-sm text-gray-600">
                        <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-green-500 mr-2"></span> 80%↑ 우수</div>
                        <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span> 50~79%</div>
                        <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span> 50%↓ 취약</div>
                    </div>
                </div>

                {/* 학생별 성취도 표 */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">👨‍🎓 학생별 성취도</h3>
                    <div className="overflow-y-auto flex-1 max-h-80">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-y border-gray-200 text-sm text-gray-600">
                                    <th className="py-3 px-4 font-semibold">순위</th>
                                    <th className="py-3 px-4 font-semibold">이름</th>
                                    <th className="py-3 px-4 font-semibold">점수</th>
                                    <th className="py-3 px-4 font-semibold">정답</th>
                                    <th className="py-3 px-4 font-semibold text-right">정답률</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {stats.playerStats.map((player, idx) => (
                                    <tr
                                        key={player.id}
                                        onClick={() => setSelectedStudent(player)}
                                        className="hover:bg-purple-50 transition-colors cursor-pointer"
                                    >
                                        <td className="py-3 px-4">
                                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                                        </td>
                                        <td className="py-3 px-4 font-medium text-gray-900">{player.nickname}</td>
                                        <td className="py-3 px-4 text-gray-600 font-mono">{player.score.toLocaleString()}</td>
                                        <td className="py-3 px-4 text-gray-600">
                                            <span className="text-green-600 font-bold">{player.correctAnswers}</span>/{player.totalAnswered}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${player.accuracy >= 80 ? 'bg-green-100 text-green-700' :
                                                player.accuracy < 50 && player.totalAnswered > 0 ? 'bg-red-100 text-red-700' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                {player.accuracy}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {stats.playerStats.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-gray-500">참여한 학생 데이터가 없습니다.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* 전체 문제 목록 (접기/펼치기) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <button
                    onClick={() => setShowAllQuestions(!showAllQuestions)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                    <h3 className="text-lg font-bold text-gray-800">📋 전체 문제별 상세 ({questions.length}문제)</h3>
                    {showAllQuestions ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                {showAllQuestions && (
                    <div className="border-t border-gray-200 divide-y divide-gray-100">
                        {stats.questionStats.map((q) => (
                            <div key={q.index} className="px-6 py-4 flex items-start gap-4">
                                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${q.totalCount === 0 ? 'bg-gray-100 text-gray-400' :
                                    q.accuracy >= 80 ? 'bg-green-100 text-green-700' :
                                        q.accuracy < 50 ? 'bg-red-100 text-red-700' :
                                            'bg-blue-100 text-blue-700'
                                    }`}>
                                    {q.totalCount === 0 ? '-' : `${q.accuracy}%`}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-xs font-bold text-gray-400">Q{q.index + 1}</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${q.type === 'CHOICE' ? 'bg-green-50 text-green-600' :
                                            q.type === 'OX' ? 'bg-purple-50 text-purple-600' :
                                                q.type === 'SHORT' ? 'bg-blue-50 text-blue-600' :
                                                    'bg-gray-50 text-gray-600'
                                            }`}>{
                                                q.type === 'CHOICE' ? '객관식' :
                                                    q.type === 'OX' ? 'OX' :
                                                        q.type === 'SHORT' ? '주관식' :
                                                            q.type === 'BLANK' ? '빈칸' : q.type
                                            }</span>
                                    </div>
                                    <p className="text-gray-800 text-sm">{q.text}</p>
                                    <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                                        <span>정답: <span className="font-bold text-gray-700">{q.answer}</span></span>
                                        {q.totalCount > 0 && (
                                            <>
                                                <span className="text-green-600">✓ {q.correctCount}</span>
                                                <span className="text-red-500">✗ {q.incorrectCount}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {/* 미니 바 */}
                                {q.totalCount > 0 && (
                                    <div className="flex-shrink-0 w-24 flex flex-col items-end gap-1">
                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${q.accuracy >= 80 ? 'bg-green-500' :
                                                    q.accuracy < 50 ? 'bg-red-500' : 'bg-blue-500'
                                                    }`}
                                                style={{ width: `${q.accuracy}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedStudent && (
                <StudentDetailModal
                    studentName={selectedStudent.nickname}
                    score={selectedStudent.score}
                    accuracy={selectedStudent.accuracy}
                    history={players.find(p => p.id === selectedStudent.id)?.answer_history as AnswerRecord[] || []}
                    questions={questions}
                    onClose={() => setSelectedStudent(null)}
                />
            )}
        </div>
    )
}
