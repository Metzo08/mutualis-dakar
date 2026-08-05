import React, { useState } from 'react';

// Registre des 13 profils d'accès avec E-mail et Mot de passe uniques
export const PRESET_ACCOUNTS_13 = [
  { code: 'ACC-01', title: '1. Assuré individuel / famille', cat: 'Citoyens & assurés', email: 'modou.diop@csu.sn', password: 'Modou2026!', portal: 'citizen', view: 'profile', icon: '👤', user: { id: 1, firstName: 'Modou', lastName: 'Diop', phone: '771234567', email: 'modou.diop@csu.sn', mutuelleName: 'Mutuelle de la Médina', packageType: 'individuel', cmuNumber: 'SN-DK-MED-8472', status: 'active' } },
  { code: 'ACC-02', title: '2. Élève / étudiant (CSU jeunes)', cat: 'Citoyens & assurés', email: 'ibrahima.sarr@ucad.edu.sn', password: 'Etudiant2026!', portal: 'citizen', view: 'profile', icon: '🎓', user: { id: 3, firstName: 'Ibrahima', lastName: 'Sarr', phone: '774567890', email: 'ibrahima.sarr@ucad.edu.sn', mutuelleName: 'Mutuelle Étudiante UCAD', packageType: 'scolaire', cmuNumber: 'SN-DK-UCAD-3012', status: 'active' } },
  { code: 'ACC-03', title: '3. Bénéficiaire BSF (filet social)', cat: 'Citoyens & assurés', email: 'fatou.diallo@bsf.sn', password: 'Bsf2026!', portal: 'citizen', view: 'profile', icon: '🌟', user: { id: 4, firstName: 'Fatou', lastName: 'Diallo', phone: '778901234', email: 'fatou.diallo@bsf.sn', mutuelleName: 'Mutuelle Communale Pikine', packageType: 'gratuité', cmuNumber: 'SN-DK-BSF-9901', status: 'active' } },
  { code: 'ACC-04', title: '4. Médecin / praticien traitant', cat: 'Plateau médical', email: 'dr.diop@hopital-fann.sn', password: 'Medecin2026!', portal: 'partner', view: 'telemedicine', icon: '🩺', user: { id: 10, username: 'dr.diop@hopital-fann.sn', contactName: 'Dr. Cheikh Anta Diop', structureName: 'Centre Hospitalier Abass Ndao', structureType: 'hopital', role: 'medecin' } },
  { code: 'ACC-05', title: '5. Infirmier / sage-femme', cat: 'Plateau médical', email: 'aissatou.sow@sante.sn', password: 'Infirmiere2026!', portal: 'partner', view: 'maternity', icon: '👩‍⚕️', user: { id: 11, username: 'aissatou.sow@sante.sn', contactName: 'Aïssatou Sow (Sage-Femme)', structureName: 'Poste de Santé de la Médina', structureType: 'poste_sante', role: 'soignant' } },
  { code: 'ACC-06', title: '6. Pharmacien d\'officine agréée', cat: 'Plateau médical', email: 'dr.fatou.sow@pharmacie-medina.sn', password: 'Pharma2026!', portal: 'partner', view: 'medicaments', icon: '💊', user: { id: 12, username: 'dr.fatou.sow@pharmacie-medina.sn', contactName: 'Dr. Fatou Sow (Pharmacienne)', structureName: 'Grande Pharmacie de la Médina', structureType: 'pharmacie', role: 'pharmacien' } },
  { code: 'ACC-07', title: '7. Biologie & radiologie (laboratoire)', cat: 'Plateau médical', email: 'dr.ousmane.kane@pasteur-dakar.sn', password: 'Biologie2026!', portal: 'partner', view: 'partner', icon: '🔬', user: { id: 13, username: 'dr.ousmane.kane@pasteur-dakar.sn', contactName: 'Dr. Ousmane Kane (Biologiste)', structureName: 'Laboratoire Pasteur Dakar', structureType: 'laboratoire', role: 'laboratoire' } },
  { code: 'ACC-08', title: '8. Direction EPS & gestion hôpital', cat: 'Plateau médical', email: 'direction@hopital-principal.sn', password: 'Eps2026!', portal: 'partner', view: 'guarantees', icon: '🏥', user: { id: 14, username: 'direction@hopital-principal.sn', contactName: 'Direction EPS Hôpital Principal', structureName: 'Hôpital Principal de Dakar', structureType: 'hopital_eps', role: 'gestionnaire_eps' } },
  { code: 'ACC-09', title: '9. Agent mutuelle UDMS (terrain)', cat: 'Mutuelles communautaires', email: 'amadou.sall@udms-dakar.sn', password: 'Agent2026!', portal: 'agent', view: 'beneficiaries', icon: '💼', user: { id: 15, username: 'amadou.sall@udms-dakar.sn', firstName: 'Amadou', lastName: 'Sall', role: 'Agent d\'Enrôlement Terrain UDMS' } },
  { code: 'ACC-10', title: '10. Superviseur régional URMSCD', cat: 'Mutuelles communautaires', email: 'mariama.ba@urmscd-dakar.sn', password: 'Supervisor2026!', portal: 'agent', view: 'dashboard', icon: '📊', user: { id: 16, username: 'mariama.ba@urmscd-dakar.sn', firstName: 'Mariama', lastName: 'Ba', role: 'Superviseur Régional URMSCD' } },
  { code: 'ACC-11', title: '11. Super admin ANACSU & ministère', cat: 'Gouvernance nationale', email: 'superadmin@anacsu.sn', password: 'SuperAdmin2026!', portal: 'agent', view: 'superadmin-governance', icon: '👑', user: { id: 99, username: 'superadmin@anacsu.sn', firstName: 'Dr. Mamadou', lastName: 'Ba', role: 'Super Admin' } },
  { code: 'ACC-12', title: '12. Entreprise / employeur privé', cat: 'Entreprises & mécènes', email: 'rh@patisen.sn', password: 'Entreprise2026!', portal: 'partner', view: 'rse', icon: '🏢', user: { id: 20, username: 'rh@patisen.sn', contactName: 'Direction RH Patisen', structureName: 'Groupe PATISEN SA', structureType: 'entreprise', role: 'entreprise' } },
  { code: 'ACC-13', title: '13. Parrain solidaire & mécène RSE', cat: 'Entreprises & mécènes', email: 'fondation@wave.sn', password: 'Parrain2026!', portal: 'partner', view: 'parrainage-solidaire', icon: '🤝', user: { id: 21, username: 'fondation@wave.sn', contactName: 'Fondation WAVE & Sonatel Mécénat', structureName: 'Parrain Solidaire Régional', structureType: 'fondation_rse', role: 'parrain_rse' } }
];

