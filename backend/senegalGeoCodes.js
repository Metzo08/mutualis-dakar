'use strict';

/**
 * ============================================================
 *  Référentiel géographique officiel CSU Sénégal
 *  14 Régions · 46 Départements · Communes & Mutuelles clés
 * ============================================================
 *  Format de matricule bénéficiaire UNAMUSC / SenMutuelles :
 *    {REGION}-{DEPARTEMENT}-{ANNEE}-{SEQ}.{MEMBRE}
 *  Exemples :
 *    - Dakar / Dakar / 2026      → DKR-DKR-2026-2404.1 (adhérent)
 *                                → DKR-DKR-2026-2404.2 (ayant droit 1)
 *                                → DKR-DKR-2026-2404.3 (ayant droit 2)
 *    - Thiès / Tasset / 2026     → TH-TS-2026-0001.1
 *    - Thiès / Mbour / 2026      → TH-MB-2026-0001.1
 *    - Saint-Louis / Podor       → SL-PD-2026-0001.1
 */

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const SENEGAL_REGIONS = [
  {
    code: 'DKR',
    name: 'Dakar',
    departments: [
      { code: 'DKR', name: 'Dakar', aliases: ['dakar', 'dakar plateau', 'plateau', 'medina', 'fann', 'point e', 'parcelles assainies', 'grand yoff', 'yoff', 'ngor', 'ouakam', 'mermoz', 'sacre coeur', 'sicap', 'liberte', 'hlm', 'grand dakar', 'biscuiterie', 'hann', 'bel air', 'cambarene', 'patte d oie', 'goree', 'gueule tapee', 'fass', 'colobane', 'msd dakar'] },
      { code: 'PK', name: 'Pikine', aliases: ['pikine', 'pikine ouest', 'pikine est', 'pikine nord', 'thiaroye', 'mbao', 'diamaguene', 'sicap mbao', 'yeumbeul', 'guinaaw rail', 'dalifort', 'djidah thiaroye kao'] },
      { code: 'GD', name: 'Guédiawaye', aliases: ['guediawaye', 'golf sud', 'sam notaire', 'ndiareme limamoulaye', 'wakhinane nimzatt', 'medina gounass'] },
      { code: 'RF', name: 'Rufisque', aliases: ['rufisque', 'rufisque est', 'rufisque ouest', 'rufisque nord', 'bargny', 'diamniadio', 'sebikotane', 'sangalkam', 'bambilor', 'sendou', 'tivaouane peulh', 'yene'] },
      { code: 'KM', name: 'Keur Massar', aliases: ['keur massar', 'keur massar nord', 'keur massar sud', 'malika', 'jaxaay', 'niacourab', 'yeumbeul nord', 'yeumbeul sud'] }
    ]
  },
  {
    code: 'TH',
    name: 'Thiès',
    departments: [
      { code: 'TH', name: 'Thiès', aliases: ['thies', 'thies nord', 'thies est', 'thies ouest', 'kayor', 'khour', 'khombole', 'pout', 'fandene', 'keur moussa', 'notto'] },
      { code: 'TS', name: 'Tasset', aliases: ['tasset', 'tassette', 'notto diobass', 'diobass'] },
      { code: 'MB', name: 'Mbour', aliases: ['mbour', 'saly', 'ngaparou', 'somone', 'joal', 'fadiouth', 'popenguine', 'nguekhokh', 'sindia', 'ngueniene', 'malicounda', 'thiadiaye', 'fissel', 'ndiaganiao', 'sandiara'] },
      { code: 'TV', name: 'Tivaouane', aliases: ['tivaouane', 'mekhe', 'mboro', 'meouane', 'niakhène', 'pambal', 'pire', 'taiba ndiaye', 'cherif lo', 'mont rolland'] }
    ]
  },
  {
    code: 'DB',
    name: 'Diourbel',
    departments: [
      { code: 'DB', name: 'Diourbel', aliases: ['diourbel', 'ndindy', 'ndoulo', 'tocky gare'] },
      { code: 'BB', name: 'Bambey', aliases: ['bambey', 'baba garage', 'lambaye', 'ngoye', 'refane'] },
      { code: 'MB', name: 'Mbacké', aliases: ['mbacke', 'touba', 'touba mosquee', 'kael', 'ndame', 'taif'] }
    ]
  },
  {
    code: 'SL',
    name: 'Saint-Louis',
    departments: [
      { code: 'SL', name: 'Saint-Louis', aliases: ['saint-louis', 'saint louis', 'ndar', 'mpal', 'gandon', 'fass ngom'] },
      { code: 'DG', name: 'Dagana', aliases: ['dagana', 'richard toll', 'richard-toll', 'rosso', 'ross bethio', 'ronkh', 'mban', 'gaé'] },
      { code: 'PD', name: 'Podor', aliases: ['podor', 'ndioum', 'gollere', 'guede', 'galoya', 'pété', 'thille boubacar', 'salde'] }
    ]
  },
  {
    code: 'KL',
    name: 'Kaolack',
    departments: [
      { code: 'KL', name: 'Kaolack', aliases: ['kaolack', 'kahone', 'gandiaye', 'ndoffane', 'sibassor', 'latmingue'] },
      { code: 'GG', name: 'Guinguinéo', aliases: ['guinguineo', 'mboss', 'ngathie naoude', 'fass'] },
      { code: 'NR', name: 'Nioro du Rip', aliases: ['nioro', 'nioro du rip', 'keur madiabel', 'wack ngouna', 'paoskoto', 'medina sabakh'] }
    ]
  },
  {
    code: 'FK',
    name: 'Fatick',
    departments: [
      { code: 'FK', name: 'Fatick', aliases: ['fatick', 'diakhao', 'fimela', 'niakhâr', 'niakhar', 'tattaguine', 'diofior'] },
      { code: 'FD', name: 'Foundiougne', aliases: ['foundiougne', 'sokone', 'passy', 'karantaba', 'toubacouta', 'djilor', 'nioro alassane tall'] },
      { code: 'GS', name: 'Gossas', aliases: ['gossas', 'colobane gossas', 'mbar', 'ouadiour'] }
    ]
  },
  {
    code: 'KF',
    name: 'Kaffrine',
    departments: [
      { code: 'KF', name: 'Kaffrine', aliases: ['kaffrine', 'nganda', 'kahi', 'gniby', 'katakel'] },
      { code: 'BK', name: 'Birkelane', aliases: ['birkelane', 'keur mboucki', 'mabo', 'ndiamalathiel'] },
      { code: 'KG', name: 'Koungheul', aliases: ['koungheul', 'ida mouride', 'lour escale', 'makka yop', 'missirah wadene'] },
      { code: 'MH', name: 'Malem Hodar', aliases: ['malem hodar', 'malem-hodar', 'darou minam', 'dianke souf', 'sagna'] }
    ]
  },
  {
    code: 'LG',
    name: 'Louga',
    departments: [
      { code: 'LG', name: 'Louga', aliases: ['louga', 'coki', 'keur momar sarr', 'mbédiène', 'sakal', 'ngueune sarr'] },
      { code: 'KB', name: 'Kébémer', aliases: ['kebemer', 'gueoul', 'darou mousty', 'ndande', 'sagatta gueth', 'thieppe'] },
      { code: 'LN', name: 'Linguère', aliases: ['linguere', 'dahra', 'barkedji', 'dodji', 'yang yang', 'mbeuleukhe'] }
    ]
  },
  {
    code: 'MT',
    name: 'Matam',
    departments: [
      { code: 'MT', name: 'Matam', aliases: ['matam', 'ourossogui', 'thilogne', 'nguidjilone', 'agnams', 'dabia'] },
      { code: 'KN', name: 'Kanel', aliases: ['kanel', 'semme', 'waounde', 'dembancane', 'hamady ounaire', 'orkadiere', 'sinthiou bamambe'] },
      { code: 'RN', name: 'Ranérou-Ferlo', aliases: ['ranerou', 'ranerou ferlo', 'velingara ferlo', 'oudalaye'] }
    ]
  },
  {
    code: 'TC',
    name: 'Tambacounda',
    departments: [
      { code: 'TC', name: 'Tambacounda', aliases: ['tambacounda', 'tamba', 'koussanar', 'makacoulibantang', 'missirah'] },
      { code: 'BK', name: 'Bakel', aliases: ['bakel', 'kidira', 'diawara', 'moudery', 'ballou', 'gathiary'] },
      { code: 'GD', name: 'Goudiry', aliases: ['goudiry', 'bala', 'boynguel bamba', 'dianke makha', 'kothiary'] },
      { code: 'KP', name: 'Koumpentoum', aliases: ['koumpentoum', 'bamba thialene', 'kahène', 'kouthiaba', 'malem niani', 'payar'] }
    ]
  },
  {
    code: 'KE',
    name: 'Kédougou',
    departments: [
      { code: 'KE', name: 'Kédougou', aliases: ['kedougou', 'bandafassi', 'dindefelo', 'fongolimbi', 'tomboronkoto'] },
      { code: 'SM', name: 'Salémata', aliases: ['salemata', 'dakately', 'dar salam', 'etholo', 'kevoli', 'ouboundji'] },
      { code: 'SR', name: 'Saraya', aliases: ['saraya', 'bembou', 'khossanto', 'missirah sirimana', 'sabodala'] }
    ]
  },
  {
    code: 'KD',
    name: 'Kolda',
    departments: [
      { code: 'KD', name: 'Kolda', aliases: ['kolda', 'dabo', 'salikegne', 'sare yoba diega', 'dioulacolon', 'mampatim'] },
      { code: 'VL', name: 'Vélingara', aliases: ['velingara', 'diaobe', 'kabendou', 'kounkane', 'linkering', 'pakour', 'bonconto'] },
      { code: 'MY', name: 'Médina Yoro Foulah', aliases: ['medina yoro foulah', 'myf', 'pata', 'ndorna', 'fafacourou', 'badion'] }
    ]
  },
  {
    code: 'SD',
    name: 'Sédhiou',
    departments: [
      { code: 'SD', name: 'Sédhiou', aliases: ['sedhiou', 'diannah malary', 'marsassoum', 'diendé', 'oudoucar'] },
      { code: 'BN', name: 'Bounkiling', aliases: ['bounkiling', 'madina wandifa', 'diaroume', 'boghal', 'tankon', 'ndiamacouta'] },
      { code: 'GD', name: 'Goudomp', aliases: ['goudomp', 'samine', 'tanaff', 'diattacounda', 'simbandi brassou', 'karantaba'] }
    ]
  },
  {
    code: 'ZG',
    name: 'Ziguinchor',
    departments: [
      { code: 'ZG', name: 'Ziguinchor', aliases: ['ziguinchor', 'niaguis', 'nyassia', 'enampore', 'boutoupa', 'adeane'] },
      { code: 'BG', name: 'Bignona', aliases: ['bignona', 'thionck essyl', 'diouloulou', 'kafountine', 'sindian', 'tanghory', 'tendouck'] },
      { code: 'OS', name: 'Oussouye', aliases: ['oussouye', 'cap skirring', 'cabrousse', 'diembering', 'mlomp', 'loudia ouoloff'] }
    ]
  }
];

