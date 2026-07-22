const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./db');
const bcrypt = require('bcrypt');
const fs = require('fs');

const createTablesQuery = `
  DROP TABLE IF EXISTS guarantee_letters CASCADE;
  DROP TABLE IF EXISTS purchase_orders CASCADE;
  DROP TABLE IF EXISTS telemedicine_sessions CASCADE;
  DROP TABLE IF EXISTS medical_antecedents CASCADE;
  DROP TABLE IF EXISTS appointments CASCADE;
  DROP TABLE IF EXISTS medical_imaging_results CASCADE;
  DROP TABLE IF EXISTS maternal_health_records CASCADE;
  DROP TABLE IF EXISTS external_patient_codes CASCADE;
  DROP TABLE IF EXISTS institutional_tenants CASCADE;
  DROP TABLE IF EXISTS family_members CASCADE;
  DROP TABLE IF EXISTS beneficiaries CASCADE;
  DROP TABLE IF EXISTS donations CASCADE;
  DROP TABLE IF EXISTS locations CASCADE;
  DROP TABLE IF EXISTS mutuelles CASCADE;
  DROP TABLE IF EXISTS news CASCADE;
  DROP TABLE IF EXISTS agents CASCADE;
  DROP TABLE IF EXISTS audit_logs CASCADE;
  DROP TABLE IF EXISTS regional_coverage CASCADE;
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
  DROP TABLE IF EXISTS partnerships CASCADE;
  DROP TABLE IF EXISTS blog_comments CASCADE;
  DROP TABLE IF EXISTS blog_articles CASCADE;
  DROP TABLE IF EXISTS gallery_items CASCADE;
  DROP TABLE IF EXISTS dynamic_content CASCADE;
  DROP TABLE IF EXISTS donation_campaigns CASCADE;

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
    last_update VARCHAR(50) NOT NULL,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    landmark TEXT,
    local_info TEXT
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
    department VARCHAR(100) DEFAULT 'Dakar',
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
    photo_url TEXT,
    department VARCHAR(100) DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    actor VARCHAR(255) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS regional_coverage (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    couv NUMERIC(5,2) NOT NULL,
    color VARCHAR(50) NOT NULL,
    mutuelles INTEGER NOT NULL,
    assures VARCHAR(50) NOT NULL,
    structures INTEGER NOT NULL
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
  CREATE INDEX IF NOT EXISTS idx_beneficiaries_phone ON beneficiaries(phone);
  CREATE INDEX IF NOT EXISTS idx_beneficiaries_cmu ON beneficiaries(cmu_number);
  CREATE INDEX IF NOT EXISTS idx_family_members_beneficiary ON family_members(beneficiary_id);
  CREATE INDEX IF NOT EXISTS idx_partner_users_structure ON partner_users(structure_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

  -- Demandes de partenariat (Espace partenariat)
  CREATE TABLE IF NOT EXISTS partnerships (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    sector VARCHAR(50) NOT NULL,
    contact_person VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    date VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Articles de blog (Espace blog et paroles d'experts)
  CREATE TABLE IF NOT EXISTS blog_articles (
    id SERIAL PRIMARY KEY,
    title_fr VARCHAR(255) NOT NULL,
    title_wo VARCHAR(255) NOT NULL,
    author VARCHAR(100) NOT NULL,
    role_fr VARCHAR(150) NOT NULL,
    role_wo VARCHAR(150) NOT NULL,
    avatar VARCHAR(50) DEFAULT '🩺',
    date BIGINT NOT NULL,
    read_time_fr VARCHAR(50) NOT NULL,
    read_time_wo VARCHAR(50) NOT NULL,
    preview_fr TEXT NOT NULL,
    preview_wo TEXT NOT NULL,
    content_fr TEXT NOT NULL,
    content_wo TEXT NOT NULL,
    image_url TEXT,
    likes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Commentaires d'articles de blog
  CREATE TABLE IF NOT EXISTS blog_comments (
    id SERIAL PRIMARY KEY,
    article_id INT REFERENCES blog_articles(id) ON DELETE CASCADE,
    author VARCHAR(100) NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Galerie CSU
  CREATE TABLE IF NOT EXISTS gallery_items (
    id SERIAL PRIMARY KEY,
    image VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    title_fr VARCHAR(255) NOT NULL,
    title_wo VARCHAR(255) NOT NULL,
    description_fr TEXT NOT NULL,
    description_wo TEXT NOT NULL,
    location_fr VARCHAR(150) NOT NULL,
    location_wo VARCHAR(150) NOT NULL,
    date_fr VARCHAR(50) NOT NULL,
    date_wo VARCHAR(50) NOT NULL,
    impact_fr VARCHAR(150) NOT NULL,
    impact_wo VARCHAR(150) NOT NULL,
    tags TEXT[] NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Contenus dynamiques généraux (InfosCSU, Institutionnel...)
  CREATE TABLE IF NOT EXISTS dynamic_content (
    key VARCHAR(100) PRIMARY KEY,
    content JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Campagnes de don / Solidarité nationale
  CREATE TABLE IF NOT EXISTS donation_campaigns (
    id SERIAL PRIMARY KEY,
    title_fr VARCHAR(255) NOT NULL,
    title_wo VARCHAR(255) NOT NULL,
    description_fr TEXT NOT NULL,
    description_wo TEXT NOT NULL,
    target_amount INTEGER NOT NULL,
    baseline_amount INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 1. Lettres de garantie (Prise en charge hospitalière / chirurgicale)
  CREATE TABLE IF NOT EXISTS guarantee_letters (
    id SERIAL PRIMARY KEY,
    beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
    partner_structure_id INTEGER REFERENCES partner_structures(id),
    medical_act VARCHAR(255) NOT NULL,
    estimated_amount NUMERIC(12, 2),
    guaranteed_percentage NUMERIC(5, 2) DEFAULT 80.00,
    max_amount NUMERIC(12, 2),
    document_url VARCHAR(512),
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, used
    validation_code VARCHAR(64) UNIQUE,
    agent_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 2. Bons de commande (Pharmacie / Tiers-payant, validité 48h)
  CREATE TABLE IF NOT EXISTS purchase_orders (
    id SERIAL PRIMARY KEY,
    beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
    prescription_date DATE,
    items_json JSONB NOT NULL,
    total_amount NUMERIC(12, 2),
    status VARCHAR(50) DEFAULT 'active', -- active, expired, used
    used_at TIMESTAMP,
    partner_structure_id INTEGER REFERENCES partner_structures(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 3. Télémédecine (Sessions WebRTC & Ordonnances)
  CREATE TABLE IF NOT EXISTS telemedicine_sessions (
    id SERIAL PRIMARY KEY,
    beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
    doctor_name VARCHAR(255),
    specialty VARCHAR(150),
    scheduled_at TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, active, completed, cancelled
    room_token VARCHAR(255) UNIQUE,
    medical_summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 4. Antécédents Médicaux & Groupe Sanguin
  CREATE TABLE IF NOT EXISTS medical_antecedents (
    id SERIAL PRIMARY KEY,
    beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
    blood_group VARCHAR(10),
    allergies TEXT,
    chronic_conditions TEXT,
    past_surgeries TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 5. Prise de Rendez-vous en Ligne
  CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
    partner_structure_id INTEGER REFERENCES partner_structures(id),
    doctor_name VARCHAR(255),
    specialty VARCHAR(150) NOT NULL,
    appointment_date TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed',
    notes TEXT,
    qr_access_code VARCHAR(64) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 6. Imagerie Médicale & Biologie (Scanner, Radio, IRM)
  CREATE TABLE IF NOT EXISTS medical_imaging_results (
    id SERIAL PRIMARY KEY,
    beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
    partner_structure_id INTEGER REFERENCES partner_structures(id),
    exam_type VARCHAR(100) NOT NULL, -- Radio, Scanner, IRM, Échographie, Biologie
    title VARCHAR(255) NOT NULL,
    report_pdf_url VARCHAR(512),
    dicom_images_json JSONB,
    doctor_notes TEXT,
    exam_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 7. Carnet de Santé Maternelle & Suivi Grossesse
  CREATE TABLE IF NOT EXISTS maternal_health_records (
    id SERIAL PRIMARY KEY,
    beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
    pregnancy_start_date DATE NOT NULL,
    expected_delivery_date DATE NOT NULL,
    cpn1_date DATE,
    cpn2_date DATE,
    cpn3_date DATE,
    cpn4_date DATE,
    risk_level VARCHAR(50) DEFAULT 'normal',
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 8. Codes Patients Externes (NIP / IPP Hospitalier Interopérable)
  CREATE TABLE IF NOT EXISTS external_patient_codes (
    id SERIAL PRIMARY KEY,
    beneficiary_id INTEGER REFERENCES beneficiaries(id) ON DELETE CASCADE,
    partner_structure_id INTEGER REFERENCES partner_structures(id),
    external_patient_code VARCHAR(100) NOT NULL,
    system_name VARCHAR(100) DEFAULT 'SIGOB/DHIS2',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(partner_structure_id, external_patient_code)
  );

  -- 9. Institutions Grands Comptes / Multi-Tenants (COUD / UCAD)
  CREATE TABLE IF NOT EXISTS institutional_tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    total_members INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

const mutuellesData = [
  [
    'Union Nationale des Mutuelles de Santé Communautaires (UNAMUSC)',
    'Dakar',
    'Dakar Plateau',
    'active',
    'UN-NAT-001-2015',
    'Président Demba Mame Ndiaye',
    '+221 33 823 45 67',
    'contact@unamusc.sn',
    'Faitière Nationale',
    'Coordination nationale, représentation politique, réassurance',
    true,
    '20/06/2026',
    14.6685,
    -17.4375,
    'Près du Ministère de la Santé, Immeuble administratif du Plateau, Dakar.',
    'Organe faîtier national représentant l\'ensemble des mutuelles de santé communautaires du Sénégal.'
  ],
  [
    'Union Régionale des Mutuelles de Santé de Dakar (URMSCD)',
    'Dakar',
    'Mermoz-Sacré Coeur',
    'active',
    'UR-DK-001-2016',
    'Mamadou Saliou Diallo',
    '+221 33 859 15 15',
    'contact@urmscd.sn',
    'Faitière Régionale',
    'Administration régionale, coordination des départements, appui technique',
    true,
    '15/06/2026',
    14.7008,
    -17.4651,
    'Cité Keur Gorgui, Immeuble Serigne Mérina SYLLA, Dakar.',
    'Union régionale qui coordonne les activités et la réassurance des mutuelles des 5 départements de Dakar.'
  ],
  [
    'MSD mutuelle de santé départementale de Dakar',
    'Dakar',
    'Dakar Plateau',
    'active',
    'UD-DK-001-2018',
    'Moustapha Mbengue',
    '+221 33 821 10 10',
    'ud.dakar@unamusc.sn',
    'Cotisation Faitière',
    'Coordination départementale des mutuelles de Dakar, audit',
    true,
    '10/06/2026',
    14.6865,
    -17.4475,
    'Avenue Blaise Diagne, près de l\'Hôtel de Ville de Dakar.',
    'Coordination des mutuelles de santé communales du département de Dakar. Accompagnement technique.'
  ],
  [
    'MSD mutuelle de santé départementale de Pikine',
    'Dakar',
    'Pikine Ouest',
    'active',
    'UD-DK-002-2018',
    'Idrissa Wade',
    '+221 33 851 44 22',
    'ud.pikine@unamusc.sn',
    'Cotisation Faitière',
    'Coordination départementale, formation des gérants locaux',
    true,
    '12/06/2026',
    14.7523,
    -17.4011,
    'Pikine Ouest, Centre d\'Appui local, près du complexe culturel Léopold Sédar Senghor.',
    'Point focal pour la gestion des mutuelles et du parrainage social dans le département de Pikine.'
  ],
  [
    'MSD mutuelle de santé départementale de Guédiawaye',
    'Dakar',
    'Golf Sud',
    'active',
    'UD-DK-004-2019',
    'Cheikh Sarr',
    '+221 33 862 33 44',
    'ud.guediawaye@unamusc.sn',
    'Cotisation Faitière',
    'Coordination départementale des mutuelles de Guédiawaye, formation',
    true,
    '20/05/2026',
    14.7812,
    -17.4124,
    'Quartier Golf Sud, à 300m du grand stade de Guédiawaye Amadou Barry.',
    'Coordonne les actions des mutuelles de la zone de Guédiawaye et aide à la numérisation des cartes CMU.'
  ],
  [
    'MSD mutuelle de santé départementale de Rufisque',
    'Dakar',
    'Rufisque Est',
    'active',
    'UD-DK-003-2018',
    'Amadou Diop',
    '+221 33 871 12 12',
    'ud.rufisque@unamusc.sn',
    'Cotisation Faitière',
    'Coordination départementale, gestion des subventions étatiques',
    true,
    '15/06/2026',
    14.7154,
    -17.2721,
    'Rufisque Est, à côté de la gare TER, près de la préfecture de Rufisque.',
    'Structure faîtière regroupant toutes les mutuelles de santé communautaires du département de Rufisque.'
  ],
  [
    'MSD mutuelle de santé départementale de Keur Massar',
    'Dakar',
    'Keur Massar Nord',
    'active',
    'UD-DK-005-2022',
    'Ousmane Ndiaye',
    '+221 33 892 20 20',
    'ud.keurmassar@unamusc.sn',
    'Cotisation Faitière',
    'Coordination du réseau, développement communautaire',
    true,
    '08/06/2026',
    14.7891,
    -17.3012,
    'Keur Massar Nord, quartier Cité Ouvrière, en face du poste de police.',
    'Support technique et coordination pour les mutuelles du nouveau département de Keur Massar.'
  ],
  [
    'MSD mutuelle de santé départementale de Thiès',
    'Thiès',
    'Thiès Nord',
    'active',
    'UD-TH-001-2017',
    'Ibrahima Fall',
    '+221 33 951 00 11',
    'ud.thies@unamusc.sn',
    'Cotisation Faitière',
    'Coordination départementale, supervision des mutuelles locales',
    true,
    '05/01/2026',
    14.7932,
    -16.9295,
    'Thiès Nord, près de la Place de France, à côté de l\'ancienne Gare de Thiès.',
    'Bureau central d\'appui pour toutes les mutuelles de la région et du département de Thiès.'
  ],
  [
    'MSD mutuelle de santé départementale de Mbour',
    'Thiès',
    'Mbour',
    'active',
    'UD-TH-002-2018',
    'Saliou Diallo',
    '+221 33 957 88 99',
    'ud.mbour@unamusc.sn',
    'Cotisation Faitière',
    'Coordination départementale de la Petite Côte',
    true,
    '14/02/2026',
    14.4162,
    -16.9641,
    'Près de la préfecture de département de Mbour, non loin du rond-point du stade.',
    'Coordination départementale pour la Petite Côte, gestion de la réassurance.'
  ],
  [
    'MSD mutuelle de santé départementale de Saint-Louis',
    'Saint-Louis',
    'Saint-Louis Sor',
    'active',
    'UD-SL-001-2017',
    'Abdoulaye Sow',
    '+221 33 961 45 45',
    'ud.saintlouis@unamusc.sn',
    'Cotisation Faitière',
    'Coordination départementale, formation des agents CMU',
    true,
    '18/04/2026',
    16.0221,
    -16.4885,
    'À Sor, près de la préfecture de Saint-Louis et du pont Faidherbe.',
    'Coordonne le réseau des mutuelles de la région Nord, facilitant le tiers-payant hospitalier.'
  ],
  [
    'MSD mutuelle de santé départementale de Ziguinchor',
    'Ziguinchor',
    'Ziguinchor',
    'active',
    'UD-ZG-001-2018',
    'Lamine Sané',
    '+221 33 991 22 33',
    'ud.ziguinchor@unamusc.sn',
    'Cotisation Faitière',
    'Gestion des risques, appui technique, réassurance',
    true,
    '10/02/2026',
    12.5768,
    -16.2731,
    'Ziguinchor, non loin de la préfecture, près du rond-point Aline Sitoé Diatta.',
    'Appui à la structuration des mutuelles communautaires en zone rurale dans toute la Casamance.'
  ],
  [
    'MSD mutuelle de santé départementale de Kaolack',
    'Kaolack',
    'Kaolack',
    'active',
    'UD-KL-001-2018',
    'Modou Gueye',
    '+221 33 941 55 66',
    'ud.kaolack@unamusc.sn',
    'Cotisation Faitière',
    'Coordination du bassin arachidier, statistiques locales',
    true,
    '12/03/2026',
    14.1528,
    -16.0755,
    'Kaolack Centre, près de la gouvernance et de la grande mosquée.',
    'Coordination des mutuelles de santé du département de Kaolack.'
  ],
  [
    'MSD mutuelle de santé départementale de Louga',
    'Louga',
    'Louga',
    'active',
    'UD-LG-001-2019',
    'Mor Ndiaye',
    '+221 33 967 44 55',
    'ud.louga@unamusc.sn',
    'Cotisation Faitière',
    'Coordination départementale du Ndiambour',
    true,
    '02/01/2026',
    15.6152,
    -16.2238,
    'Louga Centre, derrière la préfecture départementale.',
    'Coordination départementale et promotion de la Couverture Maladie Universelle dans les zones rurales de Louga.'
  ],
  [
    'MSD mutuelle de santé départementale de Diourbel',
    'Diourbel',
    'Diourbel',
    'active',
    'UD-DB-001-2019',
    'Serigne Fallou Diop',
    '+221 33 971 77 88',
    'ud.diourbel@unamusc.sn',
    'Cotisation Faitière',
    'Coordination départementale, plaidoyer mutualiste',
    true,
    '24/05/2026',
    14.6558,
    -16.2225,
    'Diourbel Centre, près de la Mairie de Diourbel.',
    'Coordonne le réseau départemental des mutuelles de santé communautaires.'
  ],
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
    '18/05/2026',
    14.6851,
    -17.4523,
    'Située en face du dispensaire Blaise Diagne, Rue 22 angle Blaise Diagne.',
    'La Médina propose des permanences d\'accueil pour la CMU tous les matins de 8h à 12h.'
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
    '4 500 FCFA / an (Individuel) | 1 000 FCFA carte + 3 500 FCFA/membre (Famille)',
    'Consultations de maternité (90%), pharmacie (60%), hospitalisation (75%)',
    true,
    '10/06/2026',
    14.7562,
    -17.4082,
    'À côté du bureau de poste principal de Pikine, près de l\'ancien cinéma.',
    'Idéale pour les résidents de Pikine Ouest. Permet le remboursement à 90% pour les soins de maternité de proximité.'
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
    '04/04/2026',
    14.4125,
    -16.9615,
    'Près du grand carrefour d\'Escale, à côté de la gare routière de Mbour.',
    'Offre une couverture maladie élargie sur toute la Petite Côte. Facile d\'accès pour les commerçants du centre.'
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
    '12/03/2026',
    14.1512,
    -16.0782,
    'Quartier Ndangane, près du poste de santé local, en face du collège franco-arabe.',
    'Propose une prise en charge rapide au centre de santé et à l\'hôpital régional de Kaolack.'
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
    '20/05/2026',
    16.0245,
    -16.4862,
    'Quartier Sor, en face de la gare ferroviaire historique, à 100m du pont Faidherbe.',
    'Conventionnée avec l\'hôpital régional de Saint-Louis et les pharmacies partenaires de l\'île de Saint-Louis.'
  ],
  [
    'Mutuelle de Touba Mosquée',
    'Diourbel',
    'Touba',
    'active',
    'DB-211-2024',
    'Serigne Fallou Mbacké',
    '+221 77 400 55 66',
    'toubamosquee@unamusc.sn',
    '8 000 FCFA / an',
    'Prise en charge complète dans les dispensaires de Touba (85%)',
    true,
    '17/06/2026',
    14.8690,
    -15.8752,
    'À 200m du grand minaret de la Grande Mosquée de Touba, en face du marché central.',
    'Facilite l\'orientation médicale et la prise en charge à 85% dans les hôpitaux Matlaboul Fawzaini et dispensaires de Touba.'
  ],
  [
    'Mutuelle de Ziguinchor Boudody',
    'Ziguinchor',
    'Ziguinchor',
    'active',
    'ZG-052-2022',
    'Mariama Sané',
    '+221 77 567 89 01',
    'boudody@unamusc.sn',
    '6 000 FCFA / an',
    'Soins infirmiers (80%), pharmacie (50%), maternité (80%)',
    false,
    '14/02/2026',
    12.5710,
    -16.2755,
    'Quartier Boudody, juste derrière le quai de pêche de Ziguinchor.',
    'Très active auprès des coopératives de transformation des produits de la mer. Propose des facilités d\'adhésion.'
  ],
  [
    'Mutuelle de Louga Centre',
    'Louga',
    'Louga',
    'en_sommeil',
    'LG-015-2020',
    'Babacar Cissé',
    '+221 77 234 56 78',
    'louga.c@unamusc.sn',
    '4 500 FCFA / an',
    'Soins de base (70%)',
    false,
    '02/01/2025',
    15.6172,
    -16.2255,
    'Centre-ville de Louga, derrière la préfecture de département.',
    'Cette mutuelle est actuellement en restructuration. Pour toute question urgente, veuillez vous rapprocher de la MSD mutuelle de santé départementale de Louga.'
  ],
  [
    'Mutuelle de Golf Sud',
    'Dakar',
    'Golf Sud',
    'active',
    'DK-092-2022',
    'Khady Ba',
    '+221 77 987 65 43',
    'golfsud@mutualisdakar.sn',
    '6 500 FCFA / an',
    'Consultations (80%), Maternité (90%)',
    true,
    '11/06/2026',
    14.7832,
    -17.4105,
    'Golf Sud, en face de la mosquée de la Cité des Enseignants.',
    'Prise en charge très avantageuse pour les consultations de maternité à la clinique locale conventionnée.'
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
    'De nouvelles structures sanitaires de référence comme Dalal Jamm et l\'Hôpital Principal intègrent notre réseau conventionné pour offer une couverture optimale de soins.',
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
        `INSERT INTO mutuelles (name, region, commune, status, agreement, manager, phone, email, rates, services, certified, last_update, lat, lng, landmark, local_info)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
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
        'SN-DK-MED-8472', 'active', '1234', 'Dakar'
      ],
      [
        'Awa', 'Ndiaye', '1985-08-22', '779876543', 'awa.ndiaye@example.com',
        'Pikine Ouest Quartier Tally Boubess, Dakar', 'Mutuelle de Pikine Ouest', 'familial', 'om',
        'SN-DK-PIK-9021', 'active', '1234', 'Pikine'
      ],
      [
        'Amadou', 'Sow', '1993-02-14', '764551122', 'amadou.sow@example.com',
        'Commune de la Médina, Rue 10, Dakar', 'Mutuelle de la Médina', 'individuel', 'wave',
        'SN-DK-MED-1284', 'pending', '1234', 'Dakar'
      ],
      [
        'Fatou', 'Fall', '1979-11-30', '775123456', 'fatou.fall@example.com',
        'Rufisque Est, quartier Mérina, Dakar', 'Mutuelle de Rufisque Est', 'familial', 'wave',
        'SN-DK-RUF-3382', 'active', '1234', 'Rufisque'
      ]
    ];

    const insertedIds = [];
    const pinSalt = await bcrypt.genSalt(10);
    const hashedDefaultPin = await bcrypt.hash('1234', pinSalt); // PIN de démonstration (à changer par l'usager)
    for (const b of demoBeneficiaries) {
      // Le dernier élément ('1234') est remplacé par son hash bcrypt avant insertion
      const row = [...b];
      row[row.length - 2] = hashedDefaultPin; // shift pin hachage by 1 index because of department added at the end
      const res = await pool.query(
        `INSERT INTO beneficiaries (first_name, last_name, birth_date, phone, email, address, mutuelle_name, package_type, payment_method, cmu_number, status, pin_code, department)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
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

    // Seed Sponsors et Filleuls (Parrainages) de démonstration
    const sponsorsData = [
      ['Fondation', 'Sonatel', '1997-10-01', '776543210', 'fondation@sonatel.sn', 'VDN, Dakar', 'Mutuelle de la Médina', 'parrainage', 'wave', 'SN-DK-SPN-1001', 'active', 'Dakar', '776543210'],
      ['Mairie', 'Dakar Plateau', '1960-04-04', '773302211', 'contact@mairiedakarplateau.sn', 'Plateau, Dakar', 'Union Nationale des Mutuelles de Santé Communautaires (UNAMUSC)', 'parrainage', 'om', 'SN-DK-SPN-1002', 'active', 'Dakar', '773302211'],
      ['El Hadji', 'Ndiaye', '1970-01-01', '765554433', 'elhadji.ndiaye@example.com', 'Médina, Dakar', 'Mutuelle de la Médina', 'parrainage', 'wave', 'SN-DK-SPN-1003', 'active', 'Dakar', '765554433'],
      ['Ngone', 'Cisse', '1988-11-12', '771112233', 'ngone.cisse@example.com', 'Mbao, Dakar', 'Mutuelle de Mbao', 'parrainage', 'wave', 'SN-DK-SPN-1004', 'active', 'Dakar', '771112233'],
      ['Ahmed', 'Tall', '1982-04-15', '774445566', 'ahmed.tall@example.com', 'Keur Massar, Dakar', 'Mutuelle de Keur Massar', 'parrainage', 'om', 'SN-DK-SPN-1005', 'active', 'Dakar', '774445566']
    ];

    for (const s of sponsorsData) {
      await pool.query(
        `INSERT INTO beneficiaries (first_name, last_name, birth_date, phone, email, address, mutuelle_name, package_type, payment_method, cmu_number, status, department, sponsor_phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        s
      );
    }

    const filleulsData = [
      // Filleuls Fondation Sonatel (élèves)
      ['Mamadou', 'Sow', '2015-05-10', '770000001', 'mamadou.sow@daara.sn', 'Médina, Dakar', 'Mutuelle de la Médina', 'scolaire', 'parrainage', 'SN-DK-EDU-001', 'active', 'Dakar', '776543210', 'Daara Cheikh Al Islam'],
      ['Fatoumata', 'Diallo', '2016-08-15', '770000002', 'fatoumata.diallo@daara.sn', 'Médina, Dakar', 'Mutuelle de la Médina', 'scolaire', 'parrainage', 'SN-DK-EDU-002', 'active', 'Dakar', '776543210', 'Daara Cheikh Al Islam'],
      // Filleuls Mairie (ménages)
      ['Cheikh', 'Gueye', '1980-03-20', '770000011', 'cheikh.gueye@menage.sn', 'Plateau, Dakar', 'Union Nationale des Mutuelles de Santé Communautaires (UNAMUSC)', 'familial', 'parrainage', 'SN-DK-HH-101', 'active', 'Dakar', '773302211', null],
      ['Mariama', 'Ba', '1985-09-25', '770000012', 'mariama.ba@menage.sn', 'Plateau, Dakar', 'Union Nationale des Mutuelles de Santé Communautaires (UNAMUSC)', 'familial', 'parrainage', 'SN-DK-HH-102', 'active', 'Dakar', '773302211', null],
      // Filleuls El Hadji (individuels)
      ['Abdou', 'Diop', '2000-02-14', '770000021', 'abdou.diop@example.com', 'Médina, Dakar', 'Mutuelle de la Médina', 'individuel', 'parrainage', 'SN-DK-IND-201', 'active', 'Dakar', '765554433', null]
    ];

    const filleulIds = [];
    for (const f of filleulsData) {
      const res = await pool.query(
        `INSERT INTO beneficiaries (first_name, last_name, birth_date, phone, email, address, mutuelle_name, package_type, payment_method, cmu_number, status, department, sponsor_phone, school_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
        f
      );
      filleulIds.push(res.rows[0].id);
    }

    // Filleuls de Ngone Cisse (100 talibés - Daara Sopaey Nbil de Mbao)
    const firstNamesBoys = [
      'Modou', 'Cheikh', 'Serigne', 'Babacar', 'Ibrahima', 'Moussa', 'Aliou', 'Moustapha', 'Pape', 'Abdoulaye',
      'Ousmane', 'Amadou', 'Birame', 'Lamine', 'Idrissa', 'Samba', 'Demba', 'Youssou', 'Boubacar', 'Malick',
      'Thierno', 'Ablaye', 'Gorgui', 'Mor', 'Ndiaga', 'Keba', 'Oumar', 'Souleymane', 'El Hadji', 'Djibril'
    ];
    const firstNamesGirls = [
      'Fatou', 'Aminata', 'Khadija', 'Ndèye', 'Awa', 'Mariama', 'Ramata', 'Sokhna', 'Ouleymate', 'Penda',
      'Coumba', 'Adama', 'Seynabou', 'Khady', 'Aïssatou', 'Dieynaba', 'Maimouna', 'Rokhy', 'Binta', 'Astou',
      'Fama', 'Anta', 'Yacine', 'Aby', 'Nafi', 'Safietou', 'Ngone', 'Codou', 'Salimata', 'Isseu'
    ];
    const lastNamesList = [
      'Ndiaye', 'Diop', 'Fall', 'Gueye', 'Sow', 'Diallo', 'Kane', 'Sy', 'Ba', 'Sarr',
      'Seck', 'Beye', 'Tine', 'Niang', 'Thiam', 'Wade', 'Mbodj', 'Cisse', 'Deng', 'Tall',
      'Kouyate', 'Sene', 'Faye', 'Samb', 'Diagne', 'Lo', 'Gadiaga', 'Dramé', 'Camara', 'Touré'
    ];

    for (let i = 1; i <= 100; i++) {
      const padId = String(i).padStart(3, '0');
      const fName = firstNamesBoys[(i - 1) % firstNamesBoys.length];
      const lName = lastNamesList[(i + 3) % lastNamesList.length];
      const email = `${fName.toLowerCase()}.${lName.toLowerCase()}.${padId}@daarasopaey.sn`;
      await pool.query(
        `INSERT INTO beneficiaries (first_name, last_name, birth_date, phone, email, address, mutuelle_name, package_type, payment_method, cmu_number, status, department, sponsor_phone, school_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          fName, lName, '2016-01-01', `77001${padId}`, email,
          'Mbao, Dakar', 'Mutuelle de Mbao', 'scolaire', 'parrainage', `SN-DK-EDU-SOP-${padId}`,
          'active', 'Dakar', '771112233', 'Daara Sopaey Nbil'
        ]
      );
    }

    // Filleuls de Ahmed Tall (100 élèves - Ecole Keur Mbaye Fall 2)
    for (let i = 1; i <= 100; i++) {
      const padId = String(i).padStart(3, '0');
      const fName = (i % 2 === 0) 
        ? firstNamesGirls[(Math.floor((i - 1) / 2)) % firstNamesGirls.length] 
        : firstNamesBoys[(Math.floor((i - 1) / 2)) % firstNamesBoys.length];
      const lName = lastNamesList[(i + 7) % lastNamesList.length];
      const email = `${fName.toLowerCase()}.${lName.toLowerCase()}.${padId}@keurmbayefall2.sn`;
      await pool.query(
        `INSERT INTO beneficiaries (first_name, last_name, birth_date, phone, email, address, mutuelle_name, package_type, payment_method, cmu_number, status, department, sponsor_phone, school_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          fName, lName, '2017-01-01', `77002${padId}`, email,
          'Keur Massar, Dakar', 'Mutuelle de Keur Massar', 'scolaire', 'parrainage', `SN-DK-EDU-KMF-${padId}`,
          'active', 'Dakar', '774445566', 'Keur Mbaye Fall 2'
        ]
      );
    }

    // Membres de famille pour Cheikh Gueye (filleul index 2)
    await pool.query(
      `INSERT INTO family_members (beneficiary_id, name, relation, age) VALUES 
       ($1, 'Aminata Gueye', 'conjoint', 38),
       ($1, 'Lamine Gueye', 'enfant', 10),
       ($1, 'Khadija Gueye', 'enfant', 6)`,
      [filleulIds[2]]
    );

    // Membres de famille pour Mariama Ba (filleul index 3)
    await pool.query(
      `INSERT INTO family_members (beneficiary_id, name, relation, age) VALUES 
       ($1, 'Abdou Ba', 'enfant', 12),
       ($1, 'Ousmane Ba', 'enfant', 8)`,
      [filleulIds[3]]
    );

    console.log('Sponsors et filleuls de démonstration créés.');

    // Seed Agent
    const salt = await bcrypt.genSalt(10);
    const hashAgent = await bcrypt.hash('senecarte', salt);
    const hashSuperAdmin = await bcrypt.hash('superadmin2026', salt);

    await pool.query(
      `INSERT INTO agents (username, password_hash, first_name, last_name, role, department) VALUES
       ('agent@cmu.sn', $1, 'Amadou', 'Sall', 'Admin Régional', 'Pikine'),
       ('superadmin@cmu.sn', $2, 'Moussa', 'Ndiaye', 'Super Admin', NULL)`,
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

    // Seed Audit Logs with historical dates
    await pool.query(
      `INSERT INTO audit_logs (action, actor, details, created_at) VALUES
       ('SYSTEM_INIT', 'Système', 'Initialisation et seeding de la base de données MUTUALIS DAKAR.', NOW() - INTERVAL '15 days'),
       ('CONNEXION_AGENT', 'superadmin@cmu.sn', 'Connexion réussie de l''agent Moussa Ndiaye (Super Admin).', NOW() - INTERVAL '14 days'),
       ('DEPOS_PRE_INSCRIPTION', '771234567', 'Nouveau dossier d''adhésion en ligne déposé pour Modou Diop (CMU généré: SN-DK-MED-8472).', NOW() - INTERVAL '12 days'),
       ('RENOUVELLEMENT_COTISATION', '771234567', 'Renouvellement annuel de la cotisation (4 500 FCFA) pour l''assuré Modou Diop.', NOW() - INTERVAL '12 days'),
       ('APPROBATION_DOSSIER', 'agent@cmu.sn', 'Le dossier de l''assuré Modou Diop (CMU: SN-DK-MED-8472) a été passé au statut : active.', NOW() - INTERVAL '11 days'),
       ('DEPOS_PRE_INSCRIPTION', '779876543', 'Nouveau dossier d''adhésion en ligne déposé pour Awa Ndiaye (CMU généré: SN-DK-PIK-9021).', NOW() - INTERVAL '8 days'),
       ('RENOUVELLEMENT_COTISATION', '779876543', 'Renouvellement annuel de la cotisation (4 500 FCFA) pour l''assuré Awa Ndiaye.', NOW() - INTERVAL '8 days'),
       ('APPROBATION_DOSSIER', 'agent@cmu.sn', 'Le dossier de l''assuré Awa Ndiaye (CMU: SN-DK-PIK-9021) a été passé au statut : active.', NOW() - INTERVAL '7 days'),
       ('RECLAMATION_OUVERTE', '779876543', 'Réclamation ouverte par Awa Ndiaye pour motif : Refus de tiers-payant.', NOW() - INTERVAL '6 days'),
       ('DEPOS_PRE_INSCRIPTION', '775123456', 'Nouveau dossier d''adhésion en ligne déposé pour Fatou Fall (CMU généré: SN-DK-RUF-3382).', NOW() - INTERVAL '5 days'),
       ('RENOUVELLEMENT_COTISATION', '775123456', 'Renouvellement annuel de la cotisation (4 500 FCFA) pour l''assuré Fatou Fall.', NOW() - INTERVAL '5 days'),
       ('APPROBATION_DOSSIER', 'agent@cmu.sn', 'Le dossier de l''assuré Fatou Fall (CMU: SN-DK-RUF-3382) a été passé au statut : active.', NOW() - INTERVAL '4 days'),
       ('DON_EN_LIGNE', 'Donateur anonyme', 'Don de 50 000 FCFA en ligne pour la Mutuelle de Mbao.', NOW() - INTERVAL '3 days'),
       ('PRE_INSCRIPTION', '764551122', 'Soumission de pré-inscription pour Amadou Sow.', NOW() - INTERVAL '2 days'),
       ('DON_EN_LIGNE', 'Donateur anonyme', 'Don de 100 000 FCFA en ligne pour : solidarite.', NOW() - INTERVAL '1 day')`
    );
    console.log('Logs d\'audit de démonstration insérés avec historique.');

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

    // Seed Claims (Demandes de prise en charge)
    await pool.query(
      `INSERT INTO claims (beneficiary_id, beneficiary_name, phone, structure_name, care_type, care_description, amount, coverage_rate, reimbursed_amount, status, treatment_date) VALUES
       (1, 'Modou Diop', '771234567', 'Hôpital Principal de Dakar', 'consultation', 'Consultation généraliste grippe', 5000, 80, 4000, 'approved', '2026-06-20'),
       (1, 'Modou Diop', '771234567', 'Pharmacie du Plateau', 'pharmacie', 'Achat d''antibiotiques', 12000, 50, 6000, 'paid', '2026-06-21'),
       (2, 'Awa Ndiaye', '779876543', 'Hôpital de Fann', 'hospitalisation', 'Hospitalisation de jour pédiatrie', 45000, 80, 36000, 'approved', '2026-06-22'),
       (2, 'Awa Ndiaye', '779876543', 'Centre de santé de la Médina', 'acte', 'Pansement et soins infirmiers', 3500, 80, 2800, 'pending', '2026-06-25'),
       (4, 'Fatou Fall', '775123456', 'Hôpital Dalal Jamm', 'consultation', 'Consultation pédiatrique urgence', 6000, 80, 4800, 'rejected', '2026-06-26')`
    );
    console.log('Demandes de prise en charge de démonstration créées.');

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
       (1, 'assure_fidele', 'Assuré fidèle'),
       (1, 'citoyen_modele', 'Citoyen modèle')`
    );
    // Awa Ndiaye (id=2) : parrainage + cotisation
    await pool.query(
      `INSERT INTO loyalty_points (beneficiary_id, points, reason) VALUES
       (2, 50, 'cotisation_a_temps'),
       (2, 40, 'parrainage')`
    );
    await pool.query(
      `INSERT INTO loyalty_badges (beneficiary_id, badge_slug, badge_name) VALUES
       (2, 'parrain_solidarite', 'Parrain solidaire')`
    );
    console.log('Points de fidélité et badges créés.');

    // Seed Paiements de démonstration
    await pool.query(
      `INSERT INTO payments (reference, beneficiary_id, phone, provider, amount, purpose, status, provider_transaction_id) VALUES
       ('OM-2026-DEMO-001', 1, '771234567', 'orange_money', 4500, 'cotisation', 'success', 'OMP-' || DATE '2026-06-15'),
       ('WAV-2026-DEMO-002', 2, '779876543', 'wave', 4500, 'cotisation', 'success', 'WAVP-' || DATE '2026-06-16')`
    );
    console.log('Paiements de démonstration créés.');

    // Seed Partnerships
    await pool.query(
      `INSERT INTO partnerships (company_name, sector, contact_person, email, phone, message, status, date) VALUES
       ('Fondation Orange Sénégal', 'mécénat', 'Seynabou Diop', 'sdiop@orange.sn', '77 645 32 10', 'Souhait de financer la CMU pour 500 élèves de Daara à Medina.', 'approved', '22/06/2026'),
       ('Clinique de la Paix', 'médical', 'Dr. Cheikh Tidiane', 'contact@cliniquedelapaix.sn', '33 822 40 40', 'Proposition de convention pour appliquer la gratuité du ticket modérateur.', 'pending', '23/06/2026')`
    );
    console.log('Demandes de partenariat de démonstration créées.');

    // Seed Blog Articles & Comments
    const blogRes = await pool.query(
      `INSERT INTO blog_articles (title_fr, title_wo, author, role_fr, role_wo, avatar, date, read_time_fr, read_time_wo, preview_fr, preview_wo, content_fr, content_wo, image_url, likes) VALUES
       ('Prévenir le paludisme en saison des pluies à Dakar', 'Wanni malaria bi ci hivernage bi ci Ndakaaru', 'Dr. Aminata Sow', 'Épidémiologiste, Dakar', 'Docteur épidémiologiste', '👩‍⚕️', 1781524800000, '4 min de lecture', '4 min ci jang', 'L''hivernage est propice au développement des moustiques. Voici les mesures collectives et individuelles indispensables pour protéger votre famille.', 'Naka la gnu di wanni malaria ak moustiques yi ci saison des pluies bi ci Ndakaaru.', 'L''hivernage s''installe à Dakar et avec lui, le risque accru de transmission du paludisme. En tant que médecin épidémiologiste, je rappelle que le paludisme reste une des causes majeures de consultation dans nos structures de santé.\n\nVoici 4 conseils simples mais cruciaux :\n1. Dormez sous une moustiquaire imprégnée : C''est le moyen de prévention le plus efficace. Assurez-vous qu''elle est bien fermée et sans trous.\n2. Éliminez les eaux stagnantes : Les moustiques y pondent leurs œufs. Videz les récipients d''eau inutilisés autour de votre maison.\n3. Utilisez des répulsifs corporels : Surtout en fin de journée lorsque l''activité des moustiques augmente.\n4. Consultez au premier symptôme : La fièvre est le premier signe d''alerte. Grâce à la gratuité des soins pour les enfants de moins de 5 ans et à la couverture CMU, le diagnostic et le traitement (ACT) sont immédiats et accessibles dans tous les postes de santé conventionnés.', 'Saison des pluies bi dafa ubbil yoon moustiques yi ngir gnu bari. Loolu day andil malaria.\n\nDigle yi gënë rëy :\n1. Moustiquaire : Sangal sa bop ak sa njabot ak moustiquaire bu baax at mi yëpp.\n2. Dindi ndox yi tégu ci bountou keur yi ngir moustiques yi bagn fa egg.\n3. Fajjoo : Soo amé fievre, demal ci poste de santé bi gënë jege téy.', '/bg_health_palu.png', 12),
       ('Données de santé et RGPD : comment Mutualis protège votre vie privée', 'Données wér-gi-yaram ak RGPD ci Mutualis', 'Dr. Ibrahima Diagne', 'Expert en e-santé & sécurité', 'Docteur e-santé & sécurité', '👨‍⚕️', 1781775600000, '6 min de lecture', '6 min ci jang', 'La numérisation de la couverture maladie nécessite une sécurité maximale. Décryptage de nos protocoles d''isolation et de chiffrement.', 'Assurance maladie numérique dafa wara am sécurité bu dëgër. Leral naka la gnu di aar sa vie privée.', 'Avec le lancement de la plateforme Mutualis Dakar, nous passons à une vitesse supérieure dans la numérisation des données médicales. Mais qui dit numérisation dit responsabilité.\n\nDans le cadre de la conformité au RGPD et aux règles sénégalaises de protection des données personnelles :\n- Vos données sont cryptées : Les mots de passe et les informations personnelles sont chiffrés. Aucun tiers ne peut y avoir accès.\n- Jeton d''authentification (JWT) : Chaque connexion génère un jeton temporaire qui authentifie de manière unique l''assuré ou l''agent.\n- Droit à l''oubli : Vous pouvez à tout moment demander la suppression définitive de vos données depuis votre espace profil.\n- Consentement obligatoire : Aucune donnée n''est traitée sans votre acceptation préalable lors de l''adhésion en ligne.', 'Mbindu numérique bi dafa wara andak aar askan wi.\n\nCi bir Mutualis Dakar :\n- Sa mot de passe dafa crypté, amul kenn kou koy guiss.\n- Jeton JWT : Day sécurisé sa connexion.\n- Droit à l''oubli : Mën nga dindi sa account ak say données saa soo ko beugué ci sa profil.', '/bg_rgpd_data.png', 8),
       ('Nutrition et Hypertension : préserver le cœur au quotidien', 'Hypertension ak lekk bu baax ngir sa xol', 'Dr. Ousmane Diagne', 'Cardiologue, Hôpital de Dakar', 'Cardiologue, Hôpital Dakar', '🩺', 1781968800000, '5 min de lecture', '5 min ci jang', 'L''hypertension artérielle est un fléau silencieux. Découvrez les changements alimentaires simples à adopter pour préserver votre xol.', 'Hypertension artérielle dafa bari ci Sénégal. Xoolal naka la gnu di lekk ngir aar sa xol.', 'L''hypertension artérielle (HTA) est souvent surnommée le "tueur silencieux" car elle se développe sans symptômes apparents. Pourtant, elle cause de nombreuses complications cardiologiques et vasculaires.\n\nQuelques conseils simples de cardiologie :\n1. Réduisez le sel : La consommation excessive de sel augmente la tension artérielle. Évitez les bouillons industriels très salés et limitez le sel à table.\n2. Mangez des fruits et légumes : Riches en potassium, ils aident à réguler la tension.\n3. Pratiquez une activité physique : Marcher 30 minutes par jour à un rythme soutenu est excellent pour le cœur.\n4. Contrôlez votre tension régulièrement : Les mutuelles de santé conventionnées organisent régulièrement des campagnes de dépistage gratuites. Profitez-en !', 'Hypertension artérielle dafa andil diafé-diafé xol bou bari.\n\nDigle cardiologue :\n1. Wanni xorom : Bagn lekk bouillon industriels yi xorom bi bari.\n2. Lekkal fruits ak légumes.\n3. Doxaal : Defal marche 30 minutes ci at mi ngir sa xol wér.\n4. Saytul sa tension régulièrement ci sa mutuelle.', '/bg_health_heart.png', 24),
       ('La gratuité des césariennes : un droit fondamental pour les mamans', 'Accouchement césarienne bu gratuit ngir yaay yi', 'Dr. Fatou Ndiaye', 'Gynécologue-Obstétricienne, Dakar', 'Docteur gynécologue', '🤰', 1782141600000, '5 min de lecture', '5 min ci jang', 'Réduire la mortalité maternelle est une priorité nationale. Découvrez le fonctionnement de la gratuité totale des césariennes au Sénégal.', 'Naka la gnu di aar yaay yi ci bir Sénégal ak accouchement césarienne bu gratuit.', 'La maternité doit être un moment de joie et non d''inquiétude financière. C''est pourquoi le Sénégal a instauré la gratuité totale des césariennes dans les structures sanitaires publiques.\n\nLes points clés à retenir :\n1. Prise en charge à 100% : La gratuité comprend l''acte opératoire, les kits de césarienne complets, les médicaments nécessaires et le séjour à l''hôpital.\n2. Sans conditions de ressources : Toutes les femmes enceintes nécessitant cette intervention y ont droit d''office.\n3. Complémentarité avec la CMU : Pour les accouchements par voie basse, l''enrôlement aux mutuelles permet une couverture à 80% dans le réseau conventionné.', 'Césarienne bi dafa gratuit 100% ci hôpitaux publics yëpp ngir wanni réy xale ak yaay yi.\n\nLeral yi :\n1. Benn fay amul : Garab, kit opéatoire ak séjour gratuit la.\n2. Amul conditions : Bépp jiguen bu ko soxla day bénéficié.\n3. Ndimbalou CMU : Accouchement voie basse day andak fay bu wanni pour assuré yi.', '/csu_kids.png', 19),
       ('Mutuelles de santé scolaires : protéger l''avenir de nos enfants', 'Mutuelle de santé pour école yi ak daara yi', 'Moussa Diop', 'Inspecteur de l''Éducation, Dakar', 'Inspecteur éducation', '👨‍🏫', 1782314400000, '4 min de lecture', '4 min ci jang', 'L''affiliation des élèves et des talibés des Daaras garantit une couverture maladie dès le plus jeune âge. Explications.', 'Mbindu xale yi ci école yi ak daara yi ngir ñu am assurance wér-gi-yaram.', 'L''école et le daara sont des lieux d''apprentissage, mais aussi de protection sociale. La généralisation des mutuelles scolaires constitue un pilier majeur de la CSU.\n\nPourquoi enrôler les enfants ?\n1. Prévention active : Un enfant couvert est un enfant mieux suivi médicalement (visites régulières, soins dentaires, lunettes).\n2. Solidarité communautaire : Le parrainage des Daaras permet d''intégrer les talibés les plus vulnérables dans le tissu sanitaire national.\n3. Tranquillité d''esprit : Les familles et les maîtres de Daara n''ont plus à craindre le coût d''un traitement d''urgence en cas de maladie soudaine de l''élève.', 'Mbindu xale yi ci école yi ak daara yi ngir ñu am assurance wér-gi-yaram.\n\nNjeurit yi :\n1. Saytu wér-gi-yaram xale yi ci consultation ak fajj.\n2. Ndimbalou parrainage ngir talibé daara yi.\n3. Tranquillité ngir njabot yi ak maître daara yi.', '/csu_students.png', 15),
       ('Le plan Sésame : assurer la dignité et la santé de nos aînés', 'Plan Sésame : dimbalé sounou waajur yi', 'Awa Kane', 'Assistante Sociale, Dakar', 'Assistante sociale', '🧓', 1782487200000, '5 min de lecture', '5 min ci jang', 'Grâce au Plan Sésame, les personnes âgées de 60 ans et plus bénéficient d''une gratuité totale des soins de santé essentiels.', 'Plan Sésame ngir fajj mag ñi am 60 at walla lu ko raw ci bir Sénégal.', 'Le Plan Sésame est une mesure de solidarité nationale phare à l''égard des personnes âgées au Sénégal.\n\nCe qu''il faut savoir sur les soins gratuits :\n1. Prise en charge à 100% : Les consultations de médecine générale, de cardiologie, d''ophtalmologie et les soins infirmiers de base sont couverts.\n2. Hospitalisation gratuite : En cas d''urgence, les frais d''hospitalisation dans les structures publiques conventionnées sont pris en charge.\n3. Accès facilité : Il suffit de présenter une pièce d''identité nationale prouvant l''âge de 60 ans ou plus dans la structure d''accueil pour bénéficier des prestations.', 'Plan Sésame ngir fajj mag ñi am 60 at walla lu ko raw ci bir Sénégal.\n\nLeral yi :\n1. Fay 100% : Consultation générale, cardiologie, ophtalmologie gratuit la.\n2. Hospitalisation bu gratuit ci urgences.\n3. Mbindu simple : Carte d''identité nationale rek lay soxla ngir wane sa at.', '/csu_sesame_real.png', 32) RETURNING id`
    );
    const artIds = blogRes.rows.map(r => r.id);

    // Seed some comments for Paludisme (article 1)
    await pool.query(
      `INSERT INTO blog_comments (article_id, author, text) VALUES
       ($1, 'Moustapha Fall', 'Excellent article, très instructif !'),
       ($1, 'Khadija Sy', 'Est-ce que les moustiquaires imprégnées sont distribuées gratuitement par les mutuelles ?')`,
      [artIds[0]]
    );
    console.log('Articles de blog et commentaires créés.');

    // Seed Gallery
    await pool.query(
      `INSERT INTO gallery_items (image, category, title_fr, title_wo, description_fr, description_wo, location_fr, location_wo, date_fr, date_wo, impact_fr, impact_wo, tags) VALUES
       ('/csu_sesame_real.png', 'programmes', 'Plan Sésame - personnes âgées', 'Plan Sésame - magg ñi', 'Consultations, soins et médicaments gratuits octroyés au troisième âge (60 ans et plus) dans le cadre de l''initiative de solidarité nationale.', 'Fajj ak garab yu gratuit ngir mag ñi am 60 at walla lu ko ko raw ci bir Sénégal.', 'Hôpital Fann, Dakar', 'Hôpital Fann, Dakar', 'Mai 2026', 'Mai 2026', '12 500+ aînés couverts', '12 500+ magg ñi fajjoo', ARRAY['Sésame', 'Gratuité', 'Séniors']),
       ('/csu_bsf_real.png', 'communautaire', 'Bourse de sécurité familiale (BSF)', 'Mbindu BSF', 'Campagne massive d''enrôlement gratuit des ménages vulnérables bénéficiaires du programme national de Bourses de Sécurité Familiale.', 'Duggalal njabot yu amul doole yi nekk ci përogaraam national bourses de sécurité familiale.', 'Pikine, Dakar', 'Pikine, Dakar', 'Avril 2026', 'Avril 2026', '45 000+ familles affiliées', '45 000+ njabot yu duggu', ARRAY['Social', 'Enrôlement', 'Solidarité']),
       ('/csu_dialysis_real.png', 'cliniques', 'Gratuité des séances de dialyse', 'Dialyse bu gratuit', 'Prise en charge intégrale des séances de dialyse pour les malades d''insuffisance rénale dans les centres publics conventionnés.', 'Fajj dialyse bi amul benn fay ngir ñi yore insuffisance rénale ci hôpitaux publics yi.', 'Hôpital Général Idrissa Pouye de Grand Yoff', 'Hôpital Général Idrissa Pouye de Grand Yoff', 'Juin 2026', 'Juin 2026', '1 800+ patients réguliers', '1 800+ patients ñi fajjoo', ARRAY['Dialyse', 'Néphrologie', 'Haut niveau']),
       ('/csu_kids_real.png', 'programmes', 'Soins gratuits pour les moins de 5 ans', 'Fajj xale yu amul 5 at', 'Politique de gratuité des soins de santé essentiels pour tous les enfants de moins de cinq ans dans les postes et centres de santé.', 'Politique de gratuité ngir xale yi amul 5 at ci consultation, vaccin ak fajj.', 'Districts sanitaires de Guédiawaye', 'Districts sanitaires de Guédiawaye', 'Mars 2026', 'Mars 2026', '30 000+ consultations pédiatriques', '30 000+ consultation xale', ARRAY['Pédiatrie', 'Enfance', 'Vaccins']),
       ('/csu_students_real.png', 'programmes', 'CSU élèves & daaras', 'CSU élèves ak daara', 'Campagne de sensibilisation et d''affiliation collective des élèves et des talibés des Daaras de la région de Dakar sous l''égide du Ministère.', 'Mbindu élèves yi ak talibé daara yi ci Dakar ngir ñu am assurance wér-gi-yaram.', 'Keur Massar, Dakar', 'Keur Massar, Dakar', 'Février 2026', 'Février 2026', '18 écoles & 24 Daaras enrôlés', '18 écoles ak 24 Daara yu duggu', ARRAY['Éducation', 'Daara', 'Jeunesse']),
       ('/inst_hero_real.png', 'communautaire', 'Inauguration des unions départementales', 'Ubbi bureau CSU', 'Cérémonie officielle d''ouverture des bureaux départementaux de la CSU pour rapprocher l''administration sanitaire des populations.', 'Ubbi bureau départemental cmu ngir diapalé askan wi ci séni mbindu.', 'Dakar Plateau', 'Dakar Plateau', 'Janvier 2026', 'Janvier 2026', '4 départements opérationnels', '4 département yu ubbi', ARRAY['Institutionnel', 'Dakar', 'Administration'])`
    );
    console.log('Galerie d\'activités CSU créée.');

    // Seed General Dynamic Content
    const infosCsuContent = {
      policies: [
        {
          icon: '👴',
          impact: '150 000+ seniors couverts au Sénégal',
          title_fr: 'Plan Sésame (60 ans +)',
          title_wo: 'Plan Sésame (60 at +)',
          description_fr: 'Créé pour garantir la dignité de nos aînés. Il prend en charge à 100% les consultations, les soins hospitaliers d\'urgence et les médicaments essentiels prescrits dans les structures publiques.',
          description_wo: 'Ngir dimbalé ak deugeural sounou waajur yi. Day fay 100% consultation, urgent care ak garab ci hôpitaux publics yi.'
        },
        {
          icon: '🤰',
          impact: '40 000+ césariennes prises en charge chaque année',
          title_fr: 'Césariennes gratuites',
          title_wo: 'Césarienne Gratuit',
          description_fr: 'Afin de réduire la mortalité maternelle, l\'accouchement par césarienne (simple ou d\'urgence) est entièrement gratuit dans tous les hôpitaux publics agréés.',
          description_wo: 'Ngir wanni réy xale ak yaay yi, accouchement césarienne dafa gratuit 100% ci hôpitaux publics yëpp.'
        },
        {
          icon: '👶',
          impact: '2.5 millions d\'enfants enrôlés au niveau national',
          title_fr: 'Petite enfance (< 5 ans)',
          title_wo: 'Xale yu amul 5 at',
          description_fr: 'Les enfants âgés de 0 à 5 ans bénéficient de la gratuité des consultations de médecine générale et pédiatrique, des vaccinations obligatoires et des soins infirmiers de base.',
          description_wo: 'Xale yi amul 5 at danguay fajjoo gratuit ci poste de santé yi ci consultation, vaccin ak urgences.'
        },
        {
          icon: '🏥',
          impact: 'Gratuité totale de la dialyse dans les structures publiques',
          title_fr: 'Dialyse subventionnée',
          title_wo: 'Dialyse gratuit',
          description_fr: 'Les séances de dialyse pour l\'insuffisance rénale chronique sont gratuites dans tous les centres publics du Sénégal, soulageant les familles d\'un coût mensuel de plus de 150 000 FCFA.',
          description_wo: 'Séance dialyse yi dafa gratuit ci bir hôpitaux public yi ci Sénégal ngir wanni fay bi ci njabot yi.'
        }
      ],
      timelineEvents: [
        {
          year: '2013',
          title_fr: 'Lancement de la CSU',
          title_wo: 'Lancement CSU',
          description_fr: 'Lancement officiel du programme national de Couverture Maladie Universelle au Sénégal par le chef de l\'État.',
          description_wo: 'Ubbi përogaraam national Couverture Maladie Universelle ci Sénégal.'
        },
        {
          year: '2015',
          title_fr: 'Initiative moins de 5 ans',
          title_wo: 'Moins de 5 ans',
          description_fr: 'Introduction de la gratuité des soins de santé primaires pour les enfants de moins de cinq ans dans les structures sanitaires publiques.',
          description_wo: 'Ubbi gratuité fajj xale yi amul 5 at ci district sanitaire yi.'
        },
        {
          year: '2017',
          title_fr: 'Extension de la césarienne',
          title_wo: 'Césarienne gratuit',
          description_fr: 'Généralisation de la gratuité de la césarienne dans toutes les maternités des centres hospitaliers publics.',
          description_wo: 'Fay césarienne gratuit ci maternité hospital public yi.'
        },
        {
          year: '2021',
          title_fr: 'Gratuité de la dialyse',
          title_wo: 'Dialyse gratuit',
          description_fr: 'Prise en charge intégrale des séances de dialyse rénale pour supprimer les listes d\'attente fatales.',
          description_wo: 'Dindi fay bi ci séance dialyse yi ci hôpitaux publics yi.'
        },
        {
          year: '2026',
          title_fr: 'Lancement de MUTUALIS DAKAR',
          title_wo: 'Plateforme Mutualis',
          description_fr: 'Digitalisation complète de l\'enrôlement, paiement mobile des cotisations (Wave/OM) et déploiement de la carte de santé QR à Dakar.',
          description_wo: 'Digitalisé mbindu, fay mobile ak carte QR santé ci région Dakar.'
        }
      ]
    };

    const institutionnelContent = {
      members: [
        {
          name: 'Birame Fall',
          role_fr: 'Président de l\'URMSCD',
          role_wo: 'Njiitu Mbootaay bi',
          description_fr: 'Plus de 15 ans d\'expérience dans l\'économie sociale et solidaire.',
          description_wo: 'Am na 15 at ci wéru économie sociale.'
        },
        {
          name: 'Ndèye Fatou Seye',
          role_fr: 'Vice-Présidente',
          role_wo: 'Njiitu-Taat bi',
          description_fr: 'Spécialiste de la santé communautaire et de l\'inclusion des femmes.',
          description_wo: 'Spécialiste ci wér-gi-yaramu jigéen yi.'
        },
        {
          name: 'Ousmane Diop',
          role_fr: 'Secrétaire Général',
          role_wo: 'Bindakat bi',
          description_fr: 'Gestionnaire de projets de santé et expert en gouvernance associative.',
          description_wo: 'Expert ci wéru yore mbootaay yi.'
        },
        {
          name: 'Abdoulaye Sow',
          role_fr: 'Trésorier Général',
          role_wo: 'Korekat bi',
          description_fr: 'Comptable agréé dédié à la transparence financière des mutuelles.',
          description_wo: 'Comptable bu liggéey ci wéru xaalis.'
        }
      ]
    };

    await pool.query(
      `INSERT INTO dynamic_content (key, content) VALUES ($1, $2), ($3, $4)`,
      ['infos_csu', JSON.stringify(infosCsuContent), 'institutionnel', JSON.stringify(institutionnelContent)]
    );
    console.log('Contenus dynamiques généraux créés.');

    // Seed regional_coverage data
    await pool.query(
      `INSERT INTO regional_coverage (id, name, x, y, couv, color, mutuelles, assures, structures) VALUES
       ('dakar', 'Dakar', 80, 180, 89.4, 'var(--primary)', 52, '1 240 000', 128),
       ('thies', 'Thiès', 120, 170, 75.2, 'var(--success)', 38, '850 000', 74),
       ('diourbel', 'Diourbel', 150, 180, 71.0, 'var(--success)', 24, '620 000', 42),
       ('fatick', 'Fatick', 150, 205, 64.2, 'var(--success)', 18, '310 000', 28),
       ('kaolack', 'Kaolack', 190, 210, 62.3, 'var(--success)', 22, '450 000', 35),
       ('kaffrine', 'Kaffrine', 230, 215, 58.7, 'var(--secondary)', 14, '210 000', 18),
       ('saintlouis', 'Saint-Louis', 180, 110, 68.5, 'var(--success)', 29, '530 000', 49),
       ('louga', 'Louga', 160, 140, 60.1, 'var(--success)', 16, '340 000', 22),
       ('matam', 'Matam', 300, 120, 49.8, 'var(--danger)', 12, '180 000', 15),
       ('tambacounda', 'Tambacounda', 340, 230, 53.1, 'var(--secondary)', 15, '290 000', 19),
       ('kedougou', 'Kédougou', 420, 280, 45.2, 'var(--danger)', 8, '95 000', 9),
       ('kolda', 'Kolda', 200, 280, 55.6, 'var(--secondary)', 14, '240 000', 16),
       ('sedhiou', 'Sédhiou', 150, 290, 51.3, 'var(--secondary)', 10, '150 000', 12),
       ('ziguinchor', 'Ziguinchor', 110, 300, 65.4, 'var(--success)', 20, '380 000', 31)`
    );
    console.log('Données de couverture régionale insérées.');

    // Seed Phase 2 & 3: Institution COUD, antécédents, garanties, imagerie, carnet maternité
    await pool.query(`
      INSERT INTO institutional_tenants (name, code, contact_email, contact_phone, total_members)
      VALUES ('COUD - Centre des Œuvres Universitaires de Dakar', 'COUD_UCAD', 'sante@coud.ucad.sn', '+221 33 824 15 15', 85000)
      ON CONFLICT (code) DO NOTHING;
    `);

    // Insérer des antécédents pour le premier bénéficiaire s'il existe
    const firstBen = await pool.query('SELECT id FROM beneficiaries LIMIT 1');
    if (firstBen.rows.length > 0) {
      const benId = firstBen.rows[0].id;

      await pool.query(`
        INSERT INTO medical_antecedents (beneficiary_id, blood_group, allergies, chronic_conditions, past_surgeries, emergency_contact_name, emergency_contact_phone)
        VALUES ($1, 'O+', 'Allergie à la Pénicilline', 'Tension artérielle légère', 'Appendicectomie (2021)', 'Moussa Sow', '+221 77 450 12 34')
      `, [benId]);

      await pool.query(`
        INSERT INTO external_patient_codes (beneficiary_id, external_patient_code, system_name)
        VALUES ($1, 'IPP-COUD-2026-88', 'COUD-SANTÉ-UCAD')
        ON CONFLICT DO NOTHING;
      `, [benId]);

      await pool.query(`
        INSERT INTO guarantee_letters (beneficiary_id, medical_act, estimated_amount, guaranteed_percentage, max_amount, status, validation_code, agent_note)
        VALUES ($1, 'Intervention Chirurgicale ORL - Hôpital Fann', 250000, 80.00, 200000, 'approved', 'GAR-DK-2026-9941', 'Dossier complet. Prise en charge accordée à 80%.')
      `, [benId]);

      await pool.query(`
        INSERT INTO purchase_orders (beneficiary_id, items_json, total_amount, status)
        VALUES ($1, '[{"name": "Amoxicilline 500mg", "qty": 2, "price": 3500}, {"name": "Paracétamol 1g", "qty": 1, "price": 1200}]'::jsonb, 8200, 'active')
      `, [benId]);

      await pool.query(`
        INSERT INTO telemedicine_sessions (beneficiary_id, doctor_name, specialty, scheduled_at, status, room_token, medical_summary)
        VALUES ($1, 'Dr. Aminata Ndiaye', 'Médecine Générale / Pédiatrie', NOW() + INTERVAL '1 day', 'scheduled', 'TELE-ROOM-8821', 'Consultation de suivi prénatal et conseils nutritionnels.')
      `, [benId]);

      await pool.query(`
        INSERT INTO appointments (beneficiary_id, doctor_name, specialty, appointment_date, status, notes, qr_access_code)
        VALUES ($1, 'Pr. Ousmane Diop', 'Cardiologie', NOW() + INTERVAL '3 days', 'confirmed', 'Rendez-vous de bilan annuel à l''Hôpital Dantec.', 'RDV-CARDIO-4421')
      `, [benId]);

      await pool.query(`
        INSERT INTO medical_imaging_results (beneficiary_id, exam_type, title, report_pdf_url, doctor_notes, exam_date)
        VALUES ($1, 'Scanner', 'Scanner Thoracique et Pulmonaire - Hôpital Fann', '/docs/scanner_fann_sample.pdf', 'Parenchyme pulmonaire sans anomalie décelable. Conclusion rassurante.', CURRENT_DATE - INTERVAL '10 days')
      `, [benId]);

      await pool.query(`
        INSERT INTO maternal_health_records (beneficiary_id, pregnancy_start_date, expected_delivery_date, cpn1_date, cpn2_date, risk_level, notes)
        VALUES ($1, CURRENT_DATE - INTERVAL '120 days', CURRENT_DATE + INTERVAL '150 days', CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE - INTERVAL '30 days', 'normal', 'Grossesse évolutive normale. Prise en charge accouchement à 100% au Centre de Santé Gaspart Camara.')
      `, [benId]);
    }
    console.log('Données d\'extension Phase 2 & 3 insérées avec succès !');

    console.log('Initialisation et seeding terminés avec succès !');
    process.exit(0);
  } catch (err) {
    console.error('Erreur lors de l\'initialisation de la base de données :', err);
    process.exit(1);
  }
}

initializeDatabase();
