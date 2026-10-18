# DECISIONS — Journal des décisions d'architecture (MUTUALIS)

> Mémoire technique du projet. Chaque entrée est datée et motivée.
> Les agents consultent ce fichier AVANT toute proposition d'architecture.

## 2026-10 — Mode maintenance piloté depuis le Super Admin

- **Décision** : état de maintenance en base (`platform_settings`), pas en mémoire process.
- **Pourquoi** : en multi-instances derrière un répartiteur, un état mémoire n'existerait que sur l'instance qui a reçu l'activation — le site serait « à moitié fermé ». Le cache local de 5 s est la seule concession (propagation ≤ 5 s).
- **Conséquences** : routes `/health` toujours accessibles ; Super Admin peut naviguer même en maintenance ; API `GET/POST /api/admin/maintenance` protégée par rôle admin + audit.

## 2026-10 — Pagination serveur généralisée

- **Décision** : toute liste passe par `parsePagination` (défaut 50, plafond 200), format `{ data, pagination }`.
- **Pourquoi** : la plateforme doit absorber des dizaines de milliers de fiches. Un SELECT non borné fige le navigateur mobile et saturait le localStorage du studio cartes (cas historique : `photo_url` base64 dans la liste = 3 Mo par page).
- **Conséquences** : les photos ne sont plus dans les listes (servies à la demande par `/api/beneficiaries/:id/photo`) ; le frontend lit `{ data, pagination }` avec tolérance du tableau brut historique.

## 2026-10 — Zéro donnée de démonstration dans les listes

- **Décision** : suppression définitive des profils fictifs (Fatou Diallo, Modou Diop…) qui s'affichaient quand l'API ne répondait pas.
- **Pourquoi** : la gouvernance prenait ces faux comptes pour de vrais assurés ; les cartes « imprimées » de démonstration engageaient la responsabilité de la MSD.
- **Conséquences** : une liste vide reste vide et affiche un état vide honnête ; seuls les fallbacks légitimes subsistent (mutuelles par défaut, fichier secours si PostgreSQL est hors ligne).

## 2026-10 — Cloisonnement citoyen sur toutes les listes

- **Décision** : toute route exposant des données personnelles filtre `beneficiary_id = req.user.id` pour le rôle citizen.
- **Pourquoi** : les routes `extendedRoutes.js` (lettres de garantie, bons de commande, sessions télémed, rendez-vous) retournaient la liste GLOBALE à tout compte connecté — fuite IDOR corrigée.
- **Conséquences** : le cloisonnement est triple — citoyen (ses ressources), agent MSD (sa MSD via `msd_code`), Super Admin (tout, par rôle).

## 2026-10 — Codes CMU et lots de campagne

- **Décision** : format officiel `REGION-MSD-ANNEE-SEQUENCE` (ex. DKR-DKR-2026-0001) ; les anciens codes (`DKR_2600027.0`, préfixes programme) restent intacts et restent résolus via `beneficiary_code_aliases`.
- **Pourquoi** : une carte DÉJÀ IMPRIMÉE doit toujours retrouver son porteur au scan, même après consolidation des fiches (`merged_into`).
- **Conséquences** : migration idempotente au démarrage ; une ligne fusionnée reste en base (traçabilité) mais sort des listes.

## 2026-10 — Bus temps réel multi-instances

- **Décision** : Redis en production (canal `unamusc_presence`), PostgreSQL en secours ; le WebSocket téléconsultation est porté par le même serveur HTTP.
- **Pourquoi** : sans bus partagé, les salons WebRTC ne se relient pas entre instances.
- **Conséquences** : l'instance attend `initRealtime()` AVANT `listen` ; si le bus échoue, l'instance démarre quand même en mono-instance (dégradation loggée, pas de crash).

## 2026-10 — Gestion du port occupé (EADDRINUSE)

- **Décision** : gestionnaire explicite `server.on('error')` qui affiche les commandes de diagnostic (`netstat -ano | findstr :5000`, `taskkill`) et sort avec code 1.
- **Pourquoi** : la pile d'exception brutale ressemblait à un bug interne alors que la cause est externe (double démarrage).
- **Conséquences** : en cas de port occupé, choisir `PORT=5001` ou tuer le processus fautif.