/**
 * Résout les codes officiels { regionCode, departmentCode, regionName, departmentName }
 * à partir des champs libres (region, department, mutuelleName, address).
 * Correspondance la plus spécifique (alias le plus long) prioritaire.
 */
function resolveRegionDepartment({ region = '', department = '', mutuelleName = '', address = '' } = {}) {
  const haystack = normalizeText([department, mutuelleName, region, address].filter(Boolean).join(' '));

  let bestMatch = null;
  let bestScore = -1;

  for (const reg of SENEGAL_REGIONS) {
    const regNorm = normalizeText(reg.name);
    for (const dep of reg.departments) {
      const candidates = [dep.name, ...(dep.aliases || [])].map(normalizeText).filter(Boolean);
      for (const alias of candidates) {
        if (!alias) continue;
        // Correspondance mot entier ou expression entière
        const re = new RegExp(`(?:^|\\s|-)${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|\\s|-)`, 'i');
        if (re.test(haystack)) {
          // Bonus si l'alias correspond au département/mutuelle plutôt qu'au simple nom de région
          const isSpecific = alias !== regNorm;
          const score = alias.length + (isSpecific ? 20 : 0);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = {
              regionCode: reg.code,
              departmentCode: dep.code,
              regionName: reg.name,
              departmentName: dep.name
            };
          }
        }
      }
    }
  }

  if (bestMatch) return bestMatch;

  // Repli par défaut : Dakar / Dakar
  return {
    regionCode: 'DKR',
    departmentCode: 'DKR',
    regionName: 'Dakar',
    departmentName: 'Dakar'
  };
}

/**
 * Construit le matricule d'un ayant droit / pris en charge à partir du code
 * principal de l'adhérent (.1 → .2, .3, .4…).
 */
function buildDependentCmuNumber(principalCmuNumber, dependentPosition = 2) {
  const clean = String(principalCmuNumber || '').trim();
  const base = clean.replace(/\.\d+$/, '');
  const idx = Math.max(2, parseInt(dependentPosition, 10) || 2);
  return `${base}.${idx}`;
}

module.exports = {
  SENEGAL_REGIONS,
  resolveRegionDepartment,
  buildDependentCmuNumber,
  normalizeText
};