export default function Login({ lang, setView, portalMode, setPortalMode, setCitizenUser, setAgentUser, setPartnerUser }) {
  const [selectedAccCode, setSelectedAccCode] = useState('ACC-01');
  const [emailInput, setEmailInput] = useState('modou.diop@csu.sn');
  const [passwordInput, setPasswordInput] = useState('Modou2026!');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // (la demande d'ouverture de compte a été supprimée — réservée au SuperAdmin/Agent en back-office)

  const handleSelectPreset = (code) => {
    setSelectedAccCode(code);
    setError('');
    const found = PRESET_ACCOUNTS_13.find(a => a.code === code);
    if (found) {
      setEmailInput(found.email);
      setPasswordInput(found.password);
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      setError('Veuillez remplir votre e-mail et votre mot de passe.');
      return;
    }

    setError('');
    setLoading(true);

    // 1. Vérification dans les 13 profils prédéfinis
    const matchedPreset = PRESET_ACCOUNTS_13.find(
      a => (a.email.toLowerCase() === emailInput.trim().toLowerCase() || (a.user.phone && a.user.phone === emailInput.trim())) && 
           a.password === passwordInput
    );

    // 2. Vérification dans les comptes créés dynamiquement (cmu-all-accounts)
    let matchedDynamic = null;
    try {
      const stored = localStorage.getItem('cmu-all-accounts');
      if (stored) {
        const parsed = JSON.parse(stored);
        matchedDynamic = parsed.find(
          u => (u.email.toLowerCase() === emailInput.trim().toLowerCase() || (u.phone && u.phone === emailInput.trim())) && 
               u.password === passwordInput && u.status !== 'refused'
        );
      }
    } catch (e) {
      console.warn('Error reading stored accounts:', e);
    }

    setTimeout(() => {
      setLoading(false);

      if (matchedPreset) {
        const { portal, view, user, code } = matchedPreset;
        let rbacMode = portal;
        if (code === 'ACC-04' || code === 'ACC-07' || code === 'ACC-08') rbacMode = 'doctor';
        else if (code === 'ACC-05') rbacMode = 'midwife';
        else if (code === 'ACC-06') rbacMode = 'pharmacist';
        else if (code === 'ACC-11') rbacMode = 'superadmin';
        else if (code === 'ACC-09' || code === 'ACC-10') rbacMode = 'agent';
        else if (code === 'ACC-01' || code === 'ACC-02' || code === 'ACC-03') rbacMode = 'citizen';

        localStorage.setItem('cmu-portal-mode', rbacMode);
        if (portal === 'citizen' || rbacMode === 'citizen') {
          localStorage.setItem('cmu-citizen-user', JSON.stringify(user));
          if (setCitizenUser) setCitizenUser(user);
        } else if (portal === 'agent' || rbacMode === 'agent' || rbacMode === 'superadmin' || rbacMode === 'pharmacist') {
          localStorage.setItem('cmu-agent-user', JSON.stringify(user));
          if (setAgentUser) setAgentUser(user);
        } else {
          localStorage.setItem('cmu-partner-user', JSON.stringify(user));
          if (setPartnerUser) setPartnerUser(user);
        }
        if (setPortalMode) setPortalMode(rbacMode);
        if (setView) setView(view);
      } else if (matchedDynamic) {
        const portal = matchedDynamic.portal || (matchedDynamic.type === 'agent' || matchedDynamic.type === 'superadmin' ? 'agent' : matchedDynamic.type === 'partner' ? 'partner' : 'citizen');
        const view = matchedDynamic.targetView || (portal === 'agent' ? 'beneficiaries' : portal === 'partner' ? 'partner' : 'profile');
        const userObj = matchedDynamic.userObj || matchedDynamic;

        localStorage.setItem('cmu-portal-mode', portal);
        if (portal === 'citizen') {
          localStorage.setItem('cmu-citizen-user', JSON.stringify(userObj));
          if (setCitizenUser) setCitizenUser(userObj);
        } else if (portal === 'agent') {
          localStorage.setItem('cmu-agent-user', JSON.stringify(userObj));
          if (setAgentUser) setAgentUser(userObj);
        } else if (portal === 'partner') {
          localStorage.setItem('cmu-partner-user', JSON.stringify(userObj));
          if (setPartnerUser) setPartnerUser(userObj);
        }
        if (setPortalMode) setPortalMode(portal);
        if (setView) setView(view);
      } else {
        setError('E-mail ou mot de passe incorrect. Veuillez vérifier vos identifiants ou faire une demande d\'ouverture de compte.');
      }
    }, 400);
  };

  // (handler de demande d'ouverture supprimé — fonctionnalité retirée de la page login)

  return (
    <div className="login-view fade-in-up" style={{ minHeight: '85vh', paddingBottom: '3rem' }}>
      {/* Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.5) 0%, rgba(16, 185, 129, 0.3) 100%), url("/csu_login_portal_unique.jpg") center/cover no-repeat',
        border: '1px solid rgba(255, 255, 255, 0.45)',
        borderRadius: '24px',
        padding: '3rem 2rem',
        minHeight: '200px',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)',
        textAlign: 'center'
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ color: '#fff', fontSize: '2.2rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            🔑 Portail unique d'authentification CSU Sénégal
          </h1>
          <p style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: '500', maxWidth: '750px', margin: '0 auto', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
            Connexion sécurisée par e-mail & mot de passe unique pour les 13 profils d'accès nationaux.
          </p>
        </div>
      </section>

      {successMsg && (
        <div style={{
          maxWidth: '950px',
          margin: '0 auto 1.5rem auto',
          backgroundColor: '#059669',
          color: '#ffffff',
          padding: '1rem 1.5rem',
          borderRadius: '14px',
          fontWeight: '700',
          fontSize: '0.92rem',
          boxShadow: '0 8px 24px rgba(5, 150, 105, 0.3)'
        }}>
          {successMsg}
        </div>
      )}

      {/* Sélection rapide des 13 profils d'accès avec e-mail unique */}
      <div style={{ maxWidth: '1100px', margin: '0 auto 2.5rem auto', padding: '0 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
              🛡️ Sélection d'accès aux 13 profils (Identifiants dédiés) :
            </h3>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>
              Cliquez sur n'importe quel profil pour pré-remplir ses identifiants uniques e-mail & mot de passe
            </span>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '0.85rem'
        }}>
          {PRESET_ACCOUNTS_13.map((acc) => {
            const isSel = selectedAccCode === acc.code;
            return (
              <div
                key={acc.code}
                onClick={() => handleSelectPreset(acc.code)}
                style={{
                  background: isSel ? 'var(--bg-card)' : 'var(--bg-card-subtle)',
                  border: isSel ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  borderRadius: '16px',
                  padding: '1rem 0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  transform: isSel ? 'translateY(-3px)' : 'none',
                  boxShadow: isSel ? '0 8px 20px rgba(5, 150, 105, 0.25)' : 'var(--shadow-sm)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>{acc.icon}</span>
                  <span style={{ fontSize: '0.62rem', fontWeight: '800', background: 'var(--primary-subtle)', color: 'var(--primary)', padding: '0.15rem 0.45rem', borderRadius: '6px' }}>
                    {acc.code}
                  </span>
                </div>
                <div style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.2rem', lineHeight: '1.3' }}>
                  {acc.title}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-sub)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  📧 {acc.email}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Formulaire de Connexion Unifié */}
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '0 1rem' }}>
        <div className="card" style={{
          padding: '2.5rem 2rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '24px',
          boxShadow: 'var(--shadow-lg)',
          textAlign: 'left',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Accent Tricolore */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '5px', display: 'flex' }}>
            <div style={{ flex: 1, backgroundColor: '#00853f' }}></div>
            <div style={{ flex: 1, backgroundColor: '#fdef42' }}></div>
            <div style={{ flex: 1, backgroundColor: '#e31b23' }}></div>
          </div>

          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>
              🔐 Se connecter à sa session CSU
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginTop: '0.25rem' }}>
              Profil sélectionné : <strong>{PRESET_ACCOUNTS_13.find(a => a.code === selectedAccCode)?.title || 'Compte personnel'}</strong>
            </p>
          </div>

          {error && (
            <div style={{
              backgroundColor: 'rgba(220, 38, 38, 0.1)',
              color: 'var(--danger)',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: '600',
              marginBottom: '1.25rem',
              borderLeft: '4px solid var(--danger)'
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: '700', fontSize: '0.85rem' }}>
                Adresse e-mail unique ou N° portable
              </label>
              <input
                type="text"
                className="form-control"
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.7rem 0.9rem' }}
                placeholder="ex: modou.diop@csu.sn ou 771234567"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: '700', fontSize: '0.85rem' }}>
                Mot de passe unique
              </label>
              <input
                type="password"
                className="form-control"
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.7rem 0.9rem' }}
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', borderRadius: '12px', fontWeight: '800', fontSize: '0.95rem' }} disabled={loading}>
              {loading ? 'Connexion en cours...' : '🚀 Se connecter au portail CSU'}
            </button>

            <div style={{
              marginTop: '0.5rem',
              padding: '0.75rem 1rem',
              background: 'var(--bg-card-subtle)',
              borderRadius: '12px',
              fontSize: '0.75rem',
              color: 'var(--text-sub)',
              border: '1px dashed var(--border-color)',
              lineHeight: '1.4'
            }}>
              💡 <strong>Identifiants uniques :</strong> Chaque profil possède son adresse e-mail et son mot de passe dédiés. Le Super Admin et les Agents peuvent également accorder l'ouverture de votre compte.
            </div>
          </form>
        </div>
      </div>

    </div>
  );
}
