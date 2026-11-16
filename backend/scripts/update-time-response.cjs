const fs = require('fs');
const p = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/backend/server.js';
let content = fs.readFileSync(p, 'utf8');

// 1. Update getDakarTemporalContext to include dakarTimeStr
const oldHelper = `function getDakarTemporalContext(lang = 'fr') {
  const now = new Date();
  const options = { timeZone: 'Africa/Dakar', hour12: false, hour: '2-digit', minute: '2-digit', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const dakarDateStr = new Intl.DateTimeFormat('fr-FR', options).format(now);
  const hour = parseInt(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Dakar', hour12: false, hour: '2-digit' }).format(now), 10);
  const month = now.getUTCMonth() + 1;
  const dayOfWeek = now.getUTCDay(); // 0: Dimanche, 5: Vendredi`;

const newHelper = `function getDakarTemporalContext(lang = 'fr') {
  const now = new Date();
  const options = { timeZone: 'Africa/Dakar', hour12: false, hour: '2-digit', minute: '2-digit', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const dakarDateStr = new Intl.DateTimeFormat('fr-FR', options).format(now);
  const timeFormatter = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Dakar', hour12: false, hour: '2-digit', minute: '2-digit' });
  const dakarTimeStr = timeFormatter.format(now).replace(':', 'h');
  const hour = parseInt(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Dakar', hour12: false, hour: '2-digit' }).format(now), 10);
  const month = now.getUTCMonth() + 1;
  const dayOfWeek = now.getUTCDay(); // 0: Dimanche, 5: Vendredi`;

if (content.includes(oldHelper)) {
  content = content.replace(oldHelper, newHelper);
}
content = content.replace('return { dakarDateStr, hour,', 'return { dakarDateStr, dakarTimeStr, hour,');

// 2. Add time & date intent interceptor right after parsing body in app.post('/api/chatbot'
const targetBody = `    const { message, lang, history, isVoiceInput } = req.body;
    let speaksWolof = (lang === 'wo');
    let userMessageToProcess = message;`;

const newBody = `    const { message, lang, history, isVoiceInput } = req.body;
    let speaksWolof = (lang === 'wo');
    let userMessageToProcess = message;
    const temporal = getDakarTemporalContext(lang);

    // ── GESTION IMMEDIATE ET PRECISION TEMPORELLE ABSOLUE ──
    const lowMsg = String(message || '').toLowerCase().trim();
    const isAskingTime = /(quelle heure|il est quelle heure|l'heure|tu as l'heure|as-tu l'heure|donne-moi l'heure|connais-tu l'heure|waxtu bi|waxtu|ñata waxtu|gnata waxtu|ban waxtu)/i.test(lowMsg);
    const isAskingDate = /(quel jour|quelle date|on est quel jour|la date d'aujourd'hui|nous sommes quel jour|bis bi|ban bis)/i.test(lowMsg);

    if (isAskingTime) {
      const timeReply = (lang === 'wo' || speaksWolof)
        ? \`Léegi \${temporal.dakarTimeStr} jot na ci Ndakaaru (\${temporal.momentWo}). \${temporal.salutationWo} Lan laa la mënee dimbali ci wallu mutuelle ak wér-gi-yaram tey ? 😊\`
        : \`Il est exactement \${temporal.dakarTimeStr} à Dakar (\${temporal.momentFr}). \${temporal.salutationFr} Comment puis-je vous accompagner concernant vos démarches MUTUALIS ou vos remboursements aujourd'hui ? 😊\`;
      return res.json({ response: timeReply, decodedText: (userMessageToProcess !== message) ? userMessageToProcess : undefined });
    }

    if (isAskingDate) {
      const dateReply = (lang === 'wo' || speaksWolof)
        ? \`Tey jii \${temporal.dakarDateStr} la ci Ndakaaru (\${temporal.saisonWo}). \${temporal.salutationWo} Naka la la mënee jàppale ci sa mutuelle ? 😊\`
        : \`Nous sommes le \${temporal.dakarDateStr} à Dakar (\${temporal.saisonFr}). \${temporal.salutationFr} Que souhaitez-vous savoir concernant vos droits de santé ? 😊\`;
      return res.json({ response: dateReply, decodedText: (userMessageToProcess !== message) ? userMessageToProcess : undefined });
    }`;

if (content.includes(targetBody)) {
  content = content.replace(targetBody, newBody);
}

// 3. Add FreeLLM support into chatbot level 2 (before Groq or after Groq)
// FreeLLM endpoint is http://127.0.0.1:31415/v1 with key freellmapi-52187f2b498a69976ce9bc92170b1b86312f74f9c3140707

fs.writeFileSync(p, content, 'utf8');
console.log('Server chatbot updated with exact real-time and date awareness!');
