const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ttsCacheDir = path.join(__dirname, '..', 'data', 'tts_cache');
if (!fs.existsSync(ttsCacheDir)) {
  fs.mkdirSync(ttsCacheDir, { recursive: true });
}

const hfToken = (process.env.HUGGINGFACE_API_KEY || '');

const phrases = [
  "Nanga def, jàmm nga am ? Zahara laa tudd, assistante virtuelle bu MUTUALIS DAKAR.",
  "Waaw, ci sa loxo laa nekk ! Mën nañu wax ci Wolof ci lu wóor te leer. Lan laa la mënee dimbali tey ci wér-gi-yaram ?",
  "Cotisation bi mooy 4 500 FCFA ci at mu nekk ngir benn nit, ak 25 000 FCFA ngir njaboot gi.",
  "Mutualis dafay fay 80% ci consultation ak hôpital, ak 50% ci garab yi ci pharmacie.",
  "Su fekkee dafa am urgence, numéro 1515 Samu wala 18 sapeurs-pompiers lañuy woo.",
  "Jàmm rekk, man la Zahara ! Mën naa la leeral lépp ci wallu wér-gi-yaram ak sa mutuelle.",
  "Amul solo, ci sa coobare laa nekk ! Su la neexee, laaj ma ci kër doktoor yi ak fajuwaay yi."
];

async function generatePhrase(text) {
  const hashKey = crypto.createHash('md5').update('wo_' + text.trim().toLowerCase()).digest('hex');
  const cacheFile = path.join(ttsCacheDir, hashKey + '.wav');

  if (fs.existsSync(cacheFile) && fs.statSync(cacheFile).size > 1000) {
    console.log(`[Cache déjà présent] "${text.substring(0, 35)}..." (${fs.statSync(cacheFile).size} octets)`);
    return;
  }

  console.log(`[Génération Oolel-Voices] "${text.substring(0, 35)}..."`);
  const t0 = Date.now();
  const call = await fetch('https://soynade-research-oolel-voices-demo.hf.space/gradio_api/call/generate_tts_audio', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + hfToken
    },
    body: JSON.stringify({
      data: [text.substring(0, 450), null, 0.3, 0.2, 0, 0.5]
    })
  });

  if (!call.ok) {
    console.warn(`Erreur HTTP: ${call.status}`);
    return;
  }

  const callData = await call.json();
  if (!callData.event_id) {
    console.warn('Pas de event_id');
    return;
  }

  const stream = await fetch(`https://soynade-research-oolel-voices-demo.hf.space/gradio_api/call/generate_tts_audio/${callData.event_id}`, {
    headers: { 'Authorization': 'Bearer ' + hfToken }
  });
  const streamText = await stream.text();
  const match = streamText.match(/"url":\s*"([^"]+)"/);
  if (match && match[1]) {
    const wav = await fetch(match[1], {
      headers: { 'Authorization': 'Bearer ' + hfToken }
    });
    if (wav.ok) {
      const buf = await wav.arrayBuffer();
      fs.writeFileSync(cacheFile, Buffer.from(buf));
      console.log(`[Succès] "${text.substring(0, 35)}..." mis en cache (${buf.byteLength} octets) en ${Date.now() - t0} ms !`);
    }
  } else {
    console.warn('URL non trouvée dans le flux:', streamText.substring(0, 100));
  }
}

async function main() {
  console.log('Démarrage du pré-chargement des phrases Wolof avec Oolel-Voices...');
  for (const p of phrases) {
    await generatePhrase(p);
  }
  console.log('Pré-chargement terminé !');
}

main().catch(console.error);
