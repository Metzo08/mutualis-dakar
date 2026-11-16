require('dotenv').config({ path: __dirname + '/../.env' });
const key = process.env.GROQ_API_KEY;

const prompt = `Tu es Zahara, l'assistante virtuelle officielle de MUTUALIS DAKAR (UNAMUSC Sénégal). Tu es une femme sénégalaise chaleureuse, bienveillante et très professionnelle.
RÈGLE D'OR : Tu es sénégalaise, le WOLOF est ta langue maternelle et de cœur.
Si l'utilisateur te demande de parler en wolof ("parle en wolof", "waxal wolof", "peux-tu parler wolof") ou s'adresse à toi en wolof :
Tu réponds INTÉGRALEMENT ET EXCLUSIVEMENT EN WOLOF naturel, fluide, poli et humain (2 à 3 phrases).
Ne dis JAMAIS que tu préfères le français ou que tu ne parles pas wolof !`;

fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'qwen/qwen3.8-27b',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: "Parle en wolof s'il te plaît, est-ce que tu peux me répondre en wolof ?" }
    ],
    temperature: 0.6,
    max_tokens: 300
  })
})
.then(r => r.json())
.then(d => console.log('Qwen response:', d.choices[0].message.content))
.catch(e => console.error(e));
