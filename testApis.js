import fetch from 'node-fetch';
import getSocialSentiment from './socialSentiment.js';

async function testDexScreener() {
  const pairAddress = 'FAipE7GQSYqNM4LSB8Fu4MaBctc6ZzeHTPPrL6iXRY5Z';
  const response = await fetch(
    `https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`
  );
  const data = await response.json();
  console.log('DexScreener Test:');
  console.log('- Token Name:', data.pair.baseToken.name);
  console.log('- Price:', data.pair.priceUsd);
}

async function testPumpFun() {
  const coinId = '6QXwAjE8QQmVziS8UFsTqBj59QkH12djPXQEiPAMEm2g';
  const response = await fetch('http://localhost:3001/api/coin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coinId })
  });
  const data = await response.json();
  console.log('\nPump.fun API Test:');
  console.log('- Full Response:', JSON.stringify(data, null, 2));
}

async function testSocialSentiment() {
  console.log('\nSocial Sentiment Test:');
  const symbol = 'PILL';
  const sentiment = await getSocialSentiment(symbol);
  console.log('- Positive Sentiment:', sentiment.positiveSentiment);
  console.log('- Sample Tweet:', sentiment.tweets?.[0]?.text || 'No tweets found');
  console.log('- $'+symbol+' Mentions:', sentiment.totalTweets);
}

async function main() {
  await testDexScreener();
  await testPumpFun();
  await testSocialSentiment();
}

main(); 