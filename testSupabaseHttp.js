import fetch from 'node-fetch'

async function testHttpConnection() {
  const url = `${process.env.SUPABASE_URL}/rest/v1/token_pairs?select=*&limit=1`
  const response = await fetch(url, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
    }
  })
  
  console.log('HTTP Status:', response.status)
  console.log('Response:', await response.text())
}

testHttpConnection() 