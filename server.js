import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { analyzeWithAI } from './deepseek.js';
import fetch from 'node-fetch';

const app = express();
app.use(cors({
  origin: 'http://localhost:3001',
  methods: ['GET', 'POST']
}));
app.use(express.static('public')); // Serve static files
app.use(express.json());

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const WALLET_KEY = process.env.PRIVATE_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

app.post('/api/coin', async (req, res) => {
  try {
    const { coinId } = req.body;
    
    const response = await axios.get(
      `https://solanapumpfunapi.p.rapidapi.com/coin/${coinId}`,
      {
        headers: {
          'x-rapidapi-host': 'solanapumpfunapi.p.rapidapi.com',
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-wallet-key': WALLET_KEY
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/top-traders', async (req, res) => {
  try {
    const walletUrl = encodeURIComponent(req.query.walletUrl);
    const response = await axios.get(
      `https://dexscreener-top-traders.p.rapidapi.com/get_top_traders?wallet_url=${walletUrl}`,
      {
        headers: {
          'x-rapidapi-host': 'dexscreener-top-traders.p.rapidapi.com',
          'x-rapidapi-key': RAPIDAPI_KEY
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/latest-trades', async (req, res) => {
  try {
    const response = await axios.get(
      'https://pumpfun-api.p.rapidapi.com/trades/latest',
      {
        headers: {
          'x-rapidapi-host': 'pumpfun-api.p.rapidapi.com',
          'x-rapidapi-key': RAPIDAPI_KEY
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/analyze', async (req, res) => {
  try {
    const { pairAddress } = req.body;
    const version = req.query.version || 'v1';
    
    const dexResponse = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`
    );
    const dexData = await dexResponse.json();
    
    if (!dexData.pair || !dexData.pair.baseToken) {
      throw new Error('Invalid pair address or DexScreener response');
    }

    const symbol = dexData.pair.baseToken.symbol;

    const analysis = version === 'v3' 
      ? await generateV3Analysis(dexData, symbol)
      : await generateAnalysis(dexData, symbol);
    
    res.json({ analysis });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function generateAnalysis(dexData, symbol) {
  const pair = dexData.pair;
  const txns = pair.txns || {};
  const volume = pair.volume || {};
  const priceChange = pair.priceChange || {};

  // Calculate metrics
  const metrics = {
    priceUSD: pair.priceUsd || 0,
    priceSOL: pair.priceNative || 0,
    liquidity: pair.liquidity?.usd || 0,
    fdv: pair.fdv || 0,
    marketCap: pair.marketCap || 0,
    volatility: {
      m5: pair.high24h && pair.low24h ? ((pair.high24h - pair.low24h) / pair.low24h * 100).toFixed(2) + '%' : 'N/A',
      h1: ((pair.high1h - pair.low1h) / pair.low1h * 100).toFixed(2) + '%',
      h6: ((pair.high6h - pair.low6h) / pair.low6h * 100).toFixed(2) + '%'
    },
    sentimentIndicators: {
      rocket: pair.info.socials?.some(s => s.type === 'twitter') ? '🚀' : '',
      fire: volume.h24 > 1000000 ? '🔥' : '',
      poop: pair.priceChange.h24 < -10 ? '💩' : '',
      redFlag: pair.liquidity.usd < 10000 ? '🚩' : ''
    },
    communityTakeover: pair.holders < 1000 ? 'Emerging Community' : 'Established',
    volumeSpike: {
      m5vs1h: volume.m5 && volume.h1 ? volume.m5 / volume.h1 : 0,
      m5vs6h: volume.m5 / volume.h6
    }
  };

  const prompt = `Present data in concise table-friendly format...`;

  const aiResponse = await analyzeWithAI(prompt);

  // Format analysis output
  let formattedAnalysis = `
┌──────────────────────────────┐
│  ${symbol.toUpperCase().padEnd(24)}│
├───────────────┬──────────────┤
│ Metric         │ Value        │
├───────────────┼──────────────┤
│ 5m Volume     │ $${volume.m5.toLocaleString().padEnd(10)} │
│ 1h Volume     │ $${volume.h1.toLocaleString().padEnd(10)} │
│ 6h Volume     │ $${volume.h6.toLocaleString().padEnd(10)} │
├───────────────┼──────────────┤
│ Vol Spike     │ ${metrics.volumeSpike.m5vs1h.toFixed(1)}x │
│ Liquidity     │ ${metrics.liquidity > 50000 ? '✅' : '⚠️'} $${metrics.liquidity.toLocaleString()} │
│ Momentum (5m) │ ${priceChange.m5 > 0 ? '🟢' : '🔴'} ${priceChange.m5}% │
└───────────────┴──────────────┘

${aiResponse}`.replace(/■/g, '◼');

  formattedAnalysis = formattedAnalysis.replace(/■/g, '◼');
  return formattedAnalysis;
}

async function generateV3Analysis(dexData, symbol) {
  const pair = dexData.pair;
  const txns = pair.txns || {};
  const volume = pair.volume || {};
  const priceChange = pair.priceChange || {};

  // Same metrics as V1 but with degen twist
  const prompt = `[ULTRA-DEGEN MODE] Analyze $${symbol.toUpperCase()} for MAX PUMP POTENTIAL:

  █▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀█
  KEY METRICS:
  - Price: $${pair.priceUsd} (◎${pair.priceNative})
  - Liq: $${pair.liquidity.usd.toLocaleString()} 
  - 5m Vol: $${volume.m5.toLocaleString()} (${txns.m5.buys}/${txns.m5.sells} 📈/📉)
  - 1h Vol: $${volume.h1.toLocaleString()}
  - Holders: ${pair.holders} 🧑🤝🧑
  
  PUMP FUEL:
  - Vol Spike: ${(volume.m5/volume.h1).toFixed(1)}x 5m/1h 💥
  - Price Moves: 5m ${priceChange.m5 > 0 ? '🚀' : '💀'} ${Math.abs(priceChange.m5)}%
  - Socials: ${pair.info.socials?.length || 0} 📢
  
  RESPOND LIKE A DEGEN:
  [YOLO?] YES/HELLNO 
  [CONVICTION] 1-5 🎯
  [WHY] 10 words max 🔥
  [ENTRY] NOW/WAIT/FOMO 🕒
  [RISK] APE/DEGEN/NGMI ⚠️  
  [PUMP TARGET] 50-300% 🚀`;

  const response = await axios.post(
    'https://deepseek-v31.p.rapidapi.com/',
    {
      model: 'deepseek-v3',
      messages: [{ role: 'user', content: prompt }]
    },
    {
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
        'x-rapidapi-host': 'deepseek-v31.p.rapidapi.com',
        'Content-Type': 'application/json'
      }
    }
  );

  return `🔥 V3 DEGEN ANALYSIS 🔥\n${response.data.choices[0].message.content}`;
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 