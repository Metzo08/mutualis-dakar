# ADR-001 — Stratégie d'évolution technique de MUTUALIS (décision Rust)

**Date** : 2026-10-25
**Décideur** : Ahmed Tall
**Statut** : ✅ Décision appliquée — Option A retenue

## Contexte

MUTUALIS repose sur : React 19 + Vite 8 (frontend), Node.js/Express CommonJS
(backend), PostgreSQL via `pg` avec fallback fichier, Redis (bus temps réel),
Docker. La plateforme est fonctionnelle, testée (129 tests backend Jest,
228 tests frontend Vitest, build Vite OK) et ses sauvegardes sont vérifiées
(pg_dump + test de restauration réel : `backend/backupService.js`).

La question posée : fallait-il intégrer Rust (service ciblé) ou réécrire le
backend en Rust ?

## Décision

**Option A — Conserver l'architecture actuelle et l'optimiser.**

Aucun service Rust n'est introduit à ce jour. La plateforme continue de
fonctionner sans interruption, sans nouveau composant à déployer ni nouvelle
compétence à mobiliser.

## Justification

1. **Aucun goulot d'étranglement mesuré ne justifie Rust.** Les limites
   observées (imports Excel, photos) sont de l'ordre des requêtes SQL,
   des index et du dimensionnement des images — un changement de langage
   ne les corrigerait pas.
2. **Les risques réels de MUTUALIS sont de sécurité et de données**, pas de
   performance brute : permissions inter-MSD, révocation effective des
   cartes, audit, sauvegardes. Ce sont des règles *métier* ; les implémenter
   deux fois (Node + Rust) doublerait la surface d'erreur.
3. **Une réécriture** (Option C) impliquerait la reprise de l'authentification,
   des permissions, des calculs financiers, des tests et des migrations :
   risque de régression élevé pour un produit en production réelle.
4. **L'option B (service Rust ciblé)** reste ouverte et documentée
   (import Excel massif, traitement d'images), mais seulement si des mesures
   le justifient — voir critères ci-dessous.

## Critères de réévaluation (déclencheurs mesurés)

Réexaminer l'introduction d'un service Rust **uniquement si** :

- un import Excel + photos de plusieurs milliers de lignes dépasse
  de façon répétable **60 s** de traitement ou **1 Go de RAM** ;
- une API de premier plan dépasse **500 ms p95** en charge nominale
  malgré optimisation SQL/index (`backend/dbOptimize.js`) ;
- un besoin de concurrence CPU-intensive non couvert par le worker Node.

Mesure reproductible recommandée : script de charge local (autocannon ou
equivalent) sur `/api/beneficiaries` et l'endpoint d'import, avant/après
optimisation. Ne jamais charger la base de production.

## Règles associées (déjà en place)

- PostgreSQL reste la **seule source de vérité** ; le fallback fichier
  (`backend/data/store.json`) est un filet de sécurité, jamais une source
  concurrente.
- Toute optimisation passe d'abord par : requêtes, index, pagination
  (`backend/pagination.js`), volume des images.
- Tests obligatoires avant toute livraison (voir `.opencode` et RÈGLES).

## Conséquences

- Aucune interruption de service, aucune migration risquée.
- L'effort est concentré sur sécurité, audit, revenus et exports Excel
  (livrés) et les sauvegardes vérifiées.
- La porte reste ouverte à un service Rust ciblé, sur mesure mesurée,
  sans réécriture.
