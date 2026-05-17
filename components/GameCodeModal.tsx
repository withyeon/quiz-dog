'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { X, Copy, Check } from 'lucide-react'
import QRCodeSVG from 'react-qr-code'
import { Button } from '@/components/ui/button'
import { generateRoomCode } from '@/lib/utils/gameCode'
import { gameAssets } from '@/assets/game-assets'

interface GameCodeModalProps {
  roomCode: string
  isOpen: boolean
  onClose: () => void
  onCopy?: () => void
  onStartGame?: () => void
}

export default function GameCodeModal({
  roomCode,
  isOpen,
  onClose,
  onCopy,
  onStartGame,
}: GameCodeModalProps) {
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)
  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/play/${roomCode}` : ''

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      if (onCopy) onCopy()
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('복사 실패:', err)
    }
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('복사 실패:', err)
    }
  }

  if (!mounted || !isOpen) return null

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* 배경 오버레이 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* 모달 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8"
        >
          {/* 닫기 버튼 */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="text-center">
            {/* 제목 */}
            <h2 className="text-2xl font-bold text-gray-900 mb-2">게임 참가 코드</h2>
            <p className="text-gray-600 mb-6">학생들에게 이 코드를 공유하세요</p>

            {/* 방 코드 - 큰 글씨로 표시 */}
            <div className="mb-6">
              <div className="inline-block bg-blue-600 rounded-xl p-6 shadow-lg">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="text-6xl font-bold text-white tracking-wider mb-2"
                >
                  {roomCode}
                </motion.div>
                <button
                  onClick={handleCopyCode}
                  className="text-sm text-primary-100 hover:text-white transition-colors flex items-center gap-1 mx-auto"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      복사됨!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      코드 복사
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* QR 코드 */}
            <div className="mb-6 flex justify-center">
              <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-gray-200">
                <QRCodeSVG
                  value={inviteUrl}
                  size={200}
                  level="H"
                />
              </div>
            </div>

            {/* 참가 링크 */}
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">또는 링크로 공유</p>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3 border border-gray-200">
                <input
                  type="text"
                  value={inviteUrl}
                  readOnly
                  className="flex-1 text-sm text-gray-700 bg-transparent border-none outline-none"
                />
                <Button
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      복사됨
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      복사
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* 안내 문구 */}
            <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
              <p className="text-sm text-primary-700">
                학생들은 <strong>퀴즈독</strong> 앱이나 웹사이트에서<br />
                위 코드를 입력하거나 QR 코드를 스캔하세요
              </p>
            </div>

            {/* 게임 시작 버튼 */}
            {onStartGame && (
              <div className="mt-6">
                <Button
                  onClick={() => {
                    onStartGame()
                    onClose()
                  }}
                  size="lg"
                  className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg"
                >
                  <Image
                    src={gameAssets.joystick.icon64}
                    alt=""
                    width={64}
                    height={64}
                    unoptimized
                    className="h-6 w-6 object-contain pixelated"
                    aria-hidden
                  />
                  게임 시작하기
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )

  return createPortal(modalContent, document.body)
}
