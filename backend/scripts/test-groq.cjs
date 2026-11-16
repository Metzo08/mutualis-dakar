require('dotenv').config({ path: __dirname + '/../.env' });
const key = process.env.GROQ_API_KEY;
console.log('GROQ_API_KEY present:', Boolean(key));
if (!key) process.exit(0);

fetch('https://api.groq.com/openai/v1/models', {
  headers: { Authorization: 'Bearer ' + key }
})
.then(r => r.json())
.then(d => {
  if (d.data) {
    console.log('Available models:', d.data.map(m => m.id));
  } else {
    console.log('Response:', d);
  }
})
.catch(err => console.error(err));
