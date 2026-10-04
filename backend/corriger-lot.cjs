/**
 * ═══════════════════════════════════════════════════════════════════════
 *  CORRIGER LE RANGEMENT D'UNE FICHE MAL PLACÉE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * CAS CONSTATÉ
 * `DKR_2600040.1` (PAPA IBRAHIMA SEYE) est une personne ASS LONASE — son code,
 * sa date de naissance, son téléphone et son lieu concordent avec la ligne du
 * classeur — mais la fiche portait le lot Ville de Dakar. Conséquence : vider le
 * lot ASS LONASE l'aurait laissée sur l'autre lot, et sa photo
 * « DKR_2600040.1 PAPA IBRAHIMA SEYE.jpeg » aurait été appliquée à une fiche
 * Ville de Dakar.
 *
 * CE QUE FAIT CE SCRIPT
 * Uniquement un `UPDATE` de `lot_code`. Le code, l'identité, la photo et les
 * autres champs sont INTACTS : on change le rangement, pas la personne.
 *
 * GARDE-FOUS
 *  - l'identité est revérifiée dans le script avant d'écrire (code + naissance
 *    + téléphone), et l'opération est refusée si elle ne se confirme pas ;
 *  - la fiche doit être présente dans le lot source, et absente du lot cible ;
 *  - sauvegarde JSON complète avant écriture, transaction, journal d'audit.
 *
 * Usage :
 *   node backend/corriger-lot.cjs          (simulation)
 *   node backend/corriger-lot.cjs --apply  (écriture)
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const XLSX = require('xlsx');
const { query, pool } = require('./db');

const APPLY = process.argv.includes('--apply');
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');

/** La fiche àcorriger, et le lot où elle doit réellement se trouver. */
const CIBLE = {
  code: 'DKR_2600040.1',
  lotActuel: 'LOT-2026-010',   // Ville de Dakar
  lotVoulu: 'LOT-2026-011',    // ASS LONASE
  classeur: 'c:/Users/hp/Downloads/ASS LONASE.xlsx',
};

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();
const norm = (s) => clean(s).toUpperCase().replace(/[^A-Z0-9]/g, '');

