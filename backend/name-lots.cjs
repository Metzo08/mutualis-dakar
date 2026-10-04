/**
 * ═══════════════════════════════════════════════════════════════════════
 *  NOMMER LES LOTS DE CAMPAGNE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * PROBLÈME
 * Les fiches importées portent un `lot_code` (LOT-2026-010, LOT-2026-011)
 * qui n'existait PAS dans `campaign_lots` : ces lots ont été créés par le
 * navigateur (localStorage) et la ligne serveur n'a jamais été écrite. Le
 * Studio affichait donc « LOT-2026-010 — 137 dossier(s) », sans jamais indiquer
 * la SOURCE : impossible de distinguer Ville de Dakar d'ASS LONASE, donc
 * impossible de choisir en connaissance de cause le lot à vider.
 *
 * CE QUE FAIT CE SCRIPT
 *  1. crée une ligne de lot manquante, étiquetée d'après la composition
 *     RÉELLE de ses fiches (comparées aux classeurs Excel) ;
 *  2. supprime les lots sans aucune fiche.
 *
 * AUCUNE FICHE N'EST MODIFIÉE : seuls des étiquettes sont créées ou
 * supprimées. La composition de chaque lot est déduite des classeurs, jamais
 * supposée. Sauvegarde systématique avant écriture.
 *
 * Usage :
 *   node backend/name-lots.cjs            (simulation)
 *   node backend/name-lots.cjs --apply    (écriture)
 */
const fs = require('fs');
const path = require('path');
// Le .env vit dans backend/ : sans chemin explicite, un lancement depuis la
// racine du dépôt ne le trouve pas et la connexion part avec des identifiants
// vides (« authentification par mot de passe échouée »).
require('dotenv').config({ path: path.join(__dirname, '.env') });
const XLSX = require('xlsx');
const { query, pool } = require('./db');

const APPLY = process.argv.includes('--apply');
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();
const norm = (s) => clean(s).toUpperCase().replace(/[^A-Z]/g, '');

/** Codes d'un classeur, en majuscules. */
const codesOf = (file) => {
  const wb = XLSX.readFile(file, { cellDates: true });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
    .filter((r) => clean(r.CODE_BENEFICIAIRE))
    .map((r) => clean(r.CODE_BENEFICIAIRE).toUpperCase());
};

/** Noms « prenom NOM » d'un classeur, pour reconnaître une personne. */
const namesOf = (file) => {
  const wb = XLSX.readFile(file, { cellDates: true });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
    .map((r) => `${norm(r.PRENOM_BENEFICIAIRE)}|${norm(r.NOM_BENEFICIAIRE)}`)
    .filter((k) => k.replace(/\|/g, ''));
};

