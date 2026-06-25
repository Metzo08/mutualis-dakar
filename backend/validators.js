// Schémas de validation des entrées pour les routes API MUTUALIS DAKAR.
// Utilise zod pour valider et normaliser les payloads entrants.
const { z } = require('zod');

// Normalise un numéro de téléphone sénégalais : supprime espaces et préfixe international.
const normalizePhone = (phone) => {
  if (!phone) return phone;
  let p = String(phone).replace(/\s+/g, '');
  // Retire le préfixe +221 ou 221 s'il existe
  if (p.startsWith('+221')) p = p.slice(4);
  else if (p.startsWith('221') && p.length === 12) p = p.slice(3);
  return p;
};

// Téléphone sénégalais : 9 chiffres commençant par 7 ou 3 (Orange, Free, Expresso).
const phoneSchema = z
  .string()
  .min(1, 'Téléphone requis.')
  .transform(normalizePhone)
  .refine((p) => /^[37]\d{8}$/.test(p), {
    message: 'Numéro de téléphone sénégalais invalide (9 chiffres attendus).'
  });

const emailSchema = z.string().email('Adresse e-mail invalide.').max(255).or(z.literal(''));

const pinCodeSchema = z
  .string()
  .length(4, 'Le code PIN doit contenir exactement 4 chiffres.')
  .regex(/^\d{4}$/, 'Le code PIN ne doit contenir que des chiffres.');

// --- Schémas par endpoint ---

const citizenLoginSchema = z.object({
  phone: phoneSchema,
  pinCode: pinCodeSchema
});

const agentLoginSchema = z.object({
  username: z.string().min(1, 'Identifiant requis.').max(100),
  password: z.string().min(1, 'Mot de passe requis.').max(255)
});

const adhesionSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis.').max(100),
  lastName: z.string().min(1, 'Nom requis.').max(100),
  birthDate: z.string().max(50).optional().nullable(),
  phone: phoneSchema,
  email: emailSchema.optional().default(''),
  address: z.string().max(255).optional().default(''),
  mutuelleName: z.string().min(1, 'Mutuelle requise.').max(255),
  packageType: z.enum(['individuel', 'familial', 'parrainage', 'csu_eleves', 'csu_daara'], {
    message: 'Formule invalide.'
  }),
  paymentMethod: z.enum(['om', 'wave', 'cash', 'card'], { message: 'Moyen de paiement invalide.' }),
  familyMembers: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        relation: z.string().max(50).optional().default('parent'),
        age: z.union([z.string(), z.number()]).optional()
      })
    )
    .optional()
    .default([]),
  sponsorPhone: z.string().max(50).optional().nullable(),
  schoolName: z.string().max(255).optional().nullable(),
  parrainageType: z.enum(['eleves', 'menages', 'individuel']).optional().nullable(),
  sponsoredHouseholds: z
    .array(
      z.object({
        chefName: z.string().min(1).max(255),
        chefPhone: z.string().max(50).optional().nullable(),
        members: z
          .array(
            z.object({
              name: z.string().min(1).max(255),
              relation: z.string().max(50).optional().default('parent'),
              age: z.union([z.string(), z.number()]).optional()
            })
          )
          .optional()
          .default([])
      })
    )
    .optional()
    .nullable()
});

const cotisationRenewSchema = z.object({
  phone: phoneSchema
});

const donationSchema = z.object({
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => parseInt(v, 10))
    .refine((n) => Number.isInteger(n) && n > 0, { message: 'Le montant doit être un entier positif.' }),
  target: z.string().max(255).optional().default('general')
});

const complaintCreateSchema = z.object({
  beneficiaryName: z.string().min(1, 'Nom du bénéficiaire requis.').max(255),
  phone: phoneSchema,
  title: z.string().min(1, 'Titre requis.').max(255),
  description: z.string().min(1, 'Description requise.').max(5000)
});

const beneficiaryStatusSchema = z.object({
  status: z.enum(['pending', 'active', 'suspended', 'rejected'], {
    message: 'Statut invalide.'
  }),
  actor: z.string().max(255).optional()
});

const agentCreateSchema = z.object({
  username: z.string().min(1, 'Identifiant requis.').max(100).email('Identifiant agent doit être un e-mail.'),
  password: z.string().min(8, 'Le mot de passe doit faire au moins 8 caractères.').max(255),
  firstName: z.string().max(100).optional().nullable(),
  lastName: z.string().max(100).optional().nullable(),
  role: z.enum(['Admin Régional', 'Super Admin', 'agent', 'admin'], { message: 'Rôle invalide.' }),
  photoUrl: z.string().max(100000).optional().nullable()
});

const messageCreateSchema = z.object({
  receiver: z.string().min(1, 'Destinataire requis.').max(100),
  subject: z.string().min(1, 'Sujet requis.').max(255),
  body: z.string().min(1, 'Corps du message requis.').max(5000)
});

const chatbotSchema = z.object({
  message: z.string().min(1, 'Message requis.').max(2000),
  lang: z.enum(['fr', 'wo']).optional().default('fr'),
  history: z
    .array(
      z.object({
        sender: z.enum(['user', 'bot']),
        text: z.string().max(2000)
      })
    )
    .optional()
    .default([])
});

// --- Schémas CSU ---

