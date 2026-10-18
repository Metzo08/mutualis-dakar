# SECURITY_RULES — Règles de sécurité MUTUALIS

> Référence obligatoire pour tout agent avant de toucher au backend ou à l'authentification.

## 1. Principe central

**« L'utilisateur est connecté » n'est PAS une preuve d'autorisation.**
Toute route vérifie : authentification (JWT) → rôle (`requireRole`) → propriété/tenant de la ressource.

## 2. Jetons

| Élément | Règle |
|---|---|
| `JWT_SECRET` | ≥ 32 caractères, obligatoire. En production, le backend **refuse de démarrer** sinon (`process.exit(1)`). |
| `JWT_REFRESH_SECRET` | Secret DISTINCT du principal, ≥ 32 caractères, même exigence. |
| Access token | TTL : citoyen 24 h, agent/admin 8 h. |
| Refresh token | 30 jours, signé séparément, stocké **haché SHA-256** en base (`refresh_tokens`). Jamais en clair. |
| Échec de renouvellement | Événement `cmu-session-expired` → déconnexion côté frontend. |
| Session locale | TTL glissant 12 h (`cmu-session-ts`) ; session périmée purgée au démarrage de l'app. |

## 3. Cloisonnement (les 3 niveaux)

1. **Citoyen** : uniquement `beneficiary_id = req.user.id`. Jamais de liste globale.
2. **Agent MSD** : filtrage sur `beneficiaries.msd_code` (le CODE). JAMAIS sur `department` (libellés incohérents historiquement).
3. **Super Admin** : aucun filtre — c'est son rôle de supervision. (`msdCode` absent du jeton = marqueur.)

Toute nouvelle route GET de liste DOIT implémenter les trois niveaux. Vérifier dans : `server.js`, `csuRoutes.js`, `additionalRoutes.js`, `advancedRoutes.js`, `extendedRoutes.js`.

## 4. Données sensibles

- Aucune donnée médicale/personnelle dans les logs (`console.*`), les messages d'erreur API, ou le journal frontend (`/api/log` est assaini : pas de sauts de ligne, pas de `<>`, borné à 2000 caractères).
- `photo_url` (base64 ≈ 15 Ko) ne doit JAMAIS être dans une liste paginée — servie à la demande par `/api/beneficiaries/:id/photo`.
- Aucun secret dans le code : tout passe par `.env` (jamais commité).
- Réponses d'erreur : message générique + `console.error` côté serveur uniquement.

## 5. Endpoints à surveiller

| Endpoint | Attention |
|---|---|
| `/api/dashboard/demo-stats` | Public VOLONTAIREMENT, mais uniquement des compteurs agrégés — jamais de données personnelles. Ne rien y ajouter d'identifiant. |
| `/api/cmu-card/:cmuNumber` | Public (vérification par les structures). Limiter aux champs nécessaires. |
| `/api/partner/verify-card/:cmuNumber` | Authentification partenaire + vérification cotisation active. |
| `/api/beneficiaries/bulk` | Borné à 5000 lignes/import, idempotence par matricule + NIN. |
| `/api/tts` | Paramètre `text` requis ; timeouts sur les fetch vers Piper/ElevenLabs. |
| `/api/log` | Assainissement anti-falsification de journal (voir §4). |

## 6. Checklist avant toute nouvelle fonctionnalité

- [ ] IDOR : le citoyen A peut-il lire/écrire la ressource du citoyen B ?
- [ ] Inter-MSD : l'agent de la MSD A voit-il les données de la MSD B ?
- [ ] Privilege escalation : un agent peut-il s'octroyer un rôle admin ?
- [ ] Injection : toutes les requêtes sont paramétrées (`$1`, `$2`…), aucune concaténation de chaîne utilisateur.
- [ ] XSS : contenu utilisateur rendu sans `dangerouslySetInnerHTML`.
- [ ] Rate limiting : la route de mutation est-elle couverte par `apiLimiter` / `authLimiter` ?
- [ ] Upload : type/taille vérifiés avant stockage.
- [ ] Audit : action sensible → ligne dans `audit_logs`.
- [ ] Champs vides : comportement défini (rejet par zod ou `NULL` explicite — jamais de chaîne vide silencieuse en base).

## 7. Dépendances tiers

- ElevenLabs / Gemini / OpenRouter : clés dans `.env` uniquement ; en cas de clé absente, dégrader proprement (fallback voix navigateur, fallback chatbot local), jamais crasher.
- Piper (TTS local) : timeout 8 s puis repli voix navigateur.
