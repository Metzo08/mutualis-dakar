const fs = require('fs');
const p = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/backend/server.js';
let content = fs.readFileSync(p, 'utf8');

// Replace local greetings with dynamic temporal ones
const oldLocalGreetings = `      } else if (msg.includes('salaam') || msg.includes('naka') || msg.includes('bonjour') || msg.includes('salamaalekum') || msg.includes('nanga def')) {
        reply = pickVariant([
          "Salamaalekum ! Nanga def ! Man la Zahara, assistante virtuelle bu MUTUALIS DAKAR (UNAMUSC). Naka la la mënee dimbali tey ci wallu wér-gi-yaram ak mutuelle ? 😊",
          "Asalaa maalekum ! Dalal ak jàmm ! Zahara laa, ci sa service. Lan laay mënë defal tey : mutuelle, garab, walla fajukaay ? 😊",
          "Jàmm rekk ! Bésub jàmm bu neex ! Man Zahara, dimbalante bu UNAMUSC. Naka nga defee ? Lan nga bëggàm ci sa santé tey ? 😊"
        ]);`;

const newLocalGreetings = `      } else if (msg.includes('salaam') || msg.includes('naka') || msg.includes('bonjour') || msg.includes('salamaalekum') || msg.includes('nanga def')) {
        reply = pickVariant([
          \`\${temporal.salutationWo} Man la Zahara, assistante virtuelle bu MUTUALIS DAKAR. Naka la la mënee dimbali tey ci wér-gi-yaram ? 😊\`,
          \`Asalaa maalekum ! \${temporal.salutationWo} Zahara laa ci sa service. Lan laay mënë defal tey : mutuelle, garab walla fajukaay ? 😊\`,
          \`Jàmm rekk ! \${temporal.salutationWo} Man Zahara, dimbalante bu UNAMUSC. Lan nga bëgg xam tey ci sa santé ? 😊\`
        ]);`;

const oldFrGreetings = `      } else if (msg.includes('bonjour') || msg.includes('salut') || msg.includes('qui es-tu') || msg.includes('présente')) {
        reply = pickVariant([
          "Bonjour ! Je suis Zahara, l'assistante virtuelle officielle de MUTUALIS DAKAR (UNAMUSC Sénégal). Comment puis-je vous aider aujourd'hui concernant vos droits CSU et prestations de santé ? 😊",
          "Bonjour et bienvenue ! Zahara à votre écoute pour tout ce qui touche à votre couverture santé UNAMUSC : adhésion, remboursements, téléconsultation... Que souhaitez-vous savoir ? 😊",
          "Salut ! Ravi de vous entendre. Je peux vous guider sur les tarifs, la maternité gratuite, les lettres de garantie ou la télémédecine — dites-moi tout ! 😊"
        ]);`;

const newFrGreetings = `      } else if (msg.includes('bonjour') || msg.includes('bonsoir') || msg.includes('salut') || msg.includes('qui es-tu') || msg.includes('présente')) {
        reply = pickVariant([
          \`\${temporal.salutationFr} Je suis Zahara, l'assistante officielle de MUTUALIS DAKAR (UNAMUSC). Comment puis-je vous aider concernant vos droits CSU aujourd'hui ? 😊\`,
          \`\${temporal.salutationFr} Zahara à votre écoute pour votre couverture santé : adhésion (4 500 F), maternité 100%, pharmacie 50% ou hospitalisation 80-100%. Que souhaitez-vous savoir ? 😊\`,
          \`Ravi de vous entendre ! \${temporal.salutationFr} Je peux vous guider pas à pas selon vos besoins — dites-moi tout ! 😊\`
        ]);`;

content = content.replace(oldLocalGreetings, newLocalGreetings);
content = content.replace(oldFrGreetings, newFrGreetings);

// Replace "Avec grand plaisir ! Précisez-moi votre besoin..."
content = content.replace(
  `"Avec grand plaisir ! Précisez-moi votre besoin — adhésion, tarifs (4 500 FCFA), gratuité maternité 100%, prise en charge hospitalière (80-100%) ou pharmacie (50%) — et je vous guide pas à pas. 😊"`,
  `"Je suis là pour vous accompagner ! Dites-moi si votre question porte sur l'adhésion, vos remboursements en pharmacie (50%), ou une prise en charge hospitalière (80-100%), et je vous guide pas à pas. 😊"`
);

fs.writeFileSync(p, content, 'utf8');
console.log('Local NLP temporal greetings updated!');
