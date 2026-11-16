const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ttsCacheDir = path.join(__dirname, '..', 'data', 'tts_cache');
if (!fs.existsSync(ttsCacheDir)) {
  fs.mkdirSync(ttsCacheDir, { recursive: true });
}

const wolofUtterances = [
  "Na nga def ! Man la Zahara, sa Agent Personnel bu MUTUALIS DAKAR. Naka la la mënee dimbali tey ci sa wér-gi-yaram ?",
  "Salamaalekum ! Nanga def ! Man la Zahara, sa Agent Dédié bu MUTUALIS DAKAR. Naka la la mënee jàppale tey ?",
  "Tarif d'adhésion UNAMUSC : Formule Individuelle mooy 4 500 FCFA ci at mi. Formule Familiale mooy 1 000 FCFA carte njiitu kër bi ak 3 500 FCFA par membre. Fayal ci Orange Money walla Wave !",
  "Cotisation bi ci CSU mooy 4500 FCFA ci at mu nekk ngir nit ku nekk. Mën nga fay ci Wave mbaa Orange Money.",
  "Bons de commande pharmacie yi dañuy fay 50% ci prix garab génériques yi ci ordonnance bi. Pharmacien agréé bi day scanner sa pass CSU te nàntu 50% bi sur-le-champ !",
  "Lettres de garantie hospitalières yi dañuy fay 80% ci say frais d'hospitalisation ak opération ci hôpitaux conventionnés. Mën nga ko demander direct ci tab Lettres de garantie !",
  "Programme Gratuité Maternité bi dafa gratuit 100% ci UNAMUSC ! CPN 1 ba 4, accouchement ak vaccins yépp ci 0 FCFA.",
  "Sa carte CSU numérique sécurisée ak say ayants droit mungi ci tab Card Studio ak Vérifier Carte !",
  "Léegi waxtu bi jot na ci Ndakaaru. Lan laa la mënee dimbali ci sa mutuelle ak sa wér-gi-yaram tey ?",
  "Ngir bokk ci mutuelle bi, da ngay indi sa CNI ak foto d'identité, te fay sa droit d'adhésion 1000 FCFA ak cotisation 4500 FCFA.",
  "Jërëjëf ci sa laaj ! En tant qu'assuré à jour, am nga 50% ci pharmacie, 80% ci hôpital ak gratuité maternité 100%. Am nga yeneen laaj ?",
  "Ngoon ak jàmm ! Man la Zahara, assistante bu Mutualis Dakar. Jàmm rekk !",
  "Suba ak jàmm ! Man la Zahara, assistante bu Mutualis Dakar. Jàmm rekk !"
];

async function generateNativeWolofAudio(text) {
  const clean = text.trim();
  const hashKey = crypto.createHash('md5').update('wo_' + clean.toLowerCase()).digest('hex');
  const wavPath = path.join(ttsCacheDir, hashKey + '.wav');

  if (fs.existsSync(wavPath) && fs.statSync(wavPath).size > 1000) {
    console.log(`[Cache Existant] "${clean.substring(0, 40)}..." -> ${hashKey}.wav`);
    return;
  }

  console.log(`[Génération GalsenAI Wolof] "${clean.substring(0, 40)}..."`);
  const t0 = Date.now();

  const res = await fetch('https://abdazizsall-wolof-pocket-tts-demo.hf.space/gradio_api/call/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [clean, 'Voice 1 (galsenai, female)'] }),
    signal: AbortSignal.timeout(25000)
  });

  if (!res.ok) throw new Error('API status ' + res.status);
  const data = await res.json();
  if (!data.event_id) throw new Error('Pas de event_id');

  const streamRes = await fetch(`https://abdazizsall-wolof-pocket-tts-demo.hf.space/gradio_api/call/synthesize/${data.event_id}`, {
    signal: AbortSignal.timeout(25000)
  });
  const streamText = await streamRes.text();
  const match = streamText.match(/"url":\s*"([^"]+)"/);
  if (!match || !match[1]) throw new Error('URL audio introuvable dans le flux SSE');

  const audioRes = await fetch(match[1]);
  const arrayBuf = await audioRes.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  fs.writeFileSync(wavPath, buf);
  console.log(`[Succès Natif] ${hashKey}.wav créé (${buf.length} octets en ${Date.now() - t0} ms)`);
}

async function run() {
  console.log('=== Démarrage de la génération vocale NATIVE WOLOF (GalsenAI) ===');
  for (const text of wolofUtterances) {
    try {
      await generateNativeWolofAudio(text);
    } catch (e) {
      console.error(`Erreur pour "${text.substring(0, 30)}..." :`, e.message);
    }
  }
  console.log('=== Terminé avec succès ! ===');
}

run();
