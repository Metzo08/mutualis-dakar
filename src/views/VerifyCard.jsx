import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { generateOfficialPdf } from '../utils/pdfGenerator';
import { getBeneficiaryInfo, getAdherentCode, getBeneficiaryCode } from '../utils/csuFormatter';

// Vue publique et médicale de vérification d'une carte CSU.
// Accessible via #/verify ou #/verify/:cmuNumber — utilisée par les structures de soins,
// médecins, pharmaciens et agents pour vérifier instantanément une carte scannée
// et exécuter les actions médicales directes (Garantie, Ordonnance, Télémédecine, Radios, Antécédents).
export default function VerifyCard({ lang = 'fr', setView = null, citizenUser = null }) {
  const [cmuNumber, setCmuNumber] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdModal, setShowAdModal] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);

  // Modales d'actions rapides médicales depuis le QR Code
  const [activeModal, setActiveModal] = useState(null); // 'guarantee' | 'order' | 'imaging' | 'antecedents' | 'telemedicine'
  const [actionSuccess, setActionSuccess] = useState('');

  // Formulaire Garantie Rapide
  const [guaranteeAct, setGuaranteeAct] = useState('Hospitalisation / intervention chirurgicale');
  const [guaranteeAmount, setGuaranteeAmount] = useState('200000');
  const [guaranteeHospital, setGuaranteeHospital] = useState('Hôpital Universitaire de Fann (Dakar)');

  // Formulaire Bon Pharmacie Rapide
  const [medName, setMedName] = useState('Amoxicilline 500mg (Sirop pédiatrique)');
  const [medQty, setMedQty] = useState(2);
  const [medPrice, setMedPrice] = useState(3500);

  // Formulaire Radio / Analyse Rapide
  const [examTitle, setExamTitle] = useState('Scanner thoracique HD');
  const [examType, setExamType] = useState('Scanner');
  const [examNotes, setExamNotes] = useState('Bilan satisfaisant. Pas de lésion évolutive.');

  // Formulaire Antécédents Rapide
  const [bloodGroup, setBloodGroup] = useState('O Rhésus positif (O+)');
  const [allergies, setAllergies] = useState('Pénicilline, Aspirine');
  const [chronicCond, setChronicCond] = useState('Hypertension artérielle (HTA)');

  // Extrait le numéro CMU/CSU du hash URL (#/verify/SN-DK-MED-8472 ou #/verify/CMU-DKR-2026-8812)
  useEffect(() => {
    let rawHash = window.location.hash.replace(/^#\/?verify\/?/i, '').replace(/^#\/?/, '').trim();
    if (!rawHash || rawHash.includes('/') || rawHash.includes('PAYMENTS') || rawHash.includes('VERIFY') || rawHash.length < 3) {
      rawHash = 'CMU-DKR-2026-8812';
    }
    const decoded = decodeURIComponent(rawHash);
    setCmuNumber(decoded);
    verify(decoded);
  }, []);

  // Base de données de démonstration / secours pour accès hors-ligne et mobile
  const demoCards = {
    'SN-DK-MED-8472': {
      valid: true,
      status: 'active',
      firstName: 'Amadou',
      lastName: 'Sow',
      birthDate: '1988-04-12',
      phone: '+221 77 450 12 34',
      mutuelleName: 'Mutuelle de santé de Dakar-Plateau',
      packageType: 'Formule familiale intégrale UNAMUSC (80% à 100%)',
      cmuNumber: 'SN-DK-MED-8472',
      ippNumber: 'IPP-FANN-2026-8472',
      photoUrl: '/csu_profile_hero_real.png',
      bloodGroup: 'O Rhésus positif (O+)',
      allergies: 'Pénicilline, Aspirine',
      chronicConditions: 'Hypertension artérielle (HTA)',
      familyMembers: [
        { name: 'Fatou Sow', relation: 'Épouse', age: 32 },
        { name: 'Moussa Sow', relation: 'Enfant', age: 6 }
      ],
      checkedAt: new Date().toISOString()
    },
    'CMU-DKR-2026-8812': {
      valid: true,
      status: 'active',
      firstName: 'Awa',
      lastName: 'Ndiaye',
      birthDate: '1990-08-25',
      phone: '+221 78 123 45 67',
      mutuelleName: 'Union départementale des mutuelles de Dakar',
      packageType: 'Tiers-Payant Hospitalier UNAMUSC (80%)',
      cmuNumber: 'CMU-DKR-2026-8812',
      ippNumber: 'IPP-DANTEC-2026-8812',
      photoUrl: '/csu_bsf_real.png',
      bloodGroup: 'O Rhésus positif (O+)',
      allergies: 'Aucune connue',
      chronicConditions: 'Aucune',
      familyMembers: [
        { name: 'Amadou Sow', relation: 'Conjoint', age: 34 },
        { name: 'Fatou Sow', relation: 'Enfant', age: 6 }
      ],
      checkedAt: new Date().toISOString()
    },
    'CMU-PATIENT-SEN-884920': {
      valid: true,
      status: 'active',
      firstName: 'Aminata',
      lastName: 'Diallo',
      birthDate: '1995-11-03',
      phone: '+221 76 987 65 43',
      mutuelleName: 'Mutuelle de santé communautaire UNAMUSC Dakar',
      packageType: 'Formule étudiante & téléconsultation WebRTC',
      cmuNumber: 'CMU-PATIENT-SEN-884920',
      ippNumber: 'IPP-DKR-2026-8849',
      photoUrl: '/dr_fatou_diop.png',
      bloodGroup: 'A Rhésus positif (A+)',
      allergies: 'Aspirine',
      chronicConditions: 'Aucune',
      familyMembers: [],
      checkedAt: new Date().toISOString()
    }
  };

  const verify = async (num) => {
    let target = (num || cmuNumber || '').trim();
    if (!target || target.includes('/') || target.includes('PAYMENTS') || target.includes('VERIFY')) {
      target = 'CMU-DKR-2026-8812';
    }

    setLoading(true);
    setError('');

    // 1. Tenter de parser le payload s'il s'agit d'un QR code JSON
    if (target.startsWith('{') && target.endsWith('}')) {
      try {
        const parsed = JSON.parse(target);
        if (parsed.patient || parsed.cmu) {
          setResult({
            valid: true,
            status: 'active',
            firstName: parsed.patient ? parsed.patient.split(' ')[0] : 'Amadou',
            lastName: parsed.patient ? parsed.patient.split(' ').slice(1).join(' ') : 'Sow',
            phone: '+221 77 450 12 34',
            mutuelleName: 'UDMS Dakar — UNAMUSC',
            packageType: 'Tiers-Payant & Télémédecine WebRTC (80%)',
            cmuNumber: parsed.cmu || 'CMU-DKR-2026-8812',
            ippNumber: parsed.ipp || 'IPP-FANN-2026-9921',
            photoUrl: '/csu_profile_hero_real.png',
            bloodGroup: parsed.blood || 'O Rhésus positif (O+)',
            allergies: 'Pénicilline',
            chronicConditions: 'Hypertension artérielle',
            familyMembers: [{ name: 'Ayants droit rattachés', relation: 'Famille', age: 30 }],
            checkedAt: new Date().toISOString()
          });
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Erreur parse JSON QR Code:', e);
      }
    }

    // 2. Tenter l'API serveur avec un chemin relatif
    try {
      const res = await fetch(`/api/cmu-card/${encodeURIComponent(target)}`);
      if (res.ok) {
        const data = await res.json();
        setResult({
          ...data,
          ippNumber: data.ippNumber || `IPP-${target.slice(-4)}-2026`,
          bloodGroup: data.bloodGroup || 'O Rhésus positif (O+)'
        });
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn('API serveur inaccessible, bascule sur le vérificateur local:', err);
    }

    // 3. Fallback de démonstration et recherche locale
    const upperTarget = target.toUpperCase();
    const matchedKey = Object.keys(demoCards).find(k => 
      k.toUpperCase() === upperTarget || 
      k.toUpperCase().includes(upperTarget) || 
      upperTarget.includes(k.toUpperCase())
    );

    const isGlobalSuspended = (localStorage.getItem('cmu-portal-mode') === 'citizen_suspended' || localStorage.getItem('cmu-cotisation-suspended') === 'true');
    
    if (matchedKey) {
      const cardData = demoCards[matchedKey];
      const storedOverride = localStorage.getItem(`cmu-status-${matchedKey}`);
      const finalStatus = isGlobalSuspended ? 'suspended' : (storedOverride || 'active');
      const finalValid = (finalStatus === 'active');
      setResult({
        ...cardData,
        status: finalStatus,
        valid: finalValid
      });
    } else if (target.length >= 3) {
      const cleanTarget = target.toUpperCase();
      const storedOverride = localStorage.getItem(`cmu-status-${cleanTarget}`);
      const finalStatus = isGlobalSuspended ? 'suspended' : (storedOverride || 'active');
      const finalValid = (finalStatus === 'active');
      setResult({
        valid: finalValid,
        status: finalStatus,
        firstName: citizenUser?.firstName || 'Assuré',
        lastName: citizenUser?.lastName || 'CSU',
        phone: citizenUser?.phone || '+221 77 450 12 34',
        mutuelleName: 'Union Départementale des Mutuelles de Santé de Dakar (UDMS)',
        packageType: 'Formule Tiers-Payant UNAMUSC (80%)',
        cmuNumber: cleanTarget,
        ippNumber: `IPP-DKR-${cleanTarget.slice(-4)}`,
        photoUrl: '/csu_profile_hero_real.png',
        bloodGroup: 'O Rhésus positif (O+)',
        allergies: 'Aucune connue',
        chronicConditions: 'Aucune',
        familyMembers: [
          { name: 'Ayants droit rattachés', relation: 'Famille', age: 30 }
        ],
        checkedAt: new Date().toISOString()
      });
      setShowAdModal(true);
    } else {
      setError('Numéro de carte non reconnu. Veuillez vérifier la saisie.');
    }

    setLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    verify();
  };

  // Exécution d'actions médicales directes depuis le QR Code
  const handleCreateGuarantee = (e) => {
    e.preventDefault();
    setActionSuccess(`Lettre de garantie de ${Number(guaranteeAmount).toLocaleString()} FCFA émise avec succès pour ${result.firstName} ${result.lastName} (${guaranteeHospital}). Code validation : GAR-2026-${Math.floor(1000 + Math.random() * 9000)}.`);
    setActiveModal(null);
  };

  const handleCreateOrder = (e) => {
    e.preventDefault();
    const newOrd = {
      id: Date.now(),
      first_name: result.firstName,
      last_name: result.lastName,
      cmu_number: result.cmuNumber,
      items_json: JSON.stringify([{ name: medName, qty: parseInt(medQty), price: parseFloat(medPrice) }]),
      total_amount: medQty * medPrice,
      status: 'active',
      created_at: new Date().toISOString()
    };
    const existing = JSON.parse(localStorage.getItem('cmu_purchase_orders') || '[]');
    localStorage.setItem('cmu_purchase_orders', JSON.stringify([newOrd, ...existing]));

    setActionSuccess(`Bon de commande pharmacie (48h) généré avec succès pour ${medName} (x${medQty}) ! Il est immédiatement actif sous le Tiers-Payant UNAMUSC.`);
    setActiveModal(null);
  };

  const handleAddImaging = (e) => {
    e.preventDefault();
    setActionSuccess(`Nouvel examen d'imagerie "${examTitle}" (${examType}) ajouté et lié au Dossier Médical Partagé de ${result.firstName} ${result.lastName}.`);
    setActiveModal(null);
  };

  const handleUpdateAntecedents = (e) => {
    e.preventDefault();
    setResult({
      ...result,
      bloodGroup,
      allergies,
      chronicConditions: chronicCond
    });
    setActionSuccess(`Antécédents médicaux mis à jour : Groupe sanguin ${bloodGroup}, Allergies: ${allergies}.`);
    setActiveModal(null);
  };

  const handlePrintCertificate = () => {
    if (!result) return;
    generateOfficialPdf({
      filename: `certificat_csu_${result.cmuNumber}.pdf`,
      docType: 'CERTIFICAT OFFICIEL DE DROITS & DE TIERS-PAYANT CSU',
      title: 'Attestation d\'ouverture de droits & de couverture médicale',
      referenceNo: `VERIF-${Date.now().toString().slice(-6)}`,
      beneficiaryName: `${result.firstName} ${result.lastName}`,
      cmuNumber: result.cmuNumber,
      structureName: result.mutuelleName,
      details: [
        { label: 'Statut de couverture', value: result.valid ? 'ACTIF & VALIDE (Tiers-payant 80-100%)' : 'INACTIF' },
        { label: 'Formule souscrite', value: result.packageType },
        { label: 'Identifiant Patient (IPP)', value: result.ippNumber },
        { label: 'Téléphone assuré', value: result.phone },
        { label: 'Groupe sanguin & allergies', value: `${result.bloodGroup} (Allergies: ${result.allergies || 'Aucune'})` },
        { label: 'Ayants droit rattachés', value: result.familyMembers && result.familyMembers.length > 0 ? result.familyMembers.map(f => `${f.name} (${f.relation})`).join(', ') : 'Aucun' }
      ],
      notes: 'Ce certificat atteste de la validité des droits à la date de vérification. Il permet la dispense d\'avance de frais auprès de toutes les structures conventionnées UNAMUSC.'
    });
  };

  return (
    <div className="verify-view fade-in-up container py-3 py-md-4" style={{ maxWidth: '860px', margin: '0 auto' }}>
      
      {/* Banner signature moderne */}
      <section className="banner-mini text-white mb-4 rounded-4 overflow-hidden position-relative text-center" style={{
        background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.45) 0%, rgba(16, 185, 129, 0.22) 100%), url("/csu_verify_hero.png") center/cover no-repeat',
        padding: '2.5rem 1.5rem',
        borderRadius: '24px',
        boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.3)'
      }}>
        <div className="d-flex flex-column align-items-center justify-content-center text-center mx-auto" style={{ zIndex: 2, maxWidth: '750px' }}>
          <span className="badge px-3 py-1.5 mb-2 fw-semibold d-inline-block" style={{
            background: 'rgba(255, 255, 255, 0.22)',
            color: '#ffffff',
            backdropFilter: 'blur(4px)',
            borderRadius: '20px',
            fontSize: '0.78rem',
            border: '1px solid rgba(255, 255, 255, 0.3)'
          }}>
            🔍 UNAMUSC — Contrôle de validité & hub médical instantané
          </span>
          <h1 style={{ color: '#fff', fontSize: '1.6rem', fontWeight: '850', marginBottom: '0.4rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            Vérification de la carte CSU
          </h1>
          <p style={{ color: '#f8fafc', fontSize: '0.88rem', fontWeight: '500', maxWidth: '650px', margin: '0 auto', opacity: 0.95 }}>
            Contrôlez instantanément la validité et les droits de tiers-payant d'un assuré de la Couverture Santé Universelle.
          </p>
        </div>
      </section>

      {/* Message de succès d'action */}
      {actionSuccess && (
        <div className="alert alert-success d-flex align-items-center mb-4 rounded-4 border-0 shadow-sm p-3.5" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#047857', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <span className="fs-4 me-3">✅</span>
          <div style={{ fontSize: '0.9rem', fontWeight: '600', lineHeight: '1.5' }}>{actionSuccess}</div>
        </div>
      )}

      {/* Formulaire de recherche et vérification */}
      <div className="card shadow-sm border-0 p-3.5 p-md-4 mb-4" style={{ borderRadius: '22px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
        <form onSubmit={handleSubmit} className="d-flex gap-2 flex-column flex-sm-row">
          <input
            type="text"
            className="form-control input fw-bold"
            placeholder="Entrez ou scannez un N° CSU (ex: SN-DK-MED-8472)"
            value={cmuNumber}
            onChange={(e) => setCmuNumber(e.target.value)}
            style={{ flex: 1, height: '50px', borderRadius: '14px', fontSize: '0.95rem', background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
          />
          <button 
            type="submit" 
            className="btn text-white fw-bold px-4 shadow-sm d-flex align-items-center justify-content-center gap-2" 
            disabled={loading}
            style={{ height: '50px', borderRadius: '14px', background: '#10b981', borderColor: '#10b981', fontSize: '0.92rem' }}
          >
            {loading ? 'Vérification en cours...' : '🔍 Vérifier la carte'}
          </button>
        </form>

        {error && (
          <div className="alert alert-danger p-3 mt-3 mb-0 rounded-3 d-flex align-items-center">
            <span className="fs-5 me-2">⚠️</span>
            <div style={{ fontSize: '0.88rem' }}>{error}</div>
          </div>
        )}
      </div>

      {/* MODALE PUBLICITÉ VIDÉO & SPONSORS LORS DU SCAN DE CARTE */}
      {showAdModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(10px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }} className="fade-in">
          <div style={{
            maxWidth: '750px',
            width: '100%',
            backgroundColor: '#0f172a',
            border: '2px solid #059669',
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
            color: '#fff'
          }}>
            {/* Defilement sponsors */}
            <div style={{
              background: 'linear-gradient(90deg, #059669 0%, #1e40af 100%)',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontWeight: '700',
              fontSize: '0.9rem',
              gap: '1rem'
            }}>
              <div className="marquee-container" style={{ flex: 1 }}>
                <div className="marquee-content text-white">
                  <span className="d-inline-flex align-items-center gap-2">
                    <img src="/logo_wave.png" alt="Wave" style={{ height: '22px', borderRadius: '4px' }} />
                    ✨ Sponsorisé par PATISEN & Wave — RÉPUBLIQUE DU SÉNÉGAL 🇸🇳
                  </span>
                  <span className="d-inline-flex align-items-center gap-2">
                    🇸🇳 PROGRAMME NATIONAL DE LA COUVERTURE SANITAIRE UNIVERSELLE DU SÉNÉGAL (UNAMUSC)
                  </span>
                  <span className="d-inline-flex align-items-center gap-2">
                    <img src="/logo_wave.png" alt="Wave" style={{ height: '22px', borderRadius: '4px' }} />
                    ✨ Sponsorisé par PATISEN & Wave — RÉPUBLIQUE DU SÉNÉGAL 🇸🇳
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAdModal(false)}
                className="btn btn-light btn-sm fw-bold flex-shrink-0"
                style={{ borderRadius: '10px', fontSize: '0.8rem', padding: '0.25rem 0.75rem' }}
              >
                Passer la publicité ⏩
              </button>
            </div>

            {/* Video Player Embed */}
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
              <iframe 
                src="https://www.youtube.com/embed/FmJTCKKLQ_8?autoplay=1"
                title="Publicité CSU Senegal"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{
                  position: 'absolute',
                  top: 0, left: 0, width: '100%', height: '100%',
                  border: 0
                }}
              />
            </div>

            {/* Footer popup */}
            <div style={{ padding: '1.25rem', textAlign: 'center', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b' }}>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                💡 Présentation officielle des services de Couverture Santé Universelle
              </div>
              <button 
                type="button" 
                className="btn btn-primary fw-bold"
                onClick={() => setShowAdModal(false)}
                style={{ borderRadius: '12px', padding: '0.6rem 1.5rem' }}
              >
                ✅ Accéder à ma carte d'assuré
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AFFICHAGE DU PASS CARTE CSU NUMÉRIQUE DESIGN HAUTE DÉFINITION SUR MOBILE & DESKTOP */}
      {result && (
        <div className="fade-in-up">

          {/* BANDEAU DE DÉFILEMENT SPONSORS */}
          <div className="p-2.5 mb-3.5 rounded-4 shadow-sm d-flex align-items-center justify-content-between overflow-hidden" 
               style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.12) 0%, rgba(30,64,175,0.12) 100%)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: '16px', gap: '0.75rem' }}>
            <div className="marquee-container" style={{ flex: 1 }}>
              <div className="marquee-content">
                <span className="fw-bold d-inline-flex align-items-center gap-2" style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>
                  <img src="/logo_wave.png" alt="Wave" style={{ height: '22px', borderRadius: '3px' }} />
                  ✨ Sponsorisé par PATISEN & Wave — RÉPUBLIQUE DU SÉNÉGAL 🇸🇳
                </span>
                <span className="fw-bold d-inline-flex align-items-center gap-2" style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>
                  🇸🇳 PROGRAMME NATIONAL DE LA COUVERTURE SANITAIRE UNIVERSELLE DU SÉNÉGAL (UNAMUSC)
                </span>
                <span className="fw-bold d-inline-flex align-items-center gap-2" style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>
                  <img src="/logo_wave.png" alt="Wave" style={{ height: '22px', borderRadius: '3px' }} />
                  ✨ Sponsorisé par PATISEN & Wave — RÉPUBLIQUE DU SÉNÉGAL 🇸🇳
                </span>
              </div>
            </div>
            <button 
              type="button" 
              className="btn btn-outline-success btn-sm fw-bold py-1 px-2.5 flex-shrink-0"
              style={{ fontSize: '0.78rem', borderRadius: '8px' }}
              onClick={() => setShowAdModal(true)}
            >
              ▶️ Revoir la vidéo
            </button>
          </div>
          
          {/* CARTE NUMÉRIQUE CSU EXCLUSIVE MUTUALIS DAKAR */}
          <div 
            className="p-4 rounded-4 text-white shadow-lg position-relative overflow-hidden mb-4 cursor-pointer"
            style={{
              background: (result.valid && result.status !== 'suspended' && result.status !== 'suspendu')
                ? 'linear-gradient(135deg, #059669 0%, #047857 50%, #064e3b 100%)' 
                : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #7f1d1d 100%)',
              boxShadow: (result.valid && result.status !== 'suspended' && result.status !== 'suspendu') ? '0 20px 45px -10px rgba(5, 150, 105, 0.45)' : '0 20px 45px -10px rgba(220, 38, 38, 0.45)',
              border: '1.5px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '26px',
              cursor: 'pointer'
            }}
            onClick={() => setShowQrModal(true)}
            title="Toucher pour ouvrir le QR Code Tri-Laye grand format"
          >
            {/* Motifs géométriques en arrière-plan */}
            <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', background: 'rgba(255,255,255,0.08)', borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-50px', left: '-30px', width: '140px', height: '140px', background: 'rgba(255,255,255,0.06)', borderRadius: '50%', pointerEvents: 'none' }} />

            {/* ENTÊTE DE LA CARTE */}
            <div className="d-flex justify-content-between align-items-start mb-3 position-relative" style={{ zIndex: 2 }}>
              <div>
                <span className="d-block text-uppercase fw-bold opacity-90 mb-0.5" style={{ fontSize: '0.78rem', letterSpacing: '1px' }}>
                  Couverture Santé Universelle
                </span>
                <h4 className="fw-extrabold mb-0 text-white" style={{ fontSize: '1.35rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)', letterSpacing: '0.5px' }}>
                  MUTUALIS DAKAR 🇸🇳
                </h4>
              </div>

              <span 
                className="badge px-3 py-2 fw-extrabold text-white shadow-sm d-inline-flex align-items-center gap-1.5"
                style={{
                  background: (result.valid && result.status !== 'suspended' && result.status !== 'suspendu') ? '#10b981' : '#ef4444',
                  borderRadius: '20px',
                  fontSize: '0.84rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                  cursor: 'pointer'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setResult(prev => ({
                    ...prev,
                    valid: !(prev.valid && prev.status !== 'suspended' && prev.status !== 'suspendu'),
                    status: (prev.valid && prev.status !== 'suspended' && prev.status !== 'suspendu') ? 'suspended' : 'active'
                  }));
                }}
                title="Cliquer pour basculer le statut d'inactif à actif pour le test"
              >
                {(result.valid && result.status !== 'suspended' && result.status !== 'suspendu') ? '● ACTIF' : '🔴 SUSPENDU'}
              </span>
            </div>

            <hr className="my-2.5 opacity-25" />

            {/* CORPS DE LA CARTE : PHOTO + NOM + MUTUELLE & FORMULE */}
            <div className="row g-3 align-items-center mb-3 position-relative" style={{ zIndex: 2 }}>
              <div className="col-auto">
                <img 
                  src={result.photoUrl || '/csu_profile_hero_real.png'} 
                  alt={`${result.firstName} ${result.lastName}`}
                  onError={(e) => { e.target.onerror = null; e.target.src = '/csu_profile_hero_real.png'; }}
                  style={{
                    width: '76px',
                    height: '76px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid #ffffff',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.35)'
                  }}
                />
              </div>

              <div className="col">
                <h3 className="fw-extrabold mb-1.5 text-white" style={{ fontSize: '1.45rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                  {result.firstName} {result.lastName}
                </h3>
                <div className="d-flex flex-wrap gap-2 align-items-center mb-1">
                  <span className="badge bg-white text-emerald fw-bold px-2.5 py-1.5 d-inline-flex align-items-center gap-1" style={{ color: '#047857', borderRadius: '8px', fontSize: '0.8rem' }}>
                    📦 maternité 100%
                  </span>
                  <span className="badge px-2.5 py-1.5 fw-bold text-white d-inline-flex align-items-center gap-1" style={{ background: 'rgba(255,255,255,0.22)', borderRadius: '8px', fontSize: '0.8rem' }}>
                    🏥 {result.mutuelleName ? result.mutuelleName : '—'}
                  </span>
                </div>
              </div>

              <div className="col-auto text-end d-none d-sm-block">
                <div className="p-2 bg-white rounded-3 shadow-sm d-inline-block">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(result.cmuNumber)}`} 
                    alt="QR Code CSU" 
                    style={{ width: '70px', height: '70px' }} 
                  />
                </div>
              </div>
            </div>

            {/* PIED DE LA CARTE : N° CARTE CSU / CODE IPP & TAP TO QR */}
            <div className="p-3 rounded-3 position-relative" style={{ background: 'rgba(0, 0, 0, 0.28)', backdropFilter: 'blur(8px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.18)', zIndex: 2 }}>
              <small className="d-block text-uppercase fw-bold opacity-85 mb-0.5" style={{ fontSize: '0.74rem', letterSpacing: '0.05em' }}>
                N° Carte CSU / Code Patient IPP
              </small>
              <div className="fw-extrabold font-monospace text-white mb-2" style={{ fontSize: '1.02rem', letterSpacing: '0.5px' }}>
                {getBeneficiaryCode(result.cmuNumber, 1)} | IPP: {result.ippNumber || 'IPP-DKR-2026-88'}
              </div>

              <div className="d-flex align-items-center justify-content-between pt-2 border-top" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
                <span className="fw-extrabold d-inline-flex align-items-center gap-1.5" style={{ fontSize: '0.86rem', color: '#fef08a' }}>
                  👆 Toucher pour le QR Code Tri-Laye
                </span>
                <span className="badge bg-white text-dark px-2.5 py-1 fw-bold" style={{ borderRadius: '8px', fontSize: '0.76rem' }}>
                  QR Code HD 📱
                </span>
              </div>
            </div>
          </div>

          {/* SI LA CARTE EST SUSPENDUE : AFFICHER UNIQUEMENT LE MESSAGE D'ALERTE DE RÉGULARISATION (10 500 FCFA) */}
          {(!result.valid || result.status === 'suspended' || result.status === 'suspendu') ? (
            <div className="card shadow-sm border-0 p-4 p-md-5 mb-4 text-center" style={{ borderRadius: '24px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '2px solid #ef4444' }}>
              <div className="d-inline-flex align-items-center justify-content-center p-3 rounded-circle mb-3 mx-auto" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', width: '72px', height: '72px' }}>
                <span style={{ fontSize: '2.4rem' }}>⚠️</span>
              </div>
              
              <h3 className="fw-bold mb-2 text-danger" style={{ fontSize: '1.45rem' }}>⚠️ Couverture CSU inactive</h3>
              
              <div className="mb-3">
                <code className="px-3 py-1.5 bg-dark text-warning border border-warning rounded-3 fw-bold d-inline-block" style={{ fontSize: '1.05rem', color: '#f59e0b' }}>
                  {getAdherentCode(result.cmuNumber)}
                </code>
              </div>

              <p className="lead mb-4 mx-auto" style={{ maxWidth: '640px', fontSize: '1.08rem', lineHeight: '1.65', color: 'var(--text-main)' }}>
                Votre couverture est suspendue. Veuillez régulariser votre cotisation et celui des membres de votre famille pour un montant de <strong>10 500 FCFA</strong>.
              </p>

              <div className="d-flex justify-content-center gap-3">
                <button 
                  type="button" 
                  className="btn btn-emerald btn-lg px-4 py-3 fw-bold d-inline-flex align-items-center gap-2 shadow"
                  style={{ background: '#10b981', borderColor: '#10b981', color: '#ffffff', borderRadius: '16px', fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)' }}
                  onClick={() => {
                    localStorage.setItem('cmu-pending-renewal', JSON.stringify({
                      cmuNumber: getAdherentCode(result.cmuNumber),
                      amount: 10500,
                      familyCount: 3,
                      firstName: result.firstName,
                      lastName: result.lastName
                    }));
                    if (setView) setView('payments');
                  }}
                >
                  💳 Renouveler ma cotisation
                </button>
              </div>
            </div>
          ) : (
            <div className="verified-cards-wrapper">
              {/* ⚡ HUB D'ACTIONS MÉDICALES INSTANTANÉES (DEMANDE GARANTIE, ORDONNANCE, TÉLÉMÉDECINE, RADIOS) */}
              <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '24px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                <div className="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom flex-wrap gap-2" style={{ borderColor: 'var(--border-color)' }}>
                  <div>
                    <h5 className="fw-extrabold mb-1 d-flex align-items-center gap-2" style={{ color: '#059669', fontSize: '1.15rem' }}>
                      <span>⚡</span> Hub d'actions médicales (Scan QR Code)
                    </h5>
                    <span className="small text-muted" style={{ fontSize: '0.84rem' }}>
                      Services de prise en charge certifiés Tiers-Payant pour <strong>{result.firstName} {result.lastName}</strong>
                    </span>
                  </div>
                  <span className="badge bg-success text-white px-3 py-1.5" style={{ borderRadius: '10px', fontSize: '0.78rem' }}>
                    🟢 Assuré Actif
                  </span>
                </div>

                <div className="row g-3">
                  {/* Action 1: Lettre de Garantie */}
                  <div className="col-12 col-sm-6 col-lg-3">
                    <button 
                      type="button" 
                      className="btn w-100 p-3.5 text-start d-flex flex-column justify-content-between h-100 shadow-sm" 
                      style={{
                        background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.08) 0%, rgba(16, 185, 129, 0.03) 100%)',
                        border: '1.5px solid rgba(5, 150, 105, 0.35)',
                        borderRadius: '20px',
                        color: 'var(--text-main)',
                        minHeight: '125px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 6px 16px rgba(5, 150, 105, 0.06)'
                      }}
                      onClick={() => setActiveModal('guarantee')}
                    >
                      <div className="d-flex align-items-center justify-content-between w-100 mb-2">
                        <div className="d-flex align-items-center gap-2">
                          <span className="fs-3 p-2 rounded-3" style={{ background: 'rgba(5, 150, 105, 0.18)', color: '#059669', lineHeight: 1 }}>📜</span>
                          <span className="fw-extrabold" style={{ fontSize: '1rem', color: 'var(--text-main)' }}>Lettre de garantie</span>
                        </div>
                        <span className="badge bg-success text-white px-2.5 py-1" style={{ fontSize: '0.72rem', borderRadius: '8px' }}>80-100%</span>
                      </div>
                      <div className="mt-1">
                        <small className="d-block text-muted" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                          Prise en charge hospitalière certifiée
                        </small>
                      </div>
                    </button>
                  </div>

                  {/* Action 2: Bon pharmacie 48h */}
                  <div className="col-12 col-sm-6 col-lg-3">
                    <button 
                      type="button" 
                      className="btn w-100 p-3.5 text-start d-flex flex-column justify-content-between h-100 shadow-sm" 
                      style={{
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.03) 100%)',
                        border: '1.5px solid rgba(245, 158, 11, 0.35)',
                        borderRadius: '20px',
                        color: 'var(--text-main)',
                        minHeight: '125px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 6px 16px rgba(245, 158, 11, 0.06)'
                      }}
                      onClick={() => setActiveModal('order')}
                    >
                      <div className="d-flex align-items-center justify-content-between w-100 mb-2">
                        <div className="d-flex align-items-center gap-2">
                          <span className="fs-3 p-2 rounded-3" style={{ background: 'rgba(245, 158, 11, 0.18)', color: '#f59e0b', lineHeight: 1 }}>💊</span>
                          <span className="fw-extrabold" style={{ fontSize: '1rem', color: 'var(--text-main)' }}>Bon pharmacie</span>
                        </div>
                        <span className="badge text-dark fw-bold px-2.5 py-1" style={{ background: '#fef08a', border: '1px solid #f59e0b', fontSize: '0.72rem', borderRadius: '8px' }}>48h Tiers-Payant</span>
                      </div>
                      <div className="mt-1">
                        <small className="d-block text-muted" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                          Ordonnance et médicaments pris en charge
                        </small>
                      </div>
                    </button>
                  </div>

                  {/* Action 3: Télémédecine WebRTC */}
                  <div className="col-12 col-sm-6 col-lg-3">
                    <button 
                      type="button" 
                      className="btn w-100 p-3.5 text-start d-flex flex-column justify-content-between h-100 shadow-sm" 
                      style={{
                        background: 'linear-gradient(135deg, rgba(30, 64, 175, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%)',
                        border: '1.5px solid rgba(30, 64, 175, 0.35)',
                        borderRadius: '20px',
                        color: 'var(--text-main)',
                        minHeight: '125px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 6px 16px rgba(30, 64, 175, 0.06)'
                      }}
                      onClick={() => {
                        if (setView) setView('telemedicine');
                        else window.location.hash = '#telemedicine';
                      }}
                    >
                      <div className="d-flex align-items-center justify-content-between w-100 mb-2">
                        <div className="d-flex align-items-center gap-2">
                          <span className="fs-3 p-2 rounded-3" style={{ background: 'rgba(30, 64, 175, 0.18)', color: '#1e40af', lineHeight: 1 }}>🎥</span>
                          <span className="fw-extrabold" style={{ fontSize: '1rem', color: 'var(--text-main)' }}>Télémédecine</span>
                        </div>
                        <span className="badge text-white px-2.5 py-1" style={{ background: '#1e40af', fontSize: '0.72rem', borderRadius: '8px' }}>Direct 24/7</span>
                      </div>
                      <div className="mt-1">
                        <small className="d-block text-muted" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                          Téléconsultation avec un médecin agréé
                        </small>
                      </div>
                    </button>
                  </div>

                  {/* Action 4: Radios & Analyses */}
                  <div className="col-12 col-sm-6 col-lg-3">
                    <button 
                      type="button" 
                      className="btn w-100 p-3.5 text-start d-flex flex-column justify-content-between h-100 shadow-sm" 
                      style={{
                        background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.08) 0%, rgba(168, 85, 247, 0.03) 100%)',
                        border: '1.5px solid rgba(147, 51, 234, 0.35)',
                        borderRadius: '20px',
                        color: 'var(--text-main)',
                        minHeight: '125px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 6px 16px rgba(147, 51, 234, 0.06)'
                      }}
                      onClick={() => setActiveModal('imaging')}
                    >
                      <div className="d-flex align-items-center justify-content-between w-100 mb-2">
                        <div className="d-flex align-items-center gap-2">
                          <span className="fs-3 p-2 rounded-3" style={{ background: 'rgba(147, 51, 234, 0.18)', color: '#9333ea', lineHeight: 1 }}>🩻</span>
                          <span className="fw-extrabold" style={{ fontSize: '1rem', color: 'var(--text-main)' }}>Radios & Labo</span>
                        </div>
                        <span className="badge text-white px-2.5 py-1" style={{ background: '#9333ea', fontSize: '0.72rem', borderRadius: '8px' }}>DICOM</span>
                      </div>
                      <div className="mt-1">
                        <small className="d-block text-muted" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                          Transmettre des imageries ou bilans
                        </small>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* 🛡️ DROITS OUVERTS & DOSSIER MÉDICAL DÉTAILLÉ */}
              <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '24px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom flex-wrap gap-2" style={{ borderColor: 'var(--border-color)' }}>
                  <h5 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>
                    <span>🛡️</span> Droits ouverts & Dossier Médical
                  </h5>
                  
                  {/* L'assuré ne modifie pas son dossier médical lui-même : Accès en lecture seule */}
                  <span className="badge px-3 py-2 fw-bold text-success border border-success d-inline-flex align-items-center gap-1.5" style={{ background: 'rgba(5, 150, 105, 0.12)', borderRadius: '12px', fontSize: '0.82rem' }}>
                    🔒 Lecture seule (Réservé aux professionnels de santé)
                  </span>
                </div>

                <div className="row g-3.5 mb-4">
                  <div className="col-12 col-md-6">
                    <div className="p-3.5 rounded-4 border h-100 shadow-sm" style={{ background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.05) 0%, rgba(5, 150, 105, 0.01) 100%)', borderColor: 'rgba(5, 150, 105, 0.25)', borderRadius: '18px' }}>
                      <small className="d-block mb-1 text-uppercase fw-bold" style={{ color: '#059669', fontSize: '0.76rem', letterSpacing: '0.06em' }}>
                        🏥 Mutuelle de rattachement :
                      </small>
                      <h6 className="fw-bold mb-0" style={{ fontSize: '1.02rem', lineHeight: '1.45', color: 'var(--text-main)' }}>
                        {result.mutuelleName}
                      </h6>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="p-3.5 rounded-4 border h-100 shadow-sm" style={{ background: 'linear-gradient(135deg, rgba(30, 64, 175, 0.05) 0%, rgba(30, 64, 175, 0.01) 100%)', borderColor: 'rgba(30, 64, 175, 0.25)', borderRadius: '18px' }}>
                      <small className="d-block mb-1 text-uppercase fw-bold" style={{ color: '#1e40af', fontSize: '0.76rem', letterSpacing: '0.06em' }}>
                        📋 Formule souscrite :
                      </small>
                      <h6 className="fw-bold mb-0" style={{ fontSize: '1.02rem', lineHeight: '1.45', color: 'var(--text-main)' }}>
                        {result.packageType}
                      </h6>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="p-3.5 rounded-4 border h-100 shadow-sm" style={{ background: 'var(--bg-card-subtle)', borderColor: 'var(--border-color)', borderRadius: '18px' }}>
                      <small className="d-block mb-1 text-uppercase fw-bold" style={{ color: 'var(--text-sub)', fontSize: '0.76rem', letterSpacing: '0.06em' }}>
                        📞 Contact d'urgence & téléphone :
                      </small>
                      <h6 className="fw-bold mb-0" style={{ fontSize: '1.02rem', color: 'var(--text-main)' }}>
                        {result.phone}
                      </h6>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="p-3.5 rounded-4 border h-100 shadow-sm" style={{ background: 'var(--bg-card-subtle)', borderColor: 'var(--border-color)', borderRadius: '18px' }}>
                      <small className="d-block mb-1 text-uppercase fw-bold" style={{ color: 'var(--text-sub)', fontSize: '0.76rem', letterSpacing: '0.06em' }}>
                        🩸 Groupe sanguin & allergies :
                      </small>
                      <h6 className="fw-bold mb-0" style={{ fontSize: '1.02rem', color: 'var(--text-main)' }}>
                        🔴 {result.bloodGroup} <span className="text-muted fw-normal" style={{ fontSize: '0.9rem' }}>(Allergies : {result.allergies || 'Aucune connue'})</span>
                      </h6>
                    </div>
                  </div>
                </div>

                {/* Ayants droit rattachés */}
                {result.familyMembers && result.familyMembers.length > 0 && (
                  <div className="p-4 rounded-4 border mb-3" style={{ background: 'var(--bg-card-subtle)', borderColor: 'var(--border-color)', borderRadius: '20px' }}>
                    <h6 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ fontSize: '0.98rem', color: 'var(--text-main)' }}>
                      <span>👨‍👩‍👧‍👦</span> Ayants droit rattachés à la carte d'adhérent :
                    </h6>
                    <div className="d-flex flex-column gap-3">
                      {result.familyMembers.map((fm, idx) => (
                        <div key={idx} className="d-flex justify-content-between align-items-center p-3 rounded-3 border flex-wrap gap-2" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '14px' }}>
                          <div className="d-flex align-items-center gap-3">
                            <div className="p-2 rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px', fontSize: '1rem' }}>
                              👤
                            </div>
                            <div>
                              <div className="d-flex align-items-center gap-2 flex-wrap">
                                <strong style={{ fontSize: '0.98rem', color: 'var(--text-main)' }}>{fm.name}</strong>
                                <span className="badge bg-secondary-subtle text-secondary border border-secondary px-2.5 py-1" style={{ fontSize: '0.75rem', borderRadius: '8px' }}>
                                  {fm.relation} • {fm.age} ans
                                </span>
                              </div>
                              <small className="d-block text-muted mt-0.5" style={{ fontSize: '0.78rem' }}>
                                Couverture santé familiale active
                              </small>
                            </div>
                          </div>

                          <div className="text-end d-flex align-items-center gap-2">
                            <code style={{ fontSize: '0.82rem', color: '#059669', background: 'rgba(5, 150, 105, 0.12)', padding: '0.3rem 0.6rem', borderRadius: '8px', fontWeight: 'bold' }}>
                              {getBeneficiaryCode(result.cmuNumber, idx + 2)}
                            </code>
                            <span className="badge bg-success text-white px-2.5 py-1.5" style={{ fontSize: '0.72rem', borderRadius: '8px' }}>
                              Couvert 100%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Horodatage certifié & Bouton d'export PDF */}
                <div className="pt-3 border-top d-flex justify-content-between align-items-center flex-wrap gap-2 mt-4" style={{ borderColor: 'var(--border-color)' }}>
                  <span className="text-muted small" style={{ fontSize: '0.82rem' }}>
                    🕒 Vérifié le : <strong>{new Date(result.checkedAt).toLocaleString('fr-FR')}</strong>
                  </span>

                  <button 
                    type="button" 
                    className="btn btn-outline-success fw-bold btn-sm px-4 py-2"
                    onClick={handlePrintCertificate}
                    style={{ borderRadius: '12px', fontSize: '0.88rem' }}
                  >
                    🖨️ Imprimer le certificat PDF
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODALE PORTAL : QR CODE TRI-LAYE HD SUR TOUCHER DE LA CARTE */}
      {showQrModal && createPortal(
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh',
            background: 'rgba(15, 23, 42, 0.88)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem'
          }}
          onClick={() => setShowQrModal(false)}
        >
          <div 
            style={{
              maxWidth: '420px', width: '100%', background: 'var(--bg-card)', color: 'var(--text-main)',
              borderRadius: '24px', padding: '2rem', textAlign: 'center', border: '2px solid #059669',
              boxShadow: '0 25px 70px rgba(0,0,0,0.75)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-extrabold mb-0 text-success" style={{ fontSize: '1.15rem' }}>📱 QR Code Tri-Laye CSU</h5>
              <button type="button" className="btn-close" onClick={() => setShowQrModal(false)}></button>
            </div>

            <div className="p-3 bg-white rounded-4 shadow-sm d-inline-block mb-3">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(result.cmuNumber)}`} 
                alt="QR Code Tri-Laye" 
                style={{ width: '210px', height: '210px' }} 
              />
            </div>

            <div className="fw-extrabold text-main font-monospace mb-1" style={{ fontSize: '1.1rem' }}>
              {getBeneficiaryCode(result.cmuNumber, 1)}
            </div>
            <small className="d-block text-muted mb-4" style={{ fontSize: '0.85rem' }}>
              Code Patient IPP: {result.ippNumber || 'IPP-DKR-2026-88'}
            </small>

            <button 
              type="button" 
              className="btn w-100 fw-bold py-2.5"
              style={{ borderRadius: '14px', background: '#059669', color: '#fff', fontSize: '0.95rem' }}
              onClick={() => setShowQrModal(false)}
            >
              ✅ Fermer
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* MODALE 1 : Demander une Lettre de Garantie Rapide (React Portal — Centré) */}
      {activeModal === 'guarantee' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <form onSubmit={handleCreateGuarantee} style={{ maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-success mb-0" style={{ fontSize: '1.15rem' }}>📜 Émettre une lettre de garantie</h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>

            <p className="small text-muted mb-3" style={{ fontSize: '0.85rem' }}>
              Pour l'assuré scanné : <strong>{result?.firstName} {result?.lastName}</strong> ({result?.cmuNumber})
            </p>
            
            <div className="mb-3">
              <label className="form-label small fw-bold">Établissement récepteur *</label>
              <select className="form-select input" value={guaranteeHospital} onChange={(e) => setGuaranteeHospital(e.target.value)} style={{ borderRadius: '12px' }}>
                <option value="Hôpital Universitaire de Fann (Dakar)">Hôpital Universitaire de Fann (Dakar)</option>
                <option value="Hôpital Aristide Le Dantec">Hôpital Aristide Le Dantec</option>
                <option value="Hôpital Général Idrissa Pouye (Pikine)">Hôpital Général Idrissa Pouye (Pikine)</option>
                <option value="Centre de Santé Gaspard Camara">Centre de Santé Gaspard Camara</option>
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold">Acte médical prescrit *</label>
              <input type="text" className="form-control input" value={guaranteeAct} onChange={(e) => setGuaranteeAct(e.target.value)} required style={{ borderRadius: '12px' }} />
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold">Devis estimé (FCFA) *</label>
              <input type="number" className="form-control input" value={guaranteeAmount} onChange={(e) => setGuaranteeAmount(e.target.value)} required style={{ borderRadius: '12px' }} />
            </div>

            <div className="d-flex justify-content-end gap-3">
              <button type="button" className="btn btn-outline" style={{ borderRadius: '12px' }} onClick={() => setActiveModal(null)}>Annuler</button>
              <button type="submit" className="btn btn-success fw-bold" style={{ borderRadius: '12px', background: '#10b981', borderColor: '#10b981' }}>Émettre la garantie</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* MODALE 2 : Générer un Bon Pharmacie 48h (React Portal — Centré) */}
      {activeModal === 'order' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <form onSubmit={handleCreateOrder} style={{ maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-success mb-0" style={{ fontSize: '1.15rem' }}>💊 Générer un bon pharmacie 48h</h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>

            <p className="small text-muted mb-3" style={{ fontSize: '0.85rem' }}>
              Prescription directe pour <strong>{result?.firstName} {result?.lastName}</strong> ({result?.cmuNumber})
            </p>

            <div className="mb-3">
              <label className="form-label small fw-bold">Nom du médicament *</label>
              <input type="text" className="form-control input" value={medName} onChange={(e) => setMedName(e.target.value)} required style={{ borderRadius: '12px' }} />
            </div>

            <div className="row g-2 mb-4">
              <div className="col-6">
                <label className="form-label small fw-bold">Quantité *</label>
                <input type="number" className="form-control input" value={medQty} onChange={(e) => setMedQty(e.target.value)} min="1" required style={{ borderRadius: '12px' }} />
              </div>
              <div className="col-6">
                <label className="form-label small fw-bold">Prix unitaire (FCFA) *</label>
                <input type="number" className="form-control input" value={medPrice} onChange={(e) => setMedPrice(e.target.value)} required style={{ borderRadius: '12px' }} />
              </div>
            </div>

            <div className="d-flex justify-content-end gap-3">
              <button type="button" className="btn btn-outline" style={{ borderRadius: '12px' }} onClick={() => setActiveModal(null)}>Annuler</button>
              <button type="submit" className="btn btn-success fw-bold" style={{ borderRadius: '12px', background: '#10b981', borderColor: '#10b981' }}>Générer bon 48h</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* MODALE 3 : Ajouter Radio / Analyse DICOM (React Portal — Centré) */}
      {activeModal === 'imaging' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <form onSubmit={handleAddImaging} style={{ maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-info mb-0" style={{ fontSize: '1.15rem' }}>🩻 Ajouter examen radio / analyse</h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>

            <p className="small text-muted mb-3" style={{ fontSize: '0.85rem' }}>
              Lier un résultat au dossier médical de <strong>{result?.firstName} {result?.lastName}</strong> ({result?.cmuNumber})
            </p>

            <div className="mb-3">
              <label className="form-label small fw-bold">Titre de l'examen *</label>
              <input type="text" className="form-control input" value={examTitle} onChange={(e) => setExamTitle(e.target.value)} required style={{ borderRadius: '12px' }} />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold">Type d'examen *</label>
              <select className="form-select input" value={examType} onChange={(e) => setExamType(e.target.value)} style={{ borderRadius: '12px' }}>
                <option value="Scanner">Scanner HD</option>
                <option value="Radio">Radiographie</option>
                <option value="Analyse">Analyse biologique / labo</option>
                <option value="IRM">IRM cervicale / abdominale</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold">Compte-rendu du radiologue / médecin *</label>
              <textarea className="form-control input" rows="3" value={examNotes} onChange={(e) => setExamNotes(e.target.value)} required style={{ borderRadius: '12px' }} />
            </div>

            <div className="d-flex justify-content-end gap-3">
              <button type="button" className="btn btn-outline" style={{ borderRadius: '12px' }} onClick={() => setActiveModal(null)}>Annuler</button>
              <button type="submit" className="btn btn-info text-white fw-bold" style={{ borderRadius: '12px' }}>Enregistrer l'examen</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* MODALE 4 : Modifier Antécédents (React Portal — Centré) */}
      {activeModal === 'antecedents' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <form onSubmit={handleUpdateAntecedents} style={{ maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-warning mb-0" style={{ fontSize: '1.15rem' }}>🩸 Modifier les antécédents médicaux</h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>

            <p className="small text-muted mb-3" style={{ fontSize: '0.85rem' }}>
              Dossier de l'assuré : <strong>{result?.firstName} {result?.lastName}</strong> ({result?.cmuNumber})
            </p>

            <div className="mb-3">
              <label className="form-label small fw-bold">Groupe sanguin & rhésus *</label>
              <select className="form-select input fw-bold" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} style={{ borderRadius: '12px' }}>
                <option value="O Rhésus positif (O+)">O Rhésus positif (O+)</option>
                <option value="O Rhésus négatif (O-)">O Rhésus négatif (O-)</option>
                <option value="A Rhésus positif (A+)">A Rhésus positif (A+)</option>
                <option value="B Rhésus positif (B+)">B Rhésus positif (B+)</option>
                <option value="AB Rhésus positif (AB+)">AB Rhésus positif (AB+)</option>
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold">Allergies majeures *</label>
              <input type="text" className="form-control input" value={allergies} onChange={(e) => setAllergies(e.target.value)} required style={{ borderRadius: '12px' }} />
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold">Maladies chroniques *</label>
              <input type="text" className="form-control input" value={chronicCond} onChange={(e) => setChronicCond(e.target.value)} required style={{ borderRadius: '12px' }} />
            </div>

            <div className="d-flex justify-content-end gap-3">
              <button type="button" className="btn btn-outline" style={{ borderRadius: '12px' }} onClick={() => setActiveModal(null)}>Annuler</button>
              <button type="submit" className="btn btn-warning text-dark fw-bold" style={{ borderRadius: '12px' }}>Mettre à jour</button>
            </div>
          </form>
        </div>,
        document.body
      )}

    </div>
  );
}
