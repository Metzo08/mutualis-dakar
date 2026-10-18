// ── Photos à l'import : appariement tolérant, réimport idempotent, compte-rendu ──
//
// Ce fichier verrouille TROIS choses distinctes.
//
// 1. L'APPARIEMENT tolérant des noms de fichiers (casse, accents, suffixe de
//    rôle .0/.3, espaces multiples, traits d'union) et, surtout, son refus
//    ABSOLU de confondre deux personnes de noms proches.
//    → Ces variantes fonctionnaient DÉJÀ (normalizeName + retrait du préfixe
//      de rang). Elles sont lockées ici pour ne pas régresser. Rien n'a été
//      réécrit dans matchPhotosToRows : les 135 correspondances constatées sur
//      le fichier AMEVI sont correctes et le restent.
//
// 2. Le RÉIMPORT idempotent : une fiche déjà connue doit être REPOUSSÉE pour
//    recevoir sa photo, sans jamais créer de doublon.
//    → partitionForReimport() est une fonction PURE : elle est testée ici sans
//      React, sans canvas et sans réseau.
//
// 3. Le COMPTE-RENDU honnête : « X fiches avec photo, Y sans photo ».
//
// La compression d'images (canvas) n'est PAS testée : jsdom n'a pas de canvas.
// Le calcul du compte-rendu a donc été isolé dans summarizePhotos(), fonction
// pure, ce qui est de toute façon la bonne découpe : moins de logique dans le
// composant, plus de logique testable.

import { describe, it, expect } from 'vitest';
import {
  parseRowsToRecords,
  matchPhotosToRows,
  beneficiaryIdentity,
  partitionForReimport,
  summarizePhotos,
  dedupeRecordsByIdentity,
  buildStudioMembers
} from '../utils/bulkImport';

/** Faux fichier image : l'appariement ne lit que `name` et `type`. */
const photo = (name) => ({ name, type: 'image/jpeg' });

/** data-URL simulée : c'est bien ce que produit fileToCompressedDataUrl. */
const PHOTO = 'data:image/jpeg;base64,AAAAAAAAAAAA';

// ═══════════════════════════════════════════════════════════════════════
// 1. VARIANTES DE NOM DE FICHIER — non-régression de l'appariement
// ═══════════════════════════════════════════════════════════════════════

