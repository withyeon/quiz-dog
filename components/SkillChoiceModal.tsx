'use client'

import { motion } from 'framer-motion'
import type { Skill, SkillId } from '@/lib/game/skills'

interface SkillChoiceModalProps {
    skills: Skill[]
    goldReward: number
    isBonus: boolean
    comboCount?: number
    onSelect: (skillId: SkillId) => void
}

export default function SkillChoiceModal({
    skills,
    goldReward,
    isBonus,
    comboCount,
    onSelect,
}: SkillChoiceModalProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/72 p-5 backdrop-blur-md"
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 16 }}
                transition={{ type: 'spring', damping: 20 }}
                className="w-full max-w-4xl rounded-lg border border-white/30 bg-white/94 p-5 shadow-2xl shadow-slate-950/30"
            >
                <motion.div
                    initial={{ y: -36, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="mb-5 flex flex-wrap items-center justify-center gap-3"
                >
                    <div className="rounded-full bg-amber-400 px-5 py-2 text-lg font-black text-slate-950 shadow-lg shadow-amber-200">
                        정답! +{goldReward}G
                    </div>
                    {isBonus && (
                        <div className="rounded-full bg-orange-500 px-4 py-2 text-sm font-black text-white shadow-lg shadow-orange-200">
                            🔥 {comboCount ?? 2}연속!
                        </div>
                    )}
                </motion.div>

                <div className="grid gap-3 md:grid-cols-3">
                    {skills.map((skill) => (
                        <motion.button
                            key={skill.id}
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => onSelect(skill.id)}
                            className="min-h-[190px] rounded-lg border border-slate-200 bg-white p-5 text-left shadow-lg transition-shadow hover:shadow-xl"
                        >
                            <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-lg ${skill.color} text-4xl shadow-lg`}>
                                {skill.emoji}
                            </div>
                            <h3 className="text-xl font-black text-slate-950">{skill.name}</h3>
                            <p className="mt-2 text-sm font-bold leading-6 text-slate-600">{skill.description}</p>
                        </motion.button>
                    ))}
                </div>
            </motion.div>
        </motion.div>
    )
}
