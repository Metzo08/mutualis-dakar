const fs = require('fs');
const p = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/backend/server.js';
let lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);

const idx = lines.findIndex(l => l.includes("let userMessageToProcess = message;"));
if (idx !== -1) {
  const insertCode = [
    '    const temporal = getDakarTemporalContext(lang);',
    '    const lowMsg = String(message || "").toLowerCase().trim();',
    '    const isAskingTime = /(quelle heure|il est quelle heure|\\bl[\' ]heure\\b|tu as l\'heure|as-tu l\'heure|donne-moi l\'heure|connais-tu l\'heure|donne l\'heure|waxtu bi|waxtu|ñata waxtu|gnata waxtu|ban waxtu)/i.test(lowMsg);',
    '    const isAskingDate = /(quel jour|quelle date|on est quel jour|la date d\'aujourd\'hui|nous sommes quel jour|bis bi|ban bis)/i.test(lowMsg);',
    '',
    '    if (isAskingTime) {',
    '      const timeReply = (lang === "wo" || speaksWolof)',
    '        ? `Léegi ${temporal.dakarTimeStr} jot na ci Ndakaaru (${temporal.momentWo}). ${temporal.salutationWo} Lan laa la mënee dimbali ci wallu mutuelle ak wér-gi-yaram tey ? 😊`',
    '        : `Il est actuellement ${temporal.dakarTimeStr} à Dakar (${temporal.momentFr}). ${temporal.salutationFr} Comment puis-je vous accompagner concernant vos démarches de santé ou votre couverture CSU aujourd\\\'hui ? 😊`;',
    '      console.log("[Chatbot Time Intercept] Réponse heure exacte:", temporal.dakarTimeStr);',
    '      return res.json({ response: timeReply, decodedText: (userMessageToProcess !== message) ? userMessageToProcess : undefined });',
    '    }',
    '',
    '    if (isAskingDate) {',
    '      const dateReply = (lang === "wo" || speaksWolof)',
    '        ? `Tey jii ${temporal.dakarDateStr} la ci Ndakaaru (${temporal.saisonWo}). ${temporal.salutationWo} Naka la la mënee jàppale ci sa mutuelle ? 😊`',
    '        : `Nous sommes le ${temporal.dakarDateStr} à Dakar (${temporal.saisonFr}). ${temporal.salutationFr} Que souhaitez-vous savoir concernant vos droits de santé ? 😊`;',
    '      console.log("[Chatbot Date Intercept] Réponse date exacte:", temporal.dakarDateStr);',
    '      return res.json({ response: dateReply, decodedText: (userMessageToProcess !== message) ? userMessageToProcess : undefined });',
    '    }'
  ];
  lines.splice(idx + 1, 0, ...insertCode);
  fs.writeFileSync(p, lines.join('\n'), 'utf8');
  console.log('Inserted time interceptor at line', idx + 1);
} else {
  console.error('userMessageToProcess line not found');
}
