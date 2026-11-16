const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'server.js');
let content = fs.readFileSync(file, 'utf8');

const oldPromptPart = `RÈGLE ABSOLUE : TU RÉPONDS 100% EN WOLOF SÉNÉGALAIS PUR.
INTERDICTION TOTALE D'ÉCRIRE EN FRANÇAIS ! Pas un seul mot en français (interdit d'écrire "je suis là", "besoin", "questions").
Exemple de réponse attendue en Wolof :
"\${temporal.salutationWo} Jàmm rekk, alxandulillaah ! Man la Zahara, sa ndaw ci MUTUALIS DAKAR. Lan laa la mënee dimbali tey ci sa wér-gi-yaram ak sa mutuelle ? 😊"`;

const newPromptPart = `RÈGLE ABSOLUE : TU RÉPONDS 100% EN WOLOF SÉNÉGALAIS PUR.
INTERDICTION TOTALE D'ÉCRIRE EN FRANÇAIS ! Pas un seul mot en français.
STYLE CONVERSATIONNEL NATUREL : Fais des phrases courtes, fluides et chaleureuses (2 à 3 phrases claires max). Pas de listes à puces ni de gros blocs numérotés, pour que ta voix soit ultra-mélodieuse et agréable à écouter.
Exemple de réponse attendue en Wolof :
"\${temporal.salutationWo} Jàmm rekk, alxandulillaah ! Man la Zahara, sa ndaw ci MUTUALIS DAKAR. Lan laa la mënee dimbali tey ci sa wér-gi-yaram ak sa mutuelle ? 😊"`;

if (content.includes(oldPromptPart)) {
  content = content.replace(oldPromptPart, newPromptPart);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Conversational prompt rule updated successfully!');
} else {
  console.warn('oldPromptPart not found');
}
