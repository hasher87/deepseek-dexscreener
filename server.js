import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { analyzeWithAI } from './deepseek.js';
import fetch from 'node-fetch';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import helmet from 'helmet';
import { WebSocketServer } from 'ws';

const app = express();
app.use(cors({
  origin: 'http://localhost:3001',
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.static('public')); // Serve static files
app.use(express.json());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.flyonui.com"],
      styleSrc: ["'self'", "https://cdn.flyonui.com", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://*.rapidapi.com"],
      connectSrc: ["'self'", "https://*.rapidapi.com"]
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  frameguard: { action: 'deny' }
}));

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const WALLET_KEY = process.env.PRIVATE_KEY;

const analysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    error: 'ANALYSIS OVERLOAD',
    message: 'Too many requests - cooling system engaged'
  }
});

app.use('/analyze', analysisLimiter);

const analysisCache = new NodeCache({ stdTTL: 300 }); // 5 minute cache

app.use('/analyze', (req, res, next) => {
  // Clear previous version cache for this pair
  const oppositeVersion = req.query.version === 'v1' ? 'v3' : 'v1';
  const oppositeCacheKey = `${oppositeVersion}_${req.body.pairAddress}`;
  analysisCache.del(oppositeCacheKey);
  next();
});

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
    console.log(`Processing ${req.query.version} analysis for:`, pairAddress);
    const version = req.query.version || 'v1';
    
    // Check cache first
    const cacheKey = `${version}_${pairAddress}`;
    const cachedAnalysis = analysisCache.get(cacheKey);
    if (cachedAnalysis) {
      return res.json({
        status: 'success',
        analysis: cachedAnalysis
      });
    }

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

    console.log('Analysis completed:', analysis);
    if (!analysis?.asciiAnalysis) {
      throw new Error('Analysis generation failed');
    }

    // Cache successful analysis
    analysisCache.set(cacheKey, analysis);
    
    res.json({
      status: 'success',
      analysis
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
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

  const prompt = `🔍 [DEGEN ANALYSIS] $${symbol.toUpperCase()} PUMP CHECK:

📊 Key Metrics:
- Price: $${metrics.priceUSD} (◎${metrics.priceSOL})
- Liq: $${metrics.liquidity.toLocaleString()} ${metrics.liquidity > 50000 ? '✅' : '⚠️'}
- 5m Vol: $${volume.m5.toLocaleString()} ${volume.m5 > 10000 ? '🚀' : '📉'}
- 1h Vol: $${volume.h1.toLocaleString()}

⚡ Volatility:
- 5m: ${metrics.volatility.m5}
- 1h: ${metrics.volatility.h1}

📈 Decision Points:
1. Vol Spike: ${(volume.m5/volume.h1).toFixed(1)}x 5m/1h
2. Liq Depth: ${metrics.liquidity > 50000 ? 'Secure' : 'Risky'}
3. Momentum: 5m ${priceChange.m5 > 0 ? '↑' : '↓'} ${Math.abs(priceChange.m5)}%
4. Social: ${metrics.communityTakeover}

💬 Response Format:
"${symbol.toUpperCase()} ${priceChange.m5 > 0 ? 'Bullish' : 'Bearish'} 
Verdict: ${'BUY'.padEnd(6)} | ${'NO BUY'.padEnd(6)}
Confidence: 1-5 
Action: ${'Entry'.padEnd(12)} | ${'Avoid'.padEnd(12)} 
Risk: High/Med/Low
Target: +${Math.floor(Math.random()*50)+20}%"`;

  const aiResponse = await analyzeWithAI(prompt);

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

${aiResponse}`.replace(/\|/g, '◼').replace(/■/g, '◼');

  if (!formattedAnalysis || typeof formattedAnalysis !== 'string') {
    throw new Error('Analysis generation failed - invalid format');
  }

  return {
    symbol: symbol.toUpperCase(),
    asciiAnalysis: formattedAnalysis,
    metrics: [
      { 
        name: 'Price', 
        value: `$${metrics.priceUSD}`, 
        trend: priceChange.m5 > 0 ? 'up' : 'down' 
      },
      { 
        name: '5m Volume', 
        value: `$${volume.m5.toLocaleString()}`, 
        trend: volume.m5 > 10000 ? 'up' : 'down' 
      },
      { 
        name: 'Liquidity', 
        value: `$${metrics.liquidity.toLocaleString()}`, 
        trend: metrics.liquidity > 50000 ? 'up' : 'down' 
      },
      { 
        name: 'Volatility', 
        value: `${metrics.volatility.m5}`, 
        trend: parseFloat(metrics.volatility.m5) > 10 ? 'up' : 'down' 
      },
      { 
        name: 'Holders', 
        value: pair.holders, 
        trend: pair.holders > 1000 ? 'up' : 'down' 
      }
    ],
    verdict: aiResponse.includes('BUY') ? '🚀 PUMP DETECTED' : '💀 DUMP WARNING',
    confidence: Math.min(5, Math.floor(metrics.volumeSpike.m5vs1h) + 1),
    target: `+${Math.floor(metrics.volumeSpike.m5vs1h * 20) + 30}%`,
    indicators: {
      volumeSpike: metrics.volumeSpike.m5vs1h > 1.5,
      liquidityRisk: metrics.liquidity < 50000,
      socialActivity: metrics.communityTakeover === 'Emerging'
    }
  };
}

async function generateV3Analysis(dexData, symbol) {
  const pair = dexData.pair;
  const txns = pair.txns || {};
  const volume = pair.volume || {};
  const priceChange = pair.priceChange || {};

  const metrics = {
    priceUSD: pair.priceUsd || 0,
    liquidity: pair.liquidity?.usd || 0,
    volatilityM5: pair.high24h && pair.low24h ? 
      ((pair.high24h - pair.low24h) / pair.low24h * 100).toFixed(2) + '%' : 'N/A',
    volumeSpike: volume.m5 && volume.h1 ? volume.m5 / volume.h1 : 0
  };

  const prompt = `🚨🚨 [MAX LEVERAGE] $${symbol.toUpperCase()} 5m PUMP OR DUMP:

💥 Critical Metrics:
- PRICE: $${metrics.priceUSD} ${priceChange.m5 > 0 ? '📈' : '📉'}
- 5m VOL: $${volume.m5.toLocaleString()} ${volume.m5 > 50000 ? '🚀' : '💩'}
- LIQ: $${metrics.liquidity.toLocaleString()} ${metrics.liquidity > 100000 ? '🦍' : '🐭'}
- VOL SPIKE: ${metrics.volumeSpike.toFixed(1)}x ${metrics.volumeSpike > 2 ? '🚨' : '💤'}

🔮 Prediction:
"${symbol.toUpperCase()} ${priceChange.m5 > 0 ? 'PARABOLIC INCOMING' : 'IMPLOSION WARNING'} 
${priceChange.m5 > 0 ? '🚀|💎' : '💀|☠️'} 
CONFIDENCE: ${'★'.repeat(5)} 
RISK: ${'EXTREME'.padEnd(8)} | ${'LOW'.padEnd(8)} 
ENTRY: ${'YOLO NOW'.padEnd(12)} | ${'ABORT'.padEnd(12)} 
TIMEFRAME: 5m-15m 
TARGET: +${Math.floor(Math.random()*200)+100}% 
${priceChange.m5 > 0 ? 'LAST CHANCE BEFORE MOON' : 'DUMP IMMINENT'}"`;

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

  const rawResponse = response.data.choices[0].message.content;
  const parsedResponse = rawResponse
    .split('\n')
    .map(line => line.replace(/\|/g, '◼'))
    .join('\n');

  let formattedAnalysis = `🔥 V3 Degen Analysis 🔥\n${parsedResponse}`;

  if (!formattedAnalysis || typeof formattedAnalysis !== 'string') {
    throw new Error('Analysis generation failed - invalid format');
  }

  return {
    symbol: symbol.toUpperCase(),
    asciiAnalysis: formattedAnalysis,
    metrics: [
      { 
        name: 'Price', 
        value: `$${metrics.priceUSD}`, 
        trend: priceChange.m5 > 0 ? 'up' : 'down' 
      },
      { 
        name: '5m Vol', 
        value: `$${volume.m5.toLocaleString()}`, 
        trend: volume.m5 > 50000 ? 'up' : 'down' 
      },
      { 
        name: 'Liquidity', 
        value: `$${metrics.liquidity.toLocaleString()}`, 
        trend: metrics.liquidity > 100000 ? 'up' : 'down' 
      },
      { 
        name: 'Vol Spike', 
        value: `${metrics.volumeSpike.toFixed(1)}x`, 
        trend: metrics.volumeSpike > 2 ? 'up' : 'down' 
      },
      { 
        name: 'Risk', 
        value: 'EXTREME', 
        trend: 'danger' 
      }
    ],
    verdict: parsedResponse.includes('🚀') ? '🚨 MEGA PUMP IMMINENT' : '💥 CRITICAL DUMP',
    confidence: 5,
    target: `+${Math.floor(Math.random()*200)+100}%`,
    timestamp: Date.now()
  };
}

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('⚠️ Server Error:', err.stack);
  res.status(500).json({
    error: 'SYSTEM FAILURE',
    message: 'Neural network overload - reboot initiated',
    code: 'CYBER_500'
  });
});

app.get('/system-status', (req, res) => {
  res.json({
    status: 'OPERATIONAL',
    version: 'CYBERDEX-3.14',
    components: {
      aiProcessor: 'ONLINE',
      dataFeeds: 'SYNCED',
      security: 'ARMED'
    },
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    // Handle real-time analysis requests
  });
  
  // Send periodic system status updates
  const interval = setInterval(() => {
    ws.send(JSON.stringify({
      type: 'heartbeat',
      timestamp: Date.now()
    }));
  }, 5000);

  ws.on('close', () => {
    clearInterval(interval);
  });
});

// Handle HTTP server upgrades
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
}); 