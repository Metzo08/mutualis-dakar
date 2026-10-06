/**
 * ============================================================
 *  Routes — Assistant clinique IA (aide à la décision)
 * ============================================================
 *
 *  Réservé aux professionnels de santé habilités. Chaque appel est
 *  journalisé : l'usage d'une aide à la décision doit rester traçable
 *  (qui, pour quel patient, quand, et l'accusé de validation).
 */
const express = require('express');
const { query, pool } = require('./db');
const { authenticateToken } = require('./rbac');
const { validate } = require('./validateMiddleware');
const z = require('zod');
const clinicalAi = require('./clinicalAi');

const router = express.Router();

// Mention obligatoire, rappelée à l'écran ET dans chaque réponse.
const DISCLAIMER = "Aide à la décision clinique — validation médicale obligatoire. Ce module ne pose pas de diagnostic.";

const assistSchema = z.object({
  cmuNumber: z.string().trim().min(3).max(60),
  // Profil d'assistance demandé. Le backend le BORNE selon le rôle de
  // l'appelant (voir plus bas) : un infirmier qui demanderait le profil
  // différentiel du médecin reçoit le profil de triage, silencieusement
  // mais consigné dans la réponse pour que l'interface affiche la vérité.
  profile: z.enum(['doctor', 'nurse']).optional(),
  presentation: z.string().trim().max(8000).optional(),
  antecedents: z.array(z.string().max(300)).max(50).optional(),
  allergies: z.array(z.string().max(200)).max(50).optional(),
  pathologies: z.array(z.string().max(300)).max(50).optional(),
  medicaments: z.array(z.string().max(300)).max(50).optional(),
  constantes: z.record(z.string(), z.string()).optional(),
  observations: z.string().trim().max(4000).optional()
});

/** Construit le contexte clinique transmis au modèle. */
const buildContext = (body) => {
  const lines = [`Identifiant dossier : ${body.cmuNumber}`];
  const add = (label, values) => {
    if (Array.isArray(values) && values.length > 0) {
      lines.push(`${label} : ${values.join(' ; ')}`);
    }
  };
  add('Antécédents', body.antecedents);
  add('Allergies', body.allergies);
  add('Pathologies connues', body.pathologies);
  add('Traitements en cours', body.medicaments);
  if (body.constantes && Object.keys(body.constantes).length > 0) {
    const vitals = Object.entries(body.constantes).map(([k, v]) => `${k} = ${v}`).join(' ; ');
    lines.push(`Constantes : ${vitals}`);
  }
  if (body.observations) lines.push(`Observations du praticien : ${body.observations}`);
  if (body.presentation) lines.push(`Motif / symptômes actuels : ${body.presentation}`);
  return lines.join('\n');
};

/** État du moteur : le frontend affiche si l'assistant est disponible. */
router.get('/api/clinical/status', authenticateToken, (req, res) => {
  const cfg = clinicalAi.getConfig();
  const role = (req.user && req.user.role) || '';
  // Le profil autorisé dépend du rôle : l'interface peut ainsi n'afficher
  // que le sélecteur pertinent plutôt que d'offrir un choix que le backend
  // bornerait silencieusement.
  const allowedProfiles = clinicalAi.resolveProfile(role, 'doctor') === 'doctor'
    ? ['doctor', 'nurse']
    : ['nurse'];
  res.json({
    available: clinicalAi.isConfigured(),
    engine: 'MedGemma',
    model: cfg.model,
    roleAllowed: clinicalAi.isClinicalRole(role),
    allowedProfiles,
    disclaimer: DISCLAIMER
  });
});

/** Demande d'analyse clinique (aide à la décision, jamais un diagnostic). */
router.post('/api/clinical/assist', authenticateToken, validate(assistSchema), async (req, res) => {
  const actor = (req.user && (req.user.username || req.user.email)) || `id:${req.user && req.user.id}`;

  if (!clinicalAi.isClinicalRole(req.user && req.user.role)) {
    return res.status(403).json({
      error: 'Accès réservé aux professionnels de santé habilités.',
      disclaimer: DISCLAIMER
    });
  }

  // Aucun modèle déployé : on le dit clairement plutôt que de produire une
  // réponse inventée. Un assistant clinique fantôme serait pire qu'absent.
  if (!clinicalAi.isConfigured()) {
    return res.status(503).json({
      error: 'MOTEUR_NON_CONFIGURE',
      message: "L'assistant clinique IA n'est pas déployé. Renseignez MEDGEMMA_BASE_URL dans backend/.env.",
      disclaimer: DISCLAIMER
    });
  }

  const role = (req.user && req.user.role) || '';
  const r = role.toLowerCase().trim();
  // Résolution et application du profil : un infirmier ou une sage-femme
  // qui demanderait le profil médical reçoit le profil de triage. Ce n'est
  // pas une restriction technique mais une borne de responsabilité :
  // proposer un diagnostic différentiel hors du champ légal du praticien
  // engage autant celui qui l'a fourni.
  const profile = clinicalAi.resolveProfile(role, req.body.profile);
  const requested = req.body.profile || null;
  const profileWasAdjusted = requested && requested !== profile;

  const messages = [
    { role: 'system', content: clinicalAi.buildSystemPrompt(profile, buildContext(req.body)) },
    { role: 'user', content: req.body.presentation || 'Analyse structurée du dossier à partir des éléments disponibles.' }
  ];

  const result = await clinicalAi.callModel(messages);

  if (!result.ok) {
    return res.status(502).json({
      error: result.error,
      message: "Le moteur clinique n'a pas répondu. Aucune analyse n'est produite : ne pas présumer de diagnostic.",
      disclaimer: DISCLAIMER
    });
  }

  try {
    await query('INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)', [
      'ASSISTANCE_CLINIQUE_IA',
      actor,
      `Analyse clinique IA demandée pour ${req.body.cmuNumber} (moteur ${clinicalAi.getConfig().model}, profil ${profile}${profileWasAdjusted ? `, demandé ${requested} — ajusté au rôle` : ''}). Validation clinique requise.`
    ]);
  } catch (e) {
    console.warn('[ClinicalAI] Journalisation impossible :', e.message);
  }

  res.json({
    success: true,
    engine: 'MedGemma',
    model: clinicalAi.getConfig().model,
    profile,
    profileWasAdjusted,
    cmuNumber: req.body.cmuNumber,
    analysis: result.content,
    disclaimer: DISCLAIMER,
    validatedByClinician: false
  });
});

/** Accusé de validation du praticien (validé / corrigé / écarté). */
router.post('/api/clinical/validate', authenticateToken, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const { cmuNumber, outcome, comment } = req.body || {};
    if (!cmuNumber || !outcome) {
      return res.status(400).json({ error: 'Dossier et outcome requis.' });
    }
    if (!['valide', 'corrige', 'ecarte'].includes(outcome)) {
      return res.status(400).json({ error: 'Outcome invalide (valide | corrige | ecarte).' });
    }
    await client.query('INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)', [
      'VALIDATION_CLINIQUE_IA',
      (req.user && (req.user.username || req.user.email)) || `id:${req.user && req.user.id}`,
      `Analyse IA sur ${cmuNumber} : ${outcome}.${comment ? ' ' + String(comment).slice(0, 500) : ''}`
    ]);
    res.json({ success: true, outcome, validatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Erreur validation clinique :', err);
    res.status(500).json({ error: 'Erreur interne.' });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
