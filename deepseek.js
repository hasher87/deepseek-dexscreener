import axios from 'axios';

export async function analyzeWithAI(prompt) {
  try {
    const response = await axios.post(
      'https://deepseek-r1.p.rapidapi.com/',
      {
        model: "deepseek-r1",
        messages: [{
          role: "user",
          content: prompt
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-host': 'deepseek-r1.p.rapidapi.com',
          'x-rapidapi-key': process.env.RAPIDAPI_KEY
        }
      }
    );
    
    console.log('DeepSeek API Response:', JSON.stringify(response.data, null, 2));
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('DeepSeek API error:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Status code:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
    return null;
  }
} 