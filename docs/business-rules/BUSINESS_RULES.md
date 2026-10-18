# BUSINESS_RULES — Règles métier MUTUALIS

> Référence pour product/backend/frontend. Toute exception à une règle ci-dessous nécessite une entrée dans `docs/architecture/DECISIONS.md`.

## 1. Acteurs

| Acteur | Rôle DB normalisé | Périmètre |
|---|---|---|
| Bénéficiaire / citoyen | `citizen` | SES ressources uniquement |
| Agent MSD | `agent` | Les assurés de SA MSD (`msd_code`) |
| Admin / Super Admin | `admin` | Toutes les MSD (supervision) |
| Structure partenaire | `partner` (jeton dédié) | SES déclarations, vérification de cartes |

## 2. Cycle de vie du bénéficiaire

- **Statuts** : `active`, `pending`, (désactivé via toggle agent).
- Une **cotisation payée** portant `period_end >= NOW()` rend le bénéficiaire éligible aux prises en charge ; une cotisation expirée refuse le tiers-payant (403, jamais de dérogation silencieuse).
- Une fiche fusionnée (`merged_into` non nul) sort des listes mais reste résoluble via `beneficiary_code_aliases` — une carte déjà imprimée retrouve toujours son porteur.

## 3. Cartes CMU

- Matricule unique par MSD, format officiel `REGION-MSD-ANNEE-SEQUENCE`.
- Génération **séquentielle** (jamais `Math.random()` — collisions historiques).
- Un lot de campagne (`campaign_lots`) trace la provenance ; un lot marqué **imprimé** ne peut plus être recodé.
- La photo est exclue des listes (poids) et servie à la demande.

## 4. Prises en charge (claims)

- Dépôt : citoyen sur ses propres demandes, agent pour sa MSD.
- Traitement : `agent`/`admin` uniquement ; statuts → `approved` / `rejected` (avec motif) / `paid`.
- Chaque changement de statut : notification SMS simulée au bénéficiaire + ligne d'audit.

## 5. Lettres de garantie & tiers-payant

- Création : bénéficiaire + acte médical requis ; code de validation généré serveur.
- Validation : **100 % humaine** par un agent CMU — aucun déblocage automatique.
- Tiers-payant partenaire : carte doit être `active` ET cotisation non expirée, sinon 403. Le taux de couverture vient du jeton partenaire (`coverageRate`).

## 6. Cotisations

- Enregistrement : agent/admin (ou automatique via paiement confirmé).
- Rappels automatiques : seulement si aucun rappel envoyé depuis < 7 jours ; ciblent les cotisations expirant ≤ 60 jours ou expirées.

## 7. Réclamations

- Dépôt public (validation zod) ; lecture réservée agent/admin, cloisonnée par MSD.
- Résolution : notes obligatoires à la clôture ; suppression réservée admin.

## 8. Parrainage / fidélité

- Package `parrainage` : sponsor identifié par `sponsor_phone` ; logo du parrain (`sponsor_logo`) apposé sur les cartes parrainées.
- Points de fidélité cumulés par bénéficiaire ; classement borné à 20 (pagination naturelle du leaderboard).

## 9. Champs vides

- Champs métier obligatoires → rejet par zod avec message clair (jamais d'enregistrement silencieux à moitié vide).
- Champs optionnels absents → `NULL` explicite en base (pas de `''` ambigu).

## 10. Ce qui n'est JAMAIS négociable

1. Aucune donnée de démonstration affichée comme si elle était réelle.
2. Aucune lettre de garantie « validée » sans validation humaine.
3. Aucun citoyen ne voit les données d'un autre citoyen.
4. Aucune MSD ne voit les données d'une autre MSD.
5. Le backend est l'autorité ; le frontend reflète, il ne décide pas.
