const fs = require('fs');
const path = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/backend/server.js';
let s = fs.readFileSync(path, 'utf8');

// Also make sure 'speaksWolof' is defined outside if(apiKey) block
s = s.replace(
  'const { message, lang, history, isVoiceInput } = req.body;\n\n    const apiKey = process.env.GEMINI_API_KEY;',
  'const { message, lang, history, isVoiceInput } = req.body;\n    let speaksWolof = (lang === "wo");\n    let userMessageToProcess = message;\n    const apiKey = process.env.GEMINI_API_KEY;'
);

const groqIntegration = `      }
      console.warn('Gemini indisponible ou quota dépassé. Tentative de génération via Groq AI (Qwen 3.8 27B)...');
    }

    // ── NIVEAU 2 : MOTEUR GROQ AI HAUTE PERFORMANCE (Qwen 3.8 27B / Wolof & Français) ──
    if (process.env.GROQ_API_KEY) {
      try {
        const groqPrompt = (lang === 'wo' || speaksWolof)
          ? "Tu es Zahara, l'assistante virtuelle officielle de MUTUALIS DAKAR (UNAMUSC Sénégal). Tu es une femme sénégalaise chaleureuse, bienveillante et professionnelle. Tu réponds exclusivement en WOLOF naturel, fluide et concis (2 à 4 phrases). Formule individuelle 4 500 FCFA/an, familiale 1 000 FCFA + 3 500 FCFA/membre, maternité 100% gratuit, hôpitaux 80% à 100% sur garantie, pharmacie 50% sur bon, paiement Wave et Orange Money."
          : "Tu es Zahara, l'assistante virtuelle officielle de MUTUALIS DAKAR (UNAMUSC Sénégal). Tu es une femme sénégalaise chaleureuse, bienveillante, accueillante et très professionnelle (Teranga sénégalaise). Tu réponds en FRANÇAIS clair, naturel, concis et rassurant (2 à 4 phrases). Formule individuelle 4 500 FCFA/an, familiale 1 000 FCFA + 3 500 FCFA/membre, gratuité maternité 100%, hôpitaux 80% à 100% sur lettre de garantie, pharmacie 50% sur bon de commande, paiements Wave et Orange Money.";

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'qwen/qwen3.8-27b',
            messages: [
              { role: 'system', content: groqPrompt },
              ...((history || []).slice(-6).map(h => ({
                role: h.sender === 'user' ? 'user' : 'assistant',
                content: h.text || ''
              }))),
              { role: 'user', content: userMessageToProcess || message }
            ],
            temperature: 0.6,
            max_tokens: 300
          }),
          signal: AbortSignal.timeout(6000)
        });

        if (groqRes.ok) {
          const gData = await groqRes.json();
          const gText = gData.choices?.[0]?.message?.content?.trim();
          if (gText) {
            console.log('[Chatbot Zahara] Réponse Groq (Qwen 3.8 27B) générée avec succès.');
            return res.json({
              response: gText,
              decodedText: (userMessageToProcess && userMessageToProcess !== message) ? userMessageToProcess : undefined
            });
          }
        }
      } catch (groqErr) {
        console.warn('[Chatbot Zahara] Groq non joignable :', groqErr.message);
      }
    }`;

s = s.replace(
  /\}\s*console\.warn\(\x27Utilisation instantanée du moteur de connaissances expert local\.\x27\);\s*\}/,
  groqIntegration
);

fs.writeFileSync(path, s, 'utf8');
console.log('Successfully updated server.js with Groq AI integration');
