const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, '..', 'server.js');
let content = fs.readFileSync(serverFile, 'utf8');

// 1. Définition stricte de CSU dans le prompt Wolof et Français
const csuRule = `
DÉFINITION STRICTE DE CSU :
CSU signifie OBLIGATOIREMENT "Couverture Santé Universelle" (Paju Tiers-Payant bu UNAMUSC, mutuelle de santé).
INTERDICTION FORMELLE et ABSOLUE de dire "Chez Soi", "Domicile" ou "numbu mbooleel" !
Quand l'usager parle de CSU ("wakh ma ci CSU", "lan mooy CSU") :
Explique clairement que CSU = Couverture Santé Universelle de l'UNAMUSC :
- 4 500 FCFA par an pour adhérer
- 80% à 100% pris en charge dans les hôpitaux publics (Fann, Le Dantec, Principal...)
- 50% pris en charge en pharmacie sur ordonnance
- 100% gratuit pour la maternité et accouchement
`;

// Remplacer dans le prompt Groq
const oldWolofPrompt = `Tarifs : 4 500 FCFA ci at mi formule individuelle, 1 000 FCFA + 3 500 FCFA familiale, maternité 100% gratuit, hopital 80% ba 100%, pharmacie 50% sur bon.\``;
const newWolofPrompt = `Tarifs : 4 500 FCFA ci at mi formule individuelle, 1 000 FCFA + 3 500 FCFA familiale, maternité 100% gratuit, hopital 80% ba 100%, pharmacie 50% sur bon.
${csuRule}\``;

if (content.includes(oldWolofPrompt)) {
  content = content.replace(oldWolofPrompt, newWolofPrompt);
  console.log('[1/3] Définition stricte CSU ajoutée au prompt Wolof');
}

// 2. Mettre à jour la règle de détection locale Wolof dans le NLP pour CSU
const oldCsuLocal = "if (msg.includes('maternité') || msg.includes('jur')";
const newCsuLocal = `if (msg.includes('csu') || msg.includes('couverture santé')) {
        reply = "CSU mooy Couverture Santé Universelle bu UNAMUSC ci Ndakaaru ! Dafa lay may Tiers-Payant ngir faju ci lu yomb : 4 500 FCFA ci at mi, 80% ba 100% ci hôpitaux yi (Fann, Principal, Le Dantec), 50% ci garab yi pharmacie, ak 100% gratuité maternité. Ndax bëgg nga ma leeral la yeneen ? 😊";
      } else if (msg.includes('maternité') || msg.includes('jur')`;

if (content.includes(oldCsuLocal)) {
  content = content.replace(oldCsuLocal, newCsuLocal);
  console.log('[2/3] Règle directe CSU Wolof ajoutée au moteur local');
}

// 3. Synthèse TTS complète dynamique (sans troncature, sans voix métallique)
// On utilise convertWolofToFrenchPhonetics + Microsoft Neural Denise pour TOUT le texte
const oldTtsHandling = `        // ── GARANTIE 100% WOLOF AUTHENTIQUE : REPLI BIBLIOTHÈQUE NATIVE ──
        // On ne fait JAMAIS lire du Wolof par un moteur français (Piper ou SAPI5)
        // car le résultat sonne robotique et incompréhensible.
        const nativeWolofMap = [
          { pattern: /(cotisation|prix|xaalis|fay|4500|25000|at)/i, file: '431cad827c48fbdedc28136fadbff2d2.wav' },
          { pattern: /(wax.*wolof|peux-tu|comprends|langue|sa loxo)/i, file: '0af10941a74bd19720822a3608e7d3d5.wav' },
          { pattern: /(ngoon|nanga|jamm|jàmm|naka|salaam|nuyu|zahara)/i, file: '467a5c9dce8c3d92dd3f13de4bb4dc2f.wav' },
          { pattern: /(hopital|consultation|80%|50%|garab|pharmacie|faju)/i, file: '7fc3e6aae68cbec38772fa085b47974e.wav' },
          { pattern: /(urgence|1515|samu|18|pompiers)/i, file: '056d7f7e458b8a85c045761da399e301.wav' },
          { pattern: /(merci|jerejef|jërejëf|coobare|amul solo)/i, file: '4703e7d8a1627ddb3e3c645718a7dda0.wav' }
        ];

        let matchedFile = '9fddb9d8528524ca16e9106178034e1f.wav';
        for (const item of nativeWolofMap) {
          if (item.pattern.test(cleanText)) {
            matchedFile = item.file;
            break;
          }
        }

        const fallbackAudioPath = path.join(ttsCacheDir, matchedFile);
        if (fs.existsSync(fallbackAudioPath)) {
          console.log(\`[Wolof Native Library] Audio humain authentique (\${matchedFile}) servi pour: "\${cleanText.substring(0, 35)}..."\`);
          res.setHeader('Content-Type', 'audio/wav');
          res.setHeader('X-TTS-Cache', 'NATIVE_WOLOF_LIBRARY');
          return res.sendFile(fallbackAudioPath);
        }`;

