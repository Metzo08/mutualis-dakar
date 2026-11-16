const fs = require('fs');
const p = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/src/components/ChatbotWidget.jsx';
let lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);

const idx = lines.findIndex(l => l.includes('handleSendRef.current = handleSend;'));
if (idx !== -1) {
  // Check next lines
  const targetIdx = lines.findIndex((l, i) => i > idx && l.includes('const isAskingTime ='));
  if (targetIdx !== -1) {
    lines.splice(idx + 1, targetIdx - idx - 1,
      '',
      '  const generateLocalResponse = (userText, detectedLang) => {',
      '    const text = userText.toLowerCase().trim();',
      '    const isWolof = isWolofText(text) || detectedLang === \'wo\';',
      ''
    );
    fs.writeFileSync(p, lines.join('\n'), 'utf8');
    console.log('Restored generateLocalResponse function header successfully!');
  }
}
