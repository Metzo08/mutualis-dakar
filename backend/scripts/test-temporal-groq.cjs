require('dotenv').config({ path: __dirname + '/../.env' });
const key = process.env.GROQ_API_KEY;

// Mock temporal helper
const now = new Date();
const hour = now.getUTCHours();
console.log('Current Dakar Hour (GMT):', hour + 'h');

async function testPrompt(userMsg, lang) {
  const isWo = lang === 'wo';
  const groqPrompt = isWo
    ? `Tu es Zahara, l'assistante virtuelle officielle de MUTUALIS DAKAR (UNAMUSC Sénégal). Tu es une femme sénégalaise chaleureuse, polie, bienveillante et profondément humaine. Tu as une conscience aiguë et vivante du temps, de l'heure et des saisons à Dakar.
CONTEXTE TEMPOREL EN DIRECT À DAKAR :
- Heure : ${hour}h (Après-midi / Ngoon)
- Saison : Harmattan précoce / Noor (fraîcheur nocturne, renouvellement des cotisations 2026)
Réponds en WOLOF naturel et chaleureux (2-3 phrases) en tenant compte du moment de la journée.`
    : `Tu es Zahara, l'assistante virtuelle officielle de MUTUALIS DAKAR (UNAMUSC Sénégal). Tu es une femme sénégalaise chaleureuse, accueillante (Teranga), très professionnelle et profondément humaine. Tu as une conscience aiguë et vivante du temps, de l'heure et des saisons à Dakar.
CONTEXTE TEMPOREL EN DIRECT À DAKAR :
- Heure : ${hour}h (Après-midi)
- Saison au Sénégal : Harmattan précoce / Saison sèche (fraîcheur nocturne, début des adhésions annuelles CSU 2026)
Réponds en FRANÇAIS naturel, fluide et chaleureux (2-3 phrases) en tenant compte de l'heure et de la saison.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen/qwen3.8-27b',
      messages: [
        { role: 'system', content: groqPrompt },
        { role: 'user', content: userMsg }
      ],
      temperature: 0.6,
      max_tokens: 300
    })
  });
  const data = await res.json();
  console.log(`\n[${lang.toUpperCase()}] "${userMsg}"`);
  console.log('->', data.choices?.[0]?.message?.content);
}

(async () => {
  await testPrompt("Bonjour Zahara !", "fr");
  await testPrompt("Nanga def Zahara !", "wo");
  await testPrompt("Il fait un peu frais ce soir, des conseils de santé ?", "fr");
})();
