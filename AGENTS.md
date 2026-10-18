# MUTUALIS — PORTAIL CSU SÉNÉGAL
# RÈGLES GLOBALES D'INGÉNIERIE

## 1. Identité du projet

- **Nom** : MUTUALIS / Portail CSU Sénégal
- **Nature** : plateforme de gestion et de digitalisation des mutuelles de santé communautaire (MSD)
- **Porteur technique** : Sen-E-Carte
- **Responsable technique** : Ahmed Tall

## 2. Stack réelle (ne jamais remplacer sans justification)

- **Frontend** : React 19 + Vite 8, react-router (hash-based), TanStack Query, PWA (vite-plugin-pwa), Vitest
- **Backend** : Node.js + Express, CommonJS (`backend/server.js` et modules frères)
- **Base de données** : PostgreSQL via `pg`, avec **fallback fichier** (`backend/data/store.json`) pour zéro perte
- **Sécurité** : helmet, cors restreint, express-rate-limit, JWT + refresh tokens hachés SHA-256, bcrypt, zod (`backend/validators.js`)
- **Infra** : Docker, Redis (bus temps réel), Piper (TTS vocal)

## 3. Règle d'or : deux mondes séparés

Les agents `.opencode/agents/` sont **exclusivement des agents d'ingénierie** (build, test, review, sécurisation).

Ils ne doivent JAMAIS être transformés en agents applicatifs destinés aux utilisateurs finaux (Zahara, assistant médical, chatbot bénéficiaire). Ces deux couches sont strictement distinctes.

## 4. Architecture multi-MSD

- Une MSD ne voit JAMAIS les données d'une autre MSD.
- Toute fonctionnalité qui manipule des données doit examiner : tenant/MSD, rôle, utilisateur, permissions, propriétaire de la ressource.
- Le filtrage se fait sur `beneficiaries.msd_code` (le CODE, pas le libellé de département).
- Le Super Admin (`msdCode` absent du jeton) n'est pas filtré : c'est son rôle de supervision.
- Un citoyen ne voit QUE ses propres ressources (`beneficiary_id = req.user.id`) — le backend est l'autorité, jamais le frontend.

## 5. Données sensibles

Ne jamais :
- afficher des données médicales/personnelles dans les logs ;
- exposer des données personnelles dans les erreurs API ;
- mettre des secrets dans le code (utiliser `.env`) ;
- contourner les permissions ;
- créer un endpoint à accès direct non autorisé.

## 6. Modication du code

Avant de modifier :
1. inspecter le code existant ;
2. comprendre l'architecture ;
3. rechercher les fonctionnalités similaires ;
4. vérifier les tests existants ;
5. définir précisément le changement.

**Ne pas réécrire massivement le projet.** Privilégier les modifications minimales et maintenables.

## 7. Conventions de pagination (obligatoires)

Toute route GET qui liste des données doit :
- utiliser `parsePagination(req)` depuis `backend/pagination.js` (défaut 50, plafond 200) ;
- exécuter un `COUNT(*)` cohérent avec les mêmes filtres `WHERE` ;
- renvoyer `{ data: [...], pagination: { page, limit, total, totalPages, hasNext, hasPrev } }` ;
- sécuriser la lecture avec `countRes.rows[0]?.count || '0'` (la DB peut être mockée/vide) ;
- cloisonner par MSD / citoyen avant la pagination.

## 8. Conventions frontend

- Consommer le format paginé `{ data, pagination }` avec tolérance du tableau brut historique :
  ```js
  const data = Array.isArray(payload) ? payload : (payload.data || []);
  ```
- Aucun hook React (useState, useEffect…) ne doit être déclaré après un `return` conditionnel — toujours tous les hooks en tête du composant.
- Les rendus conditionnels globaux (maintenance, 404) viennent APRÈS tous les hooks.

## 9. Tests (obligatoires avant livraison)

Dans l'ordre :
1. `node --check <fichier>.js` (syntaxe backend)
2. `npx eslint <fichiers modifiés>`
3. `cd backend && npm test` (73 tests, tous doivent passer)
4. `npm run test` (racine, Vitest — 156 tests)
5. `npm run build` (vite build, doit réussir)

## 10. Démarrage

- **Backend** : `cd backend && npm start` (port 5000, fallback `PORT=5001`)
- **Frontend** : `npm run dev` (racine)
- En cas de `EADDRINUSE` : `netstat -ano | findstr :5000` puis `taskkill /PID <pid> /F` — le backend affiche désormais un message clair au lieu d'une pile d'exception.

## 11. Sécurité : checklist avant toute fonctionnalité

Examiner contre : IDOR, privilege escalation, broken access control, injection, XSS, CSRF, fuite de données, mauvaise gestion de session, secrets exposés, upload dangereux, accès inter-MSD.

**"L'utilisateur est connecté" n'est PAS une preuve d'autorisation.**

## 12. Git

- Ne jamais supprimer ou écraser du travail existant sans justification.
- Avant une modification importante : `git status`, comprendre les changements en cours.
- Utiliser `git stash` avec précaution : TOUJOURS vérifier que `git stash pop` a bien été exécuté (risque de timeout qui laisserait le stash en place).

## 13. Décision humaine

Les agents produisent des analyses, du code et des contrôles. **Ahmed Tall conserve la décision finale** concernant : architecture, règles métier, sécurité, mise en production, choix technologiques.

## 14. Règle de sortie (toute tâche d'agent)

Terminer avec :
- ce qui a été analysé/modifié ;
- les fichiers concernés ;
- les risques ;
- les tests exécutés ;
- les problèmes restants ;
- les décisions nécessitant validation humaine.
