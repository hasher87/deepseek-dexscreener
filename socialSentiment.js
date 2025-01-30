import fetch from 'node-fetch'

const RAPIDAPI_KEY = '23a500ee16msh45894c8bde4be83p1ebed3jsn365be3f4bc07'

// Using Twitter32 provider
async function getTweets(symbol) {
  const response = await fetch("https://twitter32.p.rapidapi.com/getSearch", {
    method: 'POST',
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'twitter32.p.rapidapi.com'
    },
    body: JSON.stringify({
      query: `$${symbol} lang:en`,
      count: 100
    })
  })
  return processTweets(await response.json())
}

async function getSocialSentiment(symbol) {
  try {
    const response = await fetch(
      `https://twitter-api45.p.rapidapi.com/search.php?query=%24${symbol}`,
      {
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'twitter-api45.p.rapidapi.com'
        }
      }
    );
    
    const data = await response.json();
    
    return {
      totalTweets: data.timeline.length,
      retweets: data.timeline.reduce((sum, t) => sum + t.retweet_count, 0),
      replies: data.timeline.reduce((sum, t) => sum + t.reply_count, 0),
      symbolMentions: data.timeline.filter(t => 
        t.text.toLowerCase().includes(`$${symbol.toLowerCase()}`)
      ).length
    };
    
  } catch (error) {
    console.error('Twitter API error:', error);
    return null;
  }
}

async function processTweets(data) {
  // Implementation of processTweets function
}

export default getSocialSentiment;
