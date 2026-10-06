// Test des profils cliniques : vérifie que le rôle détermine bien le profil
// et que la borne de responsabilité fonctionne (un infirmier ne peut pas
// obtenir le profil médecin).
const { resolveProfile, buildSystemPrompt, isClinicalRole } = require('./clinicalAi');

const cases = [
  { role: 'doctor',      requested: null,     expected: 'doctor' },
  { role: 'doctor',      requested: 'nurse',  expected: 'nurse'  },
  { role: 'médecin',     requested: 'doctor', expected: 'doctor' },
  { role: 'infirmier',   requested: 'doctor', expected: 'nurse'  },
  { role: 'infirmier',   requested: null,     expected: 'nurse'  },
  { role: 'sage-femme',  requested: 'doctor', expected: 'nurse'  },
  { role: 'midwife',     requested: 'doctor', expected: 'nurse'  },
  { role: 'agent',       requested: 'doctor', expected: 'nurse'  },
  { role: 'admin',       requested: 'nurse',  expected: 'nurse'  },
  { role: 'Super Admin', requested: 'doctor', expected: 'nurse'  }
];

let pass = 0;
for (const c of cases) {
  const got = resolveProfile(c.role, c.requested);
  const ok = got === c.expected;
  if (ok) pass++;
  console.log(`${ok ? 'OK  ' : 'ECHEC'} role=${c.role.padEnd(12)} demandé=${String(c.requested || '—').padEnd(7)} → ${got}${ok ? '' : ` (attendu ${c.expected})`}`);
}

// Les deux prompts contiennent leurs sections caractéristiques.
const docPrompt = buildSystemPrompt('doctor', 'CTX');
const nursePrompt = buildSystemPrompt('nurse', 'CTX');
const docOk = docPrompt.includes('HYPOTHESES A CONSIDERER') && docPrompt.includes('MÉDECIN');
const nurseOk = nursePrompt.includes("NIVEAU D'URGENCE") && nursePrompt.includes('ORIENTATION RECOMMANDEE') && !nursePrompt.includes('HYPOTHESES');
console.log(`${docOk ? 'OK  ' : 'ECHEC'} prompt médecin : différentiel présent`);
console.log(`${nurseOk ? 'OK  ' : 'ECHEC'} prompt infirmier : triage/orientation, AUCUNE section hypothèses`);

console.log(`\n${pass}/${cases.length} résolutions de profil correctes`);
process.exit(pass === cases.length && docOk && nurseOk ? 0 : 1);
