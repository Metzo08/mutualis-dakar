const fs = require('fs');
const p = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/src/services/voiceAudioService.js';
let c = fs.readFileSync(p, 'utf8');

const target = `function speakViaBrowserFallback(text, lang, seqId, onStart, onEnd) {
  if (typeof window !== 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }
  if (seqId !== currentSpeechSeq) return;`;

const replacement = `function speakViaBrowserFallback(text, lang, seqId, onStart, onEnd) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }
  if (seqId !== currentSpeechSeq) return;

  // RÈGLE ABSOLUE : ne JAMAIS faire lire du Wolof par la voix française du navigateur
  if (lang === 'wolof' || lang === 'wo') {
    console.warn('[Voice] Pas de voix Wolof native dans le navigateur Windows/Chrome : pas de lecture robotique déformée.');
    if (onEnd) onEnd();
    return;
  }`;

if (c.includes('if (seqId !== currentSpeechSeq) return;')) {
  c = c.replace(
    'if (seqId !== currentSpeechSeq) return;',
    `if (seqId !== currentSpeechSeq) return;

  // RÈGLE ABSOLUE : ne JAMAIS faire lire du Wolof par la voix française du navigateur
  if (lang === 'wolof' || lang === 'wo') {
    console.warn('[Voice] Pas de voix Wolof native dans le navigateur Windows/Chrome : pas de lecture robotique déformée.');
    if (onEnd) onEnd();
    return;
  }`
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('Successfully protected against French robot voice for Wolof in frontend!');
} else {
  console.error('Target not found in voiceAudioService.js');
}