const claimCreateSchema = z.object({
  beneficiaryId: z.union([z.string(), z.number()]).optional().nullable(),
  beneficiaryName: z.string().min(1, 'Nom du bénéficiaire requis.').max(255),
  phone: phoneSchema,
  structureName: z.string().min(1, 'Structure de soins requise.').max(255),
  careType: z.enum(['consultation', 'pharmacie', 'hospitalisation', 'acte'], {
    message: 'Type de soin invalide.'
  }),
  careDescription: z.string().max(2000).optional().default(''),
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => parseInt(v, 10))
    .refine((n) => Number.isInteger(n) && n >= 0, { message: 'Montant invalide.' }),
  coverageRate: z
    .union([z.string(), z.number()])
    .transform((v) => parseInt(v, 10))
    .refine((n) => Number.isInteger(n) && n >= 0 && n <= 100, { message: 'Taux invalide (0-100).' })
    .optional()
    .default(80),
  treatmentDate: z.string().max(50).optional().nullable()
});

const claimStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'paid'], { message: 'Statut invalide.' }),
  reimbursedAmount: z
    .union([z.string(), z.number()])
    .transform((v) => parseInt(v, 10))
    .refine((n) => Number.isInteger(n) && n >= 0, { message: 'Montant remboursé invalide.' })
    .optional(),
  rejectionReason: z.string().max(2000).optional().nullable()
});

const csuProgramCreateSchema = z.object({
  slug: z
    .string()
    .min(1, 'Slug requis.')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug invalide (minuscules, chiffres, tirets).'),
  titleFr: z.string().min(1, 'Titre FR requis.').max(255),
  titleWo: z.string().max(255).optional().nullable(),
  descriptionFr: z.string().min(1, 'Description FR requise.'),
  descriptionWo: z.string().optional().nullable(),
  icon: z.string().max(50).optional().default('📋'),
  targetAudience: z.string().max(255).optional().nullable(),
  coverageRate: z
    .union([z.string(), z.number()])
    .transform((v) => parseInt(v, 10))
    .refine((n) => Number.isInteger(n) && n >= 0 && n <= 100)
    .optional()
    .default(100),
  displayOrder: z
    .union([z.string(), z.number()])
    .transform((v) => parseInt(v, 10))
    .optional()
    .default(0)
});

const notificationSendSchema = z.object({
  beneficiaryId: z.union([z.string(), z.number()]).optional().nullable(),
  channel: z.enum(['sms', 'whatsapp', 'email']).optional().default('sms'),
  recipient: phoneSchema,
  type: z.enum(['adhésion', 'cotisation', 'réclamation', 'prise_en_charge', 'rappel'], {
    message: 'Type de notification invalide.'
  }),
  title: z.string().max(255).optional().nullable(),
  body: z.string().min(1, 'Corps du message requis.').max(1000)
});

// --- Schémas cotisations ---

const cotisationCreateSchema = z.object({
  beneficiaryId: z.union([z.string(), z.number()]).optional().nullable(),
  cmuNumber: z.string().max(100).optional().nullable(),
  phone: phoneSchema,
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => parseInt(v, 10))
    .refine((n) => Number.isInteger(n) && n > 0, { message: 'Montant invalide.' })
    .optional()
    .default(4500),
  paymentMethod: z.enum(['om', 'wave', 'cash', 'card']).optional().default('wave'),
  paymentReference: z.string().max(255).optional().nullable(),
  periodStart: z.string().min(1, 'Date de début requise.'),
  periodEnd: z.string().min(1, 'Date de fin requise.')
});

const partnerLoginSchema = z.object({
  username: z.string().min(1, 'Identifiant requis.').max(150),
  password: z.string().min(1, 'Mot de passe requis.').max(255)
});

const partnerStructureCreateSchema = z.object({
  name: z.string().min(1, 'Nom requis.').max(255),
  type: z.enum(['hopital', 'centre', 'poste', 'pharmacie', 'clinique'], { message: 'Type invalide.' }),
  commune: z.string().max(255).optional().nullable(),
  phone: phoneSchema,
  email: emailSchema.optional().default(''),
  address: z.string().max(1000).optional().nullable(),
  agreementNumber: z.string().min(1, 'N° agrément requis.').max(100),
  coverageRate: z
    .union([z.string(), z.number()])
    .transform((v) => parseInt(v, 10))
    .refine((n) => Number.isInteger(n) && n >= 0 && n <= 100)
    .optional()
    .default(80)
});

const tierPayantDeclareSchema = z.object({
  cmuNumber: z.string().min(1, 'N° CMU requis.').max(100),
  beneficiaryName: z.string().min(1, 'Nom bénéficiaire requis.').max(255),
  careType: z.enum(['consultation', 'pharmacie', 'hospitalisation', 'acte'], { message: 'Type de soin invalide.' }),
  careDescription: z.string().max(2000).optional().default(''),
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => parseInt(v, 10))
    .refine((n) => Number.isInteger(n) && n >= 0, { message: 'Montant invalide.' })
});

module.exports = {
  phoneSchema,
  normalizePhone,
  citizenLoginSchema,
  agentLoginSchema,
  adhesionSchema,
  cotisationRenewSchema,
  donationSchema,
  complaintCreateSchema,
  beneficiaryStatusSchema,
  agentCreateSchema,
  messageCreateSchema,
  chatbotSchema,
  claimCreateSchema,
  claimStatusSchema,
  csuProgramCreateSchema,
  notificationSendSchema,
  cotisationCreateSchema,
  partnerLoginSchema,
  partnerStructureCreateSchema,
  tierPayantDeclareSchema
};
