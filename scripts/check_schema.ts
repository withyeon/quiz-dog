
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

async function checkSchema() {
    console.log('Checking rooms table schema...')

    // Try to select set_id from rooms
    const { data, error } = await supabase.from('rooms').select('set_id').limit(1)

    if (error) {
        console.error('Error selecting set_id:', error)
        if (error.code === '42703') { // undefined_column
            console.log('RESULT: MISSING_COLUMN - The set_id column does not exist in rooms table.')
        } else {
            console.log('RESULT: ERROR - ' + error.message)
        }
    } else {
        console.log('RESULT: SUCCESS - The set_id column exists.')
    }
}

checkSchema()
