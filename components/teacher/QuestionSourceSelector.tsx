'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Pencil, FileText, Youtube, ScanLine } from 'lucide-react'

type SourceType = 'topic' | 'youtube' | 'file' | 'exam'

interface QuestionSourceSelectorProps {
  sourceType: SourceType | null
  setSourceType: (type: SourceType) => void
  topic: string
  setTopic: (value: string) => void
  youtubeUrl: string
  setYoutubeUrl: (value: string) => void
  file: File | null
  setFile: (file: File | null) => void
  examFile: File | null
  setExamFile: (file: File | null) => void
}

export default function QuestionSourceSelector({
  sourceType,
  setSourceType,
  topic,
  setTopic,
  youtubeUrl,
  setYoutubeUrl,
  file,
  setFile,
  examFile,
  setExamFile,
}: QuestionSourceSelectorProps) {
  return (
    <div className="grid md:grid-cols-2 gap-6 mb-8">

      {/* 주제 직접 입력 */}
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Card
          className={`cursor-pointer transition-all border-2 h-full ${sourceType === 'topic'
            ? 'border-purple-500 bg-purple-50 shadow-lg'
            : 'border-gray-200 hover:border-purple-300'
            }`}
          onClick={() => setSourceType('topic')}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Pencil className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-lg">주제 직접 입력</CardTitle>
                <p className="text-sm text-gray-500 mt-1">주제를 입력하면 AI가 문제를 생성합니다</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sourceType === 'topic' && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="예: 초5 도형의 넓이"
                  className="w-full px-4 py-3 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* 파일에서 추출 */}
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Card
          className={`cursor-pointer transition-all border-2 h-full ${sourceType === 'file'
            ? 'border-blue-500 bg-blue-50 shadow-lg'
            : 'border-gray-200 hover:border-blue-300'
            }`}
          onClick={() => setSourceType('file')}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">파일에서 추출</CardTitle>
                <p className="text-sm text-gray-500 mt-1">학습 자료에서 문제를 자동 생성합니다</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sourceType === 'file' ? (
              <div className="space-y-3">
                <input
                  type="file"
                  accept=".pdf,.txt,.csv,.docx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
                <p className="text-xs text-gray-500">지원 형식: PDF, DOCX, TXT, CSV</p>
                {file && (
                  <p className="text-sm text-blue-600 font-medium">
                    선택됨: {file.name}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-600">PDF, DOCX, TXT, CSV</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* 유튜브에서 추출 */}
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Card
          className={`cursor-pointer transition-all border-2 h-full relative ${sourceType === 'youtube'
            ? 'border-red-500 bg-red-50 shadow-lg'
            : 'border-gray-200 hover:border-red-300'
            }`}
          onClick={() => setSourceType('youtube')}
        >
          <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded">
            Beta
          </div>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <Youtube className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-lg">유튜브에서 추출</CardTitle>
                <p className="text-sm text-gray-500 mt-1">영상 자막에서 문제를 생성합니다</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sourceType === 'youtube' ? (
              <div className="space-y-3">
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full px-4 py-3 border-2 border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  onClick={(e) => e.stopPropagation()}
                />
                <p className="text-xs text-gray-500">자막이 있는 영상만 지원됩니다</p>
              </div>
            ) : (
              <p className="text-sm text-gray-600">자막 있는 영상 지원</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* 시험지/문제지 업로드 */}
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Card
          className={`cursor-pointer transition-all border-2 h-full relative ${sourceType === 'exam'
            ? 'border-emerald-500 bg-emerald-50 shadow-lg'
            : 'border-gray-200 hover:border-emerald-300'
            }`}
          onClick={() => setSourceType('exam')}
        >
          <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded">
            New
          </div>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <ScanLine className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">시험지에서 추출</CardTitle>
                <p className="text-sm text-gray-500 mt-1">시험지/문제지의 문제를 그대로 가져옵니다</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sourceType === 'exam' ? (
              <div className="space-y-3">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setExamFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-3 border-2 border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  onClick={(e) => e.stopPropagation()}
                />
                <p className="text-xs text-gray-500">PDF 또는 이미지(JPG, PNG) 지원 — 스캔본도 OK</p>
                {examFile && (
                  <p className="text-sm text-emerald-600 font-medium">
                    선택됨: {examFile.name}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-600">PDF, JPG, PNG (스캔본 지원)</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
