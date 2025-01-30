import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY  // Use public anon key here
)

// For admin operations
const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

// DexScreener API configuration
const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/search'

async function fetchTokenPairs(chainId, tokenAddress) {
  try {
    const response = await fetch(`${DEXSCREENER_API}/?q=${tokenAddress}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Your-App-Name/1.0 (contact@yourdomain.com)'
      },
      timeout: 10000  // Add 10-second timeout
    })
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorBody}`);
    }
    const data = await response.json();
    if (!data.pairs) throw new Error('Invalid API response format');
    return data;
  } catch (error) {
    console.error('Error fetching data:', error)
    return null
  }
}

async function storeInSupabase(pairsData) {
  // Add connection check
  const { error: connError } = await supabase
    .from('token_pairs')
    .select('*')
    .limit(1);
  
  if (connError) {
    console.error('Supabase connection error:', connError);
    return;
  }

  if (!pairsData || !pairsData.pairs) {
    console.log('No data to store');
    return;
  }

  // Transform data for Supabase
  const formattedData = pairsData.pairs.map(pair => ({
    chain_id: pair.chainId,
    pair_address: pair.pairAddress,
    base_token: pair.baseToken,
    quote_token: pair.quoteToken,
    price_usd: Number(pair.priceUsd),
    liquidity_usd: Number(pair.liquidity?.usd || 0),
    volume_24h: Number(pair.volume?.h24 || 0),
    created_at: new Date(pair.pairCreatedAt).toISOString(),
    dex_info: {
      dex_id: pair.dexId,
      url: pair.url,
      labels: pair.labels
    }
  }))

  // Use admin client for inserts
  const { data, error } = await adminSupabase
    .from('token_pairs')
    .insert(formattedData)

  if (error) {
    console.error('Error inserting data:', error);
  } else {
    console.log(`Inserted ${data.length} records`);
  }
}

// Example usage
async function main() {
  const tokenAddress = 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'
  
  console.log('Fetching data...')
  const pairsData = await fetchTokenPairs(null, tokenAddress)
  
  console.log('API Response:', JSON.stringify(pairsData, null, 2))
  
  if (pairsData?.pairs) {
    console.log(`Found ${pairsData.pairs.length} pairs`)
    await storeInSupabase(pairsData)
  } else {
    console.log('No pairs data received')
  }
}

main() 