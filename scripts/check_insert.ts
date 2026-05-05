
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

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkInsert() {
    console.log('Simulating room insertion...')

    // 1. Get a valid set_id
    const { data: sets } = await supabase.from('question_sets').select('id').limit(1)
    const setId = sets && sets.length > 0 ? sets[0].id : null

    console.log('Using Set ID:', setId)

    const testRoomCode = 'TEST_' + Math.floor(Math.random() * 1000)

    // 2. Try Insert
    const { data, error } = await supabase.from('rooms').insert({
        room_code: testRoomCode,
        status: 'waiting',
        current_q_index: 0,
        game_mode: 'gold_quest',
        set_id: setId // might be null if no sets
    }).select()

    if (error) {
        console.error('INSERT FAILED:', JSON.stringify(error, null, 2))
    } else {
        console.log('INSERT SUCCESS:', data)
        // Cleanup
        await supabase.from('rooms').delete().eq('room_code', testRoomCode)
    }
}

checkInsert()
