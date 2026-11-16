const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, '..', 'server.js');
let content = fs.readFileSync(serverFile, 'utf8');

// 1. Améliorer le prompt Wolof pour interdire le français
const targetPrompt = "Tu réponds exclusivement en WOLOF naturel, fluide, poli et humain (2 à 4 phrases). Adapte ta salutation selon l'heure (fajar/suba/bëccëk/ngoon/guddi).\nFormule individuelle 4 500 FCFA/an, familiale 1 000 FCFA + 3 500 FCFA/membre, maternité 100% gratuit, hôpitaux 80% à 100% sur garantie (urgences hospitalières ouvertes 24h/24 même la nuit), pharmacie 50% sur bon, paiement Wave et Orange Money.`";
const replacementPrompt = `RÈGLE ABSOLUE : TU RÉPONDS 100% EN WOLOF SÉNÉGALAIS PUR.
INTERDICTION TOTALE D'ÉCRIRE EN FRANÇAIS ! Pas un seul mot en français (interdit d'écrire "je suis là", "besoin", "questions").
Exemple de réponse attendue en Wolof :
"\${temporal.salutationWo} Jàmm rekk, alxandulillaah ! Man la Zahara, sa ndaw ci MUTUALIS DAKAR. Lan laa la mënee dimbali tey ci sa wér-gi-yaram ak sa mutuelle ? 😊"
Tarifs : 4 500 FCFA ci at mi formule individuelle, 1 000 FCFA + 3 500 FCFA familiale, maternité 100% gratuit, hopital 80% ba 100%, pharmacie 50% sur bon.\``;

if (content.includes(targetPrompt)) {
  content = content.replace(targetPrompt, replacementPrompt);
  console.log('[1/4] Prompt Wolof mis à jour');
} else if (content.includes(targetPrompt.replace(/\n/g, '\r\n'))) {
  content = content.replace(targetPrompt.replace(/\n/g, '\r\n'), replacementPrompt.replace(/\n/g, '\r\n'));
  console.log('[1/4] Prompt Wolof mis à jour (CRLF)');
} else {
  console.warn('[1/4] Target prompt non trouvé');
}

// 2. Nettoyage anti-fuite français si le modèle glisse
const targetGroq = `          if (gText) {
            console.log('[Chatbot Zahara] Réponse Groq (Qwen 3.8 27B) générée avec succès.');`;
const replacementGroq = `          if (gText) {
            let finalOutput = gText;
            if (speaksWolof && /je suis l[àa]|votre besoin|quel est|questions sur|pour vous aider/i.test(finalOutput)) {
              finalOutput = finalOutput
                .replace(/J[eé]ef naa,?\\s*je suis l[àa].*$/i, "Jàmm rekk, man la Zahara ! Mën naa la leeral lépp ci wallu wér-gi-yaram ak sa mutuelle. Lan nga bëgg xam tey ? 😊")
                .replace(/je suis l[àa].*$/i, "ci sa loxo laa nekk ngir dimbali la ci sa mutuelle. Lan nga bëgg xam ? 😊");
            }
            console.log('[Chatbot Zahara] Réponse Groq (Qwen 3.8 27B) générée avec succès.');
            return res.json({
              response: finalOutput,
              decodedText: (userMessageToProcess && userMessageToProcess !== message) ? userMessageToProcess : undefined
            });`;

if (content.includes(targetGroq)) {
  content = content.replace(targetGroq, replacementGroq);
  console.log('[2/4] Filtre anti-fuite Groq installé');
} else if (content.includes(targetGroq.replace(/\n/g, '\r\n'))) {
  content = content.replace(targetGroq.replace(/\n/g, '\r\n'), replacementGroq.replace(/\n/g, '\r\n'));
  console.log('[2/4] Filtre anti-fuite Groq installé (CRLF)');
} else {
  console.warn('[2/4] Target Groq non trouvé');
}

// 3. Détection intelligente du Wolof dans /api/tts pour ne jamais lire en français
const targetTts = `    const langKey = String(language || req.body?.language || req.query?.lang || 'fr').toLowerCase();
    const isWolof = (langKey === 'wo' || langKey === 'wolof');`;
const replacementTts = `    const langKey = String(language || req.body?.language || req.query?.lang || 'fr').toLowerCase();
    const hasWolofGreeting = /(ngoon ak j[aà]mm|suba ak j[aà]mm|b[eë]cc[eë]k ak j[aà]mm|guddi ak j[aà]mm|j[aà]mm rekk|nanga def|naka|j[eë]rej[eë]f|w[eé]r-gi-yaram|dimbali)/i.test(cleanText);
    const isWolof = (langKey === 'wo' || langKey === 'wolof' || hasWolofGreeting);`;

if (content.includes(targetTts)) {
  content = content.replace(targetTts, replacementTts);
  console.log('[3/4] Détection Wolof dans /api/tts mise à jour');
} else if (content.includes(targetTts.replace(/\n/g, '\r\n'))) {
  content = content.replace(targetTts.replace(/\n/g, '\r\n'), replacementTts.replace(/\n/g, '\r\n'));
  console.log('[3/4] Détection Wolof dans /api/tts mise à jour (CRLF)');
} else {
  console.warn('[3/4] Target TTS non trouvé');
}

// 4. Pattern regex dans nativeWolofMap pour inclure ngoon
const targetMap = "{ pattern: /(nanga|jamm|naka|salaam|nuyu|zahara)/i, file: '467a5c9dce8c3d92dd3f13de4bb4dc2f.wav' }";
const replacementMap = "{ pattern: /(ngoon|nanga|jamm|jàmm|naka|salaam|nuyu|zahara)/i, file: '467a5c9dce8c3d92dd3f13de4bb4dc2f.wav' }";

if (content.includes(targetMap)) {
  content = content.replace(targetMap, replacementMap);
  console.log('[4/4] Pattern regex nativeWolofMap mis à jour avec ngoon');
}

fs.writeFileSync(serverFile, content, 'utf8');
console.log('Patching terminé avec succès !');
