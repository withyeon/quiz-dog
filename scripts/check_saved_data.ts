import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load environment variables manually
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

function requireSupabaseEnv() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_SECRET_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase credentials')
        process.exit(1)
    }

    return { supabaseUrl, supabaseKey }
}

const { supabaseUrl, supabaseKey } = requireSupabaseEnv()
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkData() {
    console.log('=== Checking question_sets ===')
    const { data: sets, error: setsError } = await supabase
        .from('question_sets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3)

    if (setsError) {
        console.error('Error:', setsError)
    } else {
        console.log('Found', sets?.length, 'sets:')
        sets?.forEach(s => {
            console.log(`- ID: ${s.id}`)
            console.log(`  Title: ${s.title}`)
            console.log(`  Description: ${s.description}`)
        })
    }

    console.log('\n=== Checking questions for each set ===')
    if (sets && sets.length > 0) {
        for (const set of sets) {
            const { data: questions, error: qError } = await supabase
                .from('questions')
                .select('*')
                .eq('set_id', set.id)

            if (qError) {
                console.error(`Error for set ${set.id}:`, qError)
            } else {
                console.log(`Set "${set.title}" (${set.id}): ${questions?.length || 0} questions`)
                if (questions && questions.length > 0) {
                    console.log('  First question:', questions[0].question_text?.substring(0, 50))
                }
            }
        }
    }
}

checkData()
