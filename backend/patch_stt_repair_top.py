with open(r'C:\Users\hp\Downloads\MUTUALIS DAKAR\backend\server.js', 'r', encoding='utf-8') as f:
    content = f.read()

target = """app.post('/api/chatbot', validate(chatbotSchema), async (req, res) => {
  try {
    const { message, lang, history, isVoiceInput } = req.body;
    let speaksWolof = (lang === 'wo');
    let userMessageToProcess = message;"""

replacement = """app.post('/api/chatbot', validate(chatbotSchema), async (req, res) => {
  try {
    const { message, lang, history, isVoiceInput } = req.body;
    let speaksWolof = (lang === 'wo');
    let userMessageToProcess = message;

    // ── STT REPAIR INTELLIGENT VIA GROQ AI 120B (WOLOF / FRANÇAIS) ──
    if (isVoiceInput) {
      try {
        console.log("[STT Repair] Décodage phonétique de la voix capturée via Groq AI 120B...");
        const repairRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            messages: [
              {
                role: 'system',
                content: `Tu es un expert linguiste bilingue Wolof et Français pour le chatbot Zahara de Mutualis Dakar (UNAMUSC Sénégal).
L'utilisateur a parlé au micro. Google Chrome a transcrit en phonétique française approximative ce qu'il a cru entendre.
Exemples de transcriptions réelles :
- "non pas de natte à la cotisation" -> {"lang": "wo", "text": "Nanga def, ñaata la cotisation bi ?"}
- "garde bille pharmacie" -> {"lang": "wo", "text": "Garab yi ci pharmacie bi"}
- "j'irai jef" -> {"lang": "wo", "text": "Jërejëf"}
- "dame à beugue wax" -> {"lang": "wo", "text": "Dama bëgg wax"}
- "men n'a am ordonnance" -> {"lang": "wo", "text": "Mën naa am ordonnance"}
- "ouax ma ci mutuelle" -> {"lang": "wo", "text": "Wax ma ci mutuelle"}
- "comment obtenir une lettre de garantie" -> {"lang": "fr", "text": "Comment obtenir une lettre de garantie"}
- "bonjour comment vous allez" -> {"lang": "fr", "text": "Bonjour comment vous allez"}

Tâche : Détermine avec grande précision si l'utilisateur a parlé en Wolof (même mal transcrit par le moteur français) ou en Français.
Réponds STRICTEMENT sous format JSON seul :
{"lang": "wo", "text": "phrase wolof correcte (ë, ñ)"} ou {"lang": "fr", "text": "phrase française"}`
              },
              { role: 'user', content: message }
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' }
          }),
          signal: AbortSignal.timeout(3500)
        });

        if (repairRes.ok) {
          const rData = await repairRes.json();
          const rawContent = rData.choices?.[0]?.message?.content || '{}';
          const parsed = JSON.parse(rawContent);
          if (parsed && parsed.text) {
            userMessageToProcess = parsed.text;
            if (parsed.lang === 'wo' || isWolofText(parsed.text)) {
              speaksWolof = true;
            }
            console.log(`[STT Repair Réussi] (${parsed.lang}) "${message}" -> "${parsed.text}" (speaksWolof=${speaksWolof})`);
          }
        }
      } catch (repairErr) {
        console.warn("[STT Repair] Erreur Groq, repli phonétique :", repairErr.message);
        if (isWolofText(message)) speaksWolof = true;
      }
    } else if (lang === 'wo' || isWolofText(message)) {
      speaksWolof = true;
    }"""

if target in content:
    content = content.replace(target, replacement, 1)
    with open(r'C:\Users\hp\Downloads\MUTUALIS DAKAR\backend\server.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: server.js patched with Top STT Repair!")
else:
    print("ERROR: Target not found")
