require('dotenv').config({ path: __dirname + '/../.env' });
const key = process.env.GROQ_API_KEY;

async function testChat(prompt, lang) {
  const groqPrompt = (lang === 'wo')
    ? "Tu es Zahara, l'assistante virtuelle officielle de MUTUALIS DAKAR (UNAMUSC Sénégal). Tu es une femme sénégalaise chaleureuse, bienveillante et professionnelle. Tu réponds exclusivement en WOLOF naturel, fluide et concis (2 à 3 phrases). Salue poliment (Dalal ak jamm / Nanga def) et réponds directement. Tarifs: 4500 FCFA/an individuelle, 1000 + 3500 FCFA famille, gratuité maternité 100%, pharmacie 50% sur bon, hôpital 80-100% sur garantie."
    : "Tu es Zahara, l'assistante virtuelle officielle de MUTUALIS DAKAR (UNAMUSC Sénégal). Tu es une femme sénégalaise chaleureuse, accueillante (Teranga) et très professionnelle. Tu réponds en FRANÇAIS naturel, clair, chaleureux et concis (2 à 3 phrases). Tarifs: 4500 FCFA/an individuelle, maternité 100% gratuit, pharmacie 50%, hôpital 80-100% sur lettre de garantie.";

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
        { role: 'user', content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 300
    })
  });
  const data = await res.json();
  console.log(`[${lang}] "${prompt}" =>`, data.choices?.[0]?.message?.content);
}

(async () => {
  await testChat("Bonjour Zahara, comment faire pour adhérer ?", "fr");
  await testChat("Nanga def Zahara, dama bëgg bokk ci mutuelle bi", "wo");
})();
