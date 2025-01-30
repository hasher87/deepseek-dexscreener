import fetch from 'node-fetch'
import getSocialSentiment from './socialSentiment.js'  // Default import

async function analyzeToken(pairAddress) {
  const apiUrl = `https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`
  
  try {
    const response = await fetch(apiUrl)
    const data = await response.json()
    
    const pair = data.pair
    console.log('Token Analysis Report:')
    console.log('-----------------------')
    console.log('Token Name:', pair.baseToken.name)
    console.log('Symbol:', pair.baseToken.symbol)
    console.log('Current Price:', pair.priceUsd)
    console.log('Market Cap:', pair.fdv || 'N/A')
    console.log('24h Volume:', pair.volume.h24)
    console.log('Liquidity:', pair.liquidity.usd)
    console.log('Price Change (24h):', pair.priceChange.h24)
    console.log('DEX:', pair.dexId)
    
    // Basic probability estimation
    const requiredGrowth = 10_000_000 / (pair.fdv || pair.liquidity.usd)
    console.log('\nRequired Growth for $10M MCAP:', requiredGrowth.toFixed(1)+'x')
    
    // Risk factors
    let riskScore = 0
    if (pair.liquidity.usd < 10000) riskScore += 2
    if (pair.volume.h24 < 50000) riskScore += 1
    if (!pair.audits) riskScore += 3
    
    // Holder analysis
    const holderStats = pair.holders || {}
    const topHolderPct = holderStats.top10 || 0
    if (topHolderPct > 60) riskScore += 2
    
    // Trade activity
    const buys = pair.buys || 0
    const sells = pair.sells || 0
    const buyVolume = pair.buyVolume || 0
    const sellVolume = pair.sellVolume || 0
    
    const buySellRatio = sells > 0 ? buys / sells : 0
    const volRatio = sellVolume > 0 ? buyVolume / sellVolume : 0
    
    if (buySellRatio < 0.8 || volRatio < 0.7) riskScore += 1
    
    // Sniper activity
    const newHolders24h = holderStats.total - (holderStats.total24hAgo || holderStats.total)
    if (newHolders24h > 500) riskScore += 2  // High new holders = possible pump

    // Social sentiment
    const sentiment = await getSocialSentiment(pair.baseToken.symbol)
    if (sentiment) {
      console.log('\nSocial Sentiment:')
      console.log('- Total Tweets:', sentiment.totalTweets)
      console.log('- Positive:', sentiment.positiveSentiment)
      console.log('- Negative:', sentiment.negativeSentiment)
      console.log('- Score:', sentiment.sentimentScore)
      
      if (sentiment.sentimentScore < -5) riskScore += 2
      if (sentiment.totalTweets < 10) riskScore += 1
    }

    console.log('\nRisk Assessment:')
    console.log('- Liquidity Risk:', pair.liquidity.usd < 10000 ? 'High' : 'Moderate')
    console.log('- Volume Risk:', pair.volume.h24 < 50000 ? 'Low Activity' : 'Healthy')
    console.log('- Audit Status:', pair.audits ? 'Audited' : 'Unaudited')
    console.log('- Holder Concentration:', `${topHolderPct}% in top 10 wallets`)
    console.log('- Buy/Sell Ratio:', `${buySellRatio.toFixed(1)} (${buys} buys / ${sells} sells)`)
    console.log('- Volume Ratio:', `${volRatio.toFixed(1)} (${buyVolume.toFixed(0)}/${
      sellVolume.toFixed(0)} USD)`)
    console.log('- New Holders (24h):', newHolders24h)
    console.log('- Total Risk Score:', riskScore+'/6')
    
  } catch (error) {
    console.error('Analysis failed:', error)
  }
}

// Run analysis
analyzeToken('FAipE7GQSYqNM4LSB8Fu4MaBctc6ZzeHTPPrL6iXRY5Z') 