import fetch from 'node-fetch';
import { analyzeWithAI } from './deepseek.js';

async function fullAnalysis(tokenAddress, symbol) {
  // Get DexScreener data
  const dexResponse = await fetch(
    `https://api.dexscreener.com/latest/dex/pairs/solana/${tokenAddress}`
  );
  if (!dexResponse.ok) {
    throw new Error(`DexScreener request failed: ${dexResponse.status}`);
  }
  const dexData = await dexResponse.json();
  
  // Extract transaction metrics
  const txns = dexData.pair.txns;
  const volume = dexData.pair.volume;

  console.log('DexScreener Raw Response:', JSON.stringify(dexData, null, 2));

  if (!dexData?.pair?.baseToken?.name) {
    throw new Error('Invalid DexScreener response');
  }

  // Calculate ratios
  const ratios = {
    m5: txns.m5.buys / txns.m5.sells,
    h1: txns.h1.buys / txns.h1.sells,
    h6: txns.h6.buys / txns.h6.sells
  };

  // Generate AI analysis
  const aiPrompt = `As a crypto trading bot, analyze $${symbol}:
  - Price: $${dexData.pair.priceUsd}
  - Volume Metrics:
    * 5m: $${volume.m5} (${txns.m5.buys} buys / ${txns.m5.sells} sells)
    * 1h: $${volume.h1} (${txns.h1.buys} buys / ${txns.h1.sells} sells) 
    * 6h: $${volume.h6} (${txns.h6.buys} buys / ${txns.h6.sells} sells)
  - Buy/Sell Ratios:
    5m: ${ratios.m5.toFixed(2)} 
    1h: ${ratios.h1.toFixed(2)}
    6h: ${ratios.h6.toFixed(2)}
  
  Analyze these patterns:
  1. Volume trends across timeframes
  2. Buyer/seller momentum
  3. Liquidity and market depth
  
  Trading signal:`;
  
  const aiAnalysis = await analyzeWithAI(aiPrompt);

  console.log('Advanced Analysis Report:');
  console.log('--------------------------');
  console.log('Token:', dexData.pair.baseToken.name);
  console.log('Symbol:', symbol);
  console.log('Price:', dexData.pair.priceUsd);
  console.log('5m Volume:', dexData.pair.volume.m5);
  console.log('1h Volume:', dexData.pair.volume.h1);
  console.log('6h Volume:', dexData.pair.volume.h6);
  console.log('\nAI Analysis:\n', aiAnalysis);
}

// Run analysis for FAipE7GQSYqNM4LSB8Fu4MaBctc6ZzeHTPPrL6iXRY5Z
fullAnalysis('FAipE7GQSYqNM4LSB8Fu4MaBctc6ZzeHTPPrL6iXRY5Z', 'PILL');