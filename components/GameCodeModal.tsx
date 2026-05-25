'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Copy, Check } from 'lucide-react'
import QRCodeSVG from 'react-qr-code'
import { Button } from '@/components/ui/button'

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
          className="relative font-bitbit w-full max-w-md rounded-3xl border border-sky-100 bg-white p-8 shadow-2xl shadow-sky-200"
        >
          {/* 닫기 버튼 */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 transition-colors hover:text-slate-600"
            aria-label="닫기"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="space-y-5 text-center">
            {/* 방 코드 카드 */}
            <div className="rounded-3xl bg-gradient-to-br from-sky-400 via-sky-500 to-cyan-500 p-6 text-white shadow-xl shadow-sky-200">
              <p className="text-sm font-black text-sky-50">참가코드</p>
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="mt-1 text-6xl font-black tracking-wider"
              >
                {roomCode}
              </motion.div>
              <button
                onClick={handleCopyCode}
                className="mx-auto mt-3 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-xs font-black text-white transition hover:bg-white/30"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    복사됨!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    코드 복사
                  </>
                )}
              </button>
            </div>

            {/* QR 코드 */}
            <div className="flex justify-center">
              <div className="rounded-2xl border-2 border-sky-100 bg-white p-4 shadow-sm">
                <QRCodeSVG
                  value={inviteUrl}
                  size={220}
                  level="H"
                />
              </div>
            </div>

            {/* 참가 링크 */}
            <div className="flex items-center gap-2 rounded-2xl border border-sky-100 bg-slate-50 p-3">
              <input
                type="text"
                value={inviteUrl}
                readOnly
                className="flex-1 truncate bg-transparent text-sm font-bold text-slate-700 outline-none"
              />
              <Button
                size="sm"
                onClick={handleCopy}
                className="shrink-0 rounded-lg bg-sky-500 font-black text-white shadow-sm transition hover:bg-sky-600"
              >
                {copied ? (
                  <>
                    <Check className="mr-1 h-4 w-4" />
                    복사됨
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-4 w-4" />
                    복사
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )

  return createPortal(modalContent, document.body)
}
