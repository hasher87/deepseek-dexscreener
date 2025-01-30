import fetch from 'node-fetch'

async function testDexScreener() {
  const tokenAddress = 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'
  const apiUrl = `https://api.dexscreener.com/latest/dex/search/?q=${tokenAddress}`

  try {
    console.log('Testing DexScreener API...')
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DexTester/1.0'
      },
      timeout: 10000
    })

    console.log('HTTP Status:', response.status)
    
    const data = await response.json()
    console.log('API Response Summary:')
    console.log('- Pairs found:', data.pairs?.length || 0)
    console.log('- First pair:', data.pairs?.[0]?.pairAddress || 'None')
    
    if (data.pairs?.length > 0) {
      console.log('✅ API access successful!')
    } else {
      console.log('⚠️  API access working but no pairs found')
    }
    
  } catch (error) {
    console.error('❌ API test failed:', error)
  }
}

testDexScreener() 