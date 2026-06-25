# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

---

# 🏥 MUTUALIS DAKAR — Portail CMU régional

Plateforme numérique régionale de l'**Union Régionale des Mutuelles de Santé Communautaires de Dakar (URMSCD)**, déployée pour la **Couverture Maladie Universelle (CMU)** du Sénégal.

L'application permet aux citoyens d'adhérer à une mutuelle, de payer leur cotisation en ligne, de localiser les structures de soins conventionnées et d'échanger avec une assistante virtuelle bilingue (Français / Wolof). Côté agents, elle offre la gestion des assurés, le suivi des réclamations et un journal d'audit complet.

## 📑 Sommaire

- [Aperçu fonctionnel](#-aperçu-fonctionnel)
- [Stack technique](#-stack-technique)
- [Prérequis](#-prérequis)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Base de données](#-base-de-données)
- [Lancement](#-lancement)
- [Tests](#-tests)
- [API Référence](#-api-référence)
- [Sécurité](#-sécurité)
- [Structure du projet](#-structure-du-projet)
- [Comptes de démonstration](#-comptes-de-démonstration)
- [Déploiement](#-déploiement)

## 🎯 Aperçu fonctionnel

### Espace citoyen 🇸🇳
- Adhésion en ligne (Individuel, Familial, Parrainage Solidaire, CSU Élèves/Daaras)
- Renouvellement de cotisation via Orange Money / Wave
- Consultation du statut de couverture et des ayants droit
- Cartographie des structures conventionnées (Hôpital Principal, Fann, Dalal Jamm…)
- Dépôt de réclamations
- Chatbot IA **Zahara** (Français/Wolof) avec synthèse vocale native
- Droit à l'oubli (RGPD)

### Espace agent 💼
- Tableau de bord régional avec statistiques temps réel
- Gestion des bénéficiaires (validation, suspension, suppression)
- Registre des réclamations (résolution)
- Journal d'audit régional horodaté
- Messagerie interne entre agents
- Création de comptes agents (réservé Super Admin)
- Annuaire national des mutuelles et médicaments pris en charge

## 🛠️ Stack technique

| Couche | Technologies |
|---|---|
| **Frontend** | React 19, Vite 8, PWA (`vite-plugin-pwa`), API Web Speech (TTS), Leaflet (cartographie) |
| **Backend** | Node.js, Express 4, JWT (access + refresh), bcrypt, Helmet, express-rate-limit, zod (validation) |
| **Base de données** | PostgreSQL 17 |
| **IA** | Google Gemini (chatbot bilingue avec fallback local) |
| **Tests** | Vitest + Testing Library (frontend) · Jest + Supertest (backend) |

## 📋 Prérequis

- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14 (recommandé 17)
- **npm** ≥ 9

## 🚀 Installation

### 1. Installer les dépendances

```bash
# Frontend (racine)
npm install

# Backend
cd backend
npm install
```

### 2. Configuration des variables d'environnement

```bash
cp backend/.env.example backend/.env
```

Éditez `backend/.env` (voir [Configuration](#-configuration)).

## ⚙️ Configuration

Toutes les variables sont dans `backend/.env` (voir `.env.example` pour le modèle) :

| Variable | Description | Exemple |
|---|---|---|
| `DB_USER` | Utilisateur PostgreSQL | `postgres` |
| `DB_PASSWORD` | Mot de passe PostgreSQL | `mot_de_passe_fort` |
| `DB_NAME` | Nom de la base | `MUTUALIS DAKAR` |
| `DB_HOST` | Hôte PostgreSQL | `localhost` |
| `DB_PORT` | Port PostgreSQL | `5432` |
| `PORT` | Port du serveur Express | `5000` |
| `JWT_SECRET` | **Secret JWT (≥ 32 caractères)** — obligatoire en production | `openssl rand -hex 64` |
| `JWT_REFRESH_SECRET` | **Secret refresh token (≥ 32 caractères)** | `openssl rand -hex 64` |
| `CORS_ORIGINS` | Origines frontend autorisées (séparées par virgules) | `http://localhost:5173` |
| `GEMINI_API_KEY` | Clé Google Gemini (optionnelle — fallback local sinon) | `AIza...` |

> ⚠️ **Ne jamais committer le fichier `.env`** — il est ignoré par `.gitignore`.

## 🗄️ Base de données

### Initialisation (création des tables + données de démonstration)

```bash
cd backend
npm run init-db
```

Ce script :
- Crée toutes les tables (`beneficiaries`, `mutuelles`, `agents`, `audit_logs`, `complaints`, etc.)
- Insère des mutuelles, structures de soins, médicaments couverts
- Crée 4 bénéficiaires de démonstration (PINs hachés bcrypt)
- Crée 2 agents (agent + super admin)

> ⚠️ **Attention** : `init_db.js` exécute `DROP TABLE` au démarrage. À réserver au développement.

## ▶️ Lancement

### Backend (port 5000)

```bash
cd backend
npm start
# → Serveur démarré sur http://localhost:5000
```

### Frontend (port 5173)

```bash
npm run dev
# → http://localhost:5173
```

## 🧪 Tests

### Backend (Jest + Supertest)

```bash
cd backend
npm test
```

22 tests couvrent : sécurité/RBAC, validation zod, pagination, chatbot fallback, routes publiques. La DB PostgreSQL est **mockée** (aucune dépendance externe).

### Frontend (Vitest + Testing Library)

```bash
npm test            # run unique
npm run test:watch  # mode watch
```

14 tests couvrent : utilitaires phonétiques Wolof, composant Footer, validation i18n.

## 📡 API Référence

### Authentification

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `POST` | `/api/auth/citizen/login` | Public | Connexion citoyen (téléphone + PIN) |
| `POST` | `/api/auth/agent/login` | Public | Connexion agent (username + mot de passe) |
| `POST` | `/api/auth/refresh` | Refresh token | Renouvelle le jeton d'accès |
| `POST` | `/api/auth/logout` | Authentifié | Révoque le refresh token |

### Mutuelles & cartographie

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/api/mutuelles` | Public | Liste des mutuelles (filtres région, statut, recherche) |
| `GET` | `/api/locations` | Public | Points pour la cartographie Leaflet |
| `GET` | `/api/coverage-items` | Public | Médicaments & soins pris en charge |

### Citoyen

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `POST` | `/api/adhesions` | Public | Nouvelle adhésion (retourne PIN temporaire) |
| `POST` | `/api/cotisations/renew` | Public | Renouvellement cotisation |
| `POST` | `/api/donations` | Public | Don en ligne |
| `GET` | `/api/donations/stats` | Public | Statistiques des dons |
| `POST` | `/api/complaints` | Public | Dépôt de réclamation |
| `DELETE` | `/api/beneficiaries/:id` | Auth (propriétaire ou agent) | Droit à l'oubli RGPD |

### Agent / Admin

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/api/beneficiaries` | Agent/Admin | Liste paginée des assurés |
| `PUT` | `/api/beneficiaries/:id/status` | Agent/Admin | Modifier le statut d'un dossier |
| `DELETE` | `/api/beneficiaries/:id` | Agent/Admin | Suppression administrative |
| `GET` | `/api/audit-logs` | Agent/Admin | Journal d'audit paginé |
| `GET` | `/api/complaints` | Agent/Admin | Liste paginée des réclamations |
| `PUT` | `/api/complaints/:id/resolve` | Agent/Admin | Résoudre une réclamation |
| `GET` | `/api/agents` | Admin | Liste des agents |
| `POST` | `/api/agents` | Admin | Créer un agent |
| `PUT` | `/api/agents/:id/photo` | Agent (soi-même) / Admin | Photo de profil |
| `POST` | `/api/messages` | Agent/Admin | Envoyer un message interne |
| `GET` | `/api/messages/:username` | Agent/Admin | Messages reçus |

### Pagination

Les routes paginées acceptent `?page=N&limit=M` (limit plafonné à 200) et retournent :

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 128,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## 🔐 Sécurité

- **JWT** avec access token (8h agent / 24h citoyen) + **refresh token** (30j, rotation)
- **RBAC** : middleware `authenticateToken` + `requireRole` avec normalisation des rôles
- **PINs citoyens hachés** (bcrypt) avec migration paresseuse des anciens PINs en clair
- **Mots de passe agents** : bcrypt uniquement (plus de fallback en clair)
- **Validation stricte** des entrées via zod sur toutes les routes sensibles
- **CORS restreint** aux origines autorisées (`CORS_ORIGINS`)
- **Helmet** (headers de sécurité) + **rate limiting** (auth + global API)
- **Requêtes paramétrées** PostgreSQL (anti-injection SQL)
- **Transactions** avec rollback sur les opérations critiques
- **Secrets** ignorés par git (`.env` dans `.gitignore`)
- **Audit logs** horodatés sur toutes les actions sensibles

## 📁 Structure du projet

```
MUTUALIS DAKAR/
├── eslint.config.js
├── index.html
├── package.json              # Frontend
├── vite.config.js            # Vite + PWA
├── vitest.config.js          # Tests frontend
├── run_frontend.ps1
│
├── backend/
│   ├── server.js             # API Express (routes)
│   ├── db.js                 # Pool PostgreSQL
│   ├── init_db.js            # Schéma + seed
│   ├── validators.js         # Schémas zod
│   ├── validateMiddleware.js # Middleware validation
│   ├── pagination.js         # Helper pagination
│   ├── jest.setup.js         # Config tests
│   ├── .env.example          # Modèle variables d'env
│   ├── package.json          # Backend
│   └── __tests__/
│       └── api.test.js       # 22 tests backend
│
└── src/
    ├── App.jsx               # Routeur principal + sync URL
    ├── main.jsx
    ├── components/
    │   ├── Header.jsx        # Sidebar navigation
    │   ├── Footer.jsx
    │   ├── ChatbotWidget.jsx # Zahara (Gemini + Web Speech)
    │   └── AudioReader.jsx   # Lecteur vocal (Web Speech)
    ├── views/                # 18 vues (Home, Login, Beneficiaries…)
    ├── utils/
    │   └── phonetics.js      # Détection Wolof + phonétique TTS
    ├── styles/
    └── test/                 # Tests frontend (14 tests)
```

## 👤 Comptes de démonstration

### Citoyens
| Téléphone | PIN | Nom | Formule |
|---|---|---|---|
| `771234567` | `1234` | Modou Diop | Individuel |
| `779876543` | `1234` | Awa Ndiaye | Familial |

### Agents
| Identifiant | Mot de passe | Rôle |
|---|---|---|
| `agent@cmu.sn` | `senecarte` | Admin Régional |
| `superadmin@cmu.sn` | `superadmin2026` | Super Admin |

> ⚠️ **Changez ces credentials en production.**

## 🚢 Déploiement

### Build production frontend

```bash
npm run build      # génère dist/
npm run preview    # prévisualisation du build
```

### Variables d'environnement production

- `JWT_SECRET` et `JWT_REFRESH_SECRET` : générez avec `openssl rand -hex 64`
- `CORS_ORIGINS` : votre domaine frontend (ex. `https://mutualis-dakar.sn`)
- `GEMINI_API_KEY` : clé production Google Gemini
- HTTPS obligatoire (reverse proxy Nginx recommandé)
- Sauvegardes PostgreSQL automatiques

## 📄 Licence

Projet MUTUALIS DAKAR — URMSCD. Tous droits réservés.

