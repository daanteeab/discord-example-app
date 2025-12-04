import 'dotenv/config';
import axios from 'axios';

const RIOT_API_KEY = process.env.RIOT_API_KEY;

console.log('Testing Riot API...');
console.log('API Key:', RIOT_API_KEY ? `${RIOT_API_KEY.substring(0, 15)}...` : 'NOT FOUND');
console.log('Full Key Length:', RIOT_API_KEY?.length);
console.log('');

// Test different endpoints
const tests = [
  {
    name: 'Summoner by Name (EUW)',
    url: 'https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-name/Faker'
  },
  {
    name: 'Platform Status (EUW)',
    url: 'https://euw1.api.riotgames.com/lol/status/v4/platform-data'
  }
];

for (const test of tests) {
  console.log(`Testing: ${test.name}`);
  console.log(`URL: ${test.url}`);
  
  try {
    const response = await axios.get(test.url, {
      headers: {
        'X-Riot-Token': RIOT_API_KEY
      }
    });
    
    console.log('✅ SUCCESS!');
    console.log('Response:', JSON.stringify(response.data, null, 2).substring(0, 200));
  } catch (error) {
    console.log('❌ ERROR!');
    console.log('Status:', error.response?.status);
    console.log('Data:', JSON.stringify(error.response?.data, null, 2));
  }
  console.log('');
}
