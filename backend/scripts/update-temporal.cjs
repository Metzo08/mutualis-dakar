const fs = require('fs');
const p = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/backend/server.js';
let content = fs.readFileSync(p, 'utf8');

// 1. Helmet CORP update
content = content.replace(
  'app.use(helmet());',
  'app.use(helmet({\n  crossOriginResourcePolicy: { policy: "cross-origin" }\n}));'
);

// 2. getDakarTemporalContext helper
const helperCode = `
// ── CONTEXTE TEMPOREL, CIRCADIEN ET SAISONNIER DE DAKAR (GMT/UTC) ──
function getDakarTemporalContext(lang = 'fr') {
  const now = new Date();
  const options = { timeZone: 'Africa/Dakar', hour12: false, hour: '2-digit', minute: '2-digit', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const dakarDateStr = new Intl.DateTimeFormat('fr-FR', options).format(now);
  const hour = parseInt(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Dakar', hour12: false, hour: '2-digit' }).format(now), 10);
  const month = now.getUTCMonth() + 1;
  const dayOfWeek = now.getUTCDay(); // 0: Dimanche, 5: Vendredi

  let momentFr = '';
  let momentWo = '';
  let salutationFr = '';
  let salutationWo = '';

  if (hour >= 5 && hour < 7) {
    momentFr = "Aube / Petit matin (Fadjr)";
    momentWo = "Fajar / Suba teel";
    salutationFr = "Bonjour très matinal ! Paix et bénédiction en ce début de journée.";
    salutationWo = "Jàmm ak fajar ! Yàlla nañu yendoo ak jàmm.";
  } else if (hour >= 7 && hour < 12) {
    momentFr = "Matinée";
    momentWo = "Suba";
    salutationFr = "Bonjour et excellente matinée ! Les bureaux de mutuelles et les pharmacies sont ouverts.";
    salutationWo = "Suba ak jàmm ! Nanga fanaanee ? Mutuelle yi ak pharmacie yi ubbi nañu.";
  } else if (hour >= 12 && hour < 14) {
    momentFr = "Milieu de journée / Midi";
    momentWo = "Diggu bëccëk";
    salutationFr = "Bonne mi-journée ! Bon appétit si vous êtes à table.";
    salutationWo = "Bëccëk ak jàmm ! Naka bëccëk bi ?";
  } else if (hour >= 14 && hour < 18) {
    momentFr = "Après-midi";
    momentWo = "Bëccëk / Ngoon teel";
    salutationFr = "Bon après-midi !";
    salutationWo = "Ngoon ak jàmm ! Naka liggéey bi ?";
  } else if (hour >= 18 && hour < 22) {
    momentFr = "Soirée / Crépuscule (Timis)";
    momentWo = "Timis / Ngoon";
    salutationFr = "Bonsoir ! J'espère que votre journée s'est bien passée.";
    salutationWo = "Ngoon ak jàmm ! Naka ngoon gi ?";
  } else {
    momentFr = "Nuit (Guddi)";
    momentWo = "Guddi";
    salutationFr = "Bonsoir / Douce nuit. Rappel : Les urgences hospitalières conventionnées (CHU Fann, Hôpital Principal, Le Dantec) restent ouvertes 24h/24 et 7j/7 avec prise en charge 80% à 100%.";
    salutationWo = "Guddi ak jàmm ! Xamal ni urgences ci hôpitaux conventionnés yi (Fann, Principal, Le Dantec) ubbi nañu 24h/24 ci guddi gi ak garantie 80% ba 100%.";
  }

  let saisonFr = '';
  let saisonWo = '';
  if (month >= 7 && month <= 10) {
    saisonFr = "Saison des pluies / Hivernage (Nawet) : pic de paludisme, moustiquaires imprégnées et soins pédiatriques gratuits";
    saisonWo = "Nawet (taw yi ak palu) : vigilance moustiquaires ak garab palu gratuit";
  } else if (month >= 11 || month <= 2) {
    saisonFr = "Saison fraîche et sèche (Harmattan précoce / Noor) : fraîcheur matinale et nocturne, affections respiratoires et toux, période des adhésions et renouvellements CSU 2026 (4 500 FCFA)";
    saisonWo = "Noor / Sedd bi ak ngelaw li : faju ngir sëqët ak sooj, renouvellement cotisations annuel 4500 FCFA";
  } else {
    saisonFr = "Saison chaude et sèche (Thioron) : fortes chaleurs, hydratation, attention aux aînés couverts par le Plan SESAME (60 ans+)";
    saisonWo = "Tangor bi (Thioron) : naandoo ndox bu baax, dimbali mag ñi ci Plan SESAME (60 ans+)";
  }

  let specialDayFr = '';
  let specialDayWo = '';
  if (dayOfWeek === 5) {
    specialDayFr = "Aujourd'hui c'est Vendredi (Jour saint de prière, Jummah Mubarak)";
    specialDayWo = "Tey Àjjuma la (Àjjuma mubaarak, barkéelu)";
  } else if (dayOfWeek === 0 || dayOfWeek === 6) {
    specialDayFr = "C'est le week-end : les services d'urgence hospitalières et pharmacies de garde sont mobilisés";
    specialDayWo = "Week-end la : urgences ak pharmacies de garde ñu ngi dox";
  }

  return { dakarDateStr, hour, momentFr, momentWo, salutationFr, salutationWo, saisonFr, saisonWo, specialDayFr, specialDayWo };
}
`;

// Insert getDakarTemporalContext before app.post('/api/chatbot'
if (!content.includes('function getDakarTemporalContext')) {
  content = content.replace("app.post('/api/chatbot',", helperCode + "\napp.post('/api/chatbot',");
}

fs.writeFileSync(p, content, 'utf8');
console.log('Server helper updated');
