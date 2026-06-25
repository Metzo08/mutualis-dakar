export const isWolofText = (text) => {
  if (!text) return false;
  const clean = text.normalize('NFC').toLowerCase();

  // 1. Absolute Wolof indicators (characters unique to Wolof in this project's context)
  if (clean.includes('ë') || clean.includes('ñ')) {
    return true;
  }

  // 2. Count Wolof indicators
  const wolofWords = [
    'jamm', 'jerejef', 'jërejëf', 'nanga', 'dalal', 'yeneen', 'laaj', 'tontu',
    'firi', 'leeral', 'nuyu', 'fajj', 'fébar', 'fajukaay', 'fajuway', 'wér-gi-yaram',
    'yomb', 'lool', 'bees', 'bopp', 'waaw', 'waw', 'yaw', 'yow', 'tànn',
    'tannal', 'ngir', 'ndakaaru', 'kër', 'léegi', 'liggéey', 'liggeeyal', 'mooy',
    'mën', 'mëna', 'mënë', 'mënu', 'sunu', 'suñu', 'alla', 'wallu', 'xalis',
    'xaalis', 'xam', 'yaram', 'ñaar', 'ñaata', 'ñata', 'ñakk', 'ñent',
    'ñett', 'dëgëral', 'dëgg', 'dëkk', 'bëgg', 'gën', 'gëna', 'gënë', 'gëstu',
    'ndax', 'ndaw', 'ndimbal', 'nekk', 'ñoo', 'ñooy', 'sañ', 'sàkk',
    'seet', 'seetal', 'soxna', 'tëdd', 'wacc', 'wàññi', 'weer', 'wér', 'wuti',
    'xéwal', 'xévale', 'xéwalé', 'yakaar', 'yakk', 'yeugle', 'dimbali', 'faye',
    'ak', 'yi', 'gi', 'wi', 'ngi', 'lay', 'ngeen', 'nga', 'gnu', 'gu', 'bu', 'yu', 'ci',
    'wax', 'waxal', 'waxe', 'di', 'na', 'da', 'dama', 'danga', 'dafa', 'dañu', 'laajal', 
    'tontul', 'faj', 'paj', 'faju', 'fajjuku', 'mangi', 'yangi', 'mungi', 'nongi', 'ñoongi',
    'la', 'ma', 'salam', 'salaam', 'salamalekoum', 'salamalékoum', 'def', 'defal', 'sama', 'samay'
  ];

  const frenchWords = [
    'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'en', 'est', 'a', 'à',
    'pour', 'dans', 'par', 'sur', 'avec', 'sans', 'sous', 'ce', 'cette', 'ces',
    'mon', 'mes', 'ton', 'ta', 'tes', 'son', 'ses', 'notre', 'votre', 'leur',
    'nos', 'vos', 'leurs', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
    'se', 'y', 'ne', 'pas', 'plus', 'tout', 'tous', 'toute', 'toutes', 'mais', 'ou',
    'donc', 'or', 'ni', 'car', 'si', 'bien', 'très', 'alors', 'qui', 'que', 'quoi',
    'dont', 'où', 'comment', 'pourquoi', 'quand', 'quel', 'quelle', 'quels', 'quelles',
    'oui', 'non', 'merci', 'bonjour', 'salut', 'monsieur', 'madame', 'mademoiselle',
    'sante', 'santé', 'mutuelle', 'mutuelles', 'cotisation', 'cotisations', 'adhésion',
    'adhesion', 'inscription', 'structures', 'conventionné', 'conventionnée', 'prise',
    'charge', 'frais', 'remboursement', 'taux', 'assistant', 'assistante', 'officiel',
    'officielle', 'portail', 'régional', 'régionale', 'sénégal', 'senegal'
  ];

  let wolofScore = 0;
  let frenchScore = 0;

  // Split into words, removing punctuation
  const words = clean.split(/[^a-zA-Z0-9àéèëñâôîûç'’-]+/);

  for (const w of words) {
    if (!w) continue;
    if (wolofWords.includes(w)) {
      wolofScore++;
    }
    if (frenchWords.includes(w)) {
      frenchScore++;
    }
  }

  if (wolofScore > frenchScore) return true;
  if (frenchScore > wolofScore) return false;

  // If scores are equal, check if it contains any strong Wolof word as a fallback
  if (wolofScore > 0 && frenchScore === 0) return true;
  if (frenchScore > 0 && wolofScore === 0) return false;

  return false;
};

export const convertWolofToFrenchPhonetics = (text) => {
  const bypassWords = new Set([
    'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'en', 'est', 'a', 'à', 'pour', 'dans', 'par', 'sur', 'avec', 'sans', 'sous',
    'ce', 'cette', 'ces', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'ses', 'notre', 'votre', 'leur', 'nos', 'vos', 'leurs',
    'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'se', 'y', 'ne', 'pas', 'plus', 'tout', 'tous', 'toute', 'toutes',
    'mais', 'ou', 'donc', 'or', 'ni', 'car', 'si', 'bien', 'très', 'alors', 'qui', 'que', 'quoi', 'dont', 'où', 'comment', 'pourquoi', 'quand',
    'quel', 'quelle', 'quels', 'quelles', 'oui', 'non', 'ok', 'merci', 'bonjour', 'salut', 'monsieur', 'madame', 'mademoiselle',
    'message', 'messages', 'officiel', 'officielle', 'portail', 'portal', 'union',
    'mutuelle', 'mutuelles', 'mutuel', 'mutuels', 'cotisation', 'cotisations', 'adhésion', 'adhésions', 'adhesion', 'adhesions',
    'carte', 'cartes', 'cartographie', 'hôpital', 'hopital', 'hôpitaux', 'hopitaux', 'clinique', 'cliniques', 'pharmacie', 'pharmacies',
    'centre', 'centres', 'poste', 'postes', 'santé', 'sante', 'soin', 'soins', 'médicament', 'médicaments', 'medicament', 'medicaments',
    'prise', 'charge', 'taux', 'pourcent', 'pourcentage', 'fcfa', 'cmu', 'couverture', 'maladie', 'universelle', 'dakar',
    'orange', 'money', 'wave', 'zahara', 'mariama', 'virtuel', 'virtuelle', 'virtuels', 'virtuelles', 'assistant', 'assistante',
    'assistants', 'assistantes', 'intelligence', 'artificielle', 'officiel', 'officielle', 'officiels', 'officielles',
    'régional', 'régionale', 'regionale', 'régionales', 'communautaire', 'communautaires', 'sénégal', 'senegal',
    'sénégalais', 'senegalais', 'sénégalaise', 'senegalaise', 'chaleureux', 'chaleureuse', 'bienveillant', 'bienveillante',
    'professionnel', 'professionnelle', 'professionnels', 'professionnelles', 'empathie', 'respect', 'convivial', 'conviviale',
    'concise', 'concises', 'phrase', 'phrases', 'aide', 'aider', 'usager', 'usagers', 'visiteur', 'visiteurs', 'tarif', 'tarifs',
    'formule', 'formules', 'individuel', 'individuelle', 'individuels', 'individuelles', 'familial', 'familiale', 'familiaux', 'familiales',
    'membre', 'membres', 'paiement', 'paiements', 'mobile', 'mobiles', 'accepté', 'acceptés', 'accepte', 'acceptes',
    'structure', 'structures', 'conventionné', 'conventionnée', 'conventionnés', 'conventionnées', 'incluent', 'principal', 'principale',
    'fann', 'départemental', 'départementale', 'départementaux', 'départementales', 'département', 'départements',
    'agréé', 'agréée', 'agréés', 'agréées', 'varie', 'selon', 'choisi', 'choisie', 'choisis', 'choisies', 'programme', 'national',
    'accès', 'couvre', 'organisation', 'organisations', 'assurance', 'assurances', 'adresse', 'adresses', 'téléphone', 'téléphones',
    'horaire', 'horaires', 'contact', 'contacts', 'commune', 'communes', 'médina', 'medina', 'pikine', 'guédiawaye', 'guediawaye',
    'massar', 'rufisque', 'yoff', 'parcelles', 'assainies', 'plateau', 'ngor', 'almadies', 'ouakam', 'mermoz', 'sacre-coeur',
    'sacré-cœur', 'sicap', 'liberte', 'liberté', 'dieuppeul', 'hann', 'bel-air', 'grand-yoff', 'patte', "d'oie", 'amitie', 'amitié',
    'colobane', 'fass', 'gueule', 'tapée', 'tapeye', 'grand-dakar', 'biscuiterie', 'hlm', 'dakar-plateau', 'général', 'générale',
    'service', 'services', 'ligne', 'bouton', 'boutons', 'cliquer', 'survole', 'survoler', 'geolocalisation', 'géolocalisation',
    'exacte', 'situé', 'situe', 'recherche', 'recherches', 'google', 'maps', 'précis', 'precis', 'prises', 'frais',
    'être', 'avoir', 'faire', 'dire', 'pouvoir', 'vouloir', 'aller', 'voir', 'savoir', 'venir',
    'suis', 'es', 'sommes', 'êtes', 'sont', 'ai', 'as', 'avons', 'avez', 'ont', 'fait', 'fais', 'faites', 'font',
    'peux', 'peut', 'pouvons', 'pouvez', 'peuvent', 'veux', 'veut', 'voulons', 'voulez', 'veulent', 'vais', 'vas', 'va', 'allons', 'allez',
    'vont', 'parle', 'parlent', 'parler', 'trouve', 'trouvent', 'trouver', 'localise', 'localiser', 'affiche', 'affichent', 'afficher',
    'liste', 'listes', 'lister', 'consulter', 'consulte', 'consultes', 'consultez', 'choisir', 'choisit', 'choisissez', 'remplir',
    'remplit', 'remplissez', 'payer', 'paye', 'payez', 'paie', 'paient', 'enregistrer', 'enregistré', 'enregistrée', 'enregistres',
    'enregistrez', 'dossier', 'dossiers', 'bénéficiaire', 'bénéficiaires', 'assuré', 'assurés', 'assurée', 'assurées', 'citoyen',
    'citoyens', 'agent', 'agents', 'administrateur', 'administrateurs', 'connexion', 'déconnexion', 'authentification', 'mot', 'passe',
    'mutualis', 'internet', 'photo', 'identité', 'nouveau', 'nouvelle', 'renouvellement',
    'intelligente', 'intelligent', 'intelligents', 'intelligentes', 'aussi', 'comment', 'puis',
    'aujourd', 'hui', 'faye', 'côte', 'entre', 'aussi', 'comme', 'chez', 'encore', 'depuis',
    'alors', 'même', 'autre', 'autres', 'ici', 'vers', 'après', 'avant', 'pendant',
    'chaque', 'quelque', 'quelques', 'certain', 'certains', 'certaine', 'certaines',
    'numéro', 'numéros', 'gratuit', 'gratuite', 'gratuits', 'gratuites',
    'consultation', 'consultations', 'ordonnance', 'ordonnances', 'programme', 'programmes',
    'universelle', 'universel', 'couverture', 'réduction', 'remboursement', 'pourcentage',
    'inscription', 'inscriptions', 'formulaire', 'formulaires', 'document', 'documents',
    'certificat', 'certificats', 'médecin', 'médecins', 'docteur', 'docteurs',
    'traitement', 'traitements', 'examen', 'examens', 'analyse', 'analyses',
    'urgence', 'urgences', 'ambulance', 'ambulances', 'maternité', 'maternités',
    'pédiatrie', 'chirurgie', 'hospitalisation', 'hospitalisations',
    '50', '80', '100', '7000', '25000', 'montant', 'montants', 'prix', 'coût',
    'français', 'francais', 'wolof',
  ]);

  let cleanText = text.normalize('NFC').toLowerCase();

  const expressionMap = [
    ["salaam aleekum", "salame aleikoume"],
    ["salam aleykum", "salame aleykoume"],
    ["assalamu alaikum", "assalamou aleykoume"],
    ["dalal ak jamm", "dalal ak djamm"],
    ["dalal jamm", "dalal djamm"],
    ["ndax am nga yeneen laaj yoo bëgg ma tontu", "n'dakh amme n'ga yènènne ladj yo beug ma tonne tou"],
    ["ndax am nga yeneen laaj", "n'dakh amme n'ga yènènne ladj"],
    ["yoo bëgg ma tontu", "yo beug ma tonne tou"],
    ["yoo ma bëgg a laaj", "yo ma beug a ladj"],
    ["loo bëgg nu firi ko", "lo beug nou firi ko"],
    ["man la zahara", "mann la zahara"],
    ["mën naa la leeral", "meun na la lééral"],
    ["mën naa wax", "meun na ouakh"],
    ["mën naa la", "meun na la"],
    ["mën naa", "meun na"],
    ["mën nga ma", "meun n'ga ma"],
    ["mën nga", "meun n'ga"],
    ["mën na la", "meun na la"],
    ["mën nañu", "meun gna gnou"],
    ["mën na", "meun na"],
    ["ma ngi lay nuyu", "ma n'gui laï nouillou"],
    ["ma ngi lay", "ma n'gui laï"],
    ["mu ngi nekk", "mou n'gui nekk"],
    ["mu ngi", "mou n'gui"],
    ["naka la la mëné jafal", "naka la la meuné djafal"],
    ["naka la", "naka la"],
    ["naka ngen def", "naka n'guénn def"],
    ["nanga def", "nanga def"],
    ["fajj sa fébar", "fadj sa fébar"],
    ["fajj sa febar", "fadj sa fébar"],
    ["sa wér-gi-yaram", "sa wèr gui yaram"],
    ["wér-gi-yaram", "wèr gui yaram"],
    ["wer-gi-yaram", "wèr gui yaram"],
    ["fajukaay yi", "fadjoukail yi"],
    ["fajukaay bi", "fadjoukail bi"],
    ["yomb na lool", "yomb na loll"],
    ["yomb na", "yomb na"],
    ["bu bees", "bou bess"],
    ["yu bari", "you bari"],
    ["fayal sa", "faillal sa"],
    ["fay bi", "faille bi"],
    ["sa bopp", "sa boppe"],
    ["la laaj", "la ladj"],
    ["ma laaj", "ma ladj"],
    ["jërejëf", "djéreudjeufe"],
    ["jërejef", "djéreudjeufe"],
    ["jerejef", "djéreudjeufe"],
    ["ndakaaru", "n'dakarou"],
    ["fajukaay", "fadjoukaï"],
    ["fajj", "fadje"],
    ["fébar", "fébar"],
    ["ba ñu mën a fajjuku", "ba gnou meun a fadjokou"],
    ["ñu mën a fajjuku", "gnou meun a fadjokou"],
    ["mën a fajjuku", "meun a fadjokou"],
    ["ba ñu mën", "ba gnou meun"],
    ["anam gu yomb", "anam gou yomb"],
    ["anam gu baax", "anam gou bakh"],
    ["askan wi", "askan oui"],
    ["nguur gu sénégal", "n'gour gou sénégal"],
    ["nguur gu", "n'gour gou"],
    ["ñooy dëgëral", "gnoy deuguéral"],
    ["dëgëral liggéey", "deuguéral lidgéy"],
    ["liggéey boobu", "lidgéy bobou"],
    ["wàññi sa frais", "ouagni sa frais"],
    ["wàññi sa", "ouagni sa"],
    ["ci 50% ba 80%", "tchi 50% ba 80%"],
    ["bëgg nga xam", "beug n'ga kham"],
    ["bëgg nga", "beug n'ga"],
    ["ngay bindu", "n'gaï binndou"],
    ["am nga yeneen laaj", "amm n'ga yènènne ladj"],
    ["am nga", "amm n'ga"],
    ["sa frais de consultation", "sa frais de consultation"],
    ["sa ordonnance yi", "sa ordonnance yi"],
    ["xéwalé", "khéoualé"],
    ["te xéwalé", "té khéoualé"],
    ["ndawu kaay", "n'daou kail"],
    ["ma ngi fi", "ma n'gui fi"],
    ["fi nekk ngir", "fi nekk n'guir"],
    ["lépp lu jëm ci", "lépp lou djeum tchi"],
    ["lu jëm ci", "lou djeum tchi"],
    ["dugg ci mutuelle", "doug tchi mutuelle"],
    ["faye sa cotisation", "faillé sa cotisation"],
    ["fajiway yi", "fadjiouail yi"],
    ["cmu", "cé emme ou"],
    ["urmscd", "ou erre emme esse cé dé"],
    ["fcfa", "effe cé effe a"],
    ["orange money", "orange money"],
    ["wave", "wave"],
    ["salamalékoum", "salama lékoume"],
    ["salamalekoum", "salama lékoume"],
  ];

  expressionMap.sort((a, b) => b[0].length - a[0].length);

  const placeholders = [];
  for (const [pattern, replacement] of expressionMap) {
    const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedPattern, 'g');
    if (regex.test(cleanText)) {
      cleanText = cleanText.replace(regex, (match) => {
        const placeholder = `__expr_placeholder_${placeholders.length}__`;
        placeholders.push(replacement);
        return placeholder;
      });
    }
  }

  const wordMap = {
    'àgg': 'ag',
    'àggsi': 'agussi',
    'ak': 'ak',
    'aka': 'aka',
    'am': 'amm',
    'am na': 'am na',
    'amul': 'amoul',
    'amul solo': 'amoul solo',
    'ana': 'ana',
    'anam': 'anam',
    'ànd': "an'd",
    'angale': "an'galè",
    'askan': 'askann',
    'assalaamu alaikum': 'assalamou aleykoum',
    'assurance': 'assuransse',
    'at': 'at',
    'àtte': 'at',
    'ba': 'ba',
    'ba beneen yoon': 'ba bènènne yonne',
    'baat': 'bat',
    'baax': 'bakh',
    'baax na': 'bakh na',
    'baay': 'baï',
    'ban': 'bann',
    'bari': 'bari',
    'bees': 'bess',
    'bëgg': 'beugue',
    'bëgg-bëgg': 'beug beug',
    'bëgga': 'beuga',
    'bëggee': 'beugué',
    'bëggon': 'beugounn',
    'benn': 'benn',
    'benn yoon': 'benn yonne',
    'bess': 'bess',
    'bi': 'bi',
    'biir': 'bir',
    'bind': 'binndé',
    'bindal': 'binndal',
    'bindeeku': 'binndékou',
    'bindeel': 'binndél',
    'bindu': 'binndou',
    'bokk': 'bokke',
    'bokke': 'bokkè',
    'bokkee': 'bokkè',
    'boo': 'bo',
    'boobu': 'bobou',
    'bopp': 'boppe',
    'bu': 'bou',
    'bu baax': 'bou bakh',
    'bu bees': 'bou bès',
    'bu ndaw': "bou n'daow",
    'bu rëy': 'bou reuy',
    'bu yàgg': 'bou yag',
    'bunt': 'bount',
    'ci': 'tchi',
    'ci biir': 'si bir',
    'ci ginnaaw': 'si guinaow',
    'ci kanam': 'si kanam',
    'ci kaw': 'si kaow',
    'ci suuf': 'si souf',
    'cmu': 'sè-èmm-ou',
    'consultation': 'consultation',
    'cotisation': 'cotizasion',
    'cuq': 'tchouk',
    'da ñu': 'da gnou',
    'dafa': 'dafa',
    'dajal': 'dadjal',
    'daje': 'dadjè',
    'dakar': 'dakar',
    'daktar': 'daktar',
    'dal': 'dal',
    'dalal': 'dalal',
    'dana': 'dana',
    'danañu': 'danagnou',
    'dañu': 'dagnou',
    'day': 'daï',
    'déedéet': 'dédét',
    'déet': 'dét',
    'def': 'deffe',
    'defal': 'deffal',
    'defaraat': 'defarat',
    'dég': 'dèg',
    'dëgër': 'deuguér',
    'dëgëral': 'deuguéral',
    'dëgg': 'deugue',
    'dëgg-dëgg': 'deug-deug',
    'dëkk': 'deukke',
    'dem': 'dème',
    'di': 'di',
    'diggante': 'digannté',
    'dikk': 'dikk',
    'dikkal': 'dikkal',
    'dimbali': 'dimbily',
    'dimbali-leen': 'dimbily lénn',
    'dina': 'dina',
    'dinaa': 'dina',
    'dinañu': 'dinagnou',
    'doole': 'dolè',
    'doolé': 'dolè',
    'doom': 'domm',
    'doomam': 'domam',
    'doonte': 'donté',
    'du': 'dou',
    'dugal': 'dougal',
    'dugg': 'doug',
    'fàggu': 'fagou',
    'fajar': 'fadjar',
    'fajj': 'fadje',
    'fajjiku': 'fadjikou',
    'fajjiku-ci': 'fadjikou tchi',
    'fajjuku': 'fadjokou',
    'faju': 'fadjou',
    'fajukaay': 'fadjoukaï',
    'fajuway': 'fadjou-ouay',
    'fajuwaye': 'fadjouail',
    'fan': 'fann',
    'fañ': 'fagn',
    'fanweer': 'fanwèr',
    'fay': 'faille',
    'fayal': 'faillal',
    'faye': 'faillé',
    'fébar': 'fébar',
    'fecc': 'fetché',
    'fee': 'fé',
    'feebar': 'fèbar',
    'fees': 'fès',
    'feete': 'fété',
    'fey': 'faille',
    'fi': 'fi',
    'fii': 'fi',
    'fii-ne': 'fi-ne',
    'firi': 'firi',
    'fo': 'fo',
    'foo': 'fo',
    'foofu': 'fofou',
    'fransaa': 'fransa',
    'fu': 'fou',
    'fukk': 'fouk',
    'fukk ak benn': 'fouk ak benn',
    'gaaw-gaaw': 'gaow-gaow',
    'gën': 'guénn',
    'gëna': 'guéna',
    'gënë': 'guenè',
    'génn': 'génn',
    'gëstu': 'guestou',
    'gëstuwaat': 'guestouat',
    'gi': 'gui',
    'ginnaaw': 'guinaow',
    'gis': 'guiss',
    'golo': 'golo',
    'góor': 'gor',
    'gu': 'gou',
    'guur': 'gour',
    'indi': "in'di",
    'itam': 'itam',
    'jaam': 'djam',
    'jaay': 'djay',
    'jabar': 'djabar',
    'jaboot': 'djabot',
    'jafe-jafe': 'djafe-djafe',
    'jamm': 'djamm',
    'jàmm rekk': 'djamm rek',
    'jamono': 'djamo',
    'jàng': 'djang',
    'jàngal': 'djangal',
    'jàpp': 'djap',
    'jàppale': 'djapalé',
    'jappande': 'djapand',
    'jàppandoo': 'djapando',
    'jéego': 'djégo',
    'jëf': 'djeuf',
    'jëfandiku': 'djeufondikou',
    'jege': 'djégué',
    'jegee': 'djégué',
    'jëkkër': 'djeukeur',
    'jël': 'djeul',
    'jëlal': 'djeulal',
    'jëm': 'djeum',
    'jëmm': 'djeum',
    'jënd': "djen'd",
    'jërëjëf': 'djereu djeuf',
    'ji': 'dji',
    'jigéen': 'diguénn',
    'jokkale': 'djokalè',
    'jokkoo': 'djoko',
    'jox': 'djokh',
    'joxal': 'djokhal',
    'joxe': 'djokhé',
    'jubanti': 'djoubannti',
    'jublu': 'djoublou',
    'junni': 'djounni',
    'juroom': 'djouromm',
    'juróom': 'djouromm',
    'juroom-benn': 'djourom-benn',
    'juroom-ñaar': 'djourom-gnar',
    'juroom-ñent': 'djourom-gnent',
    'juroom-ñett': 'djourom-gnét',
    'kaay': 'kail',
    'kan': 'kann',
    'kañ': 'kagn',
    'kanam': 'kanam',
    'kër': 'keur',
    'këram': 'keuram',
    'këru': 'keurou',
    'kestio': 'kestionne',
    'kestion': 'kestionne',
    'ko': 'ko',
    'kon': 'konn',
    'kooku': 'kokou',
    'koon': 'kon',
    'ku': 'kou',
    'la': 'la',
    'laaj': 'la-adje',
    'laajal': 'la-adjale',
    'laajte': 'la-adjete',
    'laay': 'la-aïe',
    'lakk': 'lak',
    'lan': 'lann',
    'lañu': 'lagnou',
    'lay': 'laïe',
    'léegi': 'lègui',
    'leen': 'lénn',
    'leeral': 'lééral',
    'légal': 'lègal',
    'lekk': 'lek',
    'lëkku': 'leukou',
    'lekkukaay': 'lekoukaï',
    'lekkul': 'lekoul',
    'lépi': 'lépi',
    'lepp': 'lépp',
    'lépp': 'lépp',
    'li': 'li',
    'li ci des': 'li si des',
    'li ci topp': 'li si top',
    'li nu': 'li nou',
    'li yoo': 'li yo',
    'ligéey': 'li-guèye',
    'ligéeykat': 'li-guèyekate',
    'liggéey': 'li-guèye',
    'liggeeyal': 'li-guèyale',
    'liggéeyal': 'li-guèyale',
    'lii': 'li',
    'lii lépp': 'li lèp',
    'liir': 'lir',
    'lolu': 'lolou',
    'loo': 'lo',
    'lool': 'loll',
    'loolu': 'lolou',
    'looy': 'loille',
    'lu': 'lou',
    'lu bari': 'lou bari',
    'lu dul': 'lou doul',
    'lu néew': 'lou nèw',
    'luy': 'louille',
    'maa': 'ma',
    'maa ngi fi': "ma n'gui fi",
    'maangi fi rekk': "m'an'gui fi rek",
    'mag': 'mag',
    'mag-mag': 'mag mag',
    'magam': 'magam',
    'man': 'mann',
    'mangui': 'man gui',
    'mbagg': "m'bagg",
    'mbay': "m'bay",
    'mbebet': "m'bèbètt",
    'mbebéte': "m'bèbètt",
    'mbegte': "m'bégté",
    'mbégte': "m'bégté",
    'mbëgte': "m'beugté",
    'mbëgté': "m'beugté",
    'mbeugte': "m'beugté",
    'mbir': "m'bir",
    'mbiri': "m'biri",
    'mbokk': "m'bokk",
    'mbooleem': "m'bolèm",
    'mbooloo': "m'bolo",
    'mbox': "m'bokh",
    'mën': 'meun',
    'mëna': 'meuna',
    'mënë': 'meunè',
    'mënu': 'meunou',
    'mi': 'mi',
    'moo': 'mo',
    'moo ngi': "mo n'gui",
    'moom': 'momm',
    'mooy': 'moye',
    'mu': 'mou',
    'mungi': 'moun gui',
    'musiba': 'mousiba',
    'mutuelle': 'mutuèl',
    'na': 'na',
    'na nga def?': "na n'ga def?",
    'naa': 'na',
    'naan': 'nane',
    'naanal': 'nanal',
    'ñaar': 'gnar',
    'ñaar fukk': 'gnar fouk',
    'ñaar fukk ak benn': 'gnar fouk ak benn',
    'ñaar yoon': 'gnar yonne',
    'ñaata': 'gnata',
    'naataange': 'natange',
    'nafaqë': 'nafakeu',
    'naka': 'naka',
    'naka ngone si?': "naka n'gone si?",
    'naka suba si?': "naka souba si?",
    'ñakk': 'gnak',
    'nangoo': 'nan go',
    'nangu': 'nan gou',
    'nangul': 'nan goul',
    'nañu': 'na-gnou',
    'ñata': 'gnata',
    'nawet': 'nawet',
    'naxari': 'nakhari',
    'ndakaaru': "n'dakarou",
    'ndank': "n'dank",
    'ndank-ndank': "n'dank-n'dank",
    'ndàpp': "n'dap",
    'ndaw': "n'daou",
    'ndawal': "n'daoual",
    'ndawu': "n'daou",
    'ndax': "n'dakh",
    'ndaxte': "n'dakh té",
    'ndeke': "n'déké",
    'ndeye': "n'dèy",
    'ndimbal': "n'deem-bal",
    'ndox': "n'dokh",
    'ne': 'né',
    'nëbbu': 'neubou',
    'néen': 'nèn',
    'ñeent': 'gnént',
    'néew': 'nèw',
    'néew-ñaq': 'nèw-gnak',
    'neex': 'nékh',
    'neexal': 'nékhal',
    'nekk': 'nek',
    'nekkoon': 'nekon',
    'ñent': 'gnènte',
    'ñett': 'gnette',
    'ñett fukk': 'gnette fouk',
    'nettali': 'nètali',
    'nga': "n'ga",
    'ngay': "n'gaï",
    'ngen': "n'guénn",
    'ngén': "n'gén",
    'ngëneel': "n'geuneul",
    'ngi': "n'gui",
    'ngir': "n'guir",
    'ngour': "n'gour",
    'nguur': "n'gour",
    'ni': 'ni',
    'ñi': 'gni',
    'nit': 'nitt',
    'nit-ñi': 'nitt gni',
    'njaboot': "n'djabot",
    'njëkk': "n'djeuk",
    'njël': "n'djeul",
    'njooy': "n'djoy",
    'njuwaay': "n'djouail",
    'njuway': "n'djouail",
    'noo': 'no',
    'ñoo': 'gno',
    'noo ko bokk': 'no ko bok',
    'ñoom': 'gnomm',
    'noon': 'non',
    'ñooy': 'gnoy',
    'noppalu': 'nopalou',
    'nu': 'nou',
    'ñu': 'gnou',
    'ñun': 'gnun',
    'ñuy': 'gnouy',
    'nuyu': 'nouillou',
    'ordonnance': 'ordonnance',
    'pare': 'paré',
    'paré': 'paré',
    'patt': 'pat',
    'payement': 'paiemant',
    'pënd': "peun'd",
    'porogaraam': 'porogaram',
    'porogaramu': 'porogaramou',
    'ràbbi': 'rabi',
    'rafet': 'rafét',
    'rakk': 'rak',
    'rapp': 'rap',
    'raxas': 'rakhas',
    'réew': 'réou',
    'réewum': 'réoume',
    'rekk': 'rekk',
    'rëw': 'reuou',
    'sa': 'sa',
    'safaan': 'safane',
    'sagale': 'sagalè',
    'sàkk': 'sak',
    'salam alaikum': 'salam alaykoum',
    'sama': 'sama',
    'sama borom kër': 'sama borom keur',
    'sama jabar': 'sama djabar',
    'samay': 'samaille',
    'sañ': 'sagn',
    'sañ-sañ': 'sagn-sagn',
    'sant': 'sant',
    'santé': 'santè',
    'sax': 'sakh',
    'say': 'saï',
    'seet': 'sét',
    'seetal': 'sétal',
    'seeti': 'sèti',
    'seetlu': 'sétlou',
    'sénégal': 'sènègal',
    'set': 'sèt',
    'setlu': 'setlou',
    'séy': 'sèy',
    'si': 'si',
    'sogg': 'sog',
    'sopp': 'sop',
    'soxna': 'sokhna',
    'su': 'sou',
    'suba': 'souba',
    'sunu': 'sounou',
    'suñu': 'sougnou',
    'suñuy': 'sougnouy',
    'sunuy': 'sounoui',
    'suuf': 'souf',
    'tagg': 'tag',
    'tan': 'tann',
    'tànn': 'tann',
    'tannal': 'tannal',
    'tànnee': 'tanné',
    'taw': 'taw',
    'taxaw': 'takhaou',
    'te': 'té',
    'tëdd': 'teudde',
    'tee': 'tè',
    'téeméer': 'téméré',
    'téere': 'tèr',
    'teey': 'tèy',
    'tekki': 'tekki',
    'tey': 'taï',
    'téy': 'tèy',
    'tog': 'tog',
    'togg': 'togué',
    'tontal': 'tonntal',
    'tontu': 'tonntou',
    'toog': 'togué',
    'tool': 'tol',
    'topp': 'top',
    'toppal': 'toppal',
    'tour': 'tour',
    'tudd': 'toud',
    'waa': 'oua',
    'waaw': 'ouaou',
    'waay': 'ouail',
    'waaye': 'ouail',
    'wacc': 'watch',
    'alla': 'oualla',
    'walla': 'oualla',
    'wallu': 'ouallou',
    'wàllu faj': 'walou fadj',
    'wañi': 'ouagni',
    'wàñi': 'ouagni',
    'wàññi': 'ouagni',
    'waw': 'ouaou',
    'wax': 'ouakh',
    'wax-ji': 'wakh-dji',
    'waxal': 'ouakhal',
    'waxe': 'ouakhé',
    'weer': 'ouèr',
    'wëpp': 'weup',
    'wér': 'wèr',
    'wér-gi-yaram': 'wèr gui yaram',
    'weru': 'ouérou',
    'wéru': 'ouérou',
    'wëy': 'weuy',
    'wi': 'oui',
    'wolof': 'wolof',
    'woyof': 'woyof',
    'woyofal': 'ouoyofal',
    'wut': 'out',
    'wuti': 'outi',
    'xaalis': 'khalisse',
    'xale': 'khalé',
    'xalis': 'khalisse',
    'xam': 'kham',
    'xam-xam': 'kham kham',
    'xarit': 'kharit',
    'xéwal': 'khéoual',
    'xévale': 'khéoualé',
    'xéwalé': 'khéoualé',
    'xool': 'khol',
    'yaay': 'yaï',
    'yakaar': 'yakkar',
    'yakk': 'yak',
    'yaram': 'yaram',
    'yaw': 'yaou',
    'yéem': 'yéme',
    'yeen': 'yén',
    'yéen': 'yèn',
    'yéene': 'yéné',
    'yegg': 'yeg',
    'yëgle': 'yeugl',
    'yem': 'yem',
    'yendu': "yen'dou",
    'yeneen': 'yènènne',
    'yëngu': "yeun'gou",
    'yenn': 'yèn',
    'yi': 'yi',
    'yobbal': 'yobal',
    'yobbalu': 'yobalou',
    'yobbu': 'yobou',
    'yokk': 'yok',
    'yokku': 'yokkou',
    'yokkute': 'yokkoutè',
    'yomb': 'yomme-be',
    'yoon': 'yon',
    'yoonal': 'yonal',
    'yoonu': 'yo-nou',
    'yoonu faj': 'yo-nou fadj',
    'yow': 'yaou',
  };

  const words = cleanText.split(/(\s+|,|\.|!|\?|;|:|'|\(|\)|"|-)/);

  const processedWords = words.map(w => {
    if (/^[\s,.\?!;:_'"()\-\[\]]+$/.test(w) || w === '') {
      return w;
    }
    if (w.startsWith('__expr_placeholder_')) {
      return w;
    }
    if (bypassWords.has(w)) {
      return w;
    }
    if (wordMap[w]) {
      return wordMap[w];
    }

    let p = w;

    p = p.replace(/u/g, 'ou');
    p = p.replace(/û/g, 'ou');
    if (p.startsWith('w')) {
      p = 'ou' + p.slice(1);
    }
    p = p.replace(/w/g, 'ou');
    p = p.replace(/ouou/g, 'ou');

    p = p.replace(/^ndj/g, "n'dj");
    p = p.replace(/^nj/g, "n'dj");
    p = p.replace(/^nd/g, "n'd");
    p = p.replace(/^ng/g, "n'gu");
    p = p.replace(/^mb/g, "m'b");
    p = p.replace(/^mp/g, "m'p");

    p = p.replace(/ñ/g, 'gn');
    p = p.replace(/ë/g, 'eu');
    p = p.replace(/é/g, 'é');  
    p = p.replace(/è/g, 'è');
    p = p.replace(/ê/g, 'è');
    p = p.replace(/à/g, 'a');
    p = p.replace(/â/g, 'a');
    p = p.replace(/ô/g, 'o');
    p = p.replace(/î/g, 'i');
    p = p.replace(/x/g, 'kh');

    p = p.replace(/j/g, 'dj');
    p = p.replace(/c(?!h)/g, 'tch');

    p = p.replace(/g([eiéè])/g, 'gu$1');
    p = p.replace(/([aeiouyéèô])s([aeiouyéèô])/g, '$1ss$2');

    p = p.replace(/aa/g, 'a');
    p = p.replace(/ee/g, 'é');
    p = p.replace(/oo/g, 'o');

    p = p.replace(/([aeiouyéè])n($|[^aeiouyéèô])/g, '$1nn$2');
    p = p.replace(/([aeiouyéè])m($|[^aeiouyéèô])/g, '$1mm$2');

    if (p.endsWith('s') && !p.endsWith('ss') && !p.endsWith('sse')) p = p + 'se';
    if (p.endsWith('t') && !p.endsWith('te')) p = p + 'e';
    if (p.endsWith('d') && !p.endsWith('de')) p = p + 'e';
    if (p.endsWith('k')) p = p + 'e';
    if (p.endsWith('g') && !p.endsWith('gue') && !p.endsWith('ng')) p = p + 'ue';
    if (p.endsWith('b') && !p.endsWith('be')) p = p + 'e';
    if (p.endsWith('p') && !p.endsWith('pe')) p = p + 'e';
    
    return p;
  });

  let finalResult = processedWords.join('');
  for (let i = 0; i < placeholders.length; i++) {
    finalResult = finalResult.replace(`__expr_placeholder_${i}__`, placeholders[i]);
  }

  return finalResult;
};

export const cleanTextForTTS = (text) => {
  if (!text) return '';
  return text
    .normalize('NFC')
    // 1. Remove markdown links, keeping only the link text: [text](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 2. Remove markdown formatting characters and specific punctuation that TTS shouldn't read
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/__/g, '')
    .replace(/_/g, '')
    .replace(/`+/g, '')
    .replace(/#+/g, '')
    .replace(/[\(\)\[\]\{\}]/g, '') // Remove brackets and parentheses
    // 3. Replace slashes and separator hyphens with spaces to prevent verbalization
    .replace(/\//g, ' ')
    .replace(/\s-\s/g, ' ')
    .replace(/--+/g, ' ')
    // 4. Clean common emojis
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{200D}]/gu, '')
    // 5. Standardize line breaks to pauses
    .replace(/\n+/g, '. ')
    // 6. Clean up redundant spaces and multiple periods
    .replace(/\s+/g, ' ')
    .replace(/\.+/g, '.')
    .trim();
};