const SOURCES = [
  { label: 'Ville de Dakar (AMEVI.xlsx)', file: 'c:/Users/hp/Downloads/AMEVI.xlsx' },
  { label: 'ASS LONASE (ASS LONASE.xlsx)', file: 'c:/Users/hp/Downloads/ASS LONASE.xlsx' },
  { label: 'MSD de Grand Yoff.xlsx', file: 'c:/Users/hp/Downloads/MSD  de Grand Yoff.xlsx' },
];
(async () => {
  try {
    // ── 1. Lecture de l'état actuel ─────────────────────────────────────────
    const { rows: fiches } = await query(
      `select id, cmu_number, first_name, last_name, lot_code
         from beneficiaries where lot_code is not null`
    );
    const { rows: lots } = await query(
      'select code, label, source_file, card_count from campaign_lots order by code'
    );

    const refs = SOURCES.map((s) => ({
      ...s,
      codes: new Set(codesOf(s.file)),
      names: new Set(namesOf(s.file)),
    }));

    /** Source dominante d'un lot, reconnue par identité (nom + prénom). */
    const diagnoseLot = (code) => {
      const inLot = fiches.filter((f) => clean(f.lot_code) === code);
      const parSource = new Map();
      inLot.forEach((f) => {
        const k = `${norm(f.first_name)}|${norm(f.last_name)}`;
        const hit = refs.find((r) => r.names.has(k));
        const src = hit ? hit.label : null;
        parSource.set(src, (parSource.get(src) || 0) + 1);
      });
      const best = [...parSource.entries()].sort((a, b) => b[1] - a[1])[0];
      return { total: inLot.length, parSource, dominante: best };
    };

    console.log('=== ETAT ACTUEL ===');
    console.log(`  fiches rattachees a un lot : ${fiches.length}`);
    console.log(`  lots en base             : ${lots.length}`);
    lots.forEach((l) => {
      const d = diagnoseLot(clean(l.code));
      console.log(`  ${clean(l.code)}  label="${clean(l.label) || '(VIDE)'}"  fiches=${d.total}`);
    });

    /** Etiquette derivee de la composition reelle du lot. */
    const etiquette = (code, d) => {
      const src = d.dominante && d.dominante[0] ? d.dominante[0] : null;
      const nom = src ? src.replace(/\s*\(.*\)$/, '') : 'Source inconnue';
      return {
        code,
        label: src ? `${nom} — ${d.total} fiches` : `Lot ${code} — ${d.total} fiches`,
        sourceFile: nom,
        total: d.total,
        parSource: d.parSource,
      };
    };
// ── 2. Plan ────────────────────────────────────────────────────────────
    const aCreer = [];
    const aSupprimer = [];
    const dejaNommes = new Set();

    for (const l of lots) {
      const code = clean(l.code);
      const d = diagnoseLot(code);
      if (d.total === 0) {
        aSupprimer.push({ code, label: clean(l.label) });
        continue;
      }
      const label = clean(l.label);
      // Un libelle generique (« Campagne d'enrolement 2026 n° N ») ne dit rien
      // sur la provenance : il est remplace par le nom reel de la source.
      if (!label || /^Campagne d'enr/i.test(label)) {
        aCreer.push(etiquette(code, d));
      } else {
        dejaNommes.add(`${code} = ${label}`);
      }
    }

    // Fiches portant un lot absent de campaign_lots : c'est le cas ici.
    const codesBase = new Set(lots.map((l) => clean(l.code)));
    const lotsOrphelins = [...new Set(fiches.map((f) => clean(f.lot_code)).filter((c) => !codesBase.has(c)))];
    lotsOrphelins.forEach((code) => aCreer.push(etiquette(code, diagnoseLot(code))));

    if (dejaNommes.size) {
      console.log('\n=== LOTS DEJA NOMMES (inchanges) ===');
      [...dejaNommes].forEach((s) => console.log(`  ${s}`));
    }

    console.log('\n=== LOTS A NOMMER (etats de fait) ===');
    if (aCreer.length === 0) console.log('  (aucun)');
    aCreer.forEach((c) => {
      console.log(`  ${c.code} -> "${c.label}"  (${c.total} fiches)`);
      [...c.parSource.entries()].sort((a, b) => b[1] - a[1])
        .forEach(([src, n]) => console.log(`        ${String(src || 'inconnue').padEnd(34)} ${n}`));
    });

    console.log('\n=== LOTS VIDES A SUPPRIMER ===');
    if (aSupprimer.length === 0) console.log('  (aucun)');
    aSupprimer.forEach((s) => console.log(`  ${s.code}  "${s.label}"  (0 fiche)`));

    if (!APPLY) {
      console.log('\nSIMULATION — aucune ecriture. Relancez avec --apply.');
      await pool.end();
      return;
    }
// ── 3. Sauvegarde AVANT toute ecriture ─────────────────────────────────
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `lots-${stamp}.json`);
    const { rows: toutes } = await query(
      `select id, cmu_number, first_name, last_name, lot_code,
              (photo_url is not null and photo_url <> '') as avec_photo
         from beneficiaries order by cmu_number`
    );
    fs.writeFileSync(backupFile, JSON.stringify({
      genere_le: new Date().toISOString(),
      campaign_lots: lots,
      beneficiaries: toutes,
      a_creer: aCreer,
      a_supprimer: aSupprimer,
    }, null, 2));
    console.log(`\nSauvegarde : ${backupFile}`);

    // ── 4. Ecriture, dans une transaction ───────────────────────────────────
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const s of aSupprimer) {
        // Filet de securite : on ne supprime JAMAIS un lot qui aurait des
        // fiches. Une apparition dans l'intervalle rendrait l'effacement
        // partiel et irreversible.
        const { rows: chk } = await client.query(
          'select count(*)::int as n from beneficiaries where lot_code = $1', [s.code]
        );
        if (chk[0].n > 0) {
          throw new Error(`Refus de supprimer ${s.code} : ${chk[0].n} fiche(s) presente(s).`);
        }
        await client.query('delete from campaign_lots where code = $1', [s.code]);
        console.log(`  supprime : ${s.code} (lot vide)`);
      }

      for (const c of aCreer) {
        await client.query(
          `insert into campaign_lots (code, label, source_file, union_id, card_count)
           values ($1, $2, $3, 'DKR', $4)
           on conflict (code) do update
             set label = excluded.label,
                 source_file = excluded.source_file,
                 card_count = excluded.card_count`,
          [c.code, c.label, c.sourceFile, c.total]
        );
        console.log(`  nomme    : ${c.code} = "${c.label}"`);
      }

      await client.query(
        `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
        ['NOMMER_LOTS', 'name-lots',
          `${aCreer.length} lot(s) nommé(s), ${aSupprimer.length} lot(s) vide(s) supprimé(s). ` +
          aCreer.map((c) => `${c.code}=${c.label}`).join(' ; ')]
      );

      await client.query('COMMIT');
      console.log('\nTermine.');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    await pool.end();
  } catch (e) {
    console.error('ERREUR :', e.message);
    try { await pool.end(); } catch { /* ignore */ }
    process.exit(1);
  }
})();