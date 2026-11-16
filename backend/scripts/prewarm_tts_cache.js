const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { convertWolofToFrenchPhonetics } = require('../phonetics.js');

const ttsCacheDir = path.join(__dirname, '..', 'data', 'tts_cache');
if (!fs.existsSync(ttsCacheDir)) {
  fs.mkdirSync(ttsCacheDir, { recursive: true });
}

const entries = [
  // Wolof
  {
    lang: 'wo',
    text: "Nanga def ! Man la Zahara, assistante bu Mutualis Dakar. Mën naala dimbali ci lépp luy wér-gi-yaram, sa cotisation mbaa sa prise en charge."
  },
  {
    lang: 'wo',
    text: "Cotisation bi ci CSU mooy 4500 FCFA ci at mu nekk ngir nit ku nekk. Mën nga fay ci Wave mbaa Orange Money."
  },
  {
    lang: 'wo',
    text: "Ci garab yi, Mutualis Dakar dafay faye 50% ci li médecin bi bind, nga jël sa bon de prise en charge dem ci pharmacie yi bokk ci rézo bi."
  },
  {
    lang: 'wo',
    text: "Ngir tëdd ci hôpital, mutuelle bi dafay fay 80% ci frais yi ak lettre de garantie. 20% rekk ngay faye."
  },
  {
    lang: 'wo',
    text: "Liggéeyu maternité dafa am gratuité bu mat sëkk 100% ngir jigéen ñiy wésin ci structures publiques yi."
  },
  {
    lang: 'wo',
    text: "Ngir bokk ci mutuelle bi, da ngay indi sa CNI ak foto d'identité, te fay sa droit d'adhésion 1000 FCFA ak cotisation 4500 FCFA."
  },
  // Français
  {
    lang: 'fr',
    text: "Bonjour ! Je suis Zahara, votre assistante Mutualis Dakar. Comment puis-je vous aider aujourd'hui concernant votre mutuelle de santé ?"
  },
  {
    lang: 'fr',
    text: "La cotisation annuelle est de 4 500 FCFA par personne et par an pour la Couverture Santé Universelle. Vous pouvez payer facilement par Wave ou Orange Money."
  },
  {
    lang: 'fr',
    text: "Pour vos ordonnances en pharmacie conventionnée, votre mutuelle prend en charge 50% des frais sur présentation de votre bon de commande."
  },
  {
    lang: 'fr',
    text: "En cas d'hospitalisation dans une structure partenaire, 80% des frais sont pris en charge grâce à votre lettre de garantie."
  },
  {
    lang: 'fr',
    text: "La maternité bénéficie d'une gratuité totale à 100% dans les structures de santé publiques au Sénégal."
  }
];

async function generateEntry(entry) {
  const isWolof = entry.lang === 'wo';
  const cleanText = entry.text.trim();
  const hashKey = crypto.createHash('md5').update((isWolof ? 'wo' : 'fr') + '_' + cleanText.toLowerCase()).digest('hex');
  const mp3CacheFile = path.join(ttsCacheDir, hashKey + '.mp3');

  if (fs.existsSync(mp3CacheFile) && fs.statSync(mp3CacheFile).size > 1000) {
    console.log(`[Cache Existant] (${entry.lang}) "${cleanText.substring(0, 35)}..." -> ${hashKey}.mp3`);
    return;
  }

  const textToSynthesize = isWolof ? convertWolofToFrenchPhonetics(cleanText) : cleanText;
  console.log(`[Génération TTS] (${entry.lang}) "${cleanText.substring(0, 35)}..."`);

  await new Promise((resolve, reject) => {
    execFile('C:/Python313/python.exe', ['-m', 'edge_tts', '--voice', 'fr-FR-DeniseNeural', '--text', textToSynthesize, '--write-media', mp3CacheFile], { timeout: 25000 }, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  const size = fs.statSync(mp3CacheFile).size;
  console.log(`[Succès] ${hashKey}.mp3 généré (${size} octets)`);
}

async function run() {
  console.log('--- Préchauffage du cache TTS (Wolof phonétique & Français HD) ---');
  for (const entry of entries) {
    try {
      await generateEntry(entry);
    } catch (e) {
      console.error('Erreur entrée:', e.message);
    }
  }
  console.log('--- Préchauffage terminé avec succès ! ---');
}

run();
