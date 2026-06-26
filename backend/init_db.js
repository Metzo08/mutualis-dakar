const { pool } = require('./db');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const createTablesQuery = `
  DROP TABLE IF EXISTS family_members CASCADE;
  DROP TABLE IF EXISTS beneficiaries CASCADE;
  DROP TABLE IF EXISTS donations CASCADE;
  DROP TABLE IF EXISTS locations CASCADE;
  DROP TABLE IF EXISTS mutuelles CASCADE;
  DROP TABLE IF EXISTS news CASCADE;
  DROP TABLE IF EXISTS agents CASCADE;
  DROP TABLE IF EXISTS audit_logs CASCADE;
  DROP TABLE IF EXISTS coverage_items CASCADE;
  DROP TABLE IF EXISTS complaints CASCADE;
  DROP TABLE IF EXISTS internal_messages CASCADE;
  DROP TABLE IF EXISTS refresh_tokens CASCADE;
  DROP TABLE IF EXISTS claims CASCADE;
  DROP TABLE IF EXISTS notifications CASCADE;
  DROP TABLE IF EXISTS cotisations CASCADE;
  DROP TABLE IF EXISTS partner_users CASCADE;
  DROP TABLE IF EXISTS partner_structures CASCADE;
  DROP TABLE IF EXISTS csu_programs CASCADE;
  DROP TABLE IF EXISTS loyalty_points CASCADE;
  DROP TABLE IF EXISTS loyalty_badges CASCADE;
  DROP TABLE IF EXISTS payments CASCADE;
  DROP TABLE IF EXISTS sync_queue CASCADE;

  CREATE TABLE IF NOT EXISTS internal_messages (
    id SERIAL PRIMARY KEY,
    sender_username VARCHAR(100) NOT NULL,
    receiver_username VARCHAR(100) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Refresh tokens pour le mécanisme de renouvellement JWT
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

  CREATE TABLE IF NOT EXISTS mutuelles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    region VARCHAR(100) NOT NULL,
    commune VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    agreement VARCHAR(100) NOT NULL,
    manager VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    rates VARCHAR(255) NOT NULL,
    services TEXT NOT NULL,
    certified BOOLEAN DEFAULT FALSE,
    last_update VARCHAR(50) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'office', 'mutuelle', 'hospital', 'pharmacy'
    subtype VARCHAR(50),
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    description TEXT NOT NULL,
    phone VARCHAR(50) NOT NULL,
    commune VARCHAR(255),
    hours VARCHAR(100),
    services TEXT,
    coverage VARCHAR(100),
    landmark TEXT,
    local_info TEXT
  );

  CREATE TABLE IF NOT EXISTS beneficiaries (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birth_date VARCHAR(50) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    address VARCHAR(255) NOT NULL,
    mutuelle_name VARCHAR(255) NOT NULL,
    package_type VARCHAR(50) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    cmu_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    pin_code VARCHAR(255) DEFAULT NULL,
    photo_url TEXT,
    sponsor_phone VARCHAR(50),
    school_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS family_members (
    id SERIAL PRIMARY KEY,
    beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relation VARCHAR(50) NOT NULL,
    age INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS donations (
    id SERIAL PRIMARY KEY,
    amount INTEGER NOT NULL,
    target VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS news (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    date VARCHAR(50) NOT NULL,
    image_url VARCHAR(255) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'agent',
    photo_url TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    actor VARCHAR(255) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS coverage_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'medicament', 'soin'
    covered BOOLEAN NOT NULL,
    coverage_rate INTEGER DEFAULT 0,
    category VARCHAR(150),
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS complaints (
    id SERIAL PRIMARY KEY,
    beneficiary_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'resolved'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Programmes CSU (gratuités nationales : Sésame, Césariennes, Dialyse, Enfants 0-5…)
  CREATE TABLE IF NOT EXISTS csu_programs (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    title_fr VARCHAR(255) NOT NULL,
    title_wo VARCHAR(255),
    description_fr TEXT NOT NULL,
    description_wo TEXT,
    icon VARCHAR(50),
    target_audience VARCHAR(255),
    coverage_rate INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Demandes de prise en charge (tiers-payant / remboursement)
  CREATE TABLE IF NOT EXISTS claims (
    id SERIAL PRIMARY KEY,
    beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
    beneficiary_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    structure_name VARCHAR(255) NOT NULL,
    care_type VARCHAR(100) NOT NULL, -- 'consultation', 'pharmacie', 'hospitalisation', 'acte'
    care_description TEXT,
    amount INTEGER NOT NULL DEFAULT 0,
    coverage_rate INTEGER DEFAULT 80,
    reimbursed_amount INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'paid'
    treatment_date DATE,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    processed_by VARCHAR(255),
    rejection_reason TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_claims_beneficiary ON claims(beneficiary_id);
  CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

  -- Notifications (SMS/WhatsApp, statut et journal)
  CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL DEFAULT 'sms', -- 'sms', 'whatsapp', 'email'
    recipient VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'adhésion', 'cotisation', 'réclamation', 'prise_en_charge', 'rappel'
    title VARCHAR(255),
    body TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_beneficiary ON notifications(beneficiary_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

  -- Cotisations annuelles des bénéficiaires (historique + statut d'expiration)
  CREATE TABLE IF NOT EXISTS cotisations (
    id SERIAL PRIMARY KEY,
    beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
    cmu_number VARCHAR(100),
    phone VARCHAR(50),
    amount INTEGER NOT NULL DEFAULT 4500,
    payment_method VARCHAR(50) DEFAULT 'wave',
    payment_reference VARCHAR(255),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'paid', -- 'paid', 'pending', 'expired'
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_cotisations_beneficiary ON cotisations(beneficiary_id);
  CREATE INDEX IF NOT EXISTS idx_cotisations_status ON cotisations(status);
  CREATE INDEX IF NOT EXISTS idx_cotisations_period_end ON cotisations(period_end);

  -- Structures de soins partenaires (espace partenaire / tiers-payant)
  CREATE TABLE IF NOT EXISTS partner_structures (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'hopital', 'centre', 'poste', 'pharmacie', 'clinique'
    commune VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    agreement_number VARCHAR(100) UNIQUE,
    coverage_rate INTEGER DEFAULT 80,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Comptes utilisateurs des structures partenaires
  CREATE TABLE IF NOT EXISTS partner_users (
    id SERIAL PRIMARY KEY,
    structure_id INTEGER REFERENCES partner_structures(id) ON DELETE CASCADE,
    username VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'agent_structure',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Points de fidélité des assurés (cumul + historique)
  CREATE TABLE IF NOT EXISTS loyalty_points (
    id SERIAL PRIMARY KEY,
    beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    reason VARCHAR(255) NOT NULL, -- 'cotisation_a_temps', 'parrainage', 'sans_reclamation', 'annee_fidelite'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_loyalty_beneficiary ON loyalty_points(beneficiary_id);

  -- Badges débloqués par les assurés
  CREATE TABLE IF NOT EXISTS loyalty_badges (
    id SERIAL PRIMARY KEY,
    beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
    badge_slug VARCHAR(100) NOT NULL, -- 'assure_fidele', 'parrain_solidarite', 'citoyen_modele', 'veteran_5ans'
    badge_name VARCHAR(255) NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(beneficiary_id, badge_slug)
  );

  -- Transactions de paiement (Orange Money / Wave) avec statut et webhook
  CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(100) UNIQUE NOT NULL,
    beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
    phone VARCHAR(50) NOT NULL,
    provider VARCHAR(50) NOT NULL, -- 'orange_money', 'wave'
    amount INTEGER NOT NULL,
    currency VARCHAR(10) DEFAULT 'XOF',
    purpose VARCHAR(100) NOT NULL, -- 'cotisation', 'donation', 'adhesion'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'initiated', 'success', 'failed', 'cancelled'
    provider_transaction_id VARCHAR(255),
    webhook_received BOOLEAN DEFAULT FALSE,
    webhook_payload TEXT,
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    metadata JSONB
  );
  CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference);
  CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
  CREATE INDEX IF NOT EXISTS idx_payments_beneficiary ON payments(beneficiary_id);

  -- File d'attente de synchronisation pour le mode hors-ligne (actions reportées)
  CREATE TABLE IF NOT EXISTS sync_queue (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255),
    beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL, -- 'claim', 'complaint', 'donation', 'cotisation'
    payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processed', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status);
`;

