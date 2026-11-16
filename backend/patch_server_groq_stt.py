with open(r'C:\Users\hp\Downloads\MUTUALIS DAKAR\backend\server.js', 'r', encoding='utf-8') as f:
    content = f.read()

target = """      if (isVoiceInput) {
        try {
          console.log("Tentative de réparation STT (wolof/français)...");
          const repairSystemInstruction = `Tu es un correcteur de transcription vocale pour une application de santé au Sénégal (chatbot Zahara). Le texte fourni a été transcrit par un moteur de reconnaissance vocale FRANÇAIS. Deux cas possibles :
1) L'utilisateur a parlé WOLOF : le moteur a produit une phonétique française approximative (exemples réels : « nanga def » → « non pas de », « jërejëf » → « j'irai jef », « ñaata la cotisation » → « gnata la cotisation », « garab » → « garde bille », « fajukaay » → « facture kay », « waaw » → « ouaou »). Reconstruis alors la phrase Wolof originale correcte et complète (orthographe wolof standard : ë, ñ).
2) L'utilisateur a parlé FRANÇAIS : le texte est déjà correct, renvoie-le strictement inchangé.
Réponds STRICTEMENT avec un objet JSON seul, sans texte autour : {"lang":"wo","text":"phrase wolof reconstruite"} ou {"lang":"fr","text":"texte français inchangé"}`;
          // Marqueurs wolof sûrs dans un texte déjà réparé
          const WOLOF_REPAIRED_HINT = /(nanga|naka|jërejëf|jerejef|salaam|salam ale|garab|fajukaay|ndax|waaw|déedéet|ñaata|xaalis|dimbali|fajj|jamm|rekk|mungi|mangi|wér-gi-yaram|fayal|bokk ci|laaj)/i;
          let repaired = null;
          for (const repairModelName of ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash']) {
            // Budget de réparation : 4 s max AU TOTAL (pas par modèle)
            const repairLeft = 4000 - (Date.now() - geminiStartedAt);
            if (repairLeft < 800) break;
            try {
              const repairModel = genAI.getGenerativeModel({
                model: repairModelName,
                systemInstruction: repairSystemInstruction
              });
              const repairTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Repair Timeout')), repairLeft)
              );
              const repairResult = await Promise.race([
                repairModel.generateContent(message),
                repairTimeout
              ]);
              const raw = (repairResult.response.text() || '').trim();
              // Nettoie les balises de code éventuelles autour du JSON
              const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
              let parsedOk = false;
              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed && typeof parsed.text === 'string' && parsed.text.trim()) {
                  repaired = { lang: parsed.lang === 'wo' ? 'wo' : 'fr', text: parsed.text.trim() };
                  parsedOk = true;
                }
              } catch (e) { /* réponse non-JSON */ }
              if (!parsedOk && raw && WOLOF_REPAIRED_HINT.test(raw)) {
                // Réponse en texte libre contenant du Wolof : on la garde
                repaired = { lang: 'wo', text: raw };
              }
              if (repaired) break;
            } catch (e) { /* essai du modèle suivant */ }
          }
          if (repaired) {
            speaksWolof = repaired.lang === 'wo' || WOLOF_REPAIRED_HINT.test(repaired.text);
            userMessageToProcess = repaired.text;
            console.log(`[STT Repair] (${repaired.lang}) "${message}" -> "${repaired.text}"`);
          } else if (WOLOF_STT_HINT.test(message)) {
            // Réparation indisponible : on se rabat sur les marqueurs statiques
            speaksWolof = true;
          }
        } catch (repairErr) {
          console.warn("Erreur réparation STT:", repairErr.message);
          if (WOLOF_STT_HINT.test(message)) speaksWolof = true;
        }
      } else if (lang === 'wo') {
        // Saisie clavier en mode Wolof : pas de réparation nécessaire
        speaksWolof = true;
      }"""

replacement = """      if (isVoiceInput) {
        try {
          console.log("[STT Repair] Analyse et décodage de la voix via Groq AI 120B...");
          const repairSystemInstruction = `Tu es un expert linguiste bilingue Wolof et Français pour le chatbot Zahara de Mutualis Dakar (UNAMUSC Sénégal).
L'utilisateur a parlé au micro. Google Chrome (qui n'a qu'un modèle de reconnaissance français) a transcrit en phonétique française approximative ce qu'il a cru entendre.
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
{"lang": "wo", "text": "phrase wolof correcte (ë, ñ)"} ou {"lang": "fr", "text": "phrase française"}`;

          const repairRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'openai/gpt-oss-120b',
              messages: [
                { role: 'system', content: repairSystemInstruction },
                { role: 'user', content: message }
              ],
              temperature: 0.1,
              response_format: { type: 'json_object' }
            }),
            signal: AbortSignal.timeout(4000)
          });

          if (repairRes.ok) {
            const rData = await repairRes.json();
            const rawContent = rData.choices?.[0]?.message?.content || '{}';
            const parsed = JSON.parse(rawContent);
            if (parsed && parsed.text) {
              userMessageToProcess = parsed.text;
              speaksWolof = parsed.lang === 'wo' || isWolofText(parsed.text);
              console.log(`[STT Repair Réussi] (${parsed.lang}) "${message}" -> "${parsed.text}" (speaksWolof=${speaksWolof})`);
            }
          }
        } catch (repairErr) {
          console.warn("[STT Repair] Erreur Groq, repli phonétique :", repairErr.message);
          if (WOLOF_STT_HINT.test(message) || isWolofText(message)) speaksWolof = true;
        }
      } else if (lang === 'wo' || isWolofText(message)) {
        speaksWolof = true;
      }"""

if target in content:
    content = content.replace(target, replacement, 1)
    with open(r'C:\Users\hp\Downloads\MUTUALIS DAKAR\backend\server.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: server.js patched with Groq STT Repair!")
else:
    print("ERROR: Target block not found in server.js")