(async () => {
  try {
    const { rows: fiches } = await query(
      `select id, cmu_number, first_name, last_name, lot_code, nin, phone, birth_date, birth_place,
              (photo_url is not null and photo_url <> '') as avec_photo
         from beneficiaries where upper(btrim(cmu_number)) = $1`,
      [CIBLE.code]
    );
    if (fiches.length === 0) {
      throw new Error(`Fiche ${CIBLE.code} introuvable : rien à corriger.`);
    }
    if (fiches.length > 1) {
      throw new Error(`${fiches.length} fiches portent le code ${CIBLE.code} : correction refusée.`);
    }
    const f = fiches[0];

    console.log('=== FICHE CONCERNEE ===');
    console.log(`  ${clean(f.cmu_number)}  ${clean(f.first_name)} ${clean(f.last_name)}`);
    console.log(`  lot actuel : ${clean(f.lot_code)}`);
    console.log(`  lot voulu  : ${CIBLE.lotVoulu}`);
    console.log(`  naissance  : ${clean(f.birth_date)}`);
    console.log(`  tel        : ${clean(f.phone) || '-'}`);
    console.log(`  nin        : ${clean(f.nin) || '-'}`);

    // ── Garde-fou 1 : la fiche est-elle bien dans le lot annoncé ? ──────────
    if (clean(f.lot_code) !== CIBLE.lotActuel) {
      throw new Error(`Refus : la fiche est dans ${clean(f.lot_code)} et non ${CIBLE.lotActuel}. ` +
        'Le contexte a changé : verifier avant de deplacer.');
    }

    // ── Garde-fou 2 : la cible existe et n'accueille pas deja ce code ───────
    const { rows: cible } = await query(
      'select code, label from campaign_lots where code = $1', [CIBLE.lotVoulu]
    );
    if (cible.length === 0) throw new Error(`Le lot cible ${CIBLE.lotVoulu} n'existe pas.`);
    console.log(`  lot cible  : ${cible[0].label || cible[0].code}`);

    const { rows: deja } = await query(
      'select count(*)::int as n from beneficiaries where lot_code = $1 and upper(btrim(cmu_number)) = $2',
      [CIBLE.lotVoulu, CIBLE.code]
    );
    if (deja[0].n > 0) throw new Error('La fiche est deja dans le lot cible : rien a faire.');

    // ── Garde-fou 3 : l'identite est-elle confirmee par le classeur ? ──────
    const wb = XLSX.readFile(CIBLE.classeur, { cellDates: true });
    const lignes = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      .filter((r) => clean(r.CODE_BENEFICIAIRE).toUpperCase() === CIBLE.code);

    console.log('\n=== VERIFICATION D\'IDENTITE (classeur ASS LONASE) ===');
    if (lignes.length === 0) {
      throw new Error(`Le code ${CIBLE.code} est absent du classeur : correction refusee.`);
    }
    const l = lignes[0];
    const naissanceFichier = l.DATE_NAISSANCE instanceof Date
      ? l.DATE_NAISSANCE.toISOString().slice(0, 10)
      : clean(l.DATE_NAISSANCE).slice(0, 10);
    const telFichier = norm(l.CONTACT);
    const telBase = norm(f.phone);
    const naissanceBase = clean(f.birth_date);

    console.log(`  fichier : code=${clean(l.CODE_BENEFICIAIRE)} naissance=${naissanceFichier} tel=${clean(l.CONTACT) || '-'}`);
    console.log(`  base    : code=${clean(f.cmu_number)} naissance=${naissanceBase} tel=${clean(f.phone) || '-'}`);

    const naissOK = !naissanceFichier || !naissanceBase || naissanceFichier === naissanceBase;
    const telOK = !telFichier || !telBase || telFichier === telBase;
    console.log(`  naissance concordante : ${naissOK ? 'OUI' : 'NON'}`);
    console.log(`  telephone concordant : ${telOK ? 'OUI' : 'NON'}`);

    if (!naissOK || !telOK) {
      throw new Error('Identite non confirmee : correction refusee (deux personnes distinctes).');
    }
    console.log('\n  Identite confirmee : c est bien la meme personne.');

    if (!APPLY) {
      console.log('\nSIMULATION — aucune ecriture. Relancez avec --apply.');
      await pool.end();
      return;
    }
// ── Sauvegarde, puis écriture ──────────────────────────────────────────
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `fiche-${CIBLE.code}-${stamp}.json`);
    const { rows: complet } = await query(
      `select id, cmu_number, first_name, last_name, lot_code, nin, phone, birth_date, birth_place,
              (photo_url is not null and photo_url <> '') as avec_photo
         from beneficiaries order by cmu_number`
    );
    fs.writeFileSync(backupFile, JSON.stringify({
      genere_le: new Date().toISOString(),
      motif: `Deplacement de ${CIBLE.code} de ${CIBLE.lotActuel} vers ${CIBLE.lotVoulu}`,
      avant: f,
      beneficiaries: complet,
    }, null, 2));
    console.log(`\nSauvegarde : ${backupFile}`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // La condition sur le lot source rend l'opération idempotente : rejouer
      // le script ne déplace pas deux fois la fiche.
      const { rowCount } = await client.query(
        `update beneficiaries set lot_code = $1
          where id = $2 and lot_code = $3`,
        [CIBLE.lotVoulu, f.id, CIBLE.lotActuel]
      );
      if (rowCount !== 1) {
        throw new Error(`Mise a jour inattendue (${rowCount} ligne(s)) : annulation.`);
      }

      // Le compteur du lot doit refléter la nouvelle répartition.
      await client.query(
        `update campaign_lots set card_count = (
           select count(*) from beneficiaries b where b.lot_code = campaign_lots.code
         ) where code in ($1, $2)`,
        [CIBLE.lotActuel, CIBLE.lotVoulu]
      );

      await client.query(
        `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
        ['CORRECTION_LOT', 'corriger-lot',
          `${clean(f.cmu_number)} (${clean(f.first_name)} ${clean(f.last_name)}) deplace de ` +
          `${CIBLE.lotActuel} vers ${CIBLE.lotVoulu} — identite confirmee par le classeur ` +
          `(naissance et telephone concordants).`]
      );

      await client.query('COMMIT');
      console.log(`  deplace : ${CIBLE.code} ${CIBLE.lotActuel} -> ${CIBLE.lotVoulu}`);
      console.log('\nTermine.');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // ── Contrôle final : état après écriture ───────────────────────────────
    const { rows: apres } = await query(
      `select b.cmu_number, b.lot_code, l.label
         from beneficiaries b left join campaign_lots l on l.code = b.lot_code
        where b.id = $1`,
      [f.id]
    );
    console.log('\n=== APRES ===');
    console.log(`  ${apres[0].cmu_number} -> ${apres[0].lot_code} (${apres[0].label || 'sans libelle'})`);

    await pool.end();
  } catch (e) {
    console.error('\n' + e.message);
    try { await pool.end(); } catch { /* ignore */ }
    process.exit(1);
  }
})();