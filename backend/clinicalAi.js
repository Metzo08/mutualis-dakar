/**
 * ============================================================
 *  MUTUALIS DAKAR — Clinical AI Engine (assistant d'aide à la décision)
 * ============================================================
 *
 *  ⚠️ AVERTISSEMENT NON NÉGOCIABLE
 *  --------------------------------
 *  Ce module est un outil d'AIDE À LA DÉCISION destiné aux professionnels
 *  de santé. Il ne pose JAMAIS de diagnostic et ne remplace JAMAIS le
 *  jugement clinique. Toute sortie doit être validée, corrigée ou écartée
 *  par un praticien habilité avant toute décision thérapeutique.
 *
 *  Ces garde-fous ne sont pas optionnels : MedGemma (comme tout modèle de
 *  développement) ne doit pas être utilisé pour établir un diagnostic ou
 *  une décision thérapeutique sans validation clinique indépendante.
 *
 *  MODÈLE
 *  -------
 *  MedGemma (Google Health AI), servi en infrastructure privée via une API
 *  compatible OpenAI (vLLM, Ollama, llama.cpp…). AUCUNE donnée patient ne
 *  quitte l'infrastructure : c'est la raison d'être du déploiement privé.
 *
 *      MedGemma 4B Instruct → déploiement de référence (texte + vision)
 *      MedGemma 27B       → raisonnement complexe, si GPU disponible
 *
 *  Le modèle n'est JAMAIS requis pour que l'application fonctionne : sans
 *  endpoint configuré, l'assistant reste indisponible plutôt que de produire
 *  une réponse inventée.
 */

const DEFAULT_TIMEOUT_MS = 120000;

/** Habilitations autorisées à interroger l'assistant clinique. */
const CLINICAL_ROLES = ['agent', 'admin', 'doctor', 'midwife'];

/** Liste blanche des rôles (alignée sur normalizeRole côté RBAC). */
const isClinicalRole = (role) => {
  const r = String(role || '').toLowerCase().trim();
  if (r === 'super admin' || r === 'superadmin' || r === 'admin' || r === 'agent') return true;
  if (r === 'médecin' || r === 'medecin' || r === 'doctor' || r === 'sage-femme' || r === 'sage femme' || r === 'midwife') return true;
  return CLINICAL_ROLES.includes(r);
};

// ---------------------------------------------------------------------------
// PROFILS CLINIQUES — l'assistance est calibrée sur les compétences réelles
// du praticien, pas sur un modèle unique.
//
// Pourquoi deux profils et pas un : un médecin et une sage-femme/infirmier
// n'ont ni la même formation ni la même responsabilité légale. Une sage-femme
// qui reçoit des hypothèses diagnostiques différentielles complexes sur un
// domaïne hors périnatalité est mise en position de décider au-delà de son
// champ légal — et le système qui la pousse dans cette position partage cette
// responsabilité. L'inférieur reçoit donc un OUTIL DE TRIAGE et d'orientation,
// pas un moteur d'hypothèses.
//
// Le praticien peut toujours demander l'autre profil via le sélecteur, mais
// le backend borne ce qu'il accepte : un infirmier ne peut pas obtenir le
// profil différentiel (voir clinicalRoutes.js). C'est une borne de
// responsabilité, pas une limite technique.
// ---------------------------------------------------------------------------
const CLINICAL_PROFILES = {
  doctor: 'doctor',
  infirmier: 'nurse',
  nurse: 'nurse',
  sage_femme: 'nurse',
  midwife: 'nurse'
};

const resolveProfile = (role, requested) => {
  const r = String(role || '').toLowerCase().trim();
  const req = String(requested || '').toLowerCase().trim();
  // Les rôles "agent/admin" (administration, pas un praticien clinique)
  // ne peuvent demander que le profil de triage : voir la borne côté routes.
  const isPhysician = ['médecin', 'medecin', 'doctor'].includes(r);
  if (isPhysician) {
    return req === 'nurse' ? 'nurse' : 'doctor';
  }
  // Sage-femme/infirmier : profil triage, quelle que soit la demande.
  return 'nurse';
};

/** Configuration du moteur, lue à chaque appel (surchargeable par variables). */
const getConfig = () => ({
  baseUrl: (process.env.MEDGEMMA_BASE_URL || process.env.LLM_BASE_URL || '').replace(/\/+$/, ''),
  apiKey: process.env.MEDGEMMA_API_KEY || process.env.LLM_API_KEY || '',
  model: process.env.MEDGEMMA_MODEL || 'medgemma-4b-it',
  timeoutMs: parseInt(process.env.MEDGEMMA_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10)
});

/** Le moteur est-il déployé et exploitable ? */
const isConfigured = () => Boolean(getConfig().baseUrl);

