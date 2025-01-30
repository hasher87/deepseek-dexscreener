import fetch from 'node-fetch';

async function testTweetScout() {
  const symbol = 'PILL';
  const response = await fetch(
    `https://api.tweetscout.io/v2/search?query=%24${symbol}&lang=en`,
    {
      headers: {
        'Authorization': 'Bearer 8fbe1786-4d7c-49af-a5b1-a03a99bf306c',
        'Content-Type': 'application/json'
      }
    }
  );
  
  const data = await response.json();
  console.log('TweetScout Test Results:');
  console.log('------------------------');
  console.log('Status:', response.status);
  console.log('Total Tweets:', data.total_count);
  console.log('First Tweet:', data.tweets?.[0]?.content || 'None');
}

testTweetScout(); 