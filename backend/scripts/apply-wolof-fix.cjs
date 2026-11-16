const fs = require('fs');

// 1. Update backend/server.js
const serverPath = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/backend/server.js';
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Insert Wolof intent interceptor after date check
const dateCheckTarget = `      console.log("[Chatbot Date Intercept] Réponse date exacte:", temporal.dakarDateStr);
      return res.json({ response: dateReply, decodedText: (userMessageToProcess !== message) ? userMessageToProcess : undefined });
    }`;

const wolofInterceptor = `      console.log("[Chatbot Date Intercept] Réponse date exacte:", temporal.dakarDateStr);
      return res.json({ response: dateReply, decodedText: (userMessageToProcess !== message) ? userMessageToProcess : undefined });
    }

    // ── DETECTION WOLOF RENFORCEE & BILINGUISME SOUVERAIN ──
    const wolofIntentRegex = /(parl\\w*\\s+(?:en\\s+)?wolof|wax(?:al)?\\s+(?:ma\\s+)?(?:ci\\s+)?wolof|r[eé]pond\\w*\\s+(?:en\\s+)?wolof|en\\s+wolof|en\\s+ouolof|wolof\\s+rekk|wolof\\s+laay\\s+wax|dama\\s+bëgg\\s+wax\\s+wolof|wax\\s+wolof|wolofal|tontul\\s+ci\\s+wolof)/i;
    const isExplicitWolofSwitch = wolofIntentRegex.test(lowMsg);
    if (isExplicitWolofSwitch) {
      speaksWolof = true;
      const wolofSwitchReply = "Waaw, ci sa loxo laa nekk ! Mën nañu wax ci Wolof ci lu wóor te leer. Man la Zahara, assistante officielle bu MUTUALIS DAKAR. Naka la la mënee dimbali tey ci wallu mutuelle ak sa wér-gi-yaram ? 😊";
      console.log("[Chatbot Wolof Direct Switch] Réponse Wolof direct envoyée");
      return res.json({ response: wolofSwitchReply, decodedText: (userMessageToProcess !== message) ? userMessageToProcess : undefined });
    }

    const hasWolofKeywords = /(nanga|naka|jërejëf|jerejef|dieuredieuf|salaam|salam|garab|fajukaay|faju|ndax|waaw|déedéet|deedet|ñaata|gnata|niata|xaalis|haliss|khaliss|dimbali|dimbalante|fajj|jamm|rekk|mungi|mangui|mangi|wér-gi-yaram|wer gu yaram|fayal|dama|damay|bëgg|begg|am na|ci biir|kër|keur|yaye|sama|sañu|ndox|sooj|seket|sëqët|waxtu|lan la|fan la|kuy|lu tax|ñuñu|yépp|yeup|lepp)/i.test(lowMsg);
    if (hasWolofKeywords) {
      speaksWolof = true;
    }`;

if (serverContent.includes(dateCheckTarget)) {
  serverContent = serverContent.replace(dateCheckTarget, wolofInterceptor);
}

// Update Groq French prompt to enforce Wolof switching
const oldGroqFr = `Tu réponds en FRANÇAIS clair, naturel, chaleureux et très humain (2 à 4 phrases). Adapte ta salutation selon l'heure (matin, après-midi, soirée, ou nuit avec rappel des urgences 24/7).
Tarifs : 4 500 FCFA/an individuelle, familiale 1 000 FCFA + 3 500 FCFA/membre, gratuité maternité 100%, hôpitaux 80% à 100% sur lettre de garantie (urgences Fann, Principal, Le Dantec 24/7), pharmacie 50% sur bon, paiements Wave et Orange Money.`;

const newGroqFr = `RÈGLE ABSOLUE DE BILINGUISME SÉNÉGALAIS (WOLOF / FRANÇAIS) :
Tu es Zahara, une femme sénégalaise fière de sa culture (Teranga) et parfaitement bilingue Français et Wolof.
- Si l'usager te parle en Wolof ou demande de parler Wolof ("parle en wolof", "waxal wolof", "nanga def", etc.) : BASCULE IMMÉDIATEMENT ET RÉPONDS INTÉGRALEMENT EN WOLOF naturel.
- INTERDICTION FORMELLE de dire : "Je parle principalement en français" ou "Je ne parle pas wolof" ! Le Wolof est ta langue maternelle.
Tu réponds en FRANÇAIS clair, naturel, chaleureux et très humain (2 à 4 phrases). Adapte ta salutation selon l'heure (matin, après-midi, soirée, ou nuit avec rappel des urgences 24/7).
Tarifs : 4 500 FCFA/an individuelle, familiale 1 000 FCFA + 3 500 FCFA/membre, gratuité maternité 100%, hôpitaux 80% à 100% sur lettre de garantie (urgences Fann, Principal, Le Dantec 24/7), pharmacie 50% sur bon, paiements Wave et Orange Money.`;

if (serverContent.includes(oldGroqFr)) {
  serverContent = serverContent.replace(oldGroqFr, newGroqFr);
}

fs.writeFileSync(serverPath, serverContent, 'utf8');
console.log('Backend server.js updated with Wolof sovereignty rules!');

// 2. Update src/components/ChatbotWidget.jsx
const widgetPath = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/src/components/ChatbotWidget.jsx';
let widgetContent = fs.readFileSync(widgetPath, 'utf8');

const oldDetection = `    const cleanMsg = processedText.toLowerCase().trim();
    if (cleanMsg.includes('en wolof') || cleanMsg.includes('waxal ci wolof') || cleanMsg.includes('parle wolof') || cleanMsg.includes('wax wolof')) {
      messageLang = 'wo';
    } else if (isVoiceInput && detectedIsWolof) {
      // On a parlé Wolof au micro → Zahara répond en Wolof, même si l'UI était en FR
      messageLang = 'wo';
    } else if (chatLang === 'wo' && !detectedIsWolof && !isVoiceInput) {
      messageLang = 'fr';
    } else if (chatLang === 'fr' && detectedIsWolof) {
      messageLang = 'wo';
    }`;

const newDetection = `    const cleanMsg = processedText.toLowerCase().trim();
    const wantsWolof = /(parl\\w*\\s+(?:en\\s+)?wolof|wax(?:al)?\\s+(?:ma\\s+)?(?:ci\\s+)?wolof|r[eé]pond\\w*\\s+(?:en\\s+)?wolof|en\\s+wolof|en\\s+ouolof|wolof\\s+rekk|wolof\\s+laay\\s+wax|dama\\s+bëgg\\s+wax\\s+wolof|wax\\s+wolof|wolofal|tontul\\s+ci\\s+wolof)/i.test(cleanMsg);
    if (wantsWolof || detectedIsWolof || (isVoiceInput && detectedIsWolof)) {
      messageLang = 'wo';
    } else if (chatLang === 'wo' && !detectedIsWolof && !isVoiceInput) {
      messageLang = 'fr';
    }`;

if (widgetContent.includes(oldDetection)) {
  widgetContent = widgetContent.replace(oldDetection, newDetection);
  fs.writeFileSync(widgetPath, widgetContent, 'utf8');
  console.log('ChatbotWidget updated with upgraded Wolof detection!');
} else {
  console.log('ChatbotWidget target for detection not found, checking lines...');
}