/**
 * Consignes système cliniques — une par profil.
 *
 * Les deux profils partagent les mêmes garde-fous fondamentaux, mais
 * raisonnent différemment :
 *
 *  - DOCTOR : raisonnement différentiel structuré. Le médecin a la
 *    formation et la responsabilité de peser des hypothèses — l'assistant
 *    les organise sans les trancher.
 *
 *  - NURSE : triage et orientation. Aucune hypothèse diagnostique : le
 *    modèle identifie les signes de gravité, les mesures à prendre et
 *    vers QUI orienter (médecin, structure, urgence). L'infirmier agit
 *    dans un cadre défini par ce qu'il peut faire légalement.
 */
const buildDoctorPrompt = (context) => `Tu es un assistant d'aide à la décision clinique pour un MÉDECIN au Sénégal (portail CSU / MUTUALIS).

RÔLE ET LIMITES
- Tu aides le médecin à raisonner. Tu ne poses PAS de diagnostic.
- Tu ne prescris PAS de traitement ni de posologie.
- Tu ne remplaces JAMAIS l'examen clinique ni le jugement du médecin.
- En cas d'urgence vitale, indique immédiatement la conduite à tenir et les signes d'alerte à rechercher.
- Ne déduis jamais un diagnostic à partir d'un élément manquant : signale l'information manquante.

SORTIE ATTENDUE (Markdown strict, dans cet ordre exact) :
## MOTIF
## ELEMENTS PERTINENTS
## HYPOTHESES A CONSIDERER
## ELEMENTS EN FAVEUR
## ELEMENTS CONTRE
## EXAMENS COMPLEMENTAIRES
## SIGNES D'ALERTE
## RISQUES ET INTERACTIONS
## INFORMATIONS MANQUANTES
## NIVEAU D'INCERTITUDE
## VALIDATION MEDICALE REQUISE

CONTEXTE DU PATIENT (données autorisées par le praticien) :
${context}

Rédige en français, de façon concise et factuelle.`;

const buildNursePrompt = (context) => `Tu es un assistant de TRIAGE CLINIQUE pour un infirmier ou une sage-femme au Sénégal (portail CSU / MUTUALIS).

RÔLE ET LIMITES — CONTRAIGNANTES
- Tu aides le praticien à évaluer la GRAVITÉ et à ORIENTER. Tu ne proposes JAMAIS d'hypothèse diagnostique.
- Tu ne prescris RIEN. Tu ne suggères AUCUN traitement, même symptomatique.
- Tu décris ce que le praticien peut FAIRE dans son champ : mesures, surveillance, critères de réévaluation.
- Pour toute prise en charge au-delà du triage, tu renvoies explicitement vers un médecin ou une structure, en précisant le niveau d'urgence.
- En cas de signe de gravité, tu places l'orientation en TÊTE de réponse : le praticien doit la voir en premier.

SORTIE ATTENDUE (Markdown strict, dans cet ordre exact) :
## SITUATION
## NIVEAU D'URGENCE   ← rouge / orange / vert selon les signes observés
## SIGNES DE GRAVITE A RECHERCHER   ← quoi mesurer, à quelle fréquence
## ACTIONS DANS LE CHAMP DU PRATICIEN   ← uniquement ce qu'il peut faire lui-même
## ORIENTATION RECOMMANDEE   ← vers qui, quand, par quel moyen
## CRITERES DE REEVALUATION   ← ce qui doit déclencher une réorientation
## INFORMATIONS A TRANSMETTRE AU MEDECIN   ← ce que le praticien doit consigner

CONTEXTE DU PATIENT (données autorisées par le praticien) :
${context}

Rédige en français, de façon concise et factuelle. L'ORIENTATION est toujours la section la plus concrète : qui appeler, quel niveau de structure, quel délai.`;

/**
 * Consigne système selon le profil résolu.
 * @param {'doctor'|'nurse'} profile
 */
const buildSystemPrompt = (profile, context) => {
  if (profile === 'nurse') return buildNursePrompt(context);
  return buildDoctorPrompt(context);
};

/**
 * Appelle le modèle médical via une API compatible OpenAI.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {number} [timeoutMs]
 * @returns {Promise<{ok: boolean, content?: string, error?: string, raw?: any}>}
 */
async function callModel(messages, timeoutMs) {
  const cfg = getConfig();
  if (!cfg.baseUrl) {
    return { ok: false, error: 'MOTEUR_NON_CONFIGURE' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || cfg.timeoutMs);

  try {
    const res = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: 0.2,
        max_tokens: 2048
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `MODELE_HTTP_${res.status}`, raw: body.slice(0, 300) };
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: 'REPONSE_VIDE' };
    return { ok: true, content: String(content) };
  } catch (err) {
    if (err.name === 'AbortError') return { ok: false, error: 'MODELE_DELAI_DEPASSE' };
    return { ok: false, error: 'MODEUR_INJOIGNABLE', raw: err.message };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  isConfigured,
  isClinicalRole,
  getConfig,
  resolveProfile,
  CLINICAL_PROFILES,
  buildSystemPrompt,
  callModel
};
