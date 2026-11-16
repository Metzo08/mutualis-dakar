const fs = require('fs');
const p = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/src/components/ChatbotWidget.jsx';
let lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);

// Find index of isAskingTime
const idx = lines.findIndex(l => l.includes('const isAskingTime ='));
if (idx !== -1) {
  // Replace the 14 lines from idx with correct template strings
  const correctBlock = [
    '    const isAskingTime = /(quelle heure|il est quelle heure|l\'heure|tu as l\'heure|as-tu l\'heure|donne-moi l\'heure|connais-tu l\'heure|waxtu bi|waxtu|ñata waxtu|gnata waxtu|ban waxtu)/i.test(text);',
    '    const isAskingDate = /(quel jour|quelle date|on est quel jour|la date d\'aujourd\'hui|nous sommes quel jour|bis bi|ban bis)/i.test(text);',
    '    if (isAskingTime || isAskingDate) {',
    '      const now = new Date();',
    '      const timeStr = now.toLocaleTimeString(\'fr-FR\', { timeZone: \'Africa/Dakar\', hour: \'2-digit\', minute: \'2-digit\' }).replace(\':\', \'h\');',
    '      const dateStr = now.toLocaleDateString(\'fr-FR\', { timeZone: \'Africa/Dakar\', weekday: \'long\', day: \'numeric\', month: \'long\', year: \'numeric\' });',
    '      if (isWolof) {',
    '        if (isAskingTime) return "Léegi " + timeStr + " jot na ci Ndakaaru. Lan laa la mënee dimbali ci sa mutuelle ak sa wér-gi-yaram tey ? 😊";',
    '        return "Tey jii " + dateStr + " la ci Ndakaaru. Naka la la mënee jàppale ci sa mutuelle ? 😊";',
    '      } else {',
    '        if (isAskingTime) return "Il est actuellement " + timeStr + " à Dakar. Comment puis-je vous accompagner concernant vos démarches de santé aujourd\'hui ? 😊";',
    '        return "Nous sommes le " + dateStr + " à Dakar. Que souhaitez-vous savoir concernant vos droits CSU ou prestations ? 😊";',
    '      }',
    '    }'
  ];
  lines.splice(idx, 14, ...correctBlock);
  fs.writeFileSync(p, lines.join('\n'), 'utf8');
  console.log('Successfully repaired ChatbotWidget.jsx syntax!');
} else {
  console.error('isAskingTime not found');
}