const mutuellesData = [
  [
    'Mutuelle de la Médina',
    'Dakar',
    'Médina',
    'active',
    'DK-012-2022',
    'Moussa Fall',
    '+221 77 500 11 22',
    'medina@mutualisdakar.sn',
    '4 500 FCFA / an (Individuel) | 1 000 FCFA carte + 3 500 FCFA/membre (Famille)',
    'Prise en charge consultations (80%), pharmacie (50%), hôpital (70%)',
    true,
    '18/05/2026'
  ],
  [
    'Mutuelle de Pikine Ouest',
    'Dakar',
    'Pikine Ouest',
    'active',
    'DK-088-2023',
    'Fatou Wade',
    '+221 77 622 33 44',
    'pikineouest@mutualisdakar.sn',
    '6 500 FCFA / an (Individuel) | 22 000 FCFA / an (Famille)',
    'Consultations de maternité (90%), pharmacie (60%), hospitalisation (75%)',
    true,
    '10/06/2026'
  ],
  [
    'Mutuelle de Mbour Escale',
    'Thiès',
    'Mbour',
    'active',
    'TH-023-2020',
    'Ousmane Sene',
    '+221 77 411 99 88',
    'mbour.escale@unamusc.sn',
    '4 500 FCFA / an',
    'Soins de base (80%), pharmacie (50%)',
    true,
    '04/04/2026'
  ],
  [
    'Mutuelle de Kaolack Ndangane',
    'Kaolack',
    'Kaolack',
    'active',
    'KL-045-2021',
    'Ami Diop',
    '+221 77 810 20 30',
    'kaolack.nd@unamusc.sn',
    '8 000 FCFA / an',
    'Consultations (80%), soins pédiatriques (90%), pharmacie (60%)',
    true,
    '12/03/2026'
  ],
  [
    'Mutuelle de Saint-Louis Sor',
    'Saint-Louis',
    'Saint-Louis Sor',
    'active',
    'SL-010-2019',
    'Cheikh Diallo',
    '+221 77 912 34 56',
    'sl.sor@unamusc.sn',
    '7 500 FCFA / an',
    'Consultations (80%), pharmacie (50%), soins spécialisés (60%)',
    true,
    '20/05/2026'
  ]
];

