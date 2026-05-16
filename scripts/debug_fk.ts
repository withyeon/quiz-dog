
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

async function debugFK() {
    console.log('--- Debugging Foreign Key Constraint ---')

    // 1. Check Constraint Existence (by checking info schema or just behavior)
    // We'll rely on behavior.

    // 2. Test inserting with NULL set_id
    const codeNull = 'TEST_NULL_' + Math.floor(Math.random() * 1000)
    console.log(`\n1. Testing insert with set_id: null (Room: ${codeNull})`)
    const { error: errNull } = await supabase.from('rooms').insert({
        room_code: codeNull,
        status: 'waiting',
        game_mode: 'gold_quest',
        set_id: null
    })

    if (errNull) {
        console.error('FAIL: Insert with NULL failed:', errNull.message)
    } else {
        console.log('SUCCESS: Insert with NULL worked.')
        await supabase.from('rooms').delete().eq('room_code', codeNull)
    }

    // 3. Test inserting with INVALID set_id
    const codeInvalid = 'TEST_INV_' + Math.floor(Math.random() * 1000)
    console.log(`\n2. Testing insert with set_id: 'INVALID_ID' (Room: ${codeInvalid})`)
    const { error: errInvalid } = await supabase.from('rooms').insert({
        room_code: codeInvalid,
        status: 'waiting',
        game_mode: 'gold_quest',
        set_id: 'INVALID_ID_XYZ'
    })

    if (errInvalid && errInvalid.message.includes('violates foreign key constraint')) {
        console.log('SUCCESS: Constraint caught the invalid ID as expected.')
    } else if (errInvalid) {
        console.log('FAIL: Insert failed but unexpected error:', errInvalid.message)
    } else {
        console.error('FAIL: Insert with INVALID ID succeeded! (Constraint missing?)')
        await supabase.from('rooms').delete().eq('room_code', codeInvalid)
    }

    // 4. List Valid Sets
    console.log('\n3. Listing Valid Question Sets:')
    const { data: sets } = await supabase.from('question_sets').select('id, title')
    if (sets) {
        sets.forEach(s => console.log(` - ID: "${s.id}", Title: "${s.title}"`))
    } else {
        console.log('No sets found.')
    }
}

debugFK()