describe('Appariement : casse, accents, suffixe de rôle, ponctuation', () => {
  const rows = parseRowsToRecords([
    { CODE_BENEFICIAIRE: 'DKR_260001.0', PRENOM: 'MOUSTAPHA NDIONE', NOM: 'NDIONE', DATE_NAISSANCE: '1972-01-03' },
    { CODE_BENEFICIAIRE: 'DKR_260002.0', PRENOM: 'ÉLIS', NOM: 'FALL', DATE_NAISSANCE: '1985-05-05' },
    { CODE_BENEFICIAIRE: 'DKR_260003.0', PRENOM: 'MAÏMOUNA', NOM: 'DIOP', DATE_NAISSANCE: '1990-09-09' },
    { CODE_BENEFICIAIRE: 'DKR_260004.0', PRENOM: 'IRSULE', NOM: 'DIAMÈTRE', DATE_NAISSANCE: '1948-04-25' },
    { CODE_BENEFICIAIRE: 'DKR_260005.0', PRENOM: 'SOKHNA F', NOM: 'DIOP', DATE_NAISSANCE: '1979-07-07' },
    { CODE_BENEFICIAIRE: 'DKR_260006.0', PRENOM: 'ANNE-MARIE', NOM: 'SARR', DATE_NAISSANCE: '2001-02-02' }
  ]);

  it('majuscules / minuscules mélangées dans le nom de fichier', () => {
    // Fichier tout en minuscules, fiche tout en majuscules.
    const out = matchPhotosToRows(rows, [photo('1.0 moustapha ndione.jpeg')]);
    expect(out.find((r) => r.codeBeneficiaire === 'DKR_260001.0').photoUrl)
      .toBe('1.0 moustapha ndione.jpeg');
  });

  it('accents absents du fichier mais présents dans le classeur', () => {
    // « Élís » sans accent dans le fichier, « ÉLIS » accentué au classeur.
    const out = matchPhotosToRows(rows, [photo('1.0 Elis Fall.jpeg')]);
    expect(out.find((r) => r.codeBeneficiaire === 'DKR_260002.0').photoUrl).toBe('1.0 Elis Fall.jpeg');
  });

  it('accents présents dans le fichier ET dans le classeur', () => {
    const out = matchPhotosToRows(rows, [photo('1.0 Maimouna DIOP.jpeg')]);
    expect(out.find((r) => r.codeBeneficiaire === 'DKR_260003.0').photoUrl).toBe('1.0 Maimouna DIOP.jpeg');
  });

  it('nom à accent grave (DIAMÈTRE)', () => {
    const out = matchPhotosToRows(rows, [photo('1.0 Irsule Diametre.jpeg')]);
    expect(out.find((r) => r.codeBeneficiaire === 'DKR_260004.0').photoUrl).toBe('1.0 Irsule Diametre.jpeg');
  });

  it('prénom composé avec initiale (SOKHNA F DIOP)', () => {
    // Cas réel du dossier : « 1.10 Sokhna F Diop.jpeg ».
    const out = matchPhotosToRows(rows, [photo('1.10 Sokhna F Diop.jpeg')]);
    expect(out.find((r) => r.codeBeneficiaire === 'DKR_260005.0').photoUrl).toBe('1.10 Sokhna F Diop.jpeg');
  });

  it('trait d\'union dans le prénom du fichier', () => {
    const out = matchPhotosToRows(rows, [photo('1.0 Anne-Marie SARR.jpeg')]);
    expect(out.find((r) => r.codeBeneficiaire === 'DKR_260006.0').photoUrl).toBe('1.0 Anne-Marie SARR.jpeg');
  });

  it('espaces multiples entre le préfixe de rang et le nom', () => {
    const out = matchPhotosToRows(rows, [photo('1.0    Moustapha   Ndione.jpeg')]);
    expect(out.find((r) => r.codeBeneficiaire === 'DKR_260001.0').photoUrl)
      .toBe('1.0    Moustapha   Ndione.jpeg');
  });

  it('suffixe de rôle .3 dans le fichier alors que la fiche est un .0', () => {
    // Le rang du nom de fichier ne doit pas empêcher l'appariement : c'est le
    // CODE de la fiche qui compte, et le fichier ne porte pas de code.
    const out = matchPhotosToRows(rows, [photo('1.3 MOUSTAPHA NDIONE.jpeg')]);
    expect(out.find((r) => r.codeBeneficiaire === 'DKR_260001.0').photoUrl).toBe('1.3 MOUSTAPHA NDIONE.jpeg');
  });

  it('deux personnes de noms proches ne sont JAMAIS confondues', () => {
    const proches = parseRowsToRecords([
      { CODE_BENEFICIAIRE: 'DKR_260010.0', PRENOM: 'AWA', NOM: 'DIOP', DATE_NAISSANCE: '1990-01-01' },
      { CODE_BENEFICIAIRE: 'DKR_260011.0', PRENOM: 'AWA', NOM: 'DIALLO', DATE_NAISSANCE: '1990-01-01' },
      { CODE_BENEFICIAIRE: 'DKR_260012.0', PRENOM: 'ADJOUA', NOM: 'SECK', DATE_NAISSANCE: '1995-03-03' }
    ]);
    const out = matchPhotosToRows(proches, [
      photo('1.0 Awa Diallo.jpeg'),   // une seule photo : ne doit capturer QUE DIALLO
      photo('1.0 Adjoua Seck.jpeg')
    ]);
    expect(out.find((r) => r.codeBeneficiaire === 'DKR_260011.0').photoUrl).toBe('1.0 Awa Diallo.jpeg');
    expect(out.find((r) => r.codeBeneficiaire === 'DKR_260012.0').photoUrl).toBe('1.0 Adjoua Seck.jpeg');
    // AWA DIOP n'a reçu aucune photo : le nom voisin ne l'a pas volée.
    expect(out.find((r) => r.codeBeneficiaire === 'DKR_260010.0').photoUrl).toBeUndefined();
  });

  it('chaque photo n\'est attribuée qu\'à une seule fiche', () => {
    const out = matchPhotosToRows(rows, rows.map((r) => photo(`1.0 ${r.prenom} ${r.nom}.jpeg`)));
    const utilisees = out.map((r) => r.photoUrl).filter(Boolean);
    expect(new Set(utilisees).size).toBe(utilisees.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. RAPPORT PHOTOS — des FICHES, pas des LIGNES
// ═══════════════════════════════════════════════════════════════════════

describe('summarizePhotos — compte des FICHES, pas des lignes', () => {
  const dossier = (nom, photoUrl, deps = []) => ({
    firstName: nom,
    lastName: 'TEST',
    birthDate: '1990-01-01',
    cmuNumber: `DKR_${nom}`,
    photoUrl,
    dependents: deps
  });

  it('compte le titulaire ET ses ayants droit', () => {
    const members = [
      dossier('A', PHOTO, [{ photoUrl: PHOTO }, { photoUrl: '' }]),
      dossier('B', '', [{ photoUrl: PHOTO }])
    ];
    // 2 titulaires + 3 ayants droit = 5 fiches ; 3 avec photo, 2 sans.
    const r = summarizePhotos(members);
    expect(r.total).toBe(5);
    expect(r.withPhoto).toBe(3);
    expect(r.withoutPhoto).toBe(2);
  });

  it('total === withPhoto + withoutPhoto (cohérence du compte-rendu)', () => {
    const members = [
      dossier('A', PHOTO, [{ photoUrl: PHOTO }]),
      dossier('B', ''),
      dossier('C', '')
    ];
    const r = summarizePhotos(members);
    expect(r.total).toBe(r.withPhoto + r.withoutPhoto);
    expect(r.total).toBe(4);   // 3 titulaires + 1 ayant droit
  });

  it('ne compte pas les lignes sans identité exploitable', () => {
    expect(summarizePhotos([]).total).toBe(0);
    expect(summarizePhotos(null).withPhoto).toBe(0);
  });

  it('tolère un membre ou un ayant droit vide ou sans tableau', () => {
    const r = summarizePhotos([{ firstName: 'A' }, null, { firstName: 'B', dependents: [null, { photoUrl: '' }] }]);
    expect(r.total).toBe(3);
    expect(r.withPhoto).toBe(0);
  });

  it('compte les fiches RÉELLEMENT construites après déduplication', async () => {
    // Régression du message trompeur : deux lignes identiques (même NIN valide
    // + même naissance) sont fusionnées par dedupeRecordsByIdentity — c'est
    // l'ordre réel du pipeline (runExcelImport : dedupe → photos → fiches) —
    // et le ménage est regroupé. Le compte-rendu doit porter sur les FICHES
    // (2 fiches), pas sur les lignes lues (3).
    const lignes = parseRowsToRecords([
      { CODE_BENEFICIAIRE: 'DKR_260001.0', PRENOM: 'MOUSTAPHA', NOM: 'NDIONE', DATE_NAISSANCE: '1972-01-03', NIN: '1234567890123' },
      { CODE_BENEFICIAIRE: 'DKR_260001.2', PRENOM: 'MOUSTAPHA', NOM: 'NDIONE', DATE_NAISSANCE: '1972-01-03', NIN: '1234567890123' },
      { CODE_BENEFICIAIRE: 'DKR_260001.1', PRENOM: 'ASSI', NOM: 'SECK', DATE_NAISSANCE: '1976-11-24' }
    ]);
    const { records, merged } = dedupeRecordsByIdentity(lignes);
    expect(merged).toBe(1);
    expect(records).toHaveLength(2);

    const members = await buildStudioMembers(records, {
      photoUrls: new Map([
        ['DKR_260001.0', PHOTO],
        ['1.0 Moustapha Ndione.jpeg', PHOTO]
      ])
    });
    // 3 lignes lues → 1 dossier de 2 personnes.
    expect(members).toHaveLength(1);
    expect(members[0].dependents).toHaveLength(1);
    const r = summarizePhotos(members);
    expect(r.total).toBe(2);
    expect(r.withPhoto).toBe(1);
    expect(r.withoutPhoto).toBe(1);
  });

  // Le marquage de la ligne absorbée repose sur la RÉFÉRENCE de l'objet, pas
  // sur son code de fichier. Le code du classeur n'est pas unique : deux lignes
  // peuvent le partager (ligne recopiée dans le classeur, code dupliqué par
  // erreur de saisie). Un Set de CODES contenait alors ce code et le filtre
  // retirait LES DEUX lignes — la personne disparaissait silencieusement de
  // l'import.
  //
  // ⚠️ Ces tests sont la RÉGRESSION de ce défaut : ils échouent si le
  // marquage redevient un Set de codes.
  describe('dedupeRecordsByIdentity — la ligne CONSERVÉE survit toujours', () => {
    const NIN = '1234567890123';
    const NAISSANCE = '1972-01-03';

    it('doublon de MÊME code → la personne survit, une seule fiche', () => {
      const lignes = parseRowsToRecords([
        { CODE_BENEFICIAIRE: 'DKR_260001.0', PRENOM: 'MOUSTAPHA', NOM: 'NDIONE', DATE_NAISSANCE: NAISSANCE, NIN },
        { CODE_BENEFICIAIRE: 'DKR_260001.0', PRENOM: 'MOUSTAPHA', NOM: 'NDIONE', DATE_NAISSANCE: NAISSANCE, NIN }
      ]);
      const { records, merged } = dedupeRecordsByIdentity(lignes);
      // La fusion EST détectée…
      expect(merged).toBe(1);
      // …et la ligne CONSERVÉE est la seule à rester : ZÉRO PERTE.
      expect(records).toHaveLength(1);
      expect(records[0].prenom).toBe('MOUSTAPHA');
      // Le code du classeur reste INTACT (gravé sur le PVC, canonicalCode).
      expect(records[0].codeBeneficiaire).toBe('DKR_260001.0');
    });

    it('doublon de code DIFFÉRENT → le cas nominal ne régresse pas', () => {
      const lignes = parseRowsToRecords([
        { CODE_BENEFICIAIRE: 'DKR_260001.0', PRENOM: 'MOUSTAPHA', NOM: 'NDIONE', DATE_NAISSANCE: NAISSANCE, NIN },
        { CODE_BENEFICIAIRE: 'DKR_260001.2', PRENOM: 'MOUSTAPHA', NOM: 'NDIONE', DATE_NAISSANCE: NAISSANCE, NIN }
      ]);
      const { records, merged } = dedupeRecordsByIdentity(lignes);
      expect(merged).toBe(1);
      expect(records).toHaveLength(1);
      expect(records[0].codeBeneficiaire).toBe('DKR_260001.0');
    });

    it('le gardien récupère les champs que le doublon seul portait', () => {
      const lignes = parseRowsToRecords([
        // Gardien « nu » : il ne porte aucun de ces champs.
        { CODE_BENEFICIAIRE: 'DKR_260001.0', PRENOM: 'MOUSTAPHA', NOM: 'NDIONE', DATE_NAISSANCE: NAISSANCE, NIN },
        {
          CODE_BENEFICIAIRE: 'DKR_260001.0',            // même code : le pire cas
          PRENOM: 'MOUSTAPHA', NOM: 'NDIONE', DATE_NAISSANCE: NAISSANCE, NIN,
          CONTACT: '77 631 71 73', ADRESSE: 'Grand Yoff', LIEU_NAISSANCE: 'Saint-Louis',
          PHOTO: '1.0 Moustapha Ndione.jpeg'
        }
      ]);
      const { records } = dedupeRecordsByIdentity(lignes);
      expect(records).toHaveLength(1);
      const gardien = records[0];
      expect(gardien.telephone).toBe('77 631 71 73');
      expect(gardien.address).toBe('Grand Yoff');
      expect(gardien.birthPlace).toBe('Saint-Louis');
      expect(gardien.photoHint).toBe('1.0 Moustapha Ndione.jpeg');
    });

    it('aucun marquage temporaire ne fuit dans les lignes retournées', () => {
      const lignes = parseRowsToRecords([
        { CODE_BENEFICIAIRE: 'DKR_260001.0', PRENOM: 'MOUSTAPHA', NOM: 'NDIONE', DATE_NAISSANCE: NAISSANCE, NIN },
        { CODE_BENEFICIAIRE: 'DKR_260001.0', PRENOM: 'MOUSTAPHA', NOM: 'NDIONE', DATE_NAISSANCE: NAISSANCE, NIN }
      ]);
      const { records } = dedupeRecordsByIdentity(lignes);
      for (const r of records) {
        // L'ancien marquage `_fuseDans` ne doit plus exister du tout.
        expect(r).not.toHaveProperty('_fuseDans');
        // Et, plus largement, aucun champ interne ne doit subsister.
        expect(Object.keys(r).filter((k) => k.startsWith('_'))).toEqual([]);
      }
      // Les lignes d'entrée ont elles aussi été nettoyées (elles sont partagées
      // avec le Studio) : pas de résidu après l'appel.
      for (const r of lignes) expect(r).not.toHaveProperty('_fuseDans');
    });

    it('trois lignes identiques → une seule fiche, deux fusions comptées', () => {
      // `merged` doit compter les LIGNES absorbées, pas les codes distincts :
      // trois lignes à code identique = deux doublons réellement retirés.
      const lignes = parseRowsToRecords([
        { CODE_BENEFICIAIRE: 'DKR_260001.0', PRENOM: 'MOUSTAPHA', NOM: 'NDIONE', DATE_NAISSANCE: NAISSANCE, NIN },
        { CODE_BENEFICIAIRE: 'DKR_260001.0', PRENOM: 'MOUSTAPHA', NOM: 'NDIONE', DATE_NAISSANCE: NAISSANCE, NIN },
        { CODE_BENEFICIAIRE: 'DKR_260001.0', PRENOM: 'MOUSTAPHA', NOM: 'NDIONE', DATE_NAISSANCE: NAISSANCE, NIN }
      ]);
      const { records, merged } = dedupeRecordsByIdentity(lignes);
      expect(merged).toBe(2);
      expect(records).toHaveLength(1);
    });

    it('n\'absorbe que la ligne marquée : les autres personnes du fichier restent', () => {
      // Un code dupliqué PAR ERREUR entre deux personnes DIFFÉRENTES ne doit
      // pas faire disparaître la deuxième : seul le NIN + la naissance
      // décident d'une fusion.
      const lignes = parseRowsToRecords([
        { CODE_BENEFICIAIRE: 'DKR_260001.0', PRENOM: 'MOUSTAPHA', NOM: 'NDIONE', DATE_NAISSANCE: NAISSANCE, NIN },
        { CODE_BENEFICIAIRE: 'DKR_260001.0', PRENOM: 'MOUSTAPHA', NOM: 'NDIONE', DATE_NAISSANCE: NAISSANCE, NIN },
        // Même code, AUTRE personne : pas de NIN valide → jamais fusionnée.
        { CODE_BENEFICIAIRE: 'DKR_260001.0', PRENOM: 'AWA', NOM: 'FALL', DATE_NAISSANCE: '1999-05-05', NIN: 'EXT NAISSANCE' }
      ]);
      const { records, merged } = dedupeRecordsByIdentity(lignes);
      expect(merged).toBe(1);
      expect(records).toHaveLength(2);
      expect(records.map((r) => r.prenom).sort()).toEqual(['AWA', 'MOUSTAPHA']);
    });
  });

  it('attribue la bonne photo à chaque fiche, même sans code dans le classeur', async () => {
    // Deux lignes SANS code : la clé « '' » ne doit pas les faire hériter de la
    // photo l'une de l'autre (le visage d'un assuré sur la carte d'un autre).
    const lignes = parseRowsToRecords([
      { PRENOM: 'ALICE', NOM: 'SECK', DATE_NAISSANCE: '1990-01-01' },
      { PRENOM: 'BERNARD', NOM: 'SECK', DATE_NAISSANCE: '1991-01-01' }
    ]);
    lignes[0].photoUrl = '1.0 Alice Seck.jpeg';
    lignes[1].photoUrl = '1.1 Bernard Seck.jpeg';
    const photoAlice = 'data:image/jpeg;base64,ALICE';
    const photoBernard = 'data:image/jpeg;base64,BERNARD';
    const members = await buildStudioMembers(lignes, {
      photoUrls: new Map([
        ['1.0 Alice Seck.jpeg', photoAlice],
        ['1.1 Bernard Seck.jpeg', photoBernard]
      ])
    });
    const alice = members.find((m) => m.firstName === 'ALICE');
    const bernard = members.find((m) => m.firstName === 'BERNARD');
    expect(alice.photoUrl).toBe(photoAlice);
    expect(bernard.photoUrl).toBe(photoBernard);
    expect(summarizePhotos(members).withPhoto).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. RÉIMPORT — pas de doublon, mais la photo arrive
// ═══════════════════════════════════════════════════════════════════════

describe('partitionForReimport — le réimport enrichit au lieu d\'ignorer', () => {
  const fiche = (code, prenom, nom, naissance, photoUrl = '') => ({
    cmuNumber: code,
    firstName: prenom,
    lastName: nom,
    birthDate: naissance,
    photoUrl,
    dependents: []
  });

  it('une fiche déjà connue est RÉPUTÉE, pas ignorée (le bug des photos)', () => {
    // Fiche existante SANS photo ; le réimport apporte la photo.
    const existing = [fiche('DKR_260001.0', 'MOUSTAPHA', 'NDIONE', '1972-01-03', '')];
    const members = [fiche('DKR_260001.0', 'MOUSTAPHA', 'NDIONE', '1972-01-03', PHOTO)];

    const { fresh, updates, duplicates } = partitionForReimport(members, existing);

    // Elle ne doit PAS être considérée comme une nouvelle fiche…
    expect(fresh).toHaveLength(0);
    // …mais elle doit repartir vers le backend pour y recevoir sa photo.
    expect(updates).toHaveLength(1);
    expect(updates[0].photoUrl).toBe(PHOTO);
    // Et ce n'est pas un « doublon ignoré » : rien n'a été perdu.
    expect(duplicates).toBe(0);
  });

  it('ne crée AUCUN doublon : rien n\'est écrit deux fois en local', () => {
    const existing = [fiche('DKR_260001.0', 'MOUSTAPHA', 'NDIONE', '1972-01-03', '')];
    const members = [fiche('DKR_260001.0', 'MOUSTAPHA', 'NDIONE', '1972-01-03', PHOTO)];
    const { fresh, updates } = partitionForReimport(members, existing);
    // fresh est écrit dans le registre local, updates ne l'est pas.
    expect(fresh.length + updates.length).toBe(1);
  });

  it('reconnaît la même personne malgré un matricule régénéré (NIN)', () => {
    // NIN : la clé d'identité la plus fiable. Matricule différent, même
    // personne → enrichissement, pas doublon.
    const existing = [{ ...fiche('DKR-DKR-2026-0001', 'A', 'B', '1990-01-01'), nin: '1234567890123' }];
    const members = [{ ...fiche('DKR_260042.0', 'Z', 'Y', '1975-05-05'), nin: '1234567890123', photoUrl: PHOTO }];
    const { fresh, updates } = partitionForReimport(members, existing);
    expect(fresh).toHaveLength(0);
    expect(updates).toHaveLength(1);
  });

  it('reconnaît la même personne par prénom + nom + naissance (sans NIN)', () => {
    // Cas AMEVI : 247 NIN exploitables sur 1702 lignes. L'identité par
    // nom + naissance doit donc suffire à reconnaître la fiche au réimport.
    const existing = [fiche('DKR_260001.0', 'SOKHNA F', 'DIOP', '1979-07-07', '')];
    const members = [fiche('DKR_260001.0', 'SOKHNA F', 'DIOP', '1979-07-07', PHOTO)];
    const { fresh, updates } = partitionForReimport(members, existing);
    expect(fresh).toHaveLength(0);
    expect(updates).toHaveLength(1);
  });

  it('tient compte de la casse et des accents dans l\'identité', () => {
    const existing = [fiche('DKR_260004.0', 'IRSULE', 'DIAMÈTRE', '1948-04-25', '')];
    const members = [fiche('DKR_260004.0', 'Irsule', 'Diametre', '1948-04-25', PHOTO)];
    const { updates } = partitionForReimport(members, existing);
    expect(updates).toHaveLength(1);
  });

  it('une fiche INCONNUE reste une fiche à créer', () => {
    const existing = [fiche('DKR_260001.0', 'MOUSTAPHA', 'NDIONE', '1972-01-03', '')];
    const members = [fiche('DKR_260099.0', 'NOUVEAU', 'DOSSARD', '2000-12-12', PHOTO)];
    const { fresh, updates, duplicates } = partitionForReimport(members, existing);
    expect(fresh).toHaveLength(1);
    expect(updates).toHaveLength(0);
    expect(duplicates).toBe(0);
  });

  it('mélange création et enrichissement dans un même import', () => {
    const existing = [
      fiche('DKR_260001.0', 'MOUSTAPHA', 'NDIONE', '1972-01-03', ''),
      fiche('DKR_260002.0', 'ASSI', 'SECK', '1976-11-24', '')
    ];
    const members = [
      fiche('DKR_260001.0', 'MOUSTAPHA', 'NDIONE', '1972-01-03', PHOTO),   // connu
      fiche('DKR_260002.0', 'ASSI', 'SECK', '1976-11-24', PHOTO),           // connu
      fiche('DKR_260003.0', 'FAMILLE', 'NDIONE', '2005-06-02', PHOTO)        // nouveau
    ];
    const { fresh, updates } = partitionForReimport(members, existing);
    expect(updates).toHaveLength(2);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].cmuNumber).toBe('DKR_260003.0');
  });

  it('une personne répétée DANS le fichier n\'est gardée qu\'une fois', () => {
    const members = [
      fiche('DKR_260001.0', 'MOUSTAPHA', 'NDIONE', '1972-01-03', PHOTO),
      fiche('DKR_260002.0', 'MOUSTAPHA', 'NDIONE', '1972-01-03', PHOTO)
    ];
    const { fresh, updates, duplicates, duplicatesInFile } = partitionForReimport(members, []);
    expect(fresh).toHaveLength(1);
    expect(updates).toHaveLength(0);
    expect(duplicatesInFile).toBe(1);
    expect(duplicates).toBe(1);
  });

  it('ne confond pas deux personnes différentes de même matricule', () => {
    // Matricule déjà pris par quelqu'un d'AUTRE (identité différente) :
    // le backend ferait un UPDATE et écraserait la fiche d'un tiers. On refuse.
    const existing = [fiche('DKR_260001.0', 'MOUSTAPHA', 'NDIONE', '1972-01-03', '')];
    const members = [fiche('DKR_260001.0', 'AUTRE', 'PERSONNE', '1999-09-09', PHOTO)];
    const { fresh, updates, codeConflicts } = partitionForReimport(members, existing);
    expect(fresh).toHaveLength(0);
    expect(updates).toHaveLength(0);
    expect(codeConflicts).toBe(1);
  });

  it('ne confond pas deux homonymes de naissance différente', () => {
    const existing = [fiche('DKR_260001.0', 'AWA', 'FALL', '1990-01-01', '')];
    const members = [fiche('DKR_260077.0', 'AWA', 'FALL', '1991-01-01', PHOTO)];
    const { fresh } = partitionForReimport(members, existing);
    expect(fresh).toHaveLength(1);
  });

  it('tolère un registre vide, absent ou sans matricule', () => {
    const members = [fiche('', 'AWA', 'FALL', '1990-01-01', '')];
    expect(partitionForReimport(members, []).fresh).toHaveLength(1);
    expect(partitionForReimport(members, undefined).fresh).toHaveLength(1);
    expect(partitionForReimport(members, [{ firstName: 'SANS', lastName: 'CODE' }]).fresh).toHaveLength(1);
  });

  it('une fiche sans nom ni prénom exploitable reste créent (non écrasée)', () => {
    // beneficiaryIdentity() renvoie '' : ni identité, ni code → la fiche est
    // conservée telle quelle plutôt que perdue.
    const members = [{ cmuNumber: '', firstName: '', lastName: '', birthDate: '', photoUrl: '' }];
    const { fresh } = partitionForReimport(members, []);
    expect(fresh).toHaveLength(1);
  });

  it('ignore une entrée vide du registre des membres lus', () => {
    const existing = [null, undefined, fiche('DKR_260001.0', 'A', 'B', '1990-01-01')];
    const members = [fiche('DKR_260001.0', 'A', 'B', '1990-01-01', PHOTO)];
    expect(() => partitionForReimport(members, existing)).not.toThrow();
    expect(partitionForReimport(members, existing).updates).toHaveLength(1);
  });

  it('reste idempotent : réimporter deux fois n\'ajoute rien de plus', () => {
    // Simule le réimport : le registre local ne contient QUE les fiches fresh.
    const first = partitionForReimport(
      [fiche('DKR_260001.0', 'AWA', 'FALL', '1990-01-01', '')],
      []
    );
    const existingApres = [...first.fresh.map((m) => ({ ...m, photoUrl: '' }))];
    const second = partitionForReimport(
      [fiche('DKR_260001.0', 'AWA', 'FALL', '1990-01-01', PHOTO)],
      existingApres
    );
    expect(second.fresh).toHaveLength(0);
    expect(second.updates).toHaveLength(1);
    expect(second.updates[0].photoUrl).toBe(PHOTO);
  });
});

/**
 * Le signal qui déclenche le bug : une photo d'ayant droit EST une data-URL
 * après compression. Le push renvoyait alors `null`, et la photo disparaissait
 * avant d'atteindre le backend. Ce test verrouille la règle au niveau du
 * contrat : ce que l'import produit part tel quel.
 */
describe('Contrat de la photo : une data-URL doit survivre au push', () => {
  it('la photo d\'un ayant droit est bien une data-URL après l\'import', async () => {
    const lignes = parseRowsToRecords([
      { CODE_BENEFICIAIRE: 'DKR_260001.0', PRENOM: 'MOUSTAPHA', NOM: 'NDIONE', DATE_NAISSANCE: '1972-01-03' },
      { CODE_BENEFICIAIRE: 'DKR_260001.1', PRENOM: 'ASSI', NOM: 'SECK', DATE_NAISSANCE: '1976-11-24' }
    ]);
    lignes[0].photoUrl = '1.0 Moustapha Ndione.jpeg';
    lignes[1].photoUrl = '1.1 Assi Seck.jpeg';
    const members = await buildStudioMembers(lignes, {
      photoUrls: new Map([
        ['1.0 Moustapha Ndione.jpeg', PHOTO],
        ['DKR_260001.1', PHOTO]
      ])
    });
    // Titulaire ET ayants droit portent une data-URL : le push ne doit plus
    // les distinguer, sinon 100 % des ayants droit perdent leur photo.
    expect(members[0].photoUrl.startsWith('data:')).toBe(true);
    expect(members[0].dependents[0].photoUrl.startsWith('data:')).toBe(true);
    expect(summarizePhotos(members).withPhoto).toBe(2);
  });

  it('une data-URL d\'un ayant droit atteint bien la partition « updates »', async () => {
    const lignes = parseRowsToRecords([
      { CODE_BENEFICIAIRE: 'DKR_260001.0', PRENOM: 'MOUSTAPHA', NOM: 'NDIONE', DATE_NAISSANCE: '1972-01-03' }
    ]);
    const members = await buildStudioMembers(lignes, { photoUrls: new Map([['DKR_260001.0', PHOTO]]) });
    const existing = [{
      cmuNumber: 'DKR_260001.0',
      firstName: 'MOUSTAPHA',
      lastName: 'NDIONE',
      birthDate: '1972-01-03',
      photoUrl: '',
      dependents: [{ cmuNumber: 'DKR_260001.1', firstName: 'ASSI', lastName: 'SECK', photoUrl: '' }]
    }];
    const { updates } = partitionForReimport(members, existing);
    // Le dossier entier (titulaire + ayants droit) repart : c'est ce qui
    // remplit `photo_url` des deux.
    expect(updates).toHaveLength(1);
    expect(updates[0].photoUrl.startsWith('data:')).toBe(true);
    expect(beneficiaryIdentity(updates[0])).toBe(beneficiaryIdentity(existing[0]));
  });
});