// locationsData static array is removed to read dynamically from locations_data.json

const newsData = [
  [
    'Lancement officiel de la carte QR Santé',
    'L\'URMSCD lance officiellement la carte QR Santé pour simplifier l\'accès aux soins tiers-payants dans la région de Dakar. Ce projet pilote vise à connecter 10 000 usagers dans les 6 premiers mois.',
    '15/06/2026',
    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=500&q=80'
  ],
  [
    'Assemblée Générale annuelle de l\'URMSCD',
    'Les délégués des 5 départements se sont réunis à Cité Keur Gorgui pour valider le plan stratégique de digitalisation de la mutualité 2026-2028 et le rapprochement avec l\'UNAMUSC.',
    '02/06/2026',
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=500&q=80'
  ],
  [
    'Partenariat renforcé avec les Hôpitaux',
    'De nouvelles structures sanitaires de référence comme Dalal Jamm et l\'Hôpital Principal intègrent notre réseau conventionné pour offrir une couverture optimale de soins.',
    '28/05/2026',
    'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=500&q=80'
  ]
];

async function initializeDatabase() {
  try {
    console.log('Connexion à la base de données...');
    // Create tables
    await pool.query(createTablesQuery);
    console.log('Tables créées avec succès.');

    // Seed Mutuelles
    for (const row of mutuellesData) {
      await pool.query(
        `INSERT INTO mutuelles (name, region, commune, status, agreement, manager, phone, email, rates, services, certified, last_update)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        row
      );
    }
    console.log('Données des mutuelles insérées.');

    // Seed Locations
    const locationsDataPath = path.join(__dirname, 'locations_data.json');
    if (fs.existsSync(locationsDataPath)) {
      const locationsData = JSON.parse(fs.readFileSync(locationsDataPath, 'utf8'));
      for (const row of locationsData) {
        await pool.query(
          `INSERT INTO locations (name, type, subtype, lat, lng, description, phone, commune, hours, services, coverage, landmark, local_info)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [row.name, row.type, row.subtype, row.lat, row.lng, row.description, row.phone, row.commune, row.hours, row.services, row.coverage, row.landmark, row.local_info]
        );
      }
      console.log(`${locationsData.length} données géographiques de la carte insérées.`);
    } else {
      console.warn("Fichier locations_data.json introuvable, insertion des localisations ignorée.");
    }

    // Seed News
    for (const row of newsData) {
      await pool.query(
        `INSERT INTO news (title, content, date, image_url)
         VALUES ($1, $2, $3, $4)`,
        row
      );
    }
    console.log('Articles d\'actualités insérés.');

    // Insert multiple active and pending beneficiaries with families for testing
    const demoBeneficiaries = [
      [
        'Modou', 'Diop', '1990-05-12', '771234567', 'modou.diop@example.com',
        'Médina Rue 22, Dakar', 'Mutuelle de la Médina', 'individuel', 'wave',
        'SN-DK-MED-8472', 'active', '1234'
      ],
      [
        'Awa', 'Ndiaye', '1985-08-22', '779876543', 'awa.ndiaye@example.com',
        'Pikine Ouest Quartier Tally Boubess, Dakar', 'Mutuelle de Pikine Ouest', 'familial', 'om',
        'SN-DK-PIK-9021', 'active', '1234'
      ],
      [
        'Amadou', 'Sow', '1993-02-14', '764551122', 'amadou.sow@example.com',
        'Commune de la Médina, Rue 10, Dakar', 'Mutuelle de la Médina', 'individuel', 'wave',
        'SN-DK-MED-1284', 'pending', '1234'
      ],
      [
        'Fatou', 'Fall', '1979-11-30', '775123456', 'fatou.fall@example.com',
        'Rufisque Est, quartier Mérina, Dakar', 'Mutuelle de Rufisque Est', 'familial', 'wave',
        'SN-DK-RUF-3382', 'active', '1234'
      ]
    ];

    const insertedIds = [];
    const pinSalt = await bcrypt.genSalt(10);
    const hashedDefaultPin = await bcrypt.hash('1234', pinSalt); // PIN de démonstration (à changer par l'usager)
    for (const b of demoBeneficiaries) {
      // Le dernier élément ('1234') est remplacé par son hash bcrypt avant insertion
      const row = [...b];
      row[row.length - 1] = hashedDefaultPin;
      const res = await pool.query(
        `INSERT INTO beneficiaries (first_name, last_name, birth_date, phone, email, address, mutuelle_name, package_type, payment_method, cmu_number, status, pin_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        row
      );
      insertedIds.push(res.rows[0].id);
    }

    // Insert family members for the familial ones
    // Awa Ndiaye (familial - index 1)
    await pool.query(
      `INSERT INTO family_members (beneficiary_id, name, relation, age) VALUES 
       ($1, 'Moustapha Ndiaye', 'conjoint', 42),
       ($1, 'Khadija Ndiaye', 'enfant', 12),
       ($1, 'Abdoulaye Ndiaye', 'enfant', 8)`,
      [insertedIds[1]]
    );

    // Fatou Fall (familial - index 3)
    await pool.query(
      `INSERT INTO family_members (beneficiary_id, name, relation, age) VALUES 
       ($1, 'Seydou Fall', 'enfant', 16),
       ($1, 'Aminata Fall', 'enfant', 14)`,
      [insertedIds[3]]
    );

    console.log('Bénéficiaires et ayants droit de démonstration créés.');

    // Seed Agent
    const salt = await bcrypt.genSalt(10);
    const hashAgent = await bcrypt.hash('senecarte', salt);
    const hashSuperAdmin = await bcrypt.hash('superadmin2026', salt);

    await pool.query(
      `INSERT INTO agents (username, password_hash, first_name, last_name, role) VALUES
       ('agent@cmu.sn', $1, 'Amadou', 'Sall', 'Admin Régional'),
       ('superadmin@cmu.sn', $2, 'Moussa', 'Ndiaye', 'Super Admin')`,
       [hashAgent, hashSuperAdmin]
    );
    console.log('Agent CMU de démonstration créé.');

    // Seed Programmes CSU (gratuités nationales du Sénégal)
    const csuPrograms = [
      ['sesame-plan', 'Plan Sésame (60 ans et +)', 'Plan Sésame (60 at ak gën)', 'Gratuité totale des soins pour les personnes âgées de 60 ans et plus dans les structures publiques.', 'Fajukaay yi ñu yërmaale ñi nelaw 60 at ak gën ci fajukaay bu dowmi.', '👴', 'Personnes âgées ≥ 60 ans', 100, true, 1],
      ['cesariennes', 'Césariennes gratuites', 'Césarienne yi ñu yërmaale', 'Gratuité des césariennes dans tous les hôpitaux publics et structures de santé agréées.', 'Césarienne yëpp ñu leen yërmaale ci fajukaay yi.', '🤱', 'Femmes enceintes', 100, true, 2],
      ['enfants-0-5', 'Soins enfants 0-5 ans', 'Faj gu gone 0-5 at', 'Prise en charge gratuite des soins pour les enfants de 0 à 5 ans (infections, paludisme, vaccination).', 'Faj gu gone yu 0 ba 5 at ñu yërmaale ko.', '👶', 'Enfants 0-5 ans', 100, true, 3],
      ['dialyse', 'Dialyse subventionnée', 'Dialyse bu ñu néwallal', 'Subvention de 100% des séances de dialyse pour les insuffisants rénaux (3 séances/semaine).', 'Dialyse bi ñu néwallal ko ñëpp ci insuffisants rénaux.', '🩺', 'Insuffisants rénaux', 100, true, 4],
      ['accouchement', 'Accouchement gratuit', 'Juddu gu ñu yërmaale', 'Gratuité des accouchements eutociques et de la consultation prénatale dans les structures publiques.', 'Juddu ak consultation prénatale ñu yërmaale leen.', '🏥', 'Femmes enceintes', 100, true, 5]
    ];
    for (const p of csuPrograms) {
      await pool.query(
        `INSERT INTO csu_programs (slug, title_fr, title_wo, description_fr, description_wo, icon, target_audience, coverage_rate, is_active, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        p
      );
    }
    console.log('Programmes CSU créés.');

    // Seed Coverage Items
    const coverageItems = [
      ['Paracétamol 500mg', 'medicament', true, 80, 'Antalgique', 'Médicament générique essentiel pour la douleur et la fièvre.'],
      ['Amoxicilline 500mg', 'medicament', true, 80, 'Antibiotique', 'Antibiotique de base pris en charge à 80% en pharmacie conventionnée.'],
      ['ACT (traitement paludisme)', 'medicament', true, 100, 'Antipaludéen', 'Traitement antipaludique d\'urgence entièrement pris en charge.'],
      ['Insuline Humaine', 'medicament', true, 50, 'Diabète', 'Insuline pour le diabète de type 1, prise en charge à 50%.'],
      ['Métformine 500mg', 'medicament', true, 80, 'Diabète', 'Antidiabétique oral, couvert à 80%.'],
      ['Ibuprofène 400mg', 'medicament', true, 80, 'Anti-inflammatoire', 'Anti-inflammatoire non stéroïdien courant, remboursé en pharmacie conventionnée.'],
      ['Ceftriaxone 1g Injectable', 'medicament', true, 80, 'Antibiotique', 'Antibiotique injectable pour infections graves, couvert dans le réseau CMU.'],
      ['Amlodipine 5mg', 'medicament', true, 80, 'Hypertension', 'Traitement de l\'hypertension artérielle, remboursé à 80% pour les assurés.'],
      ['Oméprazole 20mg', 'medicament', true, 80, 'Anti-acide', 'Traitement du reflux gastro-œsophagien et des ulcères d\'estomac.'],
      ['Salbutamol Aérosol (Ventoline)', 'medicament', true, 80, 'Asthme', 'Bronchodilatateur d\'urgence pour crises d\'asthme, pris en charge à 80%.'],
      ['Gliclazide 80mg', 'medicament', true, 80, 'Diabète', 'Antidiabétique oral de la famille des sulfamides, couvert à 80%.'],
      ['Artésunate/Amodiaquine', 'medicament', true, 100, 'Antipaludéen', 'Combinaison antipaludique générique, couverte à 100% (gratuite).'],
      ['Sérum Physiologique Flacon', 'medicament', true, 80, 'Soin de base', 'Solution de nettoyage des plaies et muqueuses, remboursée à 80%.'],
      ['Spasfon (Trimébutine)', 'medicament', true, 80, 'Spasmolytique', 'Traitement des douleurs spasmodiques abdominales et digestives.'],
      ['Vaccin Hépatite B', 'medicament', true, 100, 'Vaccination', 'Vaccin obligatoire pour les nourrissons, entièrement couvert.'],
      ['Viagra (Sildénafil)', 'medicament', false, 0, 'Confort sexuel', 'Indicateur de dysfonction érectile, non couvert par le régime obligatoire CMU.'],
      ['Roaccutane (Isotrétinoïne)', 'medicament', false, 0, 'Dermatologie', 'Traitement de l\'acné sévère, considéré comme traitement spécialisé non pris en charge.'],
      ['Vitamines C + Zinc (Cevamyline)', 'medicament', false, 0, 'Complément', 'Complément multivitaminé acheté en parapharmacie sans ordonnance de pathologie.'],
      ['Crème Anti-rides Premium', 'medicament', false, 0, 'Cosméceutique', 'Soin cutané à visée esthétique, exclu des remboursements CMU.'],
      ['Sirop de Toux Importé (Marque)', 'medicament', false, 0, 'Toux de confort', 'Spécialités de sirops importés non génériques, non inscrits sur la liste CMU.'],
      ['Shampoing Anti-poux Spécial', 'medicament', false, 0, 'Dermatologie', 'Traitement capillaire de confort, non remboursé par le régime général.'],
      ['Consultation médecine générale', 'soin', true, 80, 'Consultation', 'Consultation généraliste en poste de santé publique ou clinique conventionnée.'],
      ['Consultation pédiatrique', 'soin', true, 80, 'Consultation', 'Examen clinique de l\'enfant par un pédiatre agréé.'],
      ['Consultation gynécologique', 'soin', true, 80, 'Gynécologie', 'Consultation spécialisée pour le suivi de la femme et de la grossesse.'],
      ['Accouchement Simple', 'soin', true, 100, 'Maternité', 'Accouchement simple en poste de santé public, gratuit et entièrement couvert.'],
      ['Césarienne d\'urgence', 'soin', true, 100, 'Maternité', 'Opération de césarienne effectuée dans le public, couverte à 100%.'],
      ['Radiographie pulmonaire', 'soin', true, 80, 'Imagerie', 'Examen radiographique du thorax sur prescription médicale.'],
      ['Analyse de sang (Hémogramme)', 'soin', true, 80, 'Laboratoire', 'Examen biologique sanguin de base prescrit par un médecin.'],
      ['Échographie Obstétricale', 'soin', true, 80, 'Imagerie', 'Examen échographique de suivi de grossesse en centre agréé.'],
      ['Plâtre suite à fracture', 'soin', true, 80, 'Traumatologie', 'Pose de plâtre et réduction de fracture simple aux urgences publiques.'],
      ['Séance de Kinésithérapie', 'soin', true, 80, 'Rééducation', 'Séance de rééducation fonctionnelle prescrite suite à une intervention.'],
      ['Chimiothérapie complexe', 'soin', false, 0, 'Oncologie', 'Protocoles de chimiothérapie spécialisés hors liste nationale CMU.'],
      ['Chirurgie esthétique de confort', 'soin', false, 0, 'Chirurgie', 'Actes esthétiques non reconstructeurs, non pris en charge.'],
      ['Implants dentaires cosmétiques', 'soin', false, 0, 'Dentaire', 'Soins de dentisterie esthétique et prothèses haut de gamme, non couverts.'],
      ['Verres progressifs de luxe', 'soin', false, 0, 'Optique', 'Verres progressifs et montures importées de luxe.'],
      ['Compléments alimentaires', 'medicament', false, 0, 'Confort', 'Fortifiants et vitamines de confort achetés hors prescription de traitement.'],
      ['Blanchiment Dentaire Laser', 'soin', false, 0, 'Dentaire esthétique', 'Éclaircissement des dents à visée purement cosmétique.'],
      ['Bilan de santé Check-up VIP', 'soin', false, 0, 'Prévention', 'Bilan complet systématique sans symptôme ni prescription ciblée.'],
      ['Chirurgie Réfractive (Laser yeux)', 'soin', false, 0, 'Ophtalmologie', 'Chirurgie au laser pour corriger la myopie à la place des lunettes.'],
      ['Cure Thermale de Confort', 'soin', false, 0, 'Thermalisme', 'Séjour en centre thermal sans indication thérapeutique vitale validée.']
    ];

    for (const item of coverageItems) {
      await pool.query(
        `INSERT INTO coverage_items (name, type, covered, coverage_rate, category, description)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        item
      );
    }
    console.log('Données d\'annuaire des médicaments et soins insérées.');

    // Seed Complaints
    const complaintsData = [
      ['Awa Ndiaye', '779876543', 'Refus de tiers-payant', 'La pharmacie du Plateau a refusé d\'appliquer le taux de 80% sur mon ordonnance d\'Amoxicilline sous prétexte que le système était hors ligne.', 'open'],
      ['Modou Diop', '771234567', 'Erreur orthographe prénom', 'Mon prénom est enregistré en tant que Moudou au lieu de Modou. Merci de corriger.', 'resolved']
    ];

    for (const comp of complaintsData) {
      await pool.query(
        `INSERT INTO complaints (beneficiary_name, phone, title, description, status)
         VALUES ($1, $2, $3, $4, $5)`,
        comp
      );
    }
    console.log('Plaintes et réclamations de démonstration insérées.');

    // Seed Audit Logs
    await pool.query(
      `INSERT INTO audit_logs (action, actor, details) VALUES
       ('SYSTEM_INIT', 'Système', 'Initialisation et seeding de la base de données MUTUALIS DAKAR.'),
       ('PRE_INSCRIPTION', '764551122', 'Soumission de pré-inscription pour Amadou Sow.')`
    );
    console.log('Logs d\'audit de démonstration insérés.');

    // Seed Structures partenaires (espace partenaire / tiers-payant)
    const partnerStructures = [
      ['Hôpital Principal de Dakar', 'hopital', 'Dakar Plateau', '+221338395050', 'hp@cmu.sn', 'Avenue Nelson Mandela', 'DK-HOP-001', 80],
      ['Hôpital de Fann', 'hopital', 'Fann', '+221338691818', 'fann@cmu.sn', 'Avenue Cheikh Anta Diop', 'DK-HOP-002', 80],
      ['Hôpital Dalal Jamm', 'hopital', 'Guédiawaye', '+221338794040', 'dalaljamm@cmu.sn', 'Voie de contournement', 'DK-HOP-003', 80],
      ['Centre de santé de la Médina', 'centre', 'Médina', '+221338222424', 'medina@cmu.sn', 'Avenue Blaise Diagne', 'DK-CTR-001', 80],
      ['Pharmacie du Plateau', 'pharmacie', 'Dakar Plateau', '+221338232323', 'pharmacie.plateau@cmu.sn', 'Avenue Albert Sarraut', 'DK-PHA-001', 50],
      ['Clinique de la Madeleine', 'clinique', 'Dakar Plateau', '+221338899494', 'madeleine@cmu.sn', 'Avenue Hassan II', 'DK-CLI-001', 80]
    ];
    const structureIds = [];
    for (const ps of partnerStructures) {
      const res = await pool.query(
        `INSERT INTO partner_structures (name, type, commune, phone, email, address, agreement_number, coverage_rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        ps
      );
      structureIds.push(res.rows[0].id);
    }

    // Compte partenaire de démonstration (structure #1 = Hôpital Principal)
    const partnerSalt = await bcrypt.genSalt(10);
    const partnerHash = await bcrypt.hash('partenaire2026', partnerSalt);
    await pool.query(
      `INSERT INTO partner_users (structure_id, username, password_hash, contact_name, role)
       VALUES ($1, $2, $3, $4, $5)`,
      [structureIds[0], 'hp@cmu.sn', partnerHash, 'Réception HP Dakar', 'agent_structure']
    );
    console.log('Structures partenaires et compte de démonstration créés.');

    // Seed Cotisations (historique + statuts variés pour le suivi)
    const cotisationsData = [
      [1, 'SN-DK-MED-8472', '771234567', 4500, 'wave', 'WAV-2026-001', '2025-07-01', '2026-06-30', 'paid', true],
      [2, 'SN-DK-PIK-9021', '779876543', 4500, 'om', 'OM-2026-002', '2025-08-15', '2026-08-14', 'paid', false],
      [3, 'SN-DK-MED-1284', '764551122', 4500, 'wave', 'WAV-2026-003', '2025-05-01', '2026-04-30', 'expired', true],
      [4, 'SN-DK-RUF-3382', '775123456', 4500, 'om', 'OM-2026-004', '2026-06-15', '2027-06-14', 'paid', false]
    ];
    for (const c of cotisationsData) {
      await pool.query(
        `INSERT INTO cotisations (beneficiary_id, cmu_number, phone, amount, payment_method, payment_reference, period_start, period_end, status, reminder_sent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        c
      );
    }
    console.log('Cotisations de démonstration créées.');

    // Seed Points de fidélité + badges
    // Modou Diop (id=1) : assuré fidèle, cotisation à temps, sans réclamation
    await pool.query(
      `INSERT INTO loyalty_points (beneficiary_id, points, reason) VALUES
       (1, 50, 'cotisation_a_temps'),
       (1, 30, 'sans_reclamation'),
       (1, 20, 'annee_fidelite')`
    );
    await pool.query(
      `INSERT INTO loyalty_badges (beneficiary_id, badge_slug, badge_name) VALUES
       (1, 'assure_fidele', 'Assuré Fidèle'),
       (1, 'citoyen_modele', 'Citoyen Modèle')`
    );
    // Awa Ndiaye (id=2) : parrainage + cotisation
    await pool.query(
      `INSERT INTO loyalty_points (beneficiary_id, points, reason) VALUES
       (2, 50, 'cotisation_a_temps'),
       (2, 40, 'parrainage')`
    );
    await pool.query(
      `INSERT INTO loyalty_badges (beneficiary_id, badge_slug, badge_name) VALUES
       (2, 'parrain_solidarite', 'Parrain Solidaire')`
    );
    console.log('Points de fidélité et badges créés.');

    // Seed Paiements de démonstration
    await pool.query(
      `INSERT INTO payments (reference, beneficiary_id, phone, provider, amount, purpose, status, provider_transaction_id) VALUES
       ('OM-2026-DEMO-001', 1, '771234567', 'orange_money', 4500, 'cotisation', 'success', 'OMP-' || DATE '2026-06-15'),
       ('WAV-2026-DEMO-002', 2, '779876543', 'wave', 4500, 'cotisation', 'success', 'WAVP-' || DATE '2026-06-16')`
    );
    console.log('Paiements de démonstration créés.');

    console.log('Initialisation et seeding terminés avec succès !');
    process.exit(0);
  } catch (err) {
    console.error('Erreur lors de l\'initialisation de la base de données :', err);
    process.exit(1);
  }
}

initializeDatabase();
