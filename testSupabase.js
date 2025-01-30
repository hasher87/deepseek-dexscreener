import { createClient } from '@supabase/supabase-js'
import https from 'https'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    global: {
      fetch: (...args) => fetch(...args, { 
        agent: new https.Agent({
          rejectUnauthorized: false  // Only for testing
        })
      })
    }
  }
)

async function testConnection() {
  console.log('Testing Supabase connection...')
  
  const { data, error } = await supabase
    .from('token_pairs')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Connection test failed:', error)
  } else {
    console.log('Connection successful! Found', data.length, 'records')
  }
}

testConnection() 