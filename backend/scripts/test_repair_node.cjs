const key = (process.env.GROQ_API_KEY || '');
const system = `Tu es un expert linguiste bilingue Wolof et Français pour une mutuelle au Sénégal.
Un utilisateur sénégalais a parlé dans le micro. Google Chrome a transcrit en phonétique française ce qu'il a cru entendre.
Exemples :
- "non pas de natte à la cotisation" -> {"lang": "wo", "text": "Nanga def, ñaata la cotisation bi ?"}
- "garde bille pharmacie" -> {"lang": "wo", "text": "Garab yi ci pharmacie bi"}
- "j'irai jef" -> {"lang": "wo", "text": "Jërejëf"}
- "comment obtenir une lettre de garantie" -> {"lang": "fr", "text": "Comment obtenir une lettre de garantie"}

Tâche : Détermine si c'est du Wolof phonétiquement transcrit ou du Français.
Réponds STRICTEMENT sous forme de JSON :
{"lang": "wo", "text": "phrase wolof"} ou {"lang": "fr", "text": "phrase française"}`;

async function test(input) {
  const t0 = Date.now();
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: input }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
  });
  const data = await res.json();
  console.log(`"${input}" ->`, data.choices?.[0]?.message?.content, `en ${Date.now() - t0} ms`);
}

async function run() {
  await test('non pas de natte à la cotisation');
  await test('garde bille pharmacie');
  await test('comment obtenir une lettre de garantie');
}
run();
