import React, { useState } from 'react';
import { generateOfficialPdf } from '../utils/pdfGenerator';

// Design Premium Haut de Gamme — Carnet Maternité & Santé Enfant
export default function MaternalHealth({ lang = 'fr', citizenUser = null }) {
  const [activeTab, setActiveTab] = useState('cpn'); // 'cpn', 'pev', 'advice'
  
  // Modales
  const [showGuaranteeModal, setShowGuaranteeModal] = useState(false);
  const [showAskMidwifeModal, setShowAskMidwifeModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedCpnForBooking, setSelectedCpnForBooking] = useState(null);

  // Formulaire question sage-femme
  const [midwifeQuestion, setMidwifeQuestion] = useState('');
  const [midwifeAnswers, setMidwifeAnswers] = useState([
    {
      q: "Est-ce normal d'avoir des nausées légères au 2ème trimestre ?",
      a: "Bonjour Awa. Les nausées diminuent généralement au 2ème trimestre. Si elles persistent, nous vous recommandons des tisanes au gingembre et des repas fractionnés.",
      date: "Hier à 14:30",
      doctor: "Sage-femme Fatou Diome"
    }
  ]);

  // Données CPN
  const [cpnVisits, setCpnVisits] = useState([
    {
      id: 1,
      title: 'CPN 1 (1er Trimestre - Datation & Sérologies)',
      desc: 'Grossesse intra-utérine évolutive 8 SA. Bilan biologique initial normal, groupe O+.',
      date: '10/04/2026',
      doctor: 'Sage-Femme Fatou Kiné Diop',
      status: 'CPN 1 - CONFIRMÉE',
      completed: true
    },
    {
      id: 2,
      title: 'CPN 2 (2ème Trimestre - Morphologie & VAT 1)',
      desc: 'Hauteur utérine 21 cm. Bruit du cœur fœtal régulier (145 bpm). Injection VAT 1 réalisée.',
      date: '05/06/2026',
      doctor: 'Dr. Mariama Ba (Gynécologue)',
      status: 'CPN 2 - CONFIRMÉE',
      completed: true
    },
    {
      id: 3,
      title: 'CPN 3 (28-32 SA - Dépistage Anémie & TPI-SP 1)',
      desc: 'Prévue : Contrôle hémoglobine, 1ère dose TPI-SP (Prévention Paludisme) & VAT 2.',
      date: '12/08/2026',
      doctor: 'Sage-Femme Fatou Kiné Diop',
      status: 'CPN 3 - À VENIR',
      completed: false
    },
    {
      id: 4,
      title: 'CPN 4+ (36-38 SA - Préparation Accouchement 100% Gratuit)',
      desc: 'Prévue : Présentation céphalique, vérification bassin maternel & fiche de liaison.',
      date: '25/09/2026',
      doctor: 'Dr. Mariama Ba (Gynécologue)',
      status: 'CPN 4 - À VENIR',
      completed: false
    }
  ]);

  // Confirmer réservation CPN
  const handleConfirmBooking = (cpnId) => {
    setCpnVisits(cpnVisits.map(c => c.id === cpnId ? { ...c, completed: true, status: `CPN ${c.id} - CONFIRMÉE` } : c));
    setShowBookingModal(false);
    alert("✅ Rendez-vous CPN réservé et confirmé sous la prise en charge 100% UNAMUSC.");
  };

  // Poser question à la sage-femme
  const handleSendQuestion = (e) => {
    e.preventDefault();
    if (!midwifeQuestion.trim()) return;
    const newQ = {
      q: midwifeQuestion,
      a: "Merci Awa. Votre question a été transmise à la sage-femme de garde Dr. Fatou Diome. Une réponse vous sera notifiée d'ici 15 minutes.",
      date: "À l'instant",
      doctor: "Sage-femme Fatou Diome"
    };
    setMidwifeAnswers([newQ, ...midwifeAnswers]);
    setMidwifeQuestion('');
    setShowAskMidwifeModal(false);
    alert("📩 Votre question a bien été envoyée à la sage-femme de garde !");
  };

  const handleDownloadCarnet = () => {
    generateOfficialPdf({
      filename: 'carnet_sante_maternelle_awa_ndiaye.pdf',
      docType: 'CARNET DE SANTÉ MATERNELLE ET PÉDIATRIQUE',
      title: 'Carnet Maternité & Suivi Enfant 100% Gratuit',
      referenceNo: 'CARNET-MAT-2026-8812',
      beneficiaryName: 'Awa Ndiaye',
      cmuNumber: 'CMU-DKR-2026-8812',
      structureName: 'Hôpital Universitaire de Fann (Dakar)',
      details: [
        { label: 'Assurée', value: 'Awa Ndiaye' },
        { label: 'Enfant rattaché', value: 'Moussa Ndiaye (Né le 14/05/2026)' },
        { label: 'Statut Consultations CPN', value: '75% complété (CPN 1 et CPN 2 validées)' },
        { label: 'Vaccinations PEV Enfant', value: 'BCG, VPO 0, VHB 0 et Penta 1 administrés' },
        { label: 'Garantie Accouchement', value: 'Prise en charge intégrale à 100% par UNAMUSC' }
      ],
      notes: 'Ce carnet numérique officiel garantit l\'accès gratuit aux soins de maternité et au programme élargi de vaccination (PEV) dans tous les établissements agréés du Sénégal.'
    });
  };

  const handleDownloadGuarantee = () => {
    generateOfficialPdf({
      filename: 'lettre_garantie_accouchement_100_unamusc.pdf',
      docType: 'LETTRE DE GARANTIE HOSPITALIÈRE INTEGRALE',
      title: 'Prise en Charge Accouchement 100% UNAMUSC',
      referenceNo: 'GAR-MAT-2026-9910',
      beneficiaryName: 'Awa Ndiaye',
      cmuNumber: 'CMU-DKR-2026-8812',
      structureName: 'Centre Hospitalier Universitaire de Fann (Dakar)',
      details: [
        { label: 'Bénéficiaire', value: 'Awa Ndiaye (CMU-DKR-2026-8812)' },
        { label: 'Établissement Récepteur', value: 'CHU de Fann (Dakar)' },
        { label: 'Taux de Couverture UNAMUSC', value: '100% Prise en Charge Totale' },
        { label: 'Actes Couverts', value: 'Accouchement simple, Césarienne d\'urgence & Soins néonataux' },
        { label: 'Montant à payer par l\'assuré', value: '0 FCFA (Tiers-Payant Intégral)' }
      ],
      notes: 'La présente lettre de garantie dispense l\'assurée de toute avance de frais d\'hospitalisation ou de bloc opératoire.'
    });
  };

  return (
    <div className="maternity-view fade-in-up" style={{ minHeight: '100vh', background: '#0b1120', color: '#f8fafc', paddingBottom: '3rem' }}>
      
      {/* Subnav Header Bar */}
      <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: '#0f172a', padding: '0.85rem 2rem' }}>
        <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h5 className="fw-bold mb-0 text-white" style={{ fontSize: '1.1rem' }}>UNAMUSC Sénégal 🇸🇳</h5>
            <span style={{ height: '14px', width: '1px', background: 'rgba(255, 255, 255, 0.2)' }} />
            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', padding: '0.25rem 0.75rem' }}>
              Awa Ndiaye • Mère éligible CSU
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Rechercher..." 
              style={{ background: '#1e293b', color: '#ffffff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: '200px' }} 
            />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1320px', margin: '1.75rem auto 0 auto', padding: '0 1.5rem' }}>
        
        {/* Top Hero Banner Card */}
        <div 
          className="p-5 rounded-4 mb-5 text-white" 
          style={{ 
            background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.38) 0%, rgba(16, 185, 129, 0.18) 100%), url("/csu_kids_real.png") center/cover no-repeat', 
            padding: '3.75rem 2.5rem',
            minHeight: '240px',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.45)', 
            boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)' 
          }}
        >
          <div className="row align-items-center g-4">
            <div className="col-lg-8">
              <span style={{ background: '#059669', color: '#ffffff', padding: '0.35rem 0.9rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: '700', display: 'inline-block', marginBottom: '0.75rem', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.3)' }}>
                🇸🇳 ESPACE PREMIUM SANTÉ MATERNELLE UNAMUSC
              </span>
              <h1 className="fw-extrabold text-white mb-2" style={{ fontSize: '2.35rem', letterSpacing: '-0.02em', textShadow: '0 3px 6px rgba(0,0,0,0.4)' }}>Carnet de santé maternelle & suivi de l'enfant</h1>
              <p className="text-white-50 mb-4" style={{ fontSize: '1.05rem', maxWidth: '720px', lineHeight: '1.6', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                Accédez en toute sécurité au suivi prénatal et au calendrier vaccinal PEV de votre enfant. Bénéficiez des garanties de prise en charge 100% CMU.
              </p>

              <div className="d-flex gap-3 flex-wrap">
                <button 
                  type="button"
                  style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.75rem 1.25rem', fontWeight: '700', fontSize: '0.88rem', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)', cursor: 'pointer' }} 
                  onClick={() => setShowGuaranteeModal(true)}
                >
                  📜 Générer lettre de garantie (100% UNAMUSC)
                </button>
                
                <button 
                  type="button"
                  style={{ background: '#1e293b', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', padding: '0.75rem 1.25rem', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer' }} 
                  onClick={handleDownloadCarnet}
                >
                  📥 Télécharger Carnet Officiel PDF (🇸🇳)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation Pills */}
        <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem', borderRadius: '14px', display: 'inline-flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button 
            type="button"
            style={{ 
              background: activeTab === 'cpn' ? '#10b981' : '#0f172a', 
              color: activeTab === 'cpn' ? '#ffffff' : '#94a3b8', 
              border: 'none', 
              borderRadius: '10px', 
              padding: '0.6rem 1.25rem', 
              fontWeight: '700', 
              fontSize: '0.85rem',
              cursor: 'pointer'
            }} 
            onClick={() => setActiveTab('cpn')}
          >
            1. Suivi Prénatal (CPN 1-4+)
          </button>

          <button 
            type="button"
            style={{ 
              background: activeTab === 'pev' ? '#10b981' : '#0f172a', 
              color: activeTab === 'pev' ? '#ffffff' : '#94a3b8', 
              border: 'none', 
              borderRadius: '10px', 
              padding: '0.6rem 1.25rem', 
              fontWeight: '700', 
              fontSize: '0.85rem',
              cursor: 'pointer'
            }} 
            onClick={() => setActiveTab('pev')}
          >
            2. Croissance & Vaccins (0-12 mois)
          </button>

          <button 
            type="button"
            style={{ 
              background: activeTab === 'advice' ? '#10b981' : '#0f172a', 
              color: activeTab === 'advice' ? '#ffffff' : '#94a3b8', 
              border: 'none', 
              borderRadius: '10px', 
              padding: '0.6rem 1.25rem', 
              fontWeight: '700', 
              fontSize: '0.85rem',
              cursor: 'pointer'
            }} 
            onClick={() => setActiveTab('advice')}
          >
            3. Conseils Experts & Échanges
          </button>
        </div>

        {/* TAB 1: CPN SUIVI PRÉNATAL */}
        {activeTab === 'cpn' && (
          <div className="row g-4 mb-4">
            
            {/* Main Left Column: CPN Timeline */}
            <div className="col-lg-8">
              <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div>
                    <h5 className="fw-bold text-white mb-1" style={{ fontSize: '1.2rem' }}>Calendrier des Consultations Prénatales</h5>
                    <small className="text-muted">Progression actuelle : <span className="text-success fw-bold">75% complété</span></small>
                  </div>
                  <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid #10b981', borderRadius: '20px', padding: '0.35rem 0.85rem', fontSize: '0.78rem', fontWeight: '700' }}>
                    ✔ À jour
                  </span>
                </div>

                {/* Timeline Items */}
                <div className="d-flex flex-column gap-3">
                  {cpnVisits.map((item) => (
                    <div key={item.id} className="p-3.5 rounded-4 d-flex align-items-start gap-3" style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: item.completed ? '#10b981' : '#334155', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', flexShrink: 0 }}>
                        {item.completed ? '✓' : '⌛'}
                      </div>

                      <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700' }}>
                            {item.status}
                          </span>
                          <span style={{ background: '#1e293b', color: '#94a3b8', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '600' }}>
                            📅 {item.date}
                          </span>
                        </div>
                        <h6 className="fw-bold text-white mb-1" style={{ fontSize: '0.98rem' }}>{item.title}</h6>
                        <p className="text-white-50 small mb-1" style={{ lineHeight: '1.5' }}>{item.desc}</p>
                        <small className="text-success fw-semibold" style={{ fontSize: '0.75rem' }}>👩‍⚕️ {item.doctor}</small>
                      </div>

                      {!item.completed && (
                        <button 
                          type="button"
                          style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}
                          onClick={() => {
                            setSelectedCpnForBooking(item);
                            setShowBookingModal(true);
                          }}
                        >
                          Réserver CPN
                        </button>
                      )}
                    </div>
                  ))}
                </div>

              </div>
            </div>

            {/* Right Sidebar Column */}
            <div className="col-lg-4">
              <div className="d-flex flex-column gap-4">
                
                {/* Card Constantes Vitales */}
                <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <div className="d-flex align-items-center gap-2 mb-3 text-success">
                    <span style={{ fontSize: '1.2rem' }}>📈</span>
                    <h6 className="fw-bold text-white mb-0" style={{ fontSize: '1rem' }}>Constantes Vitales</h6>
                  </div>

                  <div className="row text-center g-2">
                    <div className="col-6">
                      <div className="p-3 rounded-3" style={{ background: '#0f172a' }}>
                        <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Poids</small>
                        <h4 className="fw-bold text-white mb-0">64.5 kg</h4>
                        <small className="text-success" style={{ fontSize: '0.68rem' }}>+2.1kg / mois</small>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="p-3 rounded-3" style={{ background: '#0f172a' }}>
                        <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Tension Art.</small>
                        <h4 className="fw-bold text-white mb-0">12/8</h4>
                        <small className="text-success" style={{ fontSize: '0.68rem' }}>Normal</small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Vos Avantages CMU */}
                <div className="p-4 rounded-4 text-white" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)' }}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-extrabold mb-0" style={{ fontSize: '1.1rem' }}>Vos Avantages CMU</h6>
                    <span style={{ fontSize: '1.5rem' }}>🇸🇳</span>
                  </div>

                  <p className="small mb-3" style={{ opacity: 0.95, lineHeight: '1.5' }}>
                    Dans le cadre du programme UNAMUSC, vos frais de maternité sont couverts à 100%.
                  </p>

                  <div className="d-flex flex-column gap-2 mb-4 small fw-semibold">
                    <div className="d-flex align-items-center gap-2">
                      <span>✓</span> <span><strong>Zéro Dépense :</strong> Consultations & examens biologiques.</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span>✓</span> <span><strong>Accouchement :</strong> Gratuité totale en structure publique.</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span>✓</span> <span><strong>Pédiatrie :</strong> Soins offerts jusqu'à 5 ans.</span>
                    </div>
                  </div>

                  <button 
                    type="button"
                    style={{ background: '#ffffff', color: '#047857', border: 'none', borderRadius: '12px', padding: '0.65rem 1rem', fontWeight: '800', width: '100%', fontSize: '0.85rem', cursor: 'pointer' }}
                    onClick={() => alert("Prise en charge UNAMUSC : consultations CPN 1-4+, échographies, accouchement simple et césarienne d'urgence pris en charge à 100% sans avance de frais.")}
                  >
                    En savoir plus sur mes droits
                  </button>
                </div>

                {/* Card Sage-femme de garde */}
                <div className="p-3.5 rounded-4 d-flex align-items-center justify-content-between" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <div className="d-flex align-items-center gap-3">
                    <img src="https://images.unsplash.com/photo-1594824813566-88855ce75907?w=120" alt="Dr. Fatou Diome" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                    <div>
                      <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Sage-femme de garde</small>
                      <strong className="text-white small d-block">Dr. Fatou Diome</strong>
                    </div>
                  </div>

                  <button 
                    type="button"
                    style={{ background: '#0f172a', color: '#34d399', border: '1px solid #10b981', borderRadius: '10px', padding: '0.45rem 0.85rem', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }}
                    onClick={() => setShowAskMidwifeModal(true)}
                  >
                    Poser une question
                  </button>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* TAB 2: CROISSANCE & VACCINS PEV */}
        {activeTab === 'pev' && (
          <div className="row g-4 mb-4">
            <div className="col-12">
              <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: '1.3rem' }}>💉</span>
                    <h5 className="fw-bold text-white mb-0" style={{ fontSize: '1.2rem' }}>Programme Élargi de Vaccination (PEV Sénégal 0-12 mois)</h5>
                  </div>
                  <span style={{ background: '#10b981', color: '#ffffff', padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700' }}>
                    Enfant : Moussa Ndiaye (Né le 14/05/2026)
                  </span>
                </div>

                <div className="table-responsive">
                  <table className="table table-dark table-hover align-middle mb-0" style={{ background: 'transparent' }}>
                    <thead>
                      <tr className="text-muted small border-bottom border-secondary border-opacity-25" style={{ fontSize: '0.78rem' }}>
                        <th scope="col">ÉCHÉANCE / ÂGE</th>
                        <th scope="col">VACCINS OBLIGATOIRES</th>
                        <th scope="col">MALADIES PROTEGÉES</th>
                        <th scope="col">STRUCTURE</th>
                        <th scope="col" className="text-end">STATUT PEV</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-bottom border-secondary border-opacity-10">
                        <td className="fw-bold text-white py-3">Naissance</td>
                        <td className="text-success fw-bold">BCG + VPO 0 + VHB 0</td>
                        <td className="text-white-50 small">Tuberculose, Polio, Hépatite B</td>
                        <td className="text-white-50 small">Centre Gaspard Camara</td>
                        <td className="text-end"><span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '0.3rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>✅ Administré</span></td>
                      </tr>
                      <tr className="border-bottom border-secondary border-opacity-10">
                        <td className="fw-bold text-white py-3">6 Semaines</td>
                        <td className="text-success fw-bold">Penta 1 + VPO 1 + Rota 1 + Pneumo 1</td>
                        <td className="text-white-50 small">Diphtérie, Tétanos, Coqueluche...</td>
                        <td className="text-white-50 small">Dispensaire Point E</td>
                        <td className="text-end"><span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '0.3rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>✅ Administré</span></td>
                      </tr>
                      <tr className="border-bottom border-secondary border-opacity-10">
                        <td className="fw-bold text-white py-3">10 Semaines</td>
                        <td className="text-warning fw-bold">Penta 2 + VPO 2 + Rota 2 + Pneumo 2</td>
                        <td className="text-white-50 small">Rappel des Immunisations</td>
                        <td className="text-white-50 small">Centre de Santé Pikine</td>
                        <td className="text-end"><span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '0.3rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>⏳ À venir (Juillet)</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CONSEILS EXPERTS & Q&A */}
        {activeTab === 'advice' && (
          <div className="row g-4 mb-4">
            <div className="col-lg-8">
              <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <h5 className="fw-bold text-white mb-3">💬 Questions posées à la Sage-femme</h5>
                
                <div className="d-flex flex-column gap-3 mb-4">
                  {midwifeAnswers.map((item, idx) => (
                    <div key={idx} className="p-3.5 rounded-3" style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <strong className="d-block text-warning mb-1" style={{ fontSize: '0.9rem' }}>Q: {item.q}</strong>
                      <p className="text-white-50 small mb-2" style={{ lineHeight: '1.5' }}>{item.a}</p>
                      <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>{item.doctor} • {item.date}</small>
                    </div>
                  ))}
                </div>

                <button 
                  type="button"
                  style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.65rem 1.25rem', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
                  onClick={() => setShowAskMidwifeModal(true)}
                >
                  ➕ Poser une nouvelle question
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* GUARANTEE LETTER MODAL */}
      {showGuaranteeModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content text-white p-4" style={{ borderRadius: '24px', background: '#1e293b' }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold text-success mb-0">📜 Lettre de Garantie Hospitalière (100% UNAMUSC 🇸🇳)</h5>
                <button className="btn-close btn-close-white" onClick={() => setShowGuaranteeModal(false)}></button>
              </div>

              <div className="p-4 rounded-3 bg-dark mb-3 border border-success">
                <div className="d-flex justify-content-between mb-3 border-bottom border-secondary pb-2">
                  <div>
                    <strong className="text-white d-block">Union Nationale des Mutuelles de Santé (UNAMUSC)</strong>
                    <small className="text-success fw-bold">Prise en charge 100% Maternité & Accouchement</small>
                  </div>
                  <div className="text-end">
                    <small className="text-muted d-block">Date d'émission: {new Date().toLocaleDateString('fr-FR')}</small>
                    <small className="text-warning fw-bold">N° GAR-MAT-2026-9910</small>
                  </div>
                </div>

                <p className="small text-white-50 mb-2">
                  <strong>Assurée :</strong> Awa Ndiaye (CMU-DKR-2026-8812)
                </p>
                <p className="small text-white-50 mb-2">
                  <strong>Établissement récepteur :</strong> Centre Hospitalier Universitaire de Fann (Dakar)
                </p>
                <p className="small text-white-50 mb-0">
                  <strong>Garantie accordée :</strong> Couverture intégrale (100%) des frais d'accouchement simple, césarienne d'urgence et soins néonataux sans aucune avance de frais.
                </p>
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button type="button" style={{ background: '#0f172a', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.5rem 1rem' }} onClick={() => setShowGuaranteeModal(false)}>Fermer</button>
                <button type="button" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1.25rem', fontWeight: '700', cursor: 'pointer' }} onClick={handleDownloadGuarantee}>📥 Télécharger la Lettre PDF Certifiée (🇸🇳)</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ASK MIDWIFE MODAL */}
      {showAskMidwifeModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <form onSubmit={handleSendQuestion} className="modal-content text-white p-4" style={{ borderRadius: '24px', background: '#1e293b' }}>
              <h5 className="fw-bold text-success mb-3">💬 Poser une question à la Sage-femme de garde</h5>
              
              <div className="mb-3">
                <label className="form-label small fw-bold text-white-50">Votre question ou symptôme *</label>
                <textarea 
                  className="form-control text-white border-0" 
                  style={{ background: '#0f172a', borderRadius: '12px' }} 
                  rows={4} 
                  value={midwifeQuestion} 
                  onChange={(e) => setMidwifeQuestion(e.target.value)}
                  placeholder="Décrivez votre question concernant la grossesse, le bébé ou la nutrition..."
                  required
                />
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button type="button" style={{ background: '#0f172a', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.5rem 1rem' }} onClick={() => setShowAskMidwifeModal(false)}>Annuler</button>
                <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1.25rem', fontWeight: '700' }}>Envoyer la question</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BOOKING CPN MODAL */}
      {showBookingModal && selectedCpnForBooking && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content text-white p-4" style={{ borderRadius: '24px', background: '#1e293b' }}>
              <h5 className="fw-bold text-success mb-2">📅 Réserver {selectedCpnForBooking.title}</h5>
              <p className="text-white-50 small mb-3">Sélectionnez la structure de santé agréée pour la consultation prénatale.</p>
              
              <div className="mb-3">
                <label className="form-label small fw-bold text-white-50">Structure de santé *</label>
                <select className="form-select text-white border-0" style={{ background: '#0f172a', borderRadius: '10px' }}>
                  <option value="1">Centre de Santé Gaspard Camara (Dakar)</option>
                  <option value="2">Centre de Santé de Pikine</option>
                  <option value="3">Hôpital Universitaire Fann</option>
                </select>
              </div>

              <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" style={{ background: '#0f172a', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.5rem 1rem' }} onClick={() => setShowBookingModal(false)}>Annuler</button>
                <button type="button" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1.25rem', fontWeight: '700' }} onClick={() => handleConfirmBooking(selectedCpnForBooking.id)}>Confirmer la réservation (0 FCFA)</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
