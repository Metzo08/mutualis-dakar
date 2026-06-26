import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { outboxAdd } from '../utils/offline';

export default function ParrainageCSU({ lang }) {
  // Stepper State
  const [regStep, setRegStep] = useState(1);
  const [parrainageType, setParrainageType] = useState('individuel');
  const [selectedMutuelle, setSelectedMutuelle] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', birthDate: '', phone: '', email: '', address: '', cni: null, photo: null
  });
  const [schoolName, setSchoolName] = useState('');
  const [familyMembers, setFamilyMembers] = useState([]);
  const [newFamilyMember, setNewFamilyMember] = useState({ name: '', relation: '', age: '' });
  const [sponsoredHouseholds, setSponsoredHouseholds] = useState([]);
  
  // Payment States
  const [paymentMethod, setPaymentMethod] = useState('wave');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [generatedCmuNumber, setGeneratedCmuNumber] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, loading, success
  const [gdprConsent, setGdprConsent] = useState(false);
  
  // Error state
  const [error, setError] = useState('');
  const showError = (msg) => {
    setError(msg);
    setTimeout(() => {
      setError(prev => prev === msg ? '' : prev);
    }, 6000);
  };

  // Reset errors on step change
  useEffect(() => {
    setError('');
  }, [regStep]);

  // Load mutuelles list
  const [mutuellesList, setMutuellesList] = useState([]);
  useEffect(() => {
    const fallbackList = [
      'Mutuelle de la Médina',
      'Mutuelle de Dakar Plateau',
      'Mutuelle de Pikine Ouest',
      'Mutuelle de Yeumbeul',
      'Mutuelle de Golf Sud (Guédiawaye)',
      'Mutuelle de Rufisque Est',
      'Mutuelle de Sangalkam',
      'Mutuelle de Keur Massar Nord'
    ];
    fetch('http://localhost:5000/api/mutuelles')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setMutuellesList(data.map(m => m.name));
        } else {
          setMutuellesList(fallbackList);
        }
      })
      .catch(() => setMutuellesList(fallbackList));
  }, []);

  // QR Code generator
  useEffect(() => {
    if (generatedCmuNumber) {
      QRCode.toDataURL(generatedCmuNumber, {
        margin: 1,
        width: 150,
        color: { dark: '#0f172a', light: '#ffffff' }
      })
      .then(url => setQrCodeUrl(url))
      .catch(err => console.error('Error generating QR Code:', err));
    }
  }, [generatedCmuNumber]);

  // Pricing Logic
  const calculateTotalCost = () => {
    if (parrainageType === 'menages') {
      return sponsoredHouseholds.reduce((acc, curr) => {
        return acc + 1000 + (curr.members.length + 1) * 3500;
      }, 0);
    }
    if (parrainageType === 'eleves') {
      return Math.max(1, familyMembers.length) * 1000;
    }
    return Math.max(1, familyMembers.length) * 4500;
  };

  // Navigation handlers
  const nextStep = () => {
    if (regStep === 1 && !parrainageType) {
      showError(lang === 'fr' ? 'Veuillez sélectionner un type de parrainage.' : 'Tannal parrainage bi.');
      return;
    }
    if (regStep === 2 && !selectedMutuelle) {
      showError(lang === 'fr' ? 'Veuillez sélectionner une mutuelle de rattachement.' : 'Tannal mutuelle bi.');
      return;
    }
    if (regStep === 3) {
      if (parrainageType === 'eleves' && !schoolName) {
        showError(lang === 'fr' ? 'Veuillez saisir le nom de l\'établissement scolaire.' : 'Bindal tourou daara/ecole bi.');
        return;
      }
      if (!formData.firstName || !formData.lastName || !formData.phone) {
        showError(lang === 'fr' ? 'Veuillez remplir les champs du parrain (prénom, nom, téléphone).' : 'Bindal sa tour, sa sant ak sa portable.');
        return;
      }
    }
    if (regStep === 4) {
      if (parrainageType === 'menages') {
        if (sponsoredHouseholds.length === 0) {
          showError(lang === 'fr' ? 'Veuillez ajouter au moins un ménage à parrainer.' : 'Duggalal njaboot bu bokk.');
          return;
        }
        for (let i = 0; i < sponsoredHouseholds.length; i++) {
          if (!sponsoredHouseholds[i].chefName || !sponsoredHouseholds[i].chefPhone) {
            showError(lang === 'fr' ? `Veuillez renseigner le nom et le téléphone du Chef pour le Ménage #${i+1}.` : `Bindal tour ak portable Chef bi ci njaboot #${i+1}.`);
            return;
          }
        }
      } else {
        if (familyMembers.length === 0) {
          showError(lang === 'fr' ? 'Veuillez ajouter au moins un filleul ou élève.' : 'Duggalal filleul bu bokk.');
          return;
        }
      }
    }
    setRegStep(prev => prev + 1);
  };

  const prevStep = () => setRegStep(prev => prev - 1);

  // Beneficiary Management
  const addFamilyMember = () => {
    if (newFamilyMember.name && newFamilyMember.age) {
      setFamilyMembers([...familyMembers, newFamilyMember]);
      setNewFamilyMember({ name: '', relation: '', age: '' });
    } else {
      showError(lang === 'fr' ? 'Veuillez renseigner le prénom, le nom et l\'âge.' : 'Bindal tour bi ak at mi.');
    }
  };

  const removeFamilyMember = (idx) => {
    setFamilyMembers(familyMembers.filter((_, i) => i !== idx));
  };

  // Submit and Pay
  const triggerOtp = () => setOtpSent(true);

  const handlePayment = (e) => {
    e.preventDefault();
    if (otpCode === '7842') {
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        birthDate: formData.birthDate,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        mutuelleName: selectedMutuelle,
        packageType: 'parrainage',
        paymentMethod: paymentMethod,
        familyMembers: familyMembers,
        sponsorPhone: formData.phone,
        schoolName: parrainageType === 'eleves' ? schoolName : null,
        parrainageType: parrainageType,
        sponsoredHouseholds: parrainageType === 'menages' ? sponsoredHouseholds : null
      };

      if (!navigator.onLine) {
        outboxAdd('adhesion', payload)
          .then(() => {
            setGeneratedCmuNumber('SN-DK-SPN-' + Math.floor(1000 + Math.random() * 9000));
            setPaymentSuccess(true);
            setRegStep(6);
            alert(lang === 'fr' 
              ? "Mode hors-ligne : Votre demande de parrainage a été enregistrée localement et sera synchronisée dès le retour de la connexion."
              : "Hors-ligne mode : Sa parrainage enregistrer na localement te mungi lay xaar connexion bi ñëwaat."
            );
          })
          .catch(err => {
            console.error('Offline queuing failed:', err);
            setGeneratedCmuNumber('SN-DK-SPN-' + Math.floor(1000 + Math.random() * 9000));
            setPaymentSuccess(true);
            setRegStep(6);
          });
        return;
      }

      fetch('http://localhost:5000/api/adhesions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setGeneratedCmuNumber(data.cmuNumber);
          setPaymentSuccess(true);
          setRegStep(6);
        } else {
          showError(lang === 'fr' ? 'Erreur API : ' + data.error : 'Erreur API : ' + data.error);
        }
      })
      .catch(() => {
        setGeneratedCmuNumber('SN-DK-SPN-' + Math.floor(1000 + Math.random() * 9000));
        setPaymentSuccess(true);
        setRegStep(6);
      });
    } else {
      showError(lang === 'fr' ? 'Code OTP incorrect. Veuillez réessayer (Indice : 7842)' : 'Code OTP bi baaxul (Indice: 7842)');
    }
  };

  const handleSync = () => {
    setSyncStatus('loading');
    setTimeout(() => setSyncStatus('success'), 2000);
  };

  const handleDownloadReceipt = () => {
    const now = new Date();
    const receiptContent = [
      '═══════════════════════════════════════════════',
      '              MUTUALIS DAKAR',
      '        Reçu de Parrainage solidaire',
      '═══════════════════════════════════════════════',
      '',
      `Date : ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR')}`,
      `N° Membre : ${generatedCmuNumber}`,
      '',
      '───────────────────────────────────────────────',
      '  Informations du parrain',
      '───────────────────────────────────────────────',
      `Prénom        : ${formData.firstName}`,
      `Nom           : ${formData.lastName}`,
      `Téléphone     : ${formData.phone}`,
      `Email         : ${formData.email || 'Non renseigné'}`,
      `Adresse       : ${formData.address || 'Non renseigné'}`,
      '',
      '───────────────────────────────────────────────',
      '  Détails du sponsoring',
      '───────────────────────────────────────────────',
      `Mutuelle      : ${selectedMutuelle}`,
      `Type Parrain. : ${
        parrainageType === 'menages' ? 'Parrainage de Ménages' :
        parrainageType === 'eleves' ? 'Parrainage scolaire (écoles/daaras)' :
        'Parrainage Individuel'
      }`,
      `Montant payé  : ${calculateTotalCost().toLocaleString('fr-FR')} FCFA`,
      `Moyen paiement: ${paymentMethod === 'wave' ? 'Wave' : 'Orange Money'}`,
      `Validité      : 12 / 2027`,
      '',
      '───────────────────────────────────────────────',
      '  Bénéficiaires solidaires',
      '───────────────────────────────────────────────',
      ...(parrainageType === 'menages' ? sponsoredHouseholds.flatMap((hh, i) => [
        `  Ménage #${i + 1} : Chef ${hh.chefName} (${hh.chefPhone})`,
        ...hh.members.map(m => `    - ${m.name} (${m.relation}) - ${m.age} ans`),
        ''
      ]) : (
        parrainageType === 'eleves' ? [
          `  Établissement : ${schoolName}`,
          ...familyMembers.map((m, i) => `    ${i + 1}. ${m.name} (Classe: ${m.relation}) - ${m.age} ans`)
        ] : familyMembers.map((m, i) => `    ${i + 1}. ${m.name} - ${m.age} ans`)
      )),
      '',
      '═══════════════════════════════════════════════',
      '  Reçu généré numériquement.',
      '  Contact : support@mutualisdakar.sn',
      '═══════════════════════════════════════════════',
    ].filter(line => line !== undefined && line !== '').join('\n');

    const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recu_parrainage_${generatedCmuNumber}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="view-container">
      {/* Top Banner */}
      <div className="hero-banner" style={{ backgroundImage: 'linear-gradient(to right, rgba(5, 150, 105, 0.9), rgba(5, 150, 105, 0.7)), url("/csu_parrainage_hero_real.png")', backgroundPosition: 'center', backgroundSize: 'cover', height: '260px' }}>
        <div className="hero-content">
          <span className="badge" style={{ padding: '0.4rem 0.8rem', backgroundColor: 'rgba(255, 255, 255, 0.2)', color: '#ffffff', border: 'none' }}>🤝 CMU solidarité</span>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: '0.5rem 0', color: '#ffffff' }}>
            {lang === 'fr' ? 'Parrainage solidaire' : 'Dimbalé ak Parrainage'}
          </h1>
          <p style={{ maxWidth: '600px', fontSize: '1rem', color: '#cbd5e1' }}>
            {lang === 'fr' ? 'Offrez la couverture maladie universelle (carte + cotisation annuelle) à des élèves de Daaras, des ménages démunis ou des filleuls individuels.' : 'Fayal assurance wér-gi-yaram sa njaboot, ay élève daara walla ay filleul.'}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '-2rem auto 3rem auto', padding: '0 1.5rem', position: 'relative', zIndex: 10 }}>
        {/* Error notification banner */}
        {error && (
          <div className="alert alert-danger fade-in-up" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderRadius: '12px' }}>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <div style={{ fontWeight: '600' }}>{error}</div>
          </div>
        )}

        {/* Stepper Indicators */}
        <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem 1.5rem 1.75rem 1.5rem', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', width: '100%' }}>
            
            {/* Connecting line */}
            <div style={{
              position: 'absolute',
              top: '20px',
              left: '8%',
              right: '8%',
              height: '3px',
              backgroundColor: 'var(--border-color)',
              zIndex: 1
            }}></div>

            {/* Active progress line */}
            <div style={{
              position: 'absolute',
              top: '20px',
              left: '8%',
              width: `${(regStep - 1) * 21}%`, // 5 steps, so 4 intervals of 21% = 84% total width
              height: '3px',
              backgroundColor: 'var(--success)',
              zIndex: 1,
              transition: 'width 0.3s ease'
            }}></div>

            {[
              { s: 1, label: lang === 'fr' ? 'Formule' : 'Formule' },
              { s: 2, label: lang === 'fr' ? 'Mutuelle' : 'Mutuelle' },
              { s: 3, label: lang === 'fr' ? 'Parrain' : 'Parrain' },
              { s: 4, label: lang === 'fr' ? 'Filleuls' : 'Filleuls' },
              { s: 5, label: lang === 'fr' ? 'Paiement' : 'Fay' }
            ].map(item => {
              const isActive = regStep === item.s;
              const isCompleted = regStep > item.s;
              return (
                <div 
                  key={item.s} 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    zIndex: 2, 
                    flex: 1,
                    cursor: regStep >= item.s ? 'pointer' : 'default'
                  }}
                  onClick={() => regStep >= item.s && setRegStep(item.s)}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    transition: 'all 0.3s ease',
                    border: '3px solid',
                    borderColor: isActive ? 'var(--primary)' : isCompleted ? 'var(--success)' : 'var(--border-color)',
                    backgroundColor: isActive ? 'var(--primary)' : isCompleted ? 'var(--success)' : 'var(--card-bg)',
                    color: (isActive || isCompleted) ? '#ffffff' : 'var(--text-sub)',
                    boxShadow: isActive ? '0 0 0 5px rgba(4, 120, 87, 0.2)' : 'none'
                  }}>
                    {isCompleted ? '✓' : item.s}
                  </div>
                  <span style={{ 
                    marginTop: '0.6rem', 
                    fontSize: '0.75rem', 
                    fontWeight: isActive ? 'bold' : '500', 
                    color: isActive ? 'var(--text-main)' : isCompleted ? 'var(--success)' : 'var(--text-sub)',
                    transition: 'all 0.3s ease'
                  }}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Container */}
        <div className="card stepper-content-card" style={{ padding: '2rem' }}>
          
          {/* Step 1: Formula selection */}
          {regStep === 1 && (
            <div className="fade-in-up">
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: '800' }}>{lang === 'fr' ? '1. Sélectionnez la formule de parrainage' : '1. Tannal sa formule parrainage'}</h2>
              <p style={{ color: 'var(--text-sub)', marginBottom: '2rem' }}>{lang === 'fr' ? 'Choisissez le groupe cible que vous désirez soutenir financièrement pour une année.' : 'Tannal gni nga beug fayal sa cotisation bu at bi.'}</p>
              
              <div className="grid grid-3" style={{ gap: '1.25rem' }}>
                
                {/* Individuel */}
                <div 
                  className={`card text-center ${parrainageType === 'individuel' ? 'active-border' : ''}`}
                  onClick={() => setParrainageType('individuel')}
                  style={{ 
                    border: parrainageType === 'individuel' ? '2.5px solid var(--primary)' : '1px solid var(--border-color)', 
                    backgroundColor: parrainageType === 'individuel' ? 'rgba(4, 120, 87, 0.05)' : 'var(--card-bg)',
                    transform: parrainageType === 'individuel' ? 'translateY(-4px)' : 'none',
                    boxShadow: parrainageType === 'individuel' ? '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' : 'var(--shadow-sm)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer', 
                    padding: '1.75rem 1.5rem',
                    borderRadius: '12px'
                  }}
                >
                  <div style={{ fontSize: '2.5rem' }}>👤</div>
                  <h3 style={{ fontSize: '1.1rem', marginTop: '0.5rem', fontWeight: '700' }}>{lang === 'fr' ? 'Filleuls individuels' : 'Filleuls individuels'}</h3>
                  <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--primary)', margin: '0.5rem 0' }}>4 500 FCFA <span style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>/ pers.</span></div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{lang === 'fr' ? 'Idéal pour parrainer une ou des personnes spécifiques dans le besoin.' : 'Fayal sa filleul sa cotisation ak sa carte.'}</p>
                </div>

                {/* Ménages */}
                <div 
                  className={`card text-center ${parrainageType === 'menages' ? 'active-border' : ''}`}
                  onClick={() => setParrainageType('menages')}
                  style={{ 
                    border: parrainageType === 'menages' ? '2.5px solid var(--secondary)' : '1px solid var(--border-color)', 
                    backgroundColor: parrainageType === 'menages' ? 'rgba(217, 119, 6, 0.05)' : 'var(--card-bg)',
                    transform: parrainageType === 'menages' ? 'translateY(-4px)' : 'none',
                    boxShadow: parrainageType === 'menages' ? '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' : 'var(--shadow-sm)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer', 
                    padding: '1.75rem 1.5rem',
                    borderRadius: '12px'
                  }}
                >
                  <div style={{ fontSize: '2.5rem' }}>👨‍👩‍👧‍👦</div>
                  <h3 style={{ fontSize: '1.1rem', marginTop: '0.5rem', fontWeight: '700' }}>{lang === 'fr' ? 'Ménages & familles' : 'Ménages & familles'}</h3>
                  <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--secondary)', margin: '0.5rem 0' }}>Tarif Familial</div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{lang === 'fr' ? '1 000 FCFA la carte du chef + 3 500 FCFA/pers. Couvrez une famille complète.' : 'Fayal ay njaboot yu bari.'}</p>
                </div>

                {/* Eleves */}
                <div 
                  className={`card text-center ${parrainageType === 'eleves' ? 'active-border' : ''}`}
                  onClick={() => setParrainageType('eleves')}
                  style={{ 
                    border: parrainageType === 'eleves' ? '2.5px solid var(--success)' : '1px solid var(--border-color)', 
                    backgroundColor: parrainageType === 'eleves' ? 'rgba(5, 150, 105, 0.05)' : 'var(--card-bg)',
                    transform: parrainageType === 'eleves' ? 'translateY(-4px)' : 'none',
                    boxShadow: parrainageType === 'eleves' ? '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' : 'var(--shadow-sm)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer', 
                    padding: '1.75rem 1.5rem',
                    borderRadius: '12px'
                  }}
                >
                  <div style={{ fontSize: '2.5rem' }}>🎓</div>
                  <h3 style={{ fontSize: '1.1rem', marginTop: '0.5rem', fontWeight: '700' }}>{lang === 'fr' ? 'Élèves / daara' : 'Élèves / daara'}</h3>
                  <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--success)', margin: '0.5rem 0' }}>1 000 FCFA <span style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>/ élève</span></div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{lang === 'fr' ? 'Tarif groupe subventionné par l\'État pour les écoles élémentaires et Daaras.' : 'Fay subventionné par État bi ngir daara yi ak écoles yi.'}</p>
                </div>

              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button className="btn btn-primary" onClick={nextStep}>{lang === 'fr' ? 'Continuer' : 'Kanaman'}</button>
              </div>
            </div>
          )}

          {/* Step 2: Mutuelle */}
          {regStep === 2 && (
            <div className="fade-in-up">
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: '800' }}>{lang === 'fr' ? '2. Sélectionnez la mutuelle de rattachement' : '2. Tannal mutuelle bi'}</h2>
              <p style={{ color: 'var(--text-sub)', marginBottom: '2rem' }}>{lang === 'fr' ? 'Les bénéficiaires parrainés seront rattachés à cette mutuelle communautaire locale.' : 'Fii lañuy rattaché ñi nga beug parrainer.'}</p>
              
              <div className="form-group" style={{ maxWidth: '500px', margin: '0 auto' }}>
                <label className="form-label">{lang === 'fr' ? 'Mutuelles Disponibles à Dakar' : 'Mutuelle yi nekk'}</label>
                <select 
                  className="form-control"
                  value={selectedMutuelle}
                  onChange={(e) => setSelectedMutuelle(e.target.value)}
                >
                  <option value="">-- {lang === 'fr' ? 'Sélectionner' : 'Tannal'} --</option>
                  {mutuellesList.map((m, i) => (
                    <option key={i} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem' }}>
                <button className="btn btn-outline" onClick={prevStep}>{lang === 'fr' ? 'Retour' : 'Delli'}</button>
                <button className="btn btn-primary" onClick={nextStep}>{lang === 'fr' ? 'Continuer' : 'Kanaman'}</button>
              </div>
            </div>
          )}

          {/* Step 3: Sponsor Civil Info */}
          {regStep === 3 && (
            <div className="fade-in-up">
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: '800' }}>{lang === 'fr' ? '3. Vos coordonnées en tant que parrain' : '3. Coordonnées parrain bi'}</h2>
              <p style={{ color: 'var(--text-sub)', marginBottom: '2rem' }}>{lang === 'fr' ? 'Veuillez saisir vos coordonnées civiles pour le suivi de votre dossier solidaire.' : 'Bindal sa tour, sa sant ak sa portable.'}</p>
              
              {parrainageType === 'eleves' && (
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label" style={{ fontWeight: 'bold' }}>{lang === 'fr' ? "Nom de l'établissement scolaire (école ou daara) cible" : "Tourou daara bi walla ecole bi"}</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="Ex: Daara Serigne Saliou Colobane, école élémentaire Grand-Dakar"
                    required
                  />
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{lang === 'fr' ? 'Prénom' : 'Tour'}</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{lang === 'fr' ? 'Nom' : 'Sant'}</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{lang === 'fr' ? 'Téléphone' : 'Portable'}</label>
                  <input 
                    type="tel" 
                    className="form-control" 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="Ex: 77 123 45 67"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{lang === 'fr' ? 'Adresse' : 'Dëkk'}</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="Ex: Fann Résidence, Dakar"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input 
                  type="email" 
                  className="form-control" 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="parrain@solidarite.sn"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem' }}>
                <button className="btn btn-outline" onClick={prevStep}>{lang === 'fr' ? 'Retour' : 'Delli'}</button>
                <button className="btn btn-primary" onClick={nextStep}>{lang === 'fr' ? 'Continuer' : 'Kanaman'}</button>
              </div>
            </div>
          )}

          {/* Step 4: Beneficiary solidary list */}
          {regStep === 4 && (
            <div className="fade-in-up">
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: '800' }}>
                {parrainageType === 'menages' ? (lang === 'fr' ? '4. Déclaration des ménages parrainés' : '4. Njaboot yi parrainer') :
                 parrainageType === 'eleves' ? (lang === 'fr' ? '4. Liste des élèves / talibés à inscrire' : '4. Mbindu élèves/talibés') :
                 (lang === 'fr' ? '4. Liste des filleuls à parrainer' : '4. Filleuls gnu parrainer')}
              </h2>
              <p style={{ color: 'var(--text-sub)', marginBottom: '2rem' }}>
                {parrainageType === 'menages' ? (lang === 'fr' ? 'Ajoutez les ménages/familles et listez leurs membres.' : 'Duggalal njaboot yi.') :
                 (lang === 'fr' ? 'Saisissez les informations nominatives des personnes bénéficiaires.' : 'Duggalal tourou gni nga beug fayal.')}
              </p>

              {parrainageType === 'menages' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary)' }}>
                      {lang === 'fr' ? `Ménages à parrainer (${sponsoredHouseholds.length})` : `Njaboot yi (${sponsoredHouseholds.length})`}
                    </h4>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSponsoredHouseholds([...sponsoredHouseholds, { id: Date.now() + Math.random(), chefName: '', chefPhone: '', members: [] }])}
                    >
                      {lang === 'fr' ? '+ Ajouter un ménage' : '+ Dolli njaboot'}
                    </button>
                  </div>

                  {sponsoredHouseholds.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2.5rem 1.5rem', border: '2px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-sub)' }}>
                      {lang === 'fr' ? 'Aucun ménage ajouté. Cliquez sur le bouton ci-dessus pour ajouter un ménage à parrainer.' : 'Amul njaboot bu bokk. Bësal butoŋ bi ngir dolli.'}
                    </div>
                  ) : (
                    sponsoredHouseholds.map((hh, hhIdx) => (
                      <div key={hh.id} className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem', border: '1px solid var(--border-color)', position: 'relative', background: 'var(--bg-card-subtle)' }}>
                        <button 
                          className="btn-text" 
                          style={{ position: 'absolute', top: '1rem', right: '1rem', color: 'var(--danger)', fontWeight: 'bold' }}
                          onClick={() => setSponsoredHouseholds(sponsoredHouseholds.filter((_, idx) => idx !== hhIdx))}
                        >
                          {lang === 'fr' ? 'Retirer ce ménage' : 'Dindi njaboot bi'}
                        </button>

                        <h5 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem', fontWeight: 'bold' }}>
                          {lang === 'fr' ? `Ménage #${hhIdx + 1}` : `Njaboot #${hhIdx + 1}`}
                        </h5>

                        <div className="form-row" style={{ marginBottom: '1rem' }}>
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.85rem' }}>{lang === 'fr' ? 'Prénom & nom du chef de ménage' : 'Tour ak santou chef'}</label>
                            <input 
                              type="text" 
                              className="form-control form-control-sm"
                              value={hh.chefName}
                              onChange={(e) => {
                                const updated = [...sponsoredHouseholds];
                                updated[hhIdx].chefName = e.target.value;
                                setSponsoredHouseholds(updated);
                              }}
                              placeholder="Ex: Moussa Ndiaye"
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.85rem' }}>{lang === 'fr' ? 'Téléphone du chef' : 'Portablou chef bi'}</label>
                            <input 
                              type="tel" 
                              className="form-control form-control-sm"
                              value={hh.chefPhone}
                              onChange={(e) => {
                                const updated = [...sponsoredHouseholds];
                                updated[hhIdx].chefPhone = e.target.value;
                                setSponsoredHouseholds(updated);
                              }}
                              placeholder="Ex: 77 987 65 43"
                              required
                            />
                          </div>
                        </div>

                        {/* Members section */}
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
                          <label className="form-label" style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>
                            {lang === 'fr' ? `Membres rattachés au ménage (${hh.members.length})` : `Bokk yi (${hh.members.length})`}
                          </label>

                          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                            <input 
                              type="text" 
                              id={`hh-${hhIdx}-name`}
                              className="form-control form-control-sm" 
                              style={{ flex: '2', minWidth: '150px' }} 
                              placeholder={lang === 'fr' ? 'Prénom & Nom' : 'Tour ak Sant'} 
                            />
                            <select 
                              id={`hh-${hhIdx}-relation`}
                              className="form-control form-control-sm" 
                              style={{ flex: '1', minWidth: '100px' }}
                            >
                              <option value="enfant">{lang === 'fr' ? 'Enfant' : 'Doom'}</option>
                              <option value="conjoint">{lang === 'fr' ? 'Conjoint' : 'Jëkër/Jabar'}</option>
                              <option value="parent">{lang === 'fr' ? 'Parent' : 'Waajur'}</option>
                            </select>
                            <input 
                              type="number" 
                              id={`hh-${hhIdx}-age`}
                              className="form-control form-control-sm" 
                              style={{ flex: '1', minWidth: '70px' }} 
                              placeholder={lang === 'fr' ? 'Âge' : 'At'} 
                            />
                            <button 
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                const nameEl = document.getElementById(`hh-${hhIdx}-name`);
                                const relationEl = document.getElementById(`hh-${hhIdx}-relation`);
                                const ageEl = document.getElementById(`hh-${hhIdx}-age`);
                                if (nameEl.value && ageEl.value) {
                                  const updated = [...sponsoredHouseholds];
                                  updated[hhIdx].members.push({
                                    name: nameEl.value,
                                    relation: relationEl.value,
                                    age: ageEl.value
                                  });
                                  setSponsoredHouseholds(updated);
                                  nameEl.value = '';
                                  relationEl.value = 'enfant';
                                  ageEl.value = '';
                                } else {
                                  showError(lang === 'fr' ? 'Veuillez renseigner le nom et l\'âge.' : 'Bindal tour bi ak at mi.');
                                }
                              }}
                            >
                              +
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {hh.members.map((m, mIdx) => (
                              <div key={mIdx} className="governance-item" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <strong>{m.name}</strong> ({m.relation}) - {m.age} ans
                                </div>
                                <button 
                                  className="btn-text" 
                                  style={{ color: 'var(--danger)', fontSize: '0.8rem' }}
                                  onClick={() => {
                                    const updated = [...sponsoredHouseholds];
                                    updated[hhIdx].members = updated[hhIdx].members.filter((_, idx) => idx !== mIdx);
                                    setSponsoredHouseholds(updated);
                                  }}
                                >
                                  {lang === 'fr' ? 'Retirer' : 'Dindi'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div>
                  {/* Dynamic inputs for Filleuls / Students */}
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <input 
                      type="text" 
                      className="form-control" 
                      style={{ flex: '2' }} 
                      placeholder={
                        parrainageType === 'eleves' 
                          ? (lang === 'fr' ? 'Prénom & nom de l\'élève' : 'Tour ak santou élève')
                          : (lang === 'fr' ? 'Prénom & nom du filleul' : 'Tour ak santou filleul')
                      }
                      value={newFamilyMember.name}
                      onChange={(e) => setNewFamilyMember({...newFamilyMember, name: e.target.value})}
                    />
                    
                    {parrainageType === 'eleves' ? (
                      <input 
                        type="text"
                        className="form-control"
                        style={{ flex: '1' }}
                        placeholder={lang === 'fr' ? 'Classe / niveau' : 'Classe'}
                        value={newFamilyMember.relation}
                        onChange={(e) => setNewFamilyMember({...newFamilyMember, relation: e.target.value})}
                      />
                    ) : (
                      <select 
                        className="form-control" 
                        style={{ flex: '1' }}
                        value={newFamilyMember.relation}
                        onChange={(e) => setNewFamilyMember({...newFamilyMember, relation: e.target.value})}
                      >
                        <option value="">-- {lang === 'fr' ? 'Relation' : 'Relation'} --</option>
                        <option value="enfant">{lang === 'fr' ? 'Enfant' : 'Doom'}</option>
                        <option value="parent">{lang === 'fr' ? 'Proche' : 'Filleul'}</option>
                        <option value="autre">{lang === 'fr' ? 'Autre' : 'Autre'}</option>
                      </select>
                    )}

                    <input 
                      type="number" 
                      className="form-control" 
                      style={{ flex: '1' }} 
                      placeholder={lang === 'fr' ? 'Âge' : 'At'}
                      value={newFamilyMember.age}
                      onChange={(e) => setNewFamilyMember({...newFamilyMember, age: e.target.value})}
                    />
                    <button className="btn btn-secondary btn-sm" onClick={addFamilyMember}>{lang === 'fr' ? 'Ajouter' : 'Dolli'}</button>
                  </div>

                  {/* List of family members */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {familyMembers.map((m, i) => (
                      <div key={i} className="governance-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{m.name}</strong> 
                          {parrainageType === 'eleves' ? ` (Élève - Classe: ${m.relation})` : ` (Filleul ${m.relation ? `- ${m.relation}` : ''})`}
                          {` - ${m.age} ans`}
                        </div>
                        <button className="btn-text" style={{ color: 'var(--danger)' }} onClick={() => removeFamilyMember(i)}>{lang === 'fr' ? 'Retirer' : 'Dindi'}</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem' }}>
                <button className="btn btn-outline" onClick={prevStep}>{lang === 'fr' ? 'Retour' : 'Delli'}</button>
                <button className="btn btn-primary" onClick={nextStep}>{lang === 'fr' ? 'Continuer' : 'Kanaman'}</button>
              </div>
            </div>
          )}

          {/* Step 5: Verification & Payment */}
          {regStep === 5 && (
            <div className="fade-in-up">
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: '800' }}>{lang === 'fr' ? '5. Récapitulatif & paiement sécurisé' : '5. Saytu & Fay'}</h2>
              <p style={{ color: 'var(--text-sub)', marginBottom: '2rem' }}>{lang === 'fr' ? 'Veuillez vérifier les informations de votre parrainage avant de procéder au règlement Wave / Orange Money.' : 'Saytul lépp li nga bind avant nga fay.'}</p>
              
              <div className="grid grid-2" style={{ gap: '1.5rem', textAlign: 'left', marginBottom: '2rem' }}>
                
                {/* Info Card */}
                <div style={{ border: '1px solid var(--border-color)', padding: '1.25rem', borderRadius: '12px', background: 'var(--card-bg-subtle, #f8fafc)' }}>
                  <h4 style={{ marginTop: 0, fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>{lang === 'fr' ? 'Détails du dossier' : 'Détails dossier'}</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem', marginTop: '0.75rem' }}>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Sponsor / Parrain</span>
                      <div style={{ fontWeight: 'bold' }}>{formData.firstName} {formData.lastName} ({formData.phone})</div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Mutuelle Cible</span>
                      <div style={{ fontWeight: 'bold' }}>{selectedMutuelle}</div>
                    </div>
                    {schoolName && parrainageType === 'eleves' && (
                      <div>
                        <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Établissement scolaire</span>
                        <div style={{ fontWeight: 'bold' }}>{schoolName}</div>
                      </div>
                    )}
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Type de Parrainage</span>
                      <div style={{ fontWeight: 'bold' }}>
                        {parrainageType === 'menages' ? 'Ménages / familles 🤝' :
                         parrainageType === 'eleves' ? 'Élèves scolaires (écoles/daaras) 🎓' :
                         'Filleuls individuels 👤'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Beneficiaries summary */}
                <div style={{ border: '1px solid var(--border-color)', padding: '1.25rem', borderRadius: '12px', background: 'var(--card-bg-subtle, #f8fafc)' }}>
                  <h4 style={{ marginTop: 0, fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    {parrainageType === 'menages' ? `Ménages (${sponsoredHouseholds.length})` : `Bénéficiaires (${familyMembers.length})`}
                  </h4>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                    {parrainageType === 'menages' ? (
                      sponsoredHouseholds.map((hh, idx) => (
                        <div key={idx} style={{ marginBottom: '0.5rem', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
                          <strong>Chef: {hh.chefName}</strong> ({hh.chefPhone})
                          {hh.members.length > 0 && (
                            <div style={{ color: 'var(--text-sub)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                              Membres: {hh.members.map(m => m.name).join(', ')}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                        {familyMembers.map((m, idx) => (
                          <li key={idx} style={{ marginBottom: '0.25rem' }}>
                            {m.name} {parrainageType === 'eleves' ? `(Classe: ${m.relation})` : `(Age: ${m.age} ans)`}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

              </div>

              {/* Cost breakdown banner */}
              <div className="card" style={{ borderLeft: '4px solid var(--secondary)', background: 'rgba(244, 63, 94, 0.05)', padding: '1.25rem', textAlign: 'left', marginBottom: '2rem' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Montant total à régler</span>
                <div style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--secondary)', margin: '0.25rem 0' }}>
                  {calculateTotalCost().toLocaleString('fr-FR')} FCFA
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                  {parrainageType === 'menages' && `Détail : ${sponsoredHouseholds.length} ménage(s) [1 000 FCFA carte + 3 500 FCFA/pers. par ménage]`}
                  {parrainageType === 'eleves' && `Détail : ${familyMembers.length} élève(s) × 1 000 FCFA (tarif subventionné)`}
                  {parrainageType === 'individuel' && `Détail : ${familyMembers.length} filleul(s) × 4 500 FCFA (1 000 carte + 3 500 cotisation)`}
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', backgroundColor: 'var(--card-bg-subtle, #f8fafc)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
                <input 
                  type="checkbox" 
                  id="gdpr-consent" 
                  checked={gdprConsent} 
                  onChange={(e) => setGdprConsent(e.target.checked)} 
                  style={{ marginTop: '0.25rem', transform: 'scale(1.2)', cursor: 'pointer' }} 
                />
                <label htmlFor="gdpr-consent" style={{ fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: '1.4', cursor: 'pointer' }}>
                  J'accepte que les données civiles des bénéficiaires soient enregistrées conformément aux normes de protection des données (RGPD) dans le cadre du régime de couverture maladie universelle au Sénégal.
                </label>
              </div>

              {/* Payment Methods Selection */}
              <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginBottom: '2rem' }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                  <input 
                    type="radio" 
                    name="pay" 
                    value="wave" 
                    checked={paymentMethod === 'wave'} 
                    onChange={() => setPaymentMethod('wave')}
                  />
                  Wave 🌊
                </label>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                  <input 
                    type="radio" 
                    name="pay" 
                    value="om" 
                    checked={paymentMethod === 'om'} 
                    onChange={() => setPaymentMethod('om')}
                  />
                  Orange Money 🍊
                </label>
              </div>

              {/* Trigger transaction */}
              {!otpSent ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <div className="form-group" style={{ width: '100%', maxWidth: '300px' }}>
                    <label className="form-label text-center">{lang === 'fr' ? 'Saisir votre numéro de téléphone de paiement' : 'Duggalal sa portable'}</label>
                    <input 
                      type="tel" 
                      className="form-control text-center" 
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-outline" onClick={prevStep}>{lang === 'fr' ? 'Retour' : 'Delli'}</button>
                    <button className="btn btn-secondary" onClick={triggerOtp} disabled={!gdprConsent}>{lang === 'fr' ? 'Lancer la transaction' : 'Fay ko tey'}</button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handlePayment} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                  <p style={{ color: 'var(--secondary)', fontWeight: '600' }}>
                    {lang === 'fr' ? 'Saisissez le code OTP de validation reçu sur votre portable.' : 'Bindal code OTP bi ngir fay.'}
                  </p>

                  <div className="payment-screen-mock">
                    <div className="payment-screen-mock-pattern"></div>
                    <div className="payment-screen-header">
                      {paymentMethod === 'wave' ? 'WAVE PAY' : 'ORANGE MONEY'}
                    </div>
                    <div style={{ fontSize: '0.75rem', marginBottom: '1.5rem', color: '#94a3b8' }}>
                      Montant : {calculateTotalCost().toLocaleString('fr-FR')} FCFA
                    </div>
                    <input 
                      type="text" 
                      className="payment-otp-field" 
                      maxLength="4" 
                      placeholder="••••"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ marginTop: '0.25rem', padding: '0.75rem', background: 'var(--card-bg-subtle, #f8fafc)', borderRadius: '12px', fontSize: '0.75rem', color: 'var(--text-sub)', border: '1px dashed var(--border-color)', width: '100%', maxWidth: '280px', textAlign: 'center' }}>
                    💡 {lang === 'fr' ? 'Indice démo : Saisissez le code OTP 7842' : 'Indice démo : Bindal code OTP 7842'}
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setOtpSent(false)}>{lang === 'fr' ? 'Annuler' : 'Dindi'}</button>
                    <button type="submit" className="btn btn-secondary btn-sm">{lang === 'fr' ? 'Valider le paiement' : 'Valider'}</button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Step 6: Receipt & Success */}
          {regStep === 6 && (
            <div className="fade-in-up text-center">
              <div style={{ fontSize: '4.5rem', color: 'var(--success)', marginBottom: '1rem' }}>🎉</div>
              <h2 style={{ fontSize: '1.75rem', color: 'var(--success)', marginBottom: '0.5rem', fontWeight: '800' }}>
                {lang === 'fr' ? 'Merci pour votre générosité !' : 'Jërëjëf ci sa maye !'}
              </h2>
              <p style={{ color: 'var(--text-sub)', marginBottom: '2rem' }}>
                {lang === 'fr' ? 'Votre parrainage a été validé avec succès. Les dossiers des bénéficiaires sont transmis à la mutuelle pour traitement.' : 'Parrainage bi soti na ! Mutuelle bi dina saytu dossiers yi legui.'}
              </p>

              {/* Solidary card mock */}
              <div className="digital-health-card" style={{ margin: '0 auto 2rem auto' }}>
                <div className="digital-card-pattern"></div>
                <div className="digital-card-logo">
                  <span style={{ fontWeight: '800', fontSize: '1.1rem', letterSpacing: '1px' }}>MUTUALIS DAKAR</span>
                  <div className="digital-card-chip"></div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="digital-card-label">{lang === 'fr' ? 'Parrain / Sponsor' : 'Parrain / Sponsor'}</div>
                    <div className="digital-card-value" style={{ fontSize: '1.1rem' }}>{formData.firstName} {formData.lastName}</div>
                    
                    <div className="digital-card-label" style={{ marginTop: '0.75rem' }}>
                      {parrainageType === 'menages' ? `${lang === 'fr' ? 'Ménages parrainés' : 'Njaboot'}` : `${lang === 'fr' ? 'Bénéficiaires parrainés' : 'Filleuls'}`}
                    </div>
                    <div className="digital-card-value">
                      {parrainageType === 'menages' ? `${sponsoredHouseholds.length} ménages` : `${familyMembers.length} personnes`}
                    </div>
                  </div>

                  {/* QR code */}
                  <div className="digital-card-qr" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '4px', borderRadius: '6px', width: '74px', height: '74px' }}>
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="QR Code CMU" style={{ width: '100%', height: '100%', borderRadius: '4px' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', backgroundColor: '#fff' }} />
                    )}
                  </div>
                </div>

                <div className="digital-card-details">
                  <div>
                    <div className="digital-card-label">ID Sponsoring</div>
                    <div className="digital-card-value">{generatedCmuNumber || 'SN-DK-SPN-1001'}</div>
                  </div>
                  <div>
                    <div className="digital-card-label">Mutuelle</div>
                    <div className="digital-card-value">{selectedMutuelle}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <button 
                  className="btn btn-outline" 
                  onClick={() => {
                    setRegStep(1);
                    setOtpSent(false);
                    setOtpCode('');
                    setPaymentSuccess(false);
                    setGeneratedCmuNumber('');
                    setQrCodeUrl('');
                    setFamilyMembers([]);
                    setSponsoredHouseholds([]);
                    setSchoolName('');
                  }}
                >
                  {lang === 'fr' ? 'Nouveau parrainage' : 'Dolli parrainage'}
                </button>
                <button 
                  className={`btn ${syncStatus === 'success' ? 'btn-outline' : 'btn-primary'}`}
                  onClick={handleSync}
                  disabled={syncStatus === 'loading'}
                >
                  {syncStatus === 'idle' && (lang === 'fr' ? 'Synchroniser cartes' : 'Sync cartes')}
                  {syncStatus === 'loading' && (lang === 'fr' ? 'Synchronisation...' : 'Sync...')}
                  {syncStatus === 'success' && (lang === 'fr' ? '✓ Cartes synchronisées' : '✓ Sync !')}
                </button>
                <button className="btn btn-secondary" onClick={handleDownloadReceipt}>
                  {lang === 'fr' ? 'Télécharger le reçu (PDF)' : 'Yóbbu reçu bi'}
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
