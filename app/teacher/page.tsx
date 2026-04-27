'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
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
    <div style={{ padding: '0' }}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0', color: '#888' }}>로딩 중...</div>
      ) : questionSets.length === 0 ? (
        <div style={{ maxWidth: 740, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', padding: '40px 20px 32px' }}>
            <div style={{ fontSize: 72, marginBottom: 18, animation: 'bob 2.5s ease-in-out infinite' }}>🐕</div>
            <div style={{ fontFamily: "'BMJUA', monospace", fontSize: 28, marginBottom: 10 }}>환영합니다, 선생님!</div>
            <div style={{ fontSize: 15, color: '#888', marginBottom: 36 }}>퀴즈독으로 수업을 재미있게 만들어보세요</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, marginBottom: 28 }}>
            {[
              { icon: '🎮', title: '샘플 체험', desc: '라이브러리에서 문제집을 가져와 바로 게임을 시작해보세요', bg: '#F5F3FF', href: '/teacher/library' },
              { icon: '🤖', title: 'AI로 만들기', desc: '주제, 파일, 유튜브에서 문제를 자동 생성하세요', bg: '#F0F9FF', href: '/teacher/create' },
              { icon: '✏️', title: '직접 만들기', desc: '객관식, 주관식, OX 문제를 직접 만들어보세요', bg: '#F0FDF4', href: '/teacher/create' },
            ].map((c) => (
              <Link key={c.title} href={c.href} style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    padding: '28px 20px', textAlign: 'center',
                    background: c.bg, border: '3px solid #0C2340',
                    boxShadow: '4px 4px 0 #0C2340', borderRadius: 12,
                    cursor: 'pointer', transition: 'all .12s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translate(-2px,-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '6px 6px 0 #0C2340'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '4px 4px 0 #0C2340'; }}
                >
                  <div style={{ fontSize: 40, marginBottom: 12 }}>{c.icon}</div>
                  <div style={{ fontFamily: "'BMJUA', monospace", fontSize: 15, marginBottom: 8 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: '#888', lineHeight: 1.65 }}>{c.desc}</div>
                </div>
              </Link>
            ))}
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '12px 20px',
              background: '#E0F2FE', border: '2px solid #0C2340',
              boxShadow: '2px 2px 0 #0C2340', borderRadius: 10,
              fontSize: 13, color: '#0369A1',
            }}>
              💡 먼저 라이브러리에서 샘플 문제집을 가져와 게임을 체험해보세요!
            </div>
          </div>
        </div>
      ) : (
        <div>
          {/* 통계 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
            {[
              { icon: '📚', label: '내 문제집', value: questionSets.length, bg: '#FFF3C8' },
              { icon: '❓', label: '총 문제 수', value: questionSets.reduce((a, s) => a + s.question_count, 0), bg: '#DBEEFF' },
              { icon: '🎮', label: '진행한 게임', value: 0, bg: '#DCFCE7' },
            ].map((s) => (
              <div key={s.label} style={{
                background: '#fff', border: '3px solid #0C2340',
                boxShadow: '4px 4px 0 #0C2340', borderRadius: 12,
                padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  width: 46, height: 46, background: s.bg,
                  border: '2px solid #0C2340', boxShadow: '2px 2px 0 #0C2340',
                  borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0,
                }}>{s.icon}</div>
                <div>
                  <div style={{ fontFamily: "'BMJUA', monospace", fontSize: 26, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div style={{ fontFamily: "'BMJUA', monospace", fontSize: 22 }}>내 문제집</div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>총 {questionSets.length}개의 문제집</div>
            </div>
            <Link
              href="/teacher/create"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '10px 18px',
                background: '#0EA5E9', color: '#fff',
                border: '3px solid #0C2340', boxShadow: '4px 4px 0 #0C2340',
                borderRadius: 8, fontFamily: "'BMJUA', monospace", fontSize: 13,
                textDecoration: 'none',
              }}
            >＋ 퀴즈 만들기</Link>
          </div>

          {/* 카드 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 20 }}>
            {questionSets.map((set, i) => {
              const colors = ['#0284C7,#38BDF8','#7C3AED,#A78BFA','#059669,#34D399','#D97706,#FCD34D','#DB2777,#F9A8D4','#0C4A6E,#0EA5E9']
              const emojis = ['🌍','🔢','🌱','📜','🔤','⚗️']
              const [c1, c2] = colors[i % colors.length].split(',')
              return (
                <div key={set.id} style={{
                  background: '#fff', border: '3px solid #0C2340',
                  boxShadow: '4px 4px 0 #0C2340', borderRadius: 12, overflow: 'hidden',
                  transition: 'all .12s', cursor: 'pointer',
                }}>
                  <div style={{
                    height: 80, background: `linear-gradient(135deg,${c1},${c2})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                  }}>
                    <span style={{ fontSize: 40, filter: 'drop-shadow(2px 2px 0 rgba(0,0,0,.2))' }}>
                      {emojis[i % emojis.length]}
                    </span>
                    <span style={{
                      position: 'absolute', top: 10, right: 10,
                      background: 'rgba(0,0,0,.3)', border: '1.5px solid rgba(255,255,255,.3)',
                      borderRadius: 6, padding: '2px 8px',
                      fontFamily: "'BMJUA', monospace", fontSize: 10, color: '#fff',
                    }}>{set.question_count}문제</span>
                  </div>
                  <div style={{ padding: 16 }}>
                    <div style={{
                      fontFamily: "'BMJUA', monospace", fontSize: 15, marginBottom: 6,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{set.title}</div>
                    <div style={{ fontSize: 11, color: '#aaa', marginBottom: 14 }}>
                      {new Date(set.created_at).toLocaleDateString('ko-KR')}
                    </div>
                    <div style={{ display: 'flex', gap: 7 }}>
                      <button
                        onClick={() => handleStartGame(set.id)}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          padding: 9, background: '#0EA5E9', color: '#fff',
                          border: '2px solid #0C2340', boxShadow: '2px 2px 0 #0C2340',
                          borderRadius: 8, fontFamily: "'BMJUA', monospace", fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >▶ 게임 시작</button>
                      <button onClick={() => router.push(`/teacher/sets/${encodeURIComponent(set.id)}/edit`)}
                        style={{ width: 36, height: 36, background: '#F0F9FF', border: '2px solid #0C2340', boxShadow: '2px 2px 0 #0C2340', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}>✏️</button>
                      <button onClick={() => handleDuplicate(set)}
                        style={{ width: 36, height: 36, background: '#F0F9FF', border: '2px solid #0C2340', boxShadow: '2px 2px 0 #0C2340', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}>📋</button>
                      <button onClick={() => handleDelete(set.id)}
                        style={{ width: 36, height: 36, background: '#FEF2F2', border: '2px solid #0C2340', boxShadow: '2px 2px 0 #0C2340', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}>🗑️</button>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* 새로 만들기 카드 */}
            <Link href="/teacher/create" style={{ textDecoration: 'none' }}>
              <div style={{
                border: '3px dashed #CBD5E1', borderRadius: 12, minHeight: 170,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#F0F9FF', cursor: 'pointer',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 40, opacity: .4, marginBottom: 10 }}>＋</div>
                  <div style={{ fontFamily: "'BMJUA', monospace", fontSize: 13, color: '#aaa' }}>새 문제집 만들기</div>
                </div>
              </div>
            </Link>
          </div>
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
