/* ═══════════════
   INSERTION DES 57 FICHES DKR_2600* MANQUANTES (classeur AMEVI.xlsx)
   ═══════════════
   Modèle : réparation Grand Yoff (reparer-yoff.cjs) validée.
   Précautions :
   - prend les codes du CLASSEUR (cartes déjà imprimées) ;
   - vérifie AVANT insertion que le code n'existe pas (actif ou fusionné) ;
   - copie le modèle de fiche lot 030 (mutuelle, msd_code, package_type...) ;
   - à défaut de modèle : valeurs par défaut sûres (mutuelle MSD Dakar, msd DKR) ;
   - photo rattachée immédiatement si un fichier AMEVI porte exactement le
     prénom+nom (distance 0), sinon pas de photo (jamais de photo incertaine) ;
   - 1 transaction, refus si un seul insert échoue.
   ═══════════════ */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { query, pool } = require('./db');

const ROOT = path.join(__dirname, '..');
const EXCEL = path.join(ROOT, 'MSD DAKAR', 'AMEVI.xlsx');
const DIR = path.join(ROOT, 'Photos AMEVI ville de Dakar');
const LOT = 'LOT-2026-030';

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const key = (s) => norm(s).replace(/ /g, '');
const isoOf = (d) => {
  if (!d) return '';
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const m = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : String(d).slice(0, 10);
};
const isImg = (f) => /\.(jpe?g|png|webp|gif|bmp)$/i.test(f);

// Photo encodée base64 avec compression légère si module dispo, sinon data-url brut.
// Réutilise l'encodeur du projet si présent.
let encodePhoto = null;
try { encodePhoto = require('./photo-encode.cjs'); } catch (e) { /* fallback ci-dessous */ }

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Modèle de fiche lot 030 (pour cohérence des colonnes non remplies)
    const mod = await client.query(
      `SELECT * FROM beneficiaries WHERE lot_code=$1 AND merged_into IS NULL LIMIT 1`, [LOT]
    );
    const modele = mod.rows[0] || {};
    console.log('Modèle lot 030 :', modele.cmu_number, '| msd=', modele.msd_code, '| mutuelle=', modele.mutuelle_name);

    // ── Classeur : 57 fiches manquantes ─────────────────────────────────
    const wb = XLSX.readFile(EXCEL, { cellDates: true });
    const lignes = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      .filter((r) => /^DKR_\d+/.test(clean(r.CODE_BENEFICIAIRE).toUpperCase()));

    const dejaEnBase = new Set(
      (await client.query(`SELECT upper(btrim(cmu_number)) c FROM beneficiaries WHERE cmu_number LIKE 'DKR\\_2600%'`))
        .rows.map((r) => r.c)
    );

    const manquantes = [];
    for (const r of lignes) {
      const code = clean(r.CODE_BENEFICIAIRE).toUpperCase();
      if (dejaEnBase.has(code)) continue;
      manquantes.push(r);
    }
    console.log(`Fiches à insérer : ${manquantes.length}`);
    if (manquantes.length === 0) { await client.query('COMMIT'); console.log('Rien à faire.'); return; }

    // ── Index photos : identité exacte → fichier (distance 0 uniquement) ─
    const photos = new Map(); // clé identité → fichier
    for (const f of fs.readdirSync(DIR).filter(isImg).sort()) {
      const base = f.replace(/\.[^.]+$/, '');
      const idPart = base.replace(/^\s*\d+\.\d+\s+/, '').split(/ né | née |Ne le|Née le/i)[0];
      const k = key(idPart);
      if (!photos.has(k)) photos.set(k, f); // premier arrivé = ordre alphabétique stable
    }

    // ── Insertions ──────────────────────────────────────────────────────
    let inseres = 0, avecPhoto = 0;
    for (const r of manquantes) {
      const code = clean(r.CODE_BENEFICIAIRE).toUpperCase();
      // Ce classeur place TOUS les prénoms (multi-mots) dans PRENOM_BENEFICIAIRE
      // et le nom dans NOM_BENEFICIAIRE (vérifié par test-decoupage-vdd.cjs).
      // Découper sur le dernier token tronquait « ABDOUL AZIZ DABAKH » etc.
      const firstName = clean(r.PRENOM_BENEFICIAIRE) || 'Inconnu';
      const lastNameFinal = clean(r.NOM_BENEFICIAIRE) || 'Inconnu';
      const birth = isoOf(r.DATE_NAISSANCE);
      const birthPlace = clean(r.LIEU_NAISSANCE);
      const phone = clean(r.CONTACT);
      const nin = clean(r.NIN);
      const address = clean(r.ADRESSE);
      const gender = clean(r.SEXE).toUpperCase().startsWith('F') ? 'F' : 'M';
      const bloodGroup = clean(r.GROUPE_SANGUIN) || 'O+';
      // Formule : celle du modèle de fiche du lot (cohérence avec le ménage).
      const packageType = modele.package_type || 'familial';
      const mutuelle = clean(r["MUTUELLE_D'ORIGINE"]) || 'MSD Dakar';

      const photoFile = photos.get(key(`${firstName} ${lastNameFinal}`)) || null;

      // Encodage photo si dispo
      let dataUrl = null;
      if (photoFile && encodePhoto && typeof encodePhoto.encodeWithBudget === 'function') {
        const state = { budgetRestant: 2 * 1024 * 1024, step: 0, bytes: 0 };
        dataUrl = await encodePhoto.encodeWithBudget(path.join(DIR, photoFile), state).catch(() => null);
      } else if (photoFile) {
        const buf = fs.readFileSync(path.join(DIR, photoFile));
        dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
      }
      if (dataUrl) avecPhoto++;

      await client.query(
        `INSERT INTO beneficiaries
          (first_name, last_name, birth_date, birth_place, phone, email, address,
           mutuelle_name, department, msd_code, package_type, payment_method, status,
           cmu_number, source_code, numero_adherent, nin, gender, blood_group,
           lot_code, photo_url, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active',$13,$13,$14,$15,$16,$17,$18,$19,NOW())`,
        [
          firstName || 'Inconnu', lastNameFinal || 'Inconnu',
          birth || '1970-01-01', birthPlace || '', phone || '', '', address || '',
          mutuelle, 'Dakar', modele.msd_code || 'DKR',
          packageType,
          'excel_import',
          code, clean(r.NUMERO_ADHERENT), /^\d+$/.test(nin) ? nin : null,
          gender, bloodGroup, LOT, dataUrl
        ]
      );
      inseres++;
      console.log(`  + ${code}  ${firstName} ${lastNameFinal} né=${birth} photo=${photoFile ? 'OUI' : 'non'}`);
    }

    await client.query('COMMIT');
    console.log(`\n✅ ${inseres} fiches insérées, ${avecPhoto} avec photo.`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ROLLBACK — aucune écriture :', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
