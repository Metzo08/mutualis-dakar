const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'server.js');
let content = fs.readFileSync(file, 'utf8');

const startMarker = 'if (isWolof) {';
const endMarker = 'console.warn(\'[Dynamic Wolof Neural TTS] Repli :\', dynErr.message);\n        }\n      }';
const endMarkerCRLF = 'console.warn(\'[Dynamic Wolof Neural TTS] Repli :\', dynErr.message);\r\n        }\r\n      }';

const newBlock = `if (isWolof) {
        // ── VOIX FÉMININE SÉNÉGALAISE NATIVE DYNAMIQUE (GALSENAI WOLOF POCKET-TTS) ──
        // Modèle 100% Wolof authentique : voix féminine naturelle (Voice 1 galsenai female).
        // ZÉRO effet métallique, ZÉRO robotique, prononciation dakaroise parfaite de chaque mot !
        const wolofNativeWav = path.join(ttsCacheDir, 'wolof_galsen_' + hashKey + '.wav');
        if (fs.existsSync(wolofNativeWav) && fs.statSync(wolofNativeWav).size > 1000) {
          res.setHeader('Content-Type', 'audio/wav');
          res.setHeader('X-TTS-Cache', 'HIT_WOLOF_NATIVE');
          return res.sendFile(wolofNativeWav);
        }

        try {
          console.log(\`[Native Wolof Female TTS] Synthèse intégrale GalsenAI (\${cleanText.length} car.) : "\${cleanText.substring(0, 45)}..."\`);
          const { execFile } = require('child_process');
          await new Promise((resolve, reject) => {
            execFile('C:/Python313/python.exe', [
              path.join(__dirname, 'synthesize_wolof.py'),
              '--text', cleanText,
              '--out', wolofNativeWav
            ], { timeout: 25000 }, (err) => {
              if (err) return reject(err);
              resolve();
            });
          });

          if (fs.existsSync(wolofNativeWav) && fs.statSync(wolofNativeWav).size > 1000) {
            res.setHeader('Content-Type', 'audio/wav');
            res.setHeader('X-TTS-Cache', 'WOLOF_NATIVE_FEMALE');
            return res.sendFile(wolofNativeWav);
          }
        } catch (wolofErr) {
          console.warn('[Native Wolof Female TTS] Erreur :', wolofErr.message);
        }
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
    console.log('Successfully integrated GalsenAI native female Wolof TTS!');
  } else {
    console.error('End marker not found');
  }
} else {
  console.error('Start marker not found');
}
