const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'server.js');
let content = fs.readFileSync(file, 'utf8');

const startMarker = '// ── GARANTIE 100% WOLOF AUTHENTIQUE : REPLI BIBLIOTHÈQUE NATIVE ──';
const endMarker = 'return res.sendFile(fallbackAudioPath);\n        }';
const endMarkerCRLF = 'return res.sendFile(fallbackAudioPath);\r\n        }';

const newBlock = `// ── SYNTHÈSE WOLOF DYNAMIQUE INTÉGRALE HAUTE QUALITÉ (ZÉRO TRONCATURE, ZÉRO MÉTALLIQUE) ──
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

const sIdx = content.indexOf(startMarker);
if (sIdx !== -1) {
  let eIdx = content.indexOf(endMarkerCRLF, sIdx);
  let len = endMarkerCRLF.length;
  if (eIdx === -1) {
    eIdx = content.indexOf(endMarker, sIdx);
    len = endMarker.length;
  }
  if (eIdx !== -1) {
    content = content.substring(0, sIdx) + newBlock + content.substring(eIdx + len);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Successfully replaced static truncated library with dynamic full synthesis!');
  } else {
    console.error('End marker not found');
  }
} else {
  console.error('Start marker not found');
}
