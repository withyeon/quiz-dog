import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

function loadEnv() {
    try {
        const envPath = path.join(process.cwd(), '.env.local')
        if (fs.existsSync(envPath)) {
            const envFile = fs.readFileSync(envPath, 'utf8')
            envFile.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/)
                if (match) {
                    const key = match[1].trim()
                    let value = match[2].trim()
                    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1)
                    }
                    process.env[key] = value
                }
            })
        }
    } catch (e) {
        console.warn('Warning: Could not load .env.local file manually.')
    }
}

loadEnv()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function run() {
    // BLANK 타입 문제 전체 조회
    const { data: blankQuestions, error: fetchError } = await (supabase
        .from('questions') as any)
        .select('id, question_text, set_id, type')
        .eq('type', 'BLANK')

    if (fetchError) {
        console.error('조회 에러:', fetchError)
        return
    }

    console.log('BLANK 타입 문제 목록:')
    console.log(JSON.stringify(blankQuestions, null, 2))

    if (!blankQuestions || blankQuestions.length === 0) {
        console.log('BLANK 타입 문제가 없습니다.')
        return
    }

    // 삭제 대상 찾기 (삼각형 or {{blank}} 포함)
    const targets = blankQuestions.filter((q: any) =>
        q.question_text?.includes('삼각형') ||
        q.question_text?.includes('{{blank}}') ||
        q.question_text?.includes('밑변')
    )

    if (targets.length === 0) {
        console.log('\n삭제 대상을 찾지 못했습니다. 전체 BLANK 문제 목록을 확인하세요.')
        return
    }

    for (const target of targets) {
        console.log('\n삭제 중:', target.id, '-', target.question_text)
        const { error: deleteError } = await (supabase
            .from('questions') as any)
            .delete()
            .eq('id', target.id)

        if (deleteError) {
            console.error('삭제 에러:', deleteError)
        } else {
            console.log('✅ 삭제 완료:', target.id)
        }
    }
}

run()
