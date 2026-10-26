'use client'

import VocabEditor from '@/components/vocab/VocabEditor'

export default function NewVocabSetPage() {
  return <VocabEditor initial={{ title: '', subject: '', grade: '', isPublic: true, cards: [] }} />
}