const newTtsHandling = `        // ── SYNTHÈSE WOLOF DYNAMIQUE INTÉGRALE HAUTE QUALITÉ (ZÉRO TRONCATURE, ZÉRO MÉTALLIQUE) ──
        // On convertit le texte Wolof complet en phonétique adaptée, puis synthèse Microsoft Neural HD
        try {
          const { convertWolofToFrenchPhonetics } = require('../src/utils/phonetics.js');
          let phoneticText = cleanText
            .replace(/\\bCSU\\b/gi, 'cé ess ou')
            .replace(/\\bUNAMUSC\\b/gi, 'ounamousk')
            .replace(/\\bFCFA\\b/gi, 'francs cfa');
          phoneticText = convertWolofToFrenchPhonetics(phoneticText);

          const wolofMp3File = path.join(ttsCacheDir, 'dyn_wo_' + hashKey + '.mp3');
          if (fs.existsSync(wolofMp3File) && fs.statSync(wolofMp3File).size > 1000) {
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('X-TTS-Cache', 'HIT_WOLOF_DYNAMIC');
            return res.sendFile(wolofMp3File);
          }

          console.log(\`[Dynamic Wolof Neural TTS] Synthèse intégrale (\${cleanText.length} car.) : "\${cleanText.substring(0, 45)}..."\`);
          const { execFile } = require('child_process');
          await new Promise((resolve, reject) => {
            execFile('C:/Python313/python.exe', ['-m', 'edge_tts', '--voice', 'fr-FR-DeniseNeural', '--text', phoneticText, '--write-media', wolofMp3File], { timeout: 15000 }, (err) => {
              if (err) return reject(err);
              resolve();
            });
          });

          if (fs.existsSync(wolofMp3File) && fs.statSync(wolofMp3File).size > 1000) {
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('X-TTS-Cache', 'WOLOF_DYNAMIC_FULL');
            return res.sendFile(wolofMp3File);
          }
        } catch (dynErr) {
          console.warn('[Dynamic Wolof Neural TTS] Repli :', dynErr.message);
        }`;

if (content.includes(oldTtsHandling)) {
  content = content.replace(oldTtsHandling, newTtsHandling);
  console.log('[3/3] Moteur de synthèse dynamique intégrale Wolof installé');
} else if (content.includes(oldTtsHandling.replace(/\n/g, '\r\n'))) {
  content = content.replace(oldTtsHandling.replace(/\n/g, '\r\n'), newTtsHandling.replace(/\n/g, '\r\n'));
  console.log('[3/3] Moteur de synthèse dynamique intégrale Wolof installé (CRLF)');
} else {
  console.warn('[3/3] Target TTS handling non trouvé');
}

fs.writeFileSync(serverFile, content, 'utf8');
console.log('Mise à jour terminée !');
