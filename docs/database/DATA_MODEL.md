# DATA_MODEL — Modèle de données MUTUALIS

> Vue d'ensemble utile aux agents. Le schéma réel s'auto-migre au démarrage (`server.js`, bloc « Ensure indexes ») et via `init_db.js`.

## Tables principales

### beneficiaries — les assurés
| Colonne | Rôle |
|---|---|
| `cmu_number` | Matricule unique (index unique partiel). Format officiel `REGION-MSD-ANNEE-SEQ` ; anciens formats tolérés et résolus via aliases. |
| `msd_code` | **Clé de cloisonnement** — le CODE de MSD, jamais le libellé. |
| `status` | `active` / `pending`. |
| `photo_url` | base64 — JAMAIS dans les listes paginées (servi à la demande). |
| `package_type` | `individuel` / `familial` / `parrainage`. |
| `sponsor_phone`, `sponsor_logo` | Parrainage. |
| `school_name`, `student_type`, `school_class`, `academic_year`, `ine`, `ia_ief`, `tutor_name`, `tutor_phone` | CMU-Élèves / Daara. |
| `lot_code` | Lot de campagne de provenance (NULL = carte historique jamais recodable). |
| `merged_into` | Fiche absorbée par consolidation — reste en base, sort des listes. |
| `nin` | Identité stable — rend la réimportation idempotente (index partiel). |

### beneficiary_code_aliases
`alias_code` → `canonical_code`. Une carte imprimée avec un ancien code retrouve son porteur.

### family_members
Membres du foyer d'un bénéficiaire (`beneficiary_id`, index dédié).

### mutuelles
MSD de santé départementales : `name`, `region`, `commune`, `status`.

### claims — prises en charge
`beneficiary_id`, `status` (`pending`/`approved`/`rejected`/`paid`), `reimbursed_amount`, `coverage_rate`, `processed_by`.

### guarantee_letters — lettres de garantie
`beneficiary_id`, `partner_structure_id`, `status` (`pending` → validation humaine), `validation_code` généré serveur.

### purchase_orders — bons de commande pharmacie
`beneficiary_id`, `items` (JSON), `total_amount`, rachat via `redeem`.

### cotisations
`beneficiary_id`, `period_start`/`period_end`, `status='paid'`, `payment_reference`.

### payments
Suivi des paiements opérateur (`initiate` → `webhook` → statut).

### complaints — réclamations
Dépôt public validé zod ; `status` (`open`/`resolved`), `resolution_notes`, `resolved_by`.

### notifications
SMS/WhatsApp journalisés (`channel`, `recipient`, `status`).

### audit_logs
Journal d'audit : `action`, `actor`, `details`, `created_at` (index DESC). Lecture réservée admin.

### agents
Comptes agents/admins : `username`, `password_hash` (bcrypt), `role` (libellés FR normalisés par `rbac.js`), `msd_code` (absent pour Super Admin).

### refresh_tokens
`token_hash` (SHA-256 — jamais le jeton en clair), `user_id`, `user_role`, `expires_at`.

### partner_structures / partner_users
Structures sanitaires conventionnées + comptes partenaire (`role='partner'`, `structureName`, `coverageRate` dans le jeton).

### telemedicine_sessions / appointments
Sessions téléconsultation et rendez-vous, tous deux liés à `beneficiary_id`.

### platform_settings
Paramètres plateforme clé/valeur JSONB — héberge l'état du **mode maintenance**.

### campaign_lots
Lots de campagne : `code` (unique, `LOT-AAAA-NNN`), `card_count`, `printed` (verrou de recodage).

### blog_articles / blog_comments / gallery_items / news
Contenus éditoriaux — tous paginés côté serveur.

## Index créés au démarrage (server.js)

`beneficiaries(phone)`, `beneficiaries(cmu_number)`, `beneficiaries(nin) WHERE nin <> ''`,
`family_members(beneficiary_id)`, `audit_logs(created_at DESC)`, `beneficiaries(lot_code) WHERE lot_code IS NOT NULL`, index unique partiel sur `cmu_number`.

## Conventions

- Toute table de ressource porte le cloisonnement (directement ou via jointure `beneficiaries.msd_code`).
- Toute liste expose `{ data, pagination }` — jamais un tableau brut au-delà du plafond.
- Champs optionnels : `NULL` explicite ; champs obligatoires : rejet zod.
