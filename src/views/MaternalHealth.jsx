import React, { useState } from 'react';

// Design Premium Haut de Gamme (Dark Emerald Maternal & Child Health Platform)
export default function MaternalHealth({ lang = 'fr', citizenUser = null }) {
  const [activeTab, setActiveTab] = useState('cpn'); // 'cpn', 'pev', 'advice'
  
  // CPN Timeline Data
  const cpnVisits = [
    {
      id: 1,
      title: 'Première visite (Semaine 12)',
      desc: 'Bilan biologique complet, Échographie de datation. Réalisé le 12 Jan 2024 au Centre de Santé de Pikine.',
      date: '12 Jan 2024',
      status: 'CPN 1 - CONFIRMÉE',
      completed: true
    },
    {
      id: 2,
      title: 'Deuxième visite (Semaine 24)',
      desc: 'Supplémentation en Fer/Acide Folique, TPI-1. Réalisé le 15 Mars 2024.',
      date: '15 Mar 2024',
      status: 'CPN 2 - CONFIRMÉE',
      completed: true
    },
    {
      id: 3,
      title: 'Troisième visite (Semaine 32)',
      desc: 'Évaluation du risque obstétrical, VAT 2. Rendez-vous suggéré mi-mai.',
      date: 'À venir',
      status: 'CPN 3 - À VENIR',
      completed: false
    }
  ];

  // PEV Vaccines Data
  const pevVaccines = [
    { age: 'À la naissance', vaccines: 'BCG, VPO-0, Hépatite B', disease: 'Tuberculose, Polio, Hépatite', status: 'Gratuit 100%' },
    { age: '6 Semaines', vaccines: 'Penta 1, VPO-1, Rota 1, PCV 13-1', disease: 'Diphtérie, Tétanos, Coqueluche...', status: 'Gratuit 100%' },
    { age: '10 Semaines', vaccines: 'Penta 2, VPO-2, Rota 2, PCV 13-2', disease: 'Rappel des Immunisations', status: 'Gratuit 100%' }
  ];

  return (
    <div className="maternity-view fade-in-up" style={{ minHeight: '100vh', background: '#0b1120', color: '#f8fafc', paddingBottom: '3rem' }}>
      
      {/* Subnav Header Bar */}
      <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)', padding: '0.75rem 2rem' }}>
        <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h5 className="fw-bold mb-0 text-white" style={{ fontSize: '1.1rem' }}>UNAMUSC Portail</h5>
            <span style={{ height: '14px', width: '1px', background: 'rgba(255, 255, 255, 0.2)' }} />
            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '600', padding: '0.25rem 0.65rem' }}>
              Awa Ndiaye • Mère éligible CSU
            </span>
          </div>

          <div className="input-group input-group-sm" style={{ width: '240px' }}>
            <input type="text" className="form-control bg-dark text-white border-secondary small" placeholder="Rechercher..." style={{ borderRadius: '10px 0 0 10px', fontSize: '0.8rem' }} />
            <button className="btn btn-outline-secondary" type="button" style={{ borderRadius: '0 10px 10px 0' }}>🔍</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1320px', margin: '1.75rem auto 0 auto', padding: '0 1.5rem' }}>
        
        {/* Top Hero Banner Card with Background Image */}
        <div 
          className="p-4 rounded-4 mb-4" 
          style={{ 
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(16, 185, 129, 0.25) 100%), url("https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=1200") center/cover no-repeat', 
            border: '1px solid rgba(16, 185, 129, 0.3)', 
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)' 
          }}
        >
          <div className="row align-items-center g-4">
            <div className="col-lg-8">
              <span className="badge bg-success text-white px-3 py-1.5 rounded-pill mb-2 fw-semibold" style={{ fontSize: '0.75rem' }}>● ESPACE PREMIUM SANTÉ</span>
              <h1 className="fw-extrabold text-white mb-2" style={{ fontSize: '2.2rem', letterSpacing: '-0.02em' }}>Carnet de santé maternelle & suivi de l'enfant</h1>
              <p className="text-white-50 mb-4" style={{ fontSize: '0.98rem', maxWidth: '650px', lineHeight: '1.5' }}>
                Accédez en toute sécurité au suivi prénatal et au calendrier vaccinal PEV de votre enfant. Bénéficiez des garanties de prise en charge 100% CMU.
              </p>

              <div className="d-flex gap-3 flex-wrap">
                <button className="btn btn-success px-4 py-2.5 fw-bold text-white shadow-lg d-flex align-items-center gap-2" style={{ background: '#10b981', borderRadius: '12px', border: 'none' }} onClick={() => alert("Génération de la lettre de garantie accouchement 100%...")}>
                  <span>📜 Générer lettre de garantie (100% UNAMUSC)</span>
                </button>
                <button className="btn btn-dark px-4 py-2.5 fw-bold text-white shadow-sm" style={{ borderRadius: '12px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }} onClick={() => alert("Téléchargement du Carnet Maternité A4...")}>
                  📥 Télécharger Carnet A4
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation Pills */}
        <div className="p-1.5 rounded-3 d-inline-flex gap-2 mb-4" style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
          <button className={`btn btn-sm fw-bold px-3.5 py-2 rounded-3 ${activeTab === 'cpn' ? 'btn-success text-white' : 'text-white-50'}`} style={{ fontSize: '0.85rem' }} onClick={() => setActiveTab('cpn')}>
            1. Suivi Prénatal (CPN 1-4+)
          </button>
          <button className={`btn btn-sm fw-bold px-3.5 py-2 rounded-3 ${activeTab === 'pev' ? 'btn-success text-white' : 'text-white-50'}`} style={{ fontSize: '0.85rem' }} onClick={() => setActiveTab('pev')}>
            2. Croissance & Vaccins (0-12 mois)
          </button>
          <button className={`btn btn-sm fw-bold px-3.5 py-2 rounded-3 ${activeTab === 'advice' ? 'btn-success text-white' : 'text-white-50'}`} style={{ fontSize: '0.85rem' }} onClick={() => setActiveTab('advice')}>
            3. Conseils Experts
          </button>
        </div>

        {/* Main Content Grid (CPN Timeline + Right Sidebar) */}
        <div className="row g-4 mb-4">
          
          {/* Main Left Column: CPN Timeline */}
          <div className="col-lg-8">
            <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
              
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                  <h5 className="fw-bold text-white mb-1" style={{ fontSize: '1.2rem' }}>Calendrier des Consultations Prénatales</h5>
                  <small className="text-muted">Progression actuelle : <span className="text-success fw-bold">75% complété</span></small>
                </div>
                <span className="badge bg-success-subtle text-success px-3 py-1.5 rounded-pill fw-semibold" style={{ fontSize: '0.75rem' }}>✔ À jour</span>
              </div>

              {/* Timeline Items */}
              <div className="d-flex flex-column gap-3">
                {cpnVisits.map((item) => (
                  <div key={item.id} className="p-3.5 rounded-4 d-flex align-items-start gap-3" style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className={`p-2.5 rounded-circle ${item.completed ? 'bg-success text-white' : 'bg-dark text-muted border border-secondary'}`} style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.completed ? '✓' : '⌛'}
                    </div>

                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="badge bg-dark text-success border border-success" style={{ fontSize: '0.7rem' }}>{item.status}</span>
                        <span className="badge bg-dark text-muted" style={{ fontSize: '0.7rem' }}>{item.date}</span>
                      </div>
                      <h6 className="fw-bold text-white mb-1" style={{ fontSize: '0.98rem' }}>{item.title}</h6>
                      <p className="text-white-50 small mb-0" style={{ lineHeight: '1.5' }}>{item.desc}</p>
                    </div>

                    {!item.completed && (
                      <button className="btn btn-sm btn-success fw-bold text-white align-self-center px-3" style={{ borderRadius: '10px' }} onClick={() => alert(`Réservation CPN #${item.id}`)}>
                        Réserver
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

              {/* Card Vos Avantages CMU (Vibrant Green) */}
              <div className="p-4 rounded-4 text-white" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)' }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-extrabold mb-0" style={{ fontSize: '1.1rem' }}>Vos Avantages CMU</h6>
                  <span style={{ fontSize: '1.5rem' }}>✳️</span>
                </div>

                <p className="small mb-3" style={{ opacity: 0.9, lineHeight: '1.5' }}>
                  Dans le cadre du programme UNAMUSC, vos frais sont couverts à 100%.
                </p>

                <div className="d-flex flex-column gap-2 mb-4 small fw-semibold">
                  <div className="d-flex align-items-center gap-2">
                    <span>✓</span> <span><strong>Zéro Dépense :</strong> Consultations et examens biologiques.</span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span>✓</span> <span><strong>Accouchement :</strong> Gratuité totale en structure publique.</span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span>✓</span> <span><strong>Pédiatrie :</strong> Soins offerts jusqu'à 5 ans.</span>
                  </div>
                </div>

                <button className="btn btn-light w-100 fw-bold py-2.5 text-success" style={{ borderRadius: '12px', fontSize: '0.85rem' }} onClick={() => alert("Détails des droits CMU Maternité...")}>
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

                <button className="btn btn-outline-success btn-sm fw-bold" style={{ borderRadius: '10px' }} onClick={() => alert("Question envoyée à la sage-femme...")}>
                  Poser une question
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* Bottom Section: Calendrier de Vaccination PEV */}
        <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
          <div className="d-flex align-items-center gap-2 mb-3">
            <span style={{ fontSize: '1.2rem' }}>💉</span>
            <h5 className="fw-bold text-white mb-0" style={{ fontSize: '1.15rem' }}>Calendrier de Vaccination (PEV)</h5>
          </div>
          <small className="text-muted d-block mb-3">Suivi pour votre prochain enfant à naître</small>

          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0" style={{ background: 'transparent' }}>
              <thead>
                <tr className="text-muted small border-bottom border-secondary border-opacity-25" style={{ fontSize: '0.78rem' }}>
                  <th scope="col">ÂGE DE L'ENFANT</th>
                  <th scope="col">VACCINS REQUIS</th>
                  <th scope="col">MALADIES CIBLES</th>
                  <th scope="col" className="text-end">STATUT CMU</th>
                </tr>
              </thead>
              <tbody>
                {pevVaccines.map((v, idx) => (
                  <tr key={idx} className="border-bottom border-secondary border-opacity-10">
                    <td className="fw-bold text-white py-3" style={{ fontSize: '0.88rem' }}>{v.age}</td>
                    <td className="text-white-50 small">{v.vaccines}</td>
                    <td className="text-white-50 small">{v.disease}</td>
                    <td className="text-end">
                      <span className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1" style={{ borderRadius: '12px', fontSize: '0.72rem' }}>
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
