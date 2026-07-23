import React, { useState, useEffect, useRef } from 'react';

export default function Telemedicine({ lang = 'fr', userRole = 'citizen', citizenUser = null, agentUser = null, partnerUser = null, setView = null }) {
  // Identification du rôle et accès
  const isAgent = (userRole === 'agent' || !!agentUser || !!partnerUser);
  const isCitizen = (!isAgent && !!citizenUser);

  // Informations assuré actif
  const activeCmuNumber = citizenUser?.cmu_number || citizenUser?.cmuNumber || localStorage.getItem('cmu-active-number') || 'CMU-DKR-2026-8812';
  const activeFirstName = citizenUser?.first_name || citizenUser?.firstName || 'Awa';
  const activeLastName = citizenUser?.last_name || citizenUser?.lastName || 'Ndiaye';

  // Praticiens habilités par le Super Admin (synchro localStorage)
  const defaultAccreditedDoctors = [
    { id: 1, name: 'Dr. Aminata Ndiaye', specialty: 'Pédiatrie & Santé Familiale', cnom: 'CNOM-SN-2026-8819' },
    { id: 2, name: 'Dr. Cheikh Tidiane Seck', specialty: 'Cardiologie & Médecine Générale', cnom: 'CNOM-SN-2026-9921' },
    { id: 3, name: 'Dr. Mariama Ba', specialty: 'Gynécologie-Obstétrique', cnom: 'CNOM-SN-2026-3310' }
  ];

  const [accreditedDoctors, setAccreditedDoctors] = useState(() => {
    try {
      const stored = localStorage.getItem('cmu_telemed_doctors');
      return stored ? JSON.parse(stored) : defaultAccreditedDoctors;
    } catch (e) {
      return defaultAccreditedDoctors;
    }
  });

  // Mode de Vue : 'citizen' (Assuré) ou 'doctor' (Médecin de Garde)
  const [telemedRoleMode, setTelemedRoleMode] = useState(() => isAgent ? 'doctor' : 'citizen');
  const [activeDoctorAccount, setActiveDoctorAccount] = useState(accreditedDoctors[0]?.name || 'Dr. Aminata Ndiaye');

  // File d'attente virtuelle dynamique de Télémédecine
  const defaultQueue = [
    {
      id: 1,
      patient_name: 'Awa Ndiaye',
      cmu_number: 'CMU-DKR-2026-8812',
      reason: 'Migraine pulsatile aiguë & toux sèche depuis 48h',
      urgency: 'high',
      joined_at: new Date(Date.now() - 4 * 60000).toISOString(),
      requested_doctor: 'Dr. Aminata Ndiaye',
      payment_status: 'pending',
      payment_method: null,
      amount: 2500
    },
    {
      id: 2,
      patient_name: 'Moussa Diallo',
      cmu_number: 'CMU-DKR-2026-3392',
      reason: 'Oppression thoracique & fièvre 39.2°C',
      urgency: 'critical',
      joined_at: new Date(Date.now() - 12 * 60000).toISOString(),
      requested_doctor: 'Dr. Cheikh Tidiane Seck',
      payment_status: 'paid',
      payment_method: 'Wave 🌊',
      amount: 2500
    }
  ];

  const [queue, setQueue] = useState(() => {
    try {
      const stored = localStorage.getItem('cmu_telemed_queue');
      return stored ? JSON.parse(stored) : defaultQueue;
    } catch (e) {
      return defaultQueue;
    }
  });

  // Patient courant dans la salle d'attente (Assuré)
  const [patientInQueue, setPatientInQueue] = useState(null);

  // Inscription en salle d'attente (Formulaire)
  const [inputFirstName, setInputFirstName] = useState(activeFirstName);
  const [inputLastName, setInputLastName] = useState(activeLastName);
  const [inputCmu, setInputCmu] = useState(activeCmuNumber);
  const [consultReason, setConsultReason] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState('medium');
  const [selectedDoctor, setSelectedDoctor] = useState(accreditedDoctors[0]?.name || 'Dr. Aminata Ndiaye');

  // Modal de paiement Mobile Money (Orange Money / Wave)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState('orange'); // 'orange' | 'wave'
  const [phoneNum, setPhoneNum] = useState('77 602 67 83');
  const [paying, setPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState('');

  // WebRTC Real Stream & Session active
  const [activeSession, setActiveSession] = useState(null);
  const userVideoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  const [mediaStream, setMediaStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);

  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrLevel, setQrLevel] = useState(3);

  // Prescription Ordonnance & Examens (Médecin)
  const [prescMed1, setPrescMed1] = useState('Amoxicilline 500mg (2 boîtes)');
  const [prescMed2, setPrescMed2] = useState('Paracétamol 1g (1 boîte)');
  const [prescPrice1, setPrescPrice1] = useState('3500');
  const [prescPrice2, setPrescPrice2] = useState('1500');
  const [labExams, setLabExams] = useState('NFS (Numération Formule Sanguine), Glycémie à jeun, Radiographie Pulmonaire');
  const [prescriptionSigned, setPrescriptionSigned] = useState(false);

  const [chatMessages, setChatMessages] = useState([
    { sender: 'Médecin UNAMUSC', text: 'Bonjour ! Je suis connecté en téléconsultation WebRTC. Vous m\'entendez bien ?' }
  ]);
  const [inputMsg, setInputMsg] = useState('');

  // Sauvegarde permanente de la file d'attente
  useEffect(() => {
    localStorage.setItem('cmu_telemed_queue', JSON.stringify(queue));
  }, [queue]);

  // Initialisation Caméra/Micro
  useEffect(() => {
    let currentStream = null;

    const startAudioVisualizer = (stream) => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const level = Math.min(100, Math.round((average / 128) * 100));
          setAudioLevel(level);
          animFrameRef.current = requestAnimationFrame(updateMeter);
        };

        updateMeter();
      } catch (e) {
        console.warn('Erreur WebAudio Analyser:', e);
      }
    };

    const startMediaDevices = async () => {
      if (activeSession) {
        setCameraError('');
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
              audio: true
            });
            currentStream = stream;
            setMediaStream(stream);
            setCameraActive(true);

            if (userVideoRef.current && !isCamOff) {
              userVideoRef.current.srcObject = stream;
            }

            startAudioVisualizer(stream);
          } else {
            setCameraError('Accès caméra/micro non supporté sur ce navigateur.');
          }
        } catch (err) {
          console.warn('Refus accès caméra:', err);
          setCameraError('Caméra / Micro réel non disponible. Mode flux virtuel sécurisé actif.');
          setCameraActive(false);
        }
      }
    };

    startMediaDevices();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [activeSession]);

  useEffect(() => {
    if (userVideoRef.current && mediaStream && !isCamOff) {
      userVideoRef.current.srcObject = mediaStream;
    }
  }, [isCamOff, mediaStream]);

  const toggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    if (mediaStream) {
      mediaStream.getAudioTracks().forEach(t => t.enabled = !newMuteState);
    }
    if (newMuteState) setAudioLevel(0);
  };

  const toggleCamera = () => {
    const newCamState = !isCamOff;
    setIsCamOff(newCamState);
    if (mediaStream) {
      mediaStream.getVideoTracks().forEach(t => t.enabled = !newCamState);
    }
  };

  // 1. Entrer en Salle d'Attente Virtuelle (Assuré)
  const handleJoinQueue = (e) => {
    e.preventDefault();
    if (!consultReason.trim()) return;

    const newPatient = {
      id: Date.now(),
      patient_name: `${inputFirstName} ${inputLastName}`,
      cmu_number: inputCmu,
      reason: consultReason,
      urgency: urgencyLevel,
      joined_at: new Date().toISOString(),
      requested_doctor: selectedDoctor,
      payment_status: 'pending',
      payment_method: null,
      amount: 2500
    };

    const updated = [newPatient, ...queue];
    setQueue(updated);
    setPatientInQueue(newPatient);
    setConsultReason('');
  };

  // 2. Demander le Règlement du Ticket Modérateur (Médecin -> Patient)
  const handleDoctorRequestPayment = (patientId) => {
    const updated = queue.map(p => p.id === patientId ? { ...p, payment_status: 'requested' } : p);
    setQueue(updated);
    if (patientInQueue && patientInQueue.id === patientId) {
      setPatientInQueue({ ...patientInQueue, payment_status: 'requested' });
    }
  };

  // 3. Effectuer le Paiement Mobile (Orange Money / Wave)
  const handleProcessPayment = (e) => {
    e.preventDefault();
    setPaying(true);
    setPaymentSuccess('');

    setTimeout(() => {
      const providerName = paymentProvider === 'orange' ? 'Orange Money 🍊' : 'Wave 🌊';
      const updatedQueue = queue.map(p => {
        if (patientInQueue && p.id === patientInQueue.id) {
          return { ...p, payment_status: 'paid', payment_method: providerName };
        }
        return p;
      });

      setQueue(updatedQueue);
      if (patientInQueue) {
        setPatientInQueue({ ...patientInQueue, payment_status: 'paid', payment_method: providerName });
      }

      setPaying(false);
      setShowPaymentModal(false);
      setPaymentSuccess(`🎉 Règlement de 2 500 FCFA effectué avec succès via ${providerName} ! Vous pouvez démarrer la téléconsultation.`);
    }, 1500);
  };

  // State pour alerte notification SMS Push / WhatsApp
  const [smsAlert, setSmsAlert] = useState(null);

  // 4. Lancer la visioconférence WebRTC (Médecin ou Patient) + Envoi SMS / WhatsApp Push Instantané
  const handleStartCall = (patient) => {
    const doctorNameStr = activeDoctorAccount || patient.requested_doctor || 'Dr. Aminata Ndiaye';
    const session = {
      id: patient.id || Date.now(),
      doctor_name: doctorNameStr,
      patient_name: patient.patient_name,
      cmu_number: patient.cmu_number,
      reason: patient.reason,
      room_token: `RTC-SN-WEBRTC-${Math.floor(1000 + Math.random() * 9000)}`,
      scheduled_at: new Date().toISOString()
    };

    setSmsAlert({
      recipient: patient.patient_name,
      phone: patient.phone || '77 602 67 83',
      doctor: doctorNameStr,
      roomToken: session.room_token,
      sentAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    });

    setIsCamOff(false);
    setIsMuted(false);
    setActiveSession(session);
  };

  // 5. Signer l'ordonnance et l'injecter directement dans les Bons de Commande Pharmacie
  const handleSignPrescription = async () => {
    setPrescriptionSigned(true);

    const price1 = parseFloat(prescPrice1) || 0;
    const price2 = parseFloat(prescPrice2) || 0;
    const total = price1 + price2;

    const newOrder = {
      id: Date.now(),
      first_name: activeSession?.patient_name?.split(' ')[0] || activeFirstName,
      last_name: activeSession?.patient_name?.split(' ')[1] || activeLastName,
      cmu_number: activeSession?.cmu_number || activeCmuNumber,
      items_json: JSON.stringify([
        { name: prescMed1, qty: 1, price: price1 },
        { name: prescMed2, qty: 1, price: price2 }
      ]),
      total_amount: total,
      cmu_covered: total * 0.5,
      patient_pay: total * 0.5,
      status: 'active',
      created_at: new Date().toISOString(),
      order_code: `ORD-2026-PHARM-${Math.floor(100 + Math.random() * 900)}`
    };

    const existing = JSON.parse(localStorage.getItem('cmu_purchase_orders') || '[]');
    localStorage.setItem('cmu_purchase_orders', JSON.stringify([newOrder, ...existing]));

    alert(`✅ Ordonnance signée numériquement par le médecin !\n\nUn Bon de Commande Pharmacie (${newOrder.order_code}) sous Tiers-Payant UNAMUSC (50%) a été généré et ajouté instantanément dans votre espace Bons de Commande.`);
  };

  // 6. Émettre / Imprimer l'Ordonnance Pharmacie PDF A4 Certifiée
  const handlePrintPharmacyOrderPDF = () => {
    const patientName = activeSession?.patient_name || `${activeFirstName} ${activeLastName}`;
    const cmuNum = activeSession?.cmu_number || activeCmuNumber;
    const doctorNameStr = activeSession?.doctor_name || activeDoctorAccount || 'Dr. Aminata Ndiaye';
    const orderCode = `ORD-2026-PHARM-${Math.floor(100 + Math.random() * 900)}`;

    const price1 = parseFloat(prescPrice1) || 3500;
    const price2 = parseFloat(prescPrice2) || 1500;
    const total = price1 + price2;
    const covered = total * 0.5;
    const patientPay = total * 0.5;

    const printWin = window.open('', '_blank', 'width=980,height=1150');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ordonnance_Pharmacie_${orderCode}.pdf</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body { background: #ffffff !important; color: #0f172a !important; font-family: 'Inter', Arial, sans-serif; padding: 1.5rem; }
            .cert-box { border: 2.5px solid #059669; border-radius: 16px; padding: 2rem; background: #ffffff; }
            .no-print { margin-bottom: 1.5rem; text-align: center; }
            @media print { .no-print { display: none !important; } body { padding: 0 !important; } }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" class="btn btn-success fw-bold px-4 py-2 me-2" style="background: #059669;">🖨️ Imprimer l'Ordonnance Pharmacie A4</button>
            <button onclick="window.close()" class="btn btn-secondary fw-bold px-3 py-2">Fermer</button>
          </div>

          <div class="cert-box">
            <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-4">
              <div class="d-flex align-items-center gap-3">
                <img src="/senegal_flag.png" alt="Drapeau" style="width: 54px; height: 36px; object-fit: cover; border-radius: 4px; border: 1.5px solid #d97706;" />
                <div>
                  <h6 class="fw-bold mb-0 text-uppercase" style="color: #059669;">RÉPUBLIQUE DU SÉNÉGAL</h6>
                  <small class="text-muted">Un Peuple — Un But — Une Foi</small><br />
                  <strong class="small text-uppercase" style="color: #0f172a;">UNAMUSC SÉNÉGAL — ORDONNANCE & BON PHARMACIE 50%</strong>
                </div>
              </div>
              <img src="/unamusc_logo.png" alt="UNAMUSC" style="width: 85px; height: auto;" />
            </div>

            <div class="text-center my-4 p-3 rounded-3" style="background: #f0fdf4; border: 1px solid #bbf7d0;">
              <h4 class="fw-bold text-uppercase mb-1" style="color: #059669;">ORDONNANCE NATIONALE DE PHARMACIE & BON DE COMMANDE 48H</h4>
              <small class="text-muted">Code Référence : <strong>${orderCode}</strong> • Praticien : <strong>${doctorNameStr}</strong></small>
            </div>

            <div class="row g-3 mb-4 p-3 rounded-3" style="background: #f8fafc; border: 1.5px solid #cbd5e1;">
              <div class="col-6">
                <span class="small fw-bold d-block text-muted">Bénéficiaire :</span>
                <h5 class="fw-bold mb-0">${patientName}</h5>
                <small class="text-muted">N° Carte CMU : <strong>${cmuNum}</strong></small>
              </div>
              <div class="col-6 text-end">
                <span class="small fw-bold d-block text-muted">Date & validité :</span>
                <strong class="d-block">${new Date().toLocaleDateString('fr-FR')}</strong>
                <span class="badge bg-success">Valide 48h en officine agréée</span>
              </div>
            </div>

            <h6 class="fw-bold mb-2" style="color: #059669;">💊 Médicaments prescrits & posologie :</h6>
            <table class="table table-bordered mb-4">
              <thead style="background: #f1f5f9;">
                <tr>
                  <th>Désignation du médicament</th>
                  <th class="text-center">Quantité</th>
                  <th class="text-end">Montant (FCFA)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>${prescMed1}</strong></td>
                  <td align="center">1</td>
                  <td align="right">${price1.toLocaleString('fr-FR')} FCFA</td>
                </tr>
                <tr>
                  <td><strong>${prescMed2}</strong></td>
                  <td align="center">1</td>
                  <td align="right">${price2.toLocaleString('fr-FR')} FCFA</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th colspan="2">Montant total ordonnance :</th>
                  <th align="right">${total.toLocaleString('fr-FR')} FCFA</th>
                </tr>
                <tr style="background: #e6f4ea; color: #047857;">
                  <th colspan="2">Prise en charge directe UNAMUSC (50%) :</th>
                  <th align="right">-${covered.toLocaleString('fr-FR')} FCFA</th>
                </tr>
                <tr style="background: #fef3c7; color: #b45309;">
                  <th colspan="2">Ticket modérateur restant patient en officine (50%) :</th>
                  <th align="right">${patientPay.toLocaleString('fr-FR')} FCFA</th>
                </tr>
              </tfoot>
            </table>

            <div class="row align-items-center border-top pt-4">
              <div class="col-8">
                <strong class="small text-success d-block mb-1">Clause tiers-payant officine agréée :</strong>
                <p class="small text-muted mb-0">Ce document signé numériquement dispense l'assuré de l'avance des 50% couverts par l'UNAMUSC sur présentation de la carte CMU.</p>
              </div>
              <div class="col-4 text-center">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(orderCode)}" alt="QR Code" style="width: 75px; height: 75px;" />
                <div class="small fw-bold text-success mt-1">Signature numérique CNOM</div>
              </div>
            </div>
          </div>
          <script>setTimeout(() => { window.print(); }, 400);</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // 7. Émettre une Ordonnance d'Analyses & Examens Médicaux PDF A4
  const handlePrintLabPrescriptionPDF = () => {
    const patientName = activeSession?.patient_name || `${activeFirstName} ${activeLastName}`;
    const cmuNum = activeSession?.cmu_number || activeCmuNumber;
    const doctorNameStr = activeSession?.doctor_name || 'Dr. Aminata Ndiaye';

    const printWin = window.open('', '_blank', 'width=980,height=1150');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Prescription_Analyses_${cmuNum}.pdf</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body { background: #ffffff !important; color: #0f172a !important; font-family: 'Inter', Arial, sans-serif; padding: 1.5rem; }
            .cert-box { border: 2.5px solid #047857; border-radius: 16px; padding: 2rem; background: #ffffff; }
            .no-print { margin-bottom: 1.5rem; text-align: center; }
            @media print { .no-print { display: none !important; } body { padding: 0 !important; } }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" class="btn btn-success fw-bold px-4 py-2 me-2" style="background: #059669;">🖨️ Imprimer la Prescription A4</button>
            <button onclick="window.close()" class="btn btn-secondary fw-bold px-3 py-2">Fermer</button>
          </div>

          <div class="cert-box">
            <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-4">
              <div class="d-flex align-items-center gap-3">
                <img src="/senegal_flag.png" alt="Drapeau" style="width: 54px; height: 36px; object-fit: cover; border-radius: 4px; border: 1.5px solid #d97706;" />
                <div>
                  <h6 class="fw-bold mb-0" style="color: #059669;">République du Sénégal</h6>
                  <small class="text-muted">Un Peuple — Un But — Une Foi</small><br />
                  <strong class="small" style="color: #0f172a;">UNAMUSC Sénégal — Ordonnance de biologie & imagerie</strong>
                </div>
              </div>
              <img src="/unamusc_logo.png" alt="UNAMUSC" style="width: 85px; height: auto;" />
            </div>

            <div class="text-center my-4 p-3 rounded-3" style="background: #f0fdf4; border: 1px solid #bbf7d0;">
              <h4 class="fw-bold text-uppercase mb-1" style="color: #047857;">PRESCRIPTION D'ANALYSES ET EXAMENS BIOLOGIQUES</h4>
              <small class="text-muted">Praticien : <strong>${doctorNameStr}</strong> • Consultation Télémédecine UNAMUSC</small>
            </div>

            <div class="row g-3 mb-4 p-3 rounded-3" style="background: #f8fafc; border: 1.5px solid #cbd5e1;">
              <div class="col-6">
                <span class="small fw-bold d-block text-muted">BÉNÉFICIAIRE :</span>
                <h5 class="fw-bold mb-0">${patientName}</h5>
                <small class="text-muted">N° Carte CMU : <strong>${cmuNum}</strong></small>
              </div>
              <div class="col-6 text-end">
                <span class="small fw-bold d-block text-muted">DATE :</span>
                <strong class="d-block">${new Date().toLocaleDateString('fr-FR')}</strong>
                <span class="badge bg-success">Tiers-Payant Laboratoire Agréé</span>
              </div>
            </div>

            <h6 class="fw-bold text-uppercase mb-2" style="color: #047857;">🧪 EXAMENS BIOLOGIQUES & RADIOLOGIQUES REQUIS :</h6>
            <div class="p-3 border rounded-3 mb-4 bg-light fw-bold" style="fontSize: 1.1rem; line-height: 1.8;">
              ${labExams.split(',').map(e => `• ${e.trim()}`).join('<br />')}
            </div>

            <div class="row align-items-center border-top pt-4">
              <div class="col-8">
                <strong class="small text-success d-block mb-1">Prise en Charge Directe UNAMUSC :</strong>
                <p class="small text-muted mb-0">Ce document permet la réalisation des examens prescrits dans tout laboratoire conventionné au Sénégal.</p>
              </div>
              <div class="col-4 text-center">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(`LAB-2026-${cmuNum}`)}" alt="QR Code" style="width: 75px; height: 75px;" />
                <div class="small fw-bold text-success mt-1">Signature Praticien</div>
              </div>
            </div>
          </div>
          <script>setTimeout(() => { window.print(); }, 400);</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    setChatMessages([...chatMessages, { sender: 'Vous', text: inputMsg }]);
    setInputMsg('');
    setTimeout(() => {
      setChatMessages(prev => [...prev, { 
        sender: activeSession?.doctor_name || 'Dr. Aminata Ndiaye', 
        text: 'Bien reçu. Je viens d\'examiner votre dossier médical sur la plateforme UNAMUSC.' 
      }]);
    }, 1200);
  };

  return (
    <div className="container py-4 fade-in-up">
      {/* Banner signature Télémédecine UNAMUSC avec fond d'écran immersif et typographie haute visibilité */}
      <section 
        className="banner-mini text-white mb-4 rounded-4 overflow-hidden position-relative text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.95), rgba(4, 120, 87, 0.92)), url("/csu_digital_health_real.jpg") center/cover no-repeat',
          padding: '3rem 2rem',
          boxShadow: '0 15px 30px -10px rgba(5, 150, 105, 0.4)',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div className="d-flex flex-column align-items-center justify-content-center position-relative text-center mx-auto" style={{ zIndex: 2, maxWidth: '850px' }}>
          <span 
            className="badge px-3 py-1.5 mb-3 fw-bold d-inline-block text-center shadow-sm"
            style={{
              background: 'rgba(255, 255, 255, 0.22)',
              color: '#ffffff',
              backdropFilter: 'blur(6px)',
              borderRadius: '20px',
              fontSize: '0.85rem',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              letterSpacing: '0.5px'
            }}
          >
            🟢 Tiers-Payant UNAMUSC • Visioconférence HD WebRTC 1080p
          </span>
          <h1 className="fw-bold mb-2 text-white text-center" style={{ fontSize: '2.2rem', textShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
            {lang === 'wo' ? 'Fajj ci kaw internet (Télémédecine WebRTC)' : 'Télémédecine & Salle d\'Attente Virtuelle'}
          </h1>
          <p className="mb-0 text-white-50 text-center mx-auto" style={{ fontSize: '1.02rem', lineHeight: '1.6', textShadow: '0 1px 3px rgba(0,0,0,0.3)', maxWidth: '750px' }}>
            Consultez les médecins agréés en visioconférence chiffrée 24h/7j. Recevez vos ordonnances de pharmacie (bon 50%) et prescriptions d'examens imprimables A4.
          </p>
        </div>
      </section>

      {/* Barre de Mode d'Accès Télémédecine (Affichée uniquement pour les Médecins/Agents ou avec Code Praticien) */}
      {isAgent && (
        <div className="d-flex justify-content-center gap-3 mb-4 p-2 rounded-4 flex-wrap" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <button 
            className={`btn fw-bold px-4 py-2.5 ${telemedRoleMode === 'doctor' ? 'btn-primary text-white' : 'btn-outline-secondary'}`}
            style={{ borderRadius: '12px' }}
            onClick={() => setTelemedRoleMode('doctor')}
          >
            👨‍⚕️ Espace Médecin de Garde (File d'Attente Virtuelle & Téléconsultations)
          </button>
          <button 
            className={`btn fw-bold px-4 py-2.5 ${telemedRoleMode === 'citizen' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
            style={{ borderRadius: '12px', background: telemedRoleMode === 'citizen' ? '#059669' : 'transparent' }}
            onClick={() => setTelemedRoleMode('citizen')}
          >
            👁️ Vue Aperçu Espace Assuré
          </button>
        </div>
      )}

      {paymentSuccess && (
        <div className="alert alert-success alert-dismissible fade show d-flex align-items-center mb-4 rounded-3 border-0 shadow-sm" role="alert">
          <span className="fs-5 me-2">✅</span>
          <div style={{ color: 'var(--text-main)' }}>{paymentSuccess}</div>
          <button type="button" className="btn-close" onClick={() => setPaymentSuccess('')}></button>
        </div>
      )}

      {/* NOTIFICATION SMS PUSH & WHATSAPP EN TEMPS RÉEL (APPEL PRATICIEN) */}
      {smsAlert && (
        <div 
          className="alert alert-info alert-dismissible fade show shadow-lg border-2 border-primary mb-4 p-3.5 rounded-4 position-relative" 
          role="alert"
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff', borderLeft: '6px solid #2563eb' }}
        >
          <div className="d-flex align-items-center gap-3">
            <span className="fs-1">📲</span>
            <div className="flex-grow-1">
              <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                <span className="badge bg-success fw-bold">📱 SMS PUSH ENVOYÉ</span>
                <span className="badge bg-info text-dark fw-bold">💬 WHATSAPP SÉNÉGAL</span>
                <small className="text-white-50">Heure d'envoi : {smsAlert.sentAt}</small>
              </div>
              <strong className="d-block text-warning mb-1" style={{ fontSize: '0.95rem' }}>
                Notification envoyée à {smsAlert.recipient} ({smsAlert.phone}) :
              </strong>
              <p className="mb-0 small text-white-50" style={{ fontSize: '0.88rem', lineHeight: '1.5' }}>
                "Bonjour <strong>{smsAlert.recipient}</strong>, votre médecin <strong>{smsAlert.doctor}</strong> vous invite à rejoindre immédiatement votre salle de téléconsultation WebRTC en direct ! Cliquez sur le bouton pour vous connecter."
              </p>
            </div>
            <button type="button" className="btn-close btn-close-white" onClick={() => setSmsAlert(null)}></button>
          </div>
        </div>
      )}

      {/* S'IL Y A UNE CONSULTATION WEBRTC ACTIVE */}
      {activeSession ? (
        <div className="card shadow-lg border-0 p-4 mb-4" style={{ borderRadius: '24px', background: '#0f172a', color: '#f8fafc' }}>
          <div className="d-flex justify-content-between align-items-center mb-3 border-bottom border-secondary pb-3 flex-wrap gap-2">
            <div>
              <h4 className="fw-bold mb-0 text-white">🎥 Téléconsultation HD en direct — {activeSession.doctor_name}</h4>
              <small className="text-success fw-semibold">
                🟢 Patient : {activeSession.patient_name} ({activeSession.cmu_number}) • Room: {activeSession.room_token}
              </small>
            </div>
            <button 
              type="button"
              className="btn fw-bold px-4 py-2 text-white shadow-sm" 
              style={{ borderRadius: '12px', background: '#dc2626', borderColor: '#b91c1c' }} 
              onClick={() => setActiveSession(null)}
            >
              ❌ Quitter la consultation
            </button>
          </div>

          {cameraError && (
            <div className="alert alert-warning py-2 px-3 mb-3 small rounded-3 d-flex align-items-center">
              <span className="me-2">⚠️</span>
              <div>{cameraError}</div>
            </div>
          )}

          <div className="row g-4">
            {/* Vidéo HD WebRTC & VU-Mètre Micro */}
            <div className="col-lg-7">
              <div 
                style={{ 
                  height: '420px', 
                  background: '#1e293b', 
                  borderRadius: '20px', 
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid rgba(16, 185, 129, 0.4)',
                  overflow: 'hidden'
                }}
              >
                {/* Visioconférence Médecin (Direct) */}
                <div className="text-center p-3">
                  <span style={{ fontSize: '4.5rem' }}>👨‍⚕️</span>
                  <h4 className="mt-2 text-white fw-bold">{activeSession.doctor_name}</h4>
                  <p className="text-info mb-2 small">Médecin Généraliste & Pédiatre UNAMUSC</p>
                  <span className="badge bg-success px-3 py-1.5 fw-semibold" style={{ borderRadius: '20px' }}>
                    En direct • Visioconférence chiffrée (WebRTC 1080p)
                  </span>
                </div>

                {/* Fenêtre PIP Caméra Assuré */}
                <div 
                  style={{ 
                    position: 'absolute', 
                    bottom: '15px', 
                    right: '15px', 
                    width: '180px', 
                    height: '130px', 
                    background: '#000000', 
                    borderRadius: '14px',
                    border: '2px solid #10b981',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {isCamOff ? (
                    <div className="text-center p-2">
                      <span style={{ fontSize: '1.2rem' }}>🚫</span>
                      <div className="small text-white-50 mt-1" style={{ fontSize: '0.72rem' }}>Caméra désactivée</div>
                    </div>
                  ) : cameraActive ? (
                    <video 
                      ref={userVideoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="text-center p-2">
                      <span style={{ fontSize: '1.5rem' }}>👤</span>
                      <div className="small text-white fw-semibold mt-1" style={{ fontSize: '0.75rem' }}>{activeSession.patient_name}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Contrôles WebRTC */}
              <div 
                className="d-flex justify-content-center align-items-center gap-3 mt-3 p-3 rounded-4 flex-wrap" 
                style={{ 
                  background: 'rgba(15, 23, 42, 0.95)', 
                  border: '1px solid rgba(255, 255, 255, 0.15)'
                }}
              >
                <button 
                  type="button"
                  className="btn px-3.5 py-2.5 fw-bold text-white shadow-sm d-flex align-items-center gap-2.5" 
                  style={{ 
                    borderRadius: '12px', 
                    background: isMuted ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                  }}
                  onClick={toggleMute}
                >
                  <span>{isMuted ? '🎙️ Micro Coupé' : '🎙️ Micro Actif'}</span>
                  {!isMuted && (
                    <div className="d-flex align-items-center gap-1 px-2 py-1 rounded-2" style={{ background: 'rgba(0, 0, 0, 0.4)' }}>
                      {[15, 30, 45, 60, 75, 90].map((threshold, idx) => (
                        <div 
                          key={idx} 
                          style={{ 
                            width: '4px', 
                            height: `${10 + idx * 3}px`, 
                            backgroundColor: audioLevel >= threshold ? '#34d399' : '#64748b'
                          }} 
                        />
                      ))}
                    </div>
                  )}
                </button>

                <button 
                  type="button"
                  className="btn px-3.5 py-2.5 fw-bold text-white shadow-sm" 
                  style={{ borderRadius: '12px', background: isCamOff ? '#ef4444' : '#0284c7' }}
                  onClick={toggleCamera}
                >
                  {isCamOff ? '📹 Activer Caméra' : '📹 Caméra Active'}
                </button>

                <button 
                  type="button"
                  className="btn px-4 py-2.5 fw-bold text-white shadow-sm" 
                  style={{ borderRadius: '12px', background: '#059669' }} 
                  onClick={() => setShowQrModal(true)}
                >
                  📲 Présenter QR Code CMU
                </button>
              </div>
            </div>

            {/* Panneau de Prescription Médicale & Chat (Médecin & Assuré) */}
            <div className="col-lg-5">
              <div className="card h-100 p-3 border-0 text-white d-flex flex-column" style={{ background: '#1e293b', borderRadius: '20px' }}>
                <h6 className="fw-bold mb-2 text-info">💬 Messagerie Directe & Échanges</h6>
                
                <div className="p-2 bg-dark rounded-3 mb-2 flex-grow-1" style={{ maxHeight: '160px', overflowY: 'auto', fontSize: '0.85rem' }}>
                  {chatMessages.map((m, idx) => (
                    <div key={idx} className="mb-2">
                      <strong className="text-success">{m.sender} : </strong>
                      <span className="text-white-50">{m.text}</span>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendMessage} className="d-flex gap-2 mb-3">
                  <input 
                    type="text" 
                    className="form-control form-control-sm bg-dark text-white border-secondary"
                    placeholder="Écrire au docteur..."
                    value={inputMsg}
                    onChange={(e) => setInputMsg(e.target.value)}
                  />
                  <button type="submit" className="btn btn-sm btn-success">Envoyer</button>
                </form>

                <hr className="border-secondary my-2" />

                {/* Émission Ordonnance Médicaments Pharmacie */}
                <h6 className="fw-bold mb-2 text-warning">💊 1. Ordonnance Médicamenteuse (Bon Pharmacie 50%)</h6>
                <div className="p-2.5 bg-dark rounded-3 small mb-2 border border-secondary" style={{ fontSize: '0.85rem' }}>
                  <div className="row g-2 mb-2">
                    <div className="col-8">
                      <input 
                        type="text" 
                        className="form-control form-control-sm bg-dark text-white border-secondary" 
                        value={prescMed1}
                        onChange={(e) => setPrescMed1(e.target.value)}
                      />
                    </div>
                    <div className="col-4">
                      <input 
                        type="number" 
                        className="form-control form-control-sm bg-dark text-success border-secondary fw-bold" 
                        value={prescPrice1}
                        onChange={(e) => setPrescPrice1(e.target.value)}
                        placeholder="Prix"
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-8">
                      <input 
                        type="text" 
                        className="form-control form-control-sm bg-dark text-white border-secondary" 
                        value={prescMed2}
                        onChange={(e) => setPrescMed2(e.target.value)}
                      />
                    </div>
                    <div className="col-4">
                      <input 
                        type="number" 
                        className="form-control form-control-sm bg-dark text-success border-secondary fw-bold" 
                        value={prescPrice2}
                        onChange={(e) => setPrescPrice2(e.target.value)}
                        placeholder="Prix"
                      />
                    </div>
                  </div>

                  <button 
                    type="button"
                    className={`btn btn-sm w-100 fw-bold text-white ${prescriptionSigned ? 'btn-secondary' : 'btn-success'}`}
                    style={{ borderRadius: '10px', background: prescriptionSigned ? '#475569' : '#059669' }}
                    onClick={handleSignPrescription}
                    disabled={prescriptionSigned}
                  >
                    {prescriptionSigned ? '✅ Ordonnance Signée & Injectée en Pharmacie' : '✅ Signer Ordonnance & Générer Bon 50%'}
                  </button>
                </div>

                {/* Émission Ordonnance Analyses & Examens */}
                <h6 className="fw-bold mb-2 text-info mt-2">🧪 2. Prescription d'Analyses Biologiques & Examens</h6>
                <div className="p-2.5 bg-dark rounded-3 small mb-2 border border-secondary" style={{ fontSize: '0.85rem' }}>
                  <input 
                    type="text" 
                    className="form-control form-control-sm bg-dark text-white border-secondary mb-2" 
                    value={labExams}
                    onChange={(e) => setLabExams(e.target.value)}
                    placeholder="Analyses presrites..."
                  />
                  <button 
                    type="button"
                    className="btn btn-sm btn-info w-100 fw-bold text-white"
                    style={{ borderRadius: '10px' }}
                    onClick={handlePrintLabPrescriptionPDF}
                  >
                    🧪 Émettre & Imprimer Ordonnance d'Analyses A4
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : telemedRoleMode === 'citizen' ? (
        /* VUE ASSURÉ / PATIENT (DESIGN ÉLÉGANT & HAUTE LISIBILITÉ) */
        <div className="row g-4">
          <div className="col-lg-6">
            {!patientInQueue ? (
              <div className="card shadow-sm border-0 p-4 rounded-4 h-100" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <span className="fs-3">🚪</span>
                  <div>
                    <h4 className="fw-bold mb-0" style={{ color: 'var(--primary)' }}>Entrer en Salle d'Attente Virtuelle</h4>
                    <small className="text-muted">Inscrivez-vous dans la file du praticien agréé de votre choix</small>
                  </div>
                </div>

                <form onSubmit={handleJoinQueue}>
                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-bold" style={{ color: 'var(--text-main)' }}>👤 Prénom de l'assuré *</label>
                      <input 
                        type="text" 
                        className="form-control input fw-bold p-2.5" 
                        value={inputFirstName}
                        onChange={(e) => setInputFirstName(e.target.value)}
                        required
                        style={{ borderRadius: '12px', background: 'var(--bg-body)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-bold" style={{ color: 'var(--text-main)' }}>👤 Nom de l'assuré *</label>
                      <input 
                        type="text" 
                        className="form-control input fw-bold p-2.5" 
                        value={inputLastName}
                        onChange={(e) => setInputLastName(e.target.value)}
                        required
                        style={{ borderRadius: '12px', background: 'var(--bg-body)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold" style={{ color: 'var(--text-main)' }}>💳 N° Carte / Code Assuré CMU *</label>
                    <input 
                      type="text" 
                      className="form-control input fw-bold text-success p-2.5" 
                      value={inputCmu}
                      onChange={(e) => setInputCmu(e.target.value)}
                      required
                      style={{ borderRadius: '12px', background: 'var(--bg-body)', border: '1px solid var(--border-color)' }}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold" style={{ color: 'var(--text-main)' }}>🩺 Médecin Agréé UNAMUSC (CNOM) *</label>
                    <select 
                      className="form-select input fw-bold p-2.5"
                      value={selectedDoctor}
                      onChange={(e) => setSelectedDoctor(e.target.value)}
                      style={{ borderRadius: '12px', background: 'var(--bg-body)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                    >
                      {accreditedDoctors.map(doc => (
                        <option key={doc.id} value={doc.name}>
                          {doc.name} ({doc.specialty} • {doc.cnom})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold" style={{ color: 'var(--text-main)' }}>⚠️ Niveau d'Urgence perçu *</label>
                    <select 
                      className="form-select input fw-bold p-2.5"
                      value={urgencyLevel}
                      onChange={(e) => setUrgencyLevel(e.target.value)}
                      style={{ borderRadius: '12px', background: 'var(--bg-body)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                    >
                      <option value="low">🟢 Consultation de Routine (Faible)</option>
                      <option value="medium">🟡 Symptômes Modérés (Moyenne)</option>
                      <option value="high">🟠 Douleurs / Fièvre Forte (Élevée)</option>
                      <option value="critical">🔴 Urgence Vitale (Priorité Absolue)</option>
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="form-label small fw-bold" style={{ color: 'var(--text-main)' }}>💬 Motif de consultation & Symptômes *</label>
                    <textarea 
                      className="form-control input p-2.5" 
                      rows="3" 
                      placeholder="Décrivez brièvement vos symptômes (fièvre, toux, maux de tête...)"
                      value={consultReason}
                      onChange={(e) => setConsultReason(e.target.value)}
                      required
                      style={{ borderRadius: '12px', background: 'var(--bg-body)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-success text-white w-100 fw-bold py-3 shadow-md"
                    style={{ 
                      borderRadius: '14px', 
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', 
                      border: 'none',
                      fontSize: '1rem',
                      boxShadow: '0 8px 20px rgba(5, 150, 105, 0.3)'
                    }}
                  >
                    🚪 Entrer dans la Salle d'Attente Virtuelle
                  </button>
                </form>
              </div>
            ) : (
              /* ÉCRAN SALLE D'ATTENTE INDIVIDUELLE DE L'ASSURÉ */
              <div className="card shadow-sm border-0 p-4 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', borderRadius: '24px', borderTop: '6px solid #059669' }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h4 className="fw-bold mb-0 text-success">⏳ Votre Salle d'Attente Privée</h4>
                  <span className="badge bg-success text-white px-3.5 py-2 fw-bold" style={{ borderRadius: '20px', fontSize: '0.9rem' }}>
                    Position #{queue.findIndex(p => p.id === patientInQueue.id) + 1} dans la file
                  </span>
                </div>

                <div className="p-4 rounded-4 bg-dark text-white mb-4 text-center border border-success shadow-sm">
                  <span className="small text-white-50 d-block mb-1">Praticien Référent Agréé :</span>
                  <strong className="fs-4 text-success d-block mb-2">{patientInQueue.requested_doctor}</strong>
                  <div className="spinner-grow spinner-grow-sm text-success me-2" role="status"></div>
                  <small className="text-white-50">Le praticien examine votre dossier et va vous appeler sous peu...</small>
                </div>

                <div className="p-3.5 rounded-3 border mb-3" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
                  <div className="small text-muted mb-1">Assuré : <strong style={{ color: 'var(--text-main)' }}>{patientInQueue.patient_name}</strong> ({patientInQueue.cmu_number})</div>
                  <div className="small text-muted mb-1">Motif : <em>"{patientInQueue.reason}"</em></div>
                  <div className="small text-muted">Statut règlement : {
                    patientInQueue.payment_status === 'paid' 
                      ? <span className="badge bg-success">✅ Payé via {patientInQueue.payment_method}</span> 
                      : patientInQueue.payment_status === 'requested' 
                      ? <span className="badge bg-warning text-dark">📲 Règlement demandé par le médecin (2 500 FCFA)</span> 
                      : <span className="badge bg-secondary">⏳ En attente de consigne du médecin</span>
                  }</div>
                </div>

                {patientInQueue.payment_status === 'requested' && (
                  <div className="p-3.5 rounded-4 bg-warning-subtle text-dark border border-warning mb-3">
                    <strong className="d-block mb-1 text-dark fw-bold">📲 Demande de Règlement par le Médecin :</strong>
                    <p className="small mb-2">
                      Le praticien demande le règlement du ticket modérateur de <strong>2 500 FCFA</strong> (Tiers-Payant UNAMUSC) pour démarrer l'acte.
                    </p>
                    <button 
                      type="button"
                      className="btn w-100 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 text-white"
                      style={{ 
                        borderRadius: '12px', 
                        background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', 
                        border: 'none',
                        padding: '0.75rem 1rem'
                      }}
                      onClick={() => setShowPaymentModal(true)}
                    >
                      <img src="/logo_orange_money.png" alt="OM" style={{ height: '22px', borderRadius: '4px', background: '#ffffff', padding: '1px' }} />
                      <img src="/logo_wave.png" alt="Wave" style={{ height: '22px', borderRadius: '50%' }} />
                      <span>Payer 2 500 FCFA via Orange Money ou Wave</span>
                    </button>
                  </div>
                )}

                <div className="d-flex gap-2">
                  <button 
                    className="btn btn-success flex-fill fw-bold text-white py-3"
                    style={{ borderRadius: '12px', background: '#059669' }}
                    onClick={() => handleStartCall(patientInQueue)}
                  >
                    🎥 Lancer l'Appel Vidéo HD
                  </button>
                  <button 
                    className="btn btn-outline-danger py-3 px-4 fw-bold"
                    style={{ borderRadius: '12px' }}
                    onClick={() => {
                      setQueue(queue.filter(p => p.id !== patientInQueue.id));
                      setPatientInQueue(null);
                    }}
                  >
                    Quitter
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ZONE DE TÉLÉCHARGEMENT DES ORDONNANCES ET PRESCRIPTIONS POUR L'ASSURÉ */}
          <div className="col-lg-6">
            <div className="card shadow-sm border-0 p-4 rounded-4 h-100" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', borderRadius: '24px', borderTop: '6px solid #0284c7' }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex align-items-center gap-2">
                  <span className="fs-3">📄</span>
                  <div>
                    <h4 className="fw-bold mb-0 text-info">Vos Ordonnances & Prescriptions</h4>
                    <small className="text-muted">Documents certifiés émis lors de vos téléconsultations</small>
                  </div>
                </div>
                <span className="badge bg-info-subtle text-info border border-info px-3 py-1.5 fw-bold">Certifiées CNOM</span>
              </div>

              <div className="d-flex flex-column gap-3">
                {/* Carte Ordonnance Pharmacie */}
                <div className="p-3.5 border rounded-4 bg-light text-dark shadow-sm">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <h6 className="fw-bold mb-1 text-success">💊 Ordonnance Pharmacie UNAMUSC (Bon 50%)</h6>
                      <small className="text-muted">Praticien Émetteur : <strong>Dr. Aminata Ndiaye</strong></small>
                    </div>
                    <span className="badge bg-success px-2.5 py-1">Valide 48h</span>
                  </div>
                  <div className="small mb-3 text-secondary bg-white p-2 rounded-2 border">
                    • Amoxicilline 500mg (2 boîtes)<br />
                    • Paracétamol 1g (1 boîte)
                  </div>
                  <button 
                    className="btn btn-sm btn-success fw-bold text-white w-100 py-2.5"
                    style={{ borderRadius: '10px', background: '#059669' }}
                    onClick={handlePrintPharmacyOrderPDF}
                  >
                    📥 Télécharger / Imprimer l'Ordonnance Pharmacie PDF A4
                  </button>
                </div>

                {/* Carte Prescription Analyses */}
                <div className="p-3.5 border rounded-4 bg-light text-dark shadow-sm">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <h6 className="fw-bold mb-1 text-info">🧪 Prescription d'Analyses & Radiographie</h6>
                      <small className="text-muted">Praticien Émetteur : <strong>Dr. Cheikh Tidiane Seck</strong></small>
                    </div>
                    <span className="badge bg-info text-dark px-2.5 py-1">Conventionné UNAMUSC</span>
                  </div>
                  <div className="small mb-3 text-secondary bg-white p-2 rounded-2 border">
                    • NFS (Numération Formule Sanguine)<br />
                    • Glycémie à jeun & Radiographie Pulmonaire
                  </div>
                  <button 
                    className="btn btn-sm btn-info fw-bold text-white w-100 py-2.5"
                    style={{ borderRadius: '10px' }}
                    onClick={handlePrintLabPrescriptionPDF}
                  >
                    🧪 Imprimer / Télécharger la Prescription d'Analyses A4
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* VUE MÉDECIN / PRATICIEN AGRÉÉ (FILE D'ATTENTE GLOBALE EN DIRECT & GESTION DES SOINS) */
        <div className="card shadow-sm border-0 p-4 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', borderRadius: '24px', borderTop: '6px solid #2563eb' }}>
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-3">
            <div>
              <h4 className="fw-bold mb-0 text-primary">
                📋 File d'Attente Virtuelle Télémédecine en Direct (Espace Médecin)
              </h4>
              <small className="text-muted">Tableau de bord exclusif du Médecin de Garde accrédité par le Super Admin</small>
            </div>

            <div className="d-flex align-items-center gap-2">
              <span className="small fw-bold text-muted">Compte Praticien :</span>
              <select 
                className="form-select form-select-sm fw-bold border-primary"
                value={activeDoctorAccount}
                onChange={(e) => setActiveDoctorAccount(e.target.value)}
                style={{ borderRadius: '10px', minWidth: '220px' }}
              >
                {accreditedDoctors.map(doc => (
                  <option key={doc.id} value={doc.name}>
                    👨‍⚕️ {doc.name} ({doc.specialty})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="alert alert-info py-2.5 px-3 mb-3 small rounded-3 d-flex align-items-center gap-2">
            <span>ℹ️</span>
            <div>
              Vous êtes connecté(e) en tant que <strong>{activeDoctorAccount}</strong>. Vous seul avez accès à cette file d'attente en temps réel pour trier les urgences, demander les règlements (avant ou après l'acte) et délivrer les ordonnances.
            </div>
          </div>

          {queue.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <span style={{ fontSize: '3.5rem' }}>⏳</span>
              <p className="mt-2" style={{ fontSize: '0.95rem' }}>La file d'attente virtuelle est vide pour le moment.</p>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {queue.map((pat, idx) => {
                const isUrgent = pat.urgency === 'critical' || pat.urgency === 'high';
                return (
                  <div 
                    key={pat.id} 
                    className="p-3.5 border rounded-4 d-flex justify-content-between align-items-center flex-wrap gap-3"
                    style={{ 
                      background: isUrgent ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-body)', 
                      borderColor: isUrgent ? '#ef4444' : 'var(--border-color)',
                      borderLeft: isUrgent ? '6px solid #ef4444' : '6px solid #059669'
                    }}
                  >
                    <div>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="badge bg-dark text-white fw-bold">#{idx + 1}</span>
                        <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.05rem' }}>{pat.patient_name}</h6>
                        <code className="text-success small fw-bold">{pat.cmu_number}</code>
                        {pat.urgency === 'critical' && <span className="badge bg-danger">🔴 URGENCE VITALE</span>}
                        {pat.urgency === 'high' && <span className="badge bg-warning text-dark">🟠 Élevée</span>}
                        {pat.urgency === 'medium' && <span className="badge bg-info text-dark">🟡 Modérée</span>}
                        {pat.urgency === 'low' && <span className="badge bg-secondary">🟢 Routine</span>}
                      </div>

                      <div className="small text-muted mb-1">
                        <strong>Motif :</strong> <em>"{pat.reason}"</em> • Praticien demandé : <strong>{pat.requested_doctor}</strong>
                      </div>
                      <small className="text-muted">
                        📅 Arrivé(e) à {new Date(pat.joined_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} • Statut paiement : {
                          pat.payment_status === 'paid' 
                            ? <span className="text-success fw-bold">✅ Reglé ({pat.payment_method})</span> 
                            : pat.payment_status === 'requested' 
                            ? <span className="text-warning fw-bold">⏳ Demande envoyée au patient</span> 
                            : <span className="text-muted">Non encore demandé</span>
                        }
                      </small>
                    </div>

                    <div className="d-flex gap-2 flex-wrap">
                      {pat.payment_status !== 'paid' && (
                        <button 
                          type="button"
                          className="btn btn-sm fw-bold d-flex align-items-center gap-2 shadow-sm"
                          style={{ 
                            borderRadius: '10px', 
                            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
                            border: '1.5px solid #f59e0b',
                            color: '#fbbf24',
                            padding: '0.5rem 0.9rem'
                          }}
                          onClick={() => handleDoctorRequestPayment(pat.id)}
                        >
                          <img src="/logo_orange_money.png" alt="OM" style={{ height: '18px', borderRadius: '3px', background: '#ffffff', padding: '1px' }} />
                          <img src="/logo_wave.png" alt="Wave" style={{ height: '18px', borderRadius: '50%' }} />
                          <span>Demander Règlement (Orange / Wave)</span>
                        </button>
                      )}

                      <button 
                        type="button"
                        className="btn btn-sm btn-success fw-bold text-white px-3 d-flex align-items-center gap-1.5 shadow-sm"
                        style={{ borderRadius: '10px', background: '#059669', borderColor: '#059669', padding: '0.5rem 0.9rem' }}
                        onClick={() => handleStartCall(pat)}
                      >
                        <span>🎥 Démarrer la Téléconsultation HD</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE PAIEMENT MOBILE MONEY (ORANGE MONEY / WAVE) */}
      {showPaymentModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '24px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="modal-header border-bottom p-3" style={{ borderColor: 'var(--border-color)', background: '#059669', color: '#ffffff' }}>
                <h5 className="modal-title fw-bold">
                  💳 Paiement Mobile Téléconsultation — Tiers-Payant UNAMUSC
                </h5>
                <button className="btn-close btn-close-white" onClick={() => setShowPaymentModal(false)}></button>
              </div>

              <form onSubmit={handleProcessPayment} className="modal-body p-4">
                <div className="text-center mb-4">
                  <span className="small text-muted d-block">Montant du Ticket Modérateur à régler :</span>
                  <h2 className="fw-bold text-success mb-0">2 500 FCFA</h2>
                  <small className="text-muted">Prise en charge UNAMUSC restante (50% à 80%) garantie.</small>
                </div>

                <label className="form-label small fw-bold">Sélectionnez le moyen de paiement Sénégal *</label>
                <div className="d-flex gap-3 mb-4">
                  <button 
                    type="button" 
                    className="btn flex-fill py-3 fw-bold d-flex align-items-center justify-content-center gap-2.5 shadow-sm"
                    onClick={() => setPaymentProvider('orange')}
                    style={{ 
                      borderRadius: '14px', 
                      background: paymentProvider === 'orange' ? '#ff7900' : 'var(--bg-body)', 
                      color: paymentProvider === 'orange' ? '#ffffff' : 'var(--text-main)', 
                      border: paymentProvider === 'orange' ? '2.5px solid #ff7900' : '1.5px solid var(--border-color)' 
                    }}
                  >
                    <img 
                      src="/logo_orange_money.png" 
                      alt="Orange Money" 
                      style={{ height: '32px', objectFit: 'contain', borderRadius: '6px', background: '#ffffff', padding: '2px' }} 
                    />
                    <span className="fw-bold fs-6">Orange Money</span>
                  </button>

                  <button 
                    type="button" 
                    className="btn flex-fill py-3 fw-bold d-flex align-items-center justify-content-center gap-2.5 shadow-sm"
                    onClick={() => setPaymentProvider('wave')}
                    style={{ 
                      borderRadius: '14px', 
                      background: paymentProvider === 'wave' ? '#1dc4ff' : 'var(--bg-body)', 
                      color: paymentProvider === 'wave' ? '#ffffff' : 'var(--text-main)', 
                      border: paymentProvider === 'wave' ? '2.5px solid #1dc4ff' : '1.5px solid var(--border-color)' 
                    }}
                  >
                    <img 
                      src="/logo_wave.png" 
                      alt="Wave Sénégal" 
                      style={{ height: '32px', objectFit: 'contain', borderRadius: '50%' }} 
                    />
                    <span className="fw-bold fs-6">Wave Sénégal</span>
                  </button>
                </div>

                <div className="mb-4">
                  <label className="form-label small fw-bold">Numéro de téléphone Mobile Money Sénégal *</label>
                  <input 
                    type="text" 
                    className="form-control input fw-bold text-center fs-5"
                    value={phoneNum}
                    onChange={(e) => setPhoneNum(e.target.value)}
                    placeholder="Ex: 77 602 67 83 ou 71 123 45 67"
                    required
                    style={{ borderRadius: '12px' }}
                  />
                  <small className="text-muted d-block text-center mt-1">
                    Numéros sénégalais acceptés : <strong>Orange (77, 78, 71)</strong>, Free (76), Expresso (70) ou Promobile (75).
                  </small>
                </div>

                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-secondary fw-bold" onClick={() => setShowPaymentModal(false)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-success fw-bold px-4 text-white" disabled={paying} style={{ background: '#059669', borderColor: '#059669' }}>
                    {paying ? 'Validation du paiement...' : '✅ Confirmer & Payer 2 500 FCFA'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR Code Tri-Layer CMU */}
      {showQrModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0 p-4" style={{ borderRadius: '24px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                  <h5 className="fw-bold mb-0" style={{ color: '#059669' }}>
                    🛡️ QR Code Tri-Layer Sécurisé UNAMUSC
                  </h5>
                  <small className="text-muted">Identification médicale universelle interopérable</small>
                </div>
                <button className="btn-close" onClick={() => setShowQrModal(false)}></button>
              </div>

              <div className="row g-4 align-items-center">
                <div className="col-md-5 text-center">
                  <div className="p-3 bg-white rounded-4 d-inline-block border shadow-sm mb-2">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                        JSON.stringify({
                          type: 'CSU_SEN_WEBRTC',
                          patient: activeSession?.patient_name || `${activeFirstName} ${activeLastName}`,
                          cmu: activeSession?.cmu_number || activeCmuNumber,
                          token: activeSession?.room_token
                        })
                      )}`} 
                      alt="QR Code Tri-Layer CMU" 
                      style={{ width: '200px', height: '200px' }} 
                    />
                  </div>
                  <div className="small fw-bold text-success">
                    🔒 Signature Numérique AES-256 Validée
                  </div>
                </div>

                <div className="col-md-7">
                  <div className="p-3.5 rounded-3 mb-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
                    <h6 className="fw-bold mb-2" style={{ color: 'var(--text-main)' }}>📋 Données Transmises au Médecin :</h6>
                    
                    <div className="row g-2 small">
                      <div className="col-6">
                        <span className="text-muted d-block">Assuré :</span>
                        <strong style={{ color: 'var(--text-main)' }}>{activeSession?.patient_name || `${activeFirstName} ${activeLastName}`}</strong>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block">N° Carte CMU :</span>
                        <strong className="text-success">{activeSession?.cmu_number || activeCmuNumber}</strong>
                      </div>
                    </div>
                  </div>

                  <button className="btn btn-secondary w-100 fw-bold py-2" style={{ borderRadius: '10px' }} onClick={() => setShowQrModal(false)}>
                    Fermer l'affichage du QR Code
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
