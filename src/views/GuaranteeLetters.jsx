import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { generateOfficialPdf } from '../utils/pdfGenerator';
import { getBeneficiaryInfo, getAdherentCode, getBeneficiaryCode } from '../utils/csuFormatter';

export default function GuaranteeLetters({ lang = 'fr', userRole = 'citizen', citizenUser = null, agentUser = null, partnerUser = null, setView = null }) {
  const defaultLetters = [
    {
      id: 201,
      first_name: 'Amadou',
      last_name: 'Sow',
      cmu_number: 'CSU-DKR-2026-8812.2',
      ipp_number: 'IPP-FANN-2026-8812',
      hospital_name: 'Hôpital Universitaire de Fann (Dakar)',
      medical_act: 'Intervention chirurgicale ORL — (Hôpital Universitaire de Fann)',
      estimated_amount: 250000,
      guaranteed_percentage: 80,
      max_amount: 200000,
      patient_rest: 50000,
      status: 'pending',
      validation_code: 'GAR-2026-FANN-88',
      created_at: new Date().toISOString(),
      agent_note: 'Dossier complet. Devis d\'hospitalisation vérifié conforme au barème national par l\'UNAMUSC.'
    },
    {
      id: 202,
      first_name: 'Fatou',
      last_name: 'Diop',
      cmu_number: 'CMU-DKR-2026-4401',
      ipp_number: 'IPP-DANTEC-2026-4401',
      hospital_name: 'Hôpital Aristide Le Dantec',
      medical_act: 'Hospitalisation soins intensifs 5 jours — (Hôpital Aristide Le Dantec)',
      estimated_amount: 450000,
      guaranteed_percentage: 100,
      max_amount: 450000,
      patient_rest: 0,
      status: 'approved',
      validation_code: 'GAR-2026-DANTEC-12',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      agent_note: 'Accordé à 100% au titre de la gratuité hospitalière maternité & soins d\'urgence (UNAMUSC).'
    }
  ];

  // ═══════════════════════════════════════════════════════
  // RBAC — Définition granulaire des rôles (cohérent avec MedicalProfile)
  // ═══════════════════════════════════════════════════════
  const isSuperAdmin = userRole === 'superadmin' || agentUser?.role === 'SuperAdmin' || agentUser?.role === 'Super Admin';
  const isDoctor     = userRole === 'doctor' || (userRole === 'partner' && partnerUser?.role?.toLowerCase().includes('médecin'));
  const isMidwife    = userRole === 'midwife' || (userRole === 'partner' && partnerUser?.role?.toLowerCase().includes('sage'));
  const isPharmacist = userRole === 'pharmacist';
  const isAgent      = (userRole === 'agent' || (!!agentUser && !isSuperAdmin)) && !isSuperAdmin;
  const isCitizen    = !isAgent && !isDoctor && !isMidwife && !isPharmacist && !isSuperAdmin && (!!citizenUser && (userRole === 'citizen' || userRole === 'citizen_suspended'));
  const isPublic     = !isAgent && !isDoctor && !isMidwife && !isPharmacist && !isSuperAdmin && !isCitizen;
  const isStaff      = isDoctor || isMidwife || isAgent || isPharmacist || isSuperAdmin;
  // Droits d'instruction : agent gérant ou superadmin
  const canInstruire = isAgent || isSuperAdmin;
  // Peut consulter les dossiers liés à ses patients (médecin/sage-femme) ou tous (agent/superadmin)
  const canViewAllLetters = isAgent || isSuperAdmin || isDoctor || isMidwife;

  const isSuspended = (
    userRole === 'citizen_suspended' || 
    citizenUser?.status === 'suspended' || 
    citizenUser?.status === 'inactif' || 
    citizenUser?.status === 'suspendu' || 
    localStorage.getItem('cmu-portal-mode') === 'citizen_suspended' ||
    localStorage.getItem('cmu-cotisation-suspended') === 'true'
  );

  const [publicSearchCmu, setPublicSearchCmu] = useState('');
  const [requestCategory, setRequestCategory] = useState('hospital'); // 'hospital' | 'pharmacy'

  // State pour le simulateur public de devis UNAMUSC
  const [simAmount, setSimAmount] = useState(250000);
  const [simType, setSimType] = useState('hospital'); // 'hospital' | 'pharmacy'

  // Informations assuré actif
  const activeCmuNumber = citizenUser?.cmu_number || citizenUser?.cmuNumber || localStorage.getItem('cmu-active-number') || 'SN-DK-MED-8472';
  const activeFirstName = citizenUser?.first_name || citizenUser?.firstName || 'Modou';
  const activeLastName = citizenUser?.last_name || citizenUser?.lastName || 'Diop';

  const isStudent = (citizenUser?.packageType === 'scolaire' || (citizenUser?.firstName || '').toLowerCase().includes('ibrahima'));
  const isBsf = (citizenUser?.packageType === 'gratuité' || (citizenUser?.firstName || '').toLowerCase().includes('fatou'));

  const userLetters = [
    {
      id: 101,
      first_name: activeFirstName,
      last_name: activeLastName,
      cmu_number: getBeneficiaryCode(activeCmuNumber, 1),
      ipp_number: `IPP-DKR-${getAdherentCode(activeCmuNumber).slice(-4)}`,
      hospital_name: isStudent ? 'Centre Médical Universitaire UCAD / Hôpital Fann' : isBsf ? 'Hôpital Aristide Le Dantec (Dakar)' : 'Polyclinique de la Médina',
      medical_act: isStudent ? 'Consultation & soins de santé étudiants — (Gratuité CSU Jeunes)' : isBsf ? 'Prise en charge d\'urgence & soins généraux — (Bourse Sécurité Familiale)' : 'Intervention chirurgicale ORL & consultation spécialisée',
      estimated_amount: isStudent ? 120000 : isBsf ? 350000 : 250000,
      guaranteed_percentage: isStudent ? 100 : isBsf ? 100 : 80,
      max_amount: isStudent ? 120000 : isBsf ? 350000 : 200000,
      patient_rest: isStudent ? 0 : isBsf ? 0 : 50000,
      status: 'approved',
      validation_code: `GAR-2026-${getAdherentCode(activeCmuNumber).slice(-4)}`,
      created_at: new Date().toISOString(),
      agent_note: isStudent 
        ? 'Prise en charge 100% accordée au titre de la gratuité CSU Jeunes & Étudiants (UNAMUSC).' 
        : isBsf 
        ? 'Prise en charge 100% accordée au titre du filet social Bourse de Sécurité Familiale (BSF).' 
        : 'Prise en charge 80% validée sous le système de Tiers-Payant UNAMUSC Dakar.'
    },
    {
      id: 102,
      first_name: 'Amadou',
      last_name: 'Sow',
      cmu_number: getBeneficiaryCode(activeCmuNumber, 2),
      ipp_number: `IPP-FANN-${getAdherentCode(activeCmuNumber).slice(-4)}`,
      hospital_name: 'Hôpital Universitaire de Fann (Dakar)',
      medical_act: 'Intervention chirurgicale ORL — (Hôpital Universitaire de Fann)',
      estimated_amount: 250000,
      guaranteed_percentage: 80,
      max_amount: 200000,
      patient_rest: 50000,
      status: 'pending',
      validation_code: `GAR-2026-FANN-88`,
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      agent_note: 'Dossier en cours d\'instruction par l\'agent UNAMUSC.'
    },
    ...defaultLetters
  ];

  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'new'

  // Formulaire de demande (Assuré)
  const [applicantFirstName, setApplicantFirstName] = useState(activeFirstName);
  const [applicantLastName, setApplicantLastName] = useState(activeLastName);
  const [applicantCmu, setApplicantCmu] = useState(activeCmuNumber);
  const [medicalAct, setMedicalAct] = useState('');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [structureName, setStructureName] = useState('Hôpital Universitaire de Fann (Dakar)');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [prescriptionPhoto, setPrescriptionPhoto] = useState('');
  const [prescriptionPreview, setPrescriptionPreview] = useState('');

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPrescriptionPhoto(reader.result);
        setPrescriptionPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Instruction Agent & Modal
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [modalTab, setModalTab] = useState('instruction'); // 'instruction' | 'certificate'
  const [guaranteedPct, setGuaranteedPct] = useState(80);
  const [maxAmount, setMaxAmount] = useState('');
  const [agentNote, setAgentNote] = useState('Prise en charge validée par l\'agent UNAMUSC sous le système de Tiers-Payant UNAMUSC.');

  const fetchLetters = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/guarantees');
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        setLetters(json.data);
      } else {
        setLetters(citizenUser ? userLetters : defaultLetters);
      }
    } catch (err) {
      console.warn('Utilisation des garanties de démonstration:', err);
      setLetters(citizenUser ? userLetters : defaultLetters);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLetters();
  }, []);

  // Fonction dédiée de génération et d'impression / téléchargement PDF A4 de la Lettre de Garantie
  const generateAndPrintPDFWindow = (letterToPrint = selectedLetter) => {
    const letter = letterToPrint || selectedLetter || letters[0];
    if (!letter) return;

    const guaranteeAmt = letter.guaranteed_amount || letter.max_amount || (letter.estimated_amount * ((letter.guaranteed_percentage || 80) / 100));
    const patientRest = Math.max(0, letter.estimated_amount - guaranteeAmt);
    const bInfo = getBeneficiaryInfo(`${letter.first_name} ${letter.last_name}`, letter.cmu_number || activeCmuNumber);

    const printWin = window.open('', '_blank', 'width=980,height=1150');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Attestation_Prise_En_Charge_UNAMUSC_${letter.validation_code}.pdf</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body { background: #ffffff !important; color: #0f172a !important; font-family: 'Inter', Arial, sans-serif; padding: 1.5rem; }
            .cert-box { border: 2.5px solid #047857; border-radius: 16px; padding: 2rem; background: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
            .no-print { margin-bottom: 1.5rem; text-align: center; }
            @media print {
              .no-print { display: none !important; }
              body { padding: 0 !important; }
              .cert-box { border-width: 2px !important; box-shadow: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" class="btn btn-success fw-bold px-4 py-2 me-2" style="background: #059669; border-color: #059669;">🖨️ Imprimer / Télécharger le PDF A4</button>
            <button onclick="window.close()" class="btn btn-secondary fw-bold px-3 py-2">Fermer la fenêtre</button>
          </div>

          <div class="cert-box">
            <!-- Entête Officiel Sénégal & UNAMUSC -->
            <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-4" style="border-color: #cbd5e1 !important;">
              <div class="d-flex align-items-center gap-3">
                <img src="/senegal_flag.png" alt="Drapeau du Sénégal" style="width: 54px; height: 36px; object-fit: cover; border-radius: 4px; border: 1.5px solid #d97706;" />
                <div>
                  <h6 class="fw-bold mb-0 text-uppercase" style="color: #047857; letter-spacing: 0.5px;">RÉPUBLIQUE DU SÉNÉGAL</h6>
                  <small class="text-muted fw-semibold" style="font-size: 0.75rem;">Un Peuple - Un But - Une Foi</small><br />
                  <strong class="small text-uppercase" style="color: #0f172a; font-size: 0.82rem;">UNION NATIONALE DES MUTUELLES DE SANTÉ COMMUNAUTAIRES (UNAMUSC)</strong><br />
                  <span class="badge bg-success-subtle text-success border border-success fw-semibold" style="font-size: 0.72rem;">PROGRAMME NATIONAL DE LA COUVERTURE SANITAIRE DU SÉNÉGAL</span>
                </div>
              </div>
              <div class="text-end">
                <img src="/unamusc_logo.png" alt="UNAMUSC Sénégal" style="width: 85px; height: auto; object-fit: contain;" />
              </div>
            </div>

            <!-- Titre de l'Attestation -->
            <div class="text-center my-4 p-3 rounded-3" style="background: #f0fdf4; border: 1px solid #bbf7d0;">
              <h4 class="fw-bold text-uppercase mb-1" style="color: #047857; letter-spacing: 1px;">ATTESTATION OFFICIELLE DE PRISE EN CHARGE HOSPITALIÈRE</h4>
              <small class="text-muted fw-semibold">Émise sous le système de Tiers-Payant UNAMUSC : Programme National de la Couverture Sanitaire du Sénégal</small><br />
              <code class="mt-2 d-inline-block px-3 py-1 bg-white text-success border border-success rounded-3 fw-bold fs-6">Code Homologation : #${letter.validation_code}</code>
            </div>

            <!-- Grille des caractéristiques & prise en charge -->
            <div class="row g-4 mb-4 p-4 rounded-3" style="background: #f8fafc; border: 1.5px solid #cbd5e1;">
              <div class="col-6">
                <span class="small fw-bold d-block mb-1 text-muted text-uppercase">👤 BÉNÉFICIAIRE ASSURÉ(E) :</span>
                <h5 class="fw-bold mb-1" style="color: #0f172a;">${letter.first_name} ${letter.last_name}</h5>
                <div class="small mb-1" style="color: #334155;">
                  <strong>N° CSU Bénéficiaire :</strong> <span style="color: #047857; font-weight: bold; font-family: monospace;">${bInfo.beneficiaryCode}</span> <span class="badge bg-success-subtle text-success border border-success" style="font-size: 0.68rem;">${bInfo.index === 1 ? 'Titulaire .1' : 'Ayant droit .' + bInfo.index}</span>
                </div>
                <div class="small" style="color: #475569;">
                  <strong>Code Adhérent principal :</strong> <span style="font-weight: bold; font-family: monospace;">${bInfo.adherentCode}</span> | IPP : <strong>${letter.ipp_number || 'IPP-FANN-2026-8812'}</strong>
                </div>
                <small class="text-success fw-bold d-block mt-1.5">Organisme Émetteur : Tiers-Payant UNAMUSC Sénégal</small>
              </div>

              <div class="col-6">
                <span class="small fw-bold d-block mb-1 text-muted text-uppercase">🏥 STRUCTURE HOSPITALIÈRE D'ACCUEIL :</span>
                <h6 class="fw-bold mb-1" style="color: #047857; font-size: 1rem;">${letter.hospital_name || letter.medical_act}</h6>
                <div class="small" style="color: #334155;">Conventionné Tiers-Payant UNAMUSC (Validation 100% Humaine)</div>
              </div>

              <div class="col-6 border-top pt-3" style="border-color: #e2e8f0 !important;">
                <span class="small fw-bold d-block mb-1 text-muted text-uppercase">📋 ACTE MÉDICAL : HOSPITALISATION PRESCRITE :</span>
                <strong class="d-block" style="color: #0f172a; font-size: 0.95rem;">${letter.medical_act}</strong>
              </div>

              <div class="col-6 border-top pt-3" style="border-color: #e2e8f0 !important;">
                <span class="small fw-bold d-block mb-1 text-muted text-uppercase">💰 MONTANT ESTIMÉ & ACCORD DE PRISE EN CHARGE :</span>
                <div class="small" style="color: #334155;">
                  Devis Soumis : <strong>${Number(letter.estimated_amount).toLocaleString()} FCFA</strong><br />
                  Prise en charge UNAMUSC (${letter.guaranteed_percentage || 80}%) : <strong style="color: #047857; font-size: 1.05rem;">${Number(guaranteeAmt).toLocaleString()} FCFA</strong><br />
                  <span style="color: #b45309; font-weight: bold;">Reste à charge patient (Ticket Modérateur) : ${Number(patientRest).toLocaleString()} FCFA</span>
                </div>
              </div>
            </div>

            <!-- Engagement Financier UNAMUSC & Tampon Numérique QR Code -->
            <div class="row align-items-center p-3 rounded-3" style="background: #f1f5f9; border: 1px solid #cbd5e1;">
              <div class="col-8">
                <span class="small fw-bold text-uppercase d-block mb-1" style="color: #047857;">Clause officielle d'engagement financier UNAMUSC :</span>
                <p class="small mb-0 text-secondary" style="font-size: 0.78rem; line-height: 1.45;">
                  ${letter.agent_note || 'L\'UNAMUSC s\'engage sous le Programme National de la Couverture Sanitaire du Sénégal à régler directement à l\'établissement hospitalier le montant garanti sous présentation de la facture conforme.'}
                </p>
              </div>

              <div class="col-4 text-center">
                <div class="p-2 bg-white rounded-3 shadow-sm d-inline-block border mb-2">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://mutualis.sn/#/verify/${letter.validation_code}`)}" alt="QR Code Validation" style="width: 80px; height: 80px;" />
                </div>
                <div class="small fw-bold text-success">Tampon Numérique Officiel UNAMUSC</div>
                <small class="text-muted d-block" style="font-size: 0.72rem;">Homologué par l'UNAMUSC : Signature Agent Habilité</small>
              </div>
            </div>
          </div>

          <script>
            setTimeout(() => { window.print(); }, 400);
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const handlePrintCertificate = () => {
    generateAndPrintPDFWindow(selectedLetter);
  };

  const handleDownloadPDF = (letterToPrint = selectedLetter) => {
    const letter = letterToPrint || selectedLetter || letters[0];
    if (!letter) return;
    const guaranteeAmt = letter.guaranteed_amount || letter.max_amount || (letter.estimated_amount * ((letter.guaranteed_percentage || 80) / 100));
    const bInfo = getBeneficiaryInfo(`${letter.first_name} ${letter.last_name}`, letter.cmu_number || activeCmuNumber);

    generateOfficialPdf({
      filename: `lettre_garantie_${letter.validation_code}.pdf`,
      docType: 'LETTRE DE GARANTIE HOSPITALIÈRE HABILITÉE (80%)',
      title: 'Attestation de Prise en Charge Hospitalière',
      referenceNo: letter.validation_code,
      beneficiaryName: `${letter.first_name} ${letter.last_name}`,
      cmuNumber: bInfo.beneficiaryCode,
      structureName: letter.hospital_name || 'Hôpital Universitaire de Fann (Dakar)',
      details: [
        { label: 'N° CSU Bénéficiaire', value: `${bInfo.beneficiaryCode} (${bInfo.index === 1 ? 'Titulaire .1' : 'Ayant droit .' + bInfo.index})` },
        { label: 'Code Adhérent principal', value: bInfo.adherentCode },
        { label: 'Acte Médical / Intervention', value: letter.medical_act },
        { label: 'Établissement Récepteur', value: letter.hospital_name || 'Hôpital Universitaire de Fann' },
        { label: 'Montant Devis Soumis', value: `${Number(letter.estimated_amount).toLocaleString()} FCFA` },
        { label: 'Prise en Charge UNAMUSC', value: `${Number(guaranteeAmt).toLocaleString()} FCFA (${letter.guaranteed_percentage || 80}%)` },
        { label: 'Ticket Modérateur Patient', value: `${Number(Math.max(0, letter.estimated_amount - guaranteeAmt)).toLocaleString()} FCFA` }
      ],
      notes: letter.agent_note || 'L\'UNAMUSC s\'engage sous le Programme National de la Couverture Sanitaire du Sénégal à régler directement à l\'établissement hospitalier le montant garanti sous présentation de la facture conforme.'
    });
  };

  // Filtrage strict selon le rôle (RBAC) & Confidentialité des données de santé
  const visibleLetters = letters.filter((item) => {
    // SuperAdmin, agent (instruction), médecin/sage-femme (consultation patients) : voient tous les dossiers
    if (isSuperAdmin || isAgent) return true;
    if (isDoctor || isMidwife) return true; // Consultation des dossiers liés aux patients
    if (isPharmacist) return false; // Pharmacien : non concerné par les lettres de garantie
    if (isCitizen) {
      // L'assuré connecté ne voit STRICTEMENT QUE SES PROPRES DEMANDES
      const cmuMatch = (item.cmu_number || '').trim().toLowerCase() === activeCmuNumber.trim().toLowerCase();
      const nameMatch = (item.first_name || '').trim().toLowerCase() === activeFirstName.trim().toLowerCase() &&
                        (item.last_name || '').trim().toLowerCase() === activeLastName.trim().toLowerCase();
      return cmuMatch || nameMatch;
    }
    // Visiteur public non connecté : masquage strict des dossiers d'autrui
    if (publicSearchCmu.trim()) {
      return item.cmu_number.toLowerCase().includes(publicSearchCmu.trim().toLowerCase());
    }
    return false;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!medicalAct || !estimatedAmount) return;
    setSubmitting(true);
    setSuccessMsg('');

    const estVal = parseFloat(estimatedAmount) || 0;
    const gVal = estVal * 0.8;

    if (requestCategory === 'hospital') {
      // Création d'une Lettre de Garantie d'Hospitalisation
      const newLetter = {
        id: Date.now(),
        first_name: applicantFirstName || activeFirstName,
        last_name: applicantLastName || activeLastName,
        cmu_number: applicantCmu || activeCmuNumber,
        ipp_number: 'IPP-FANN-2026-8812',
        hospital_name: structureName,
        medical_act: `${medicalAct} : (${structureName})`,
        estimated_amount: estVal,
        guaranteed_percentage: 80,
        max_amount: gVal,
        patient_rest: estVal - gVal,
        status: 'pending',
        validation_code: `GAR-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        created_at: new Date().toISOString(),
        prescription_photo: prescriptionPhoto || '/ordonnance_demo.jpg',
        agent_note: 'Demande soumise par l\'assuré. En attente de vérification de l\'ordonnance et d\'instruction par le gérant UNAMUSC.'
      };

      try {
        await fetch('/api/guarantees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            beneficiary_id: 1,
            medical_act: newLetter.medical_act,
            estimated_amount: newLetter.estimated_amount,
            prescription_photo: newLetter.prescription_photo
          })
        });
      } catch (err) {
        console.warn(err);
      }

      setLetters([newLetter, ...letters]);
      setSuccessMsg(lang === 'wo' 
        ? 'Demande bi yónnee nañu ko ak jamm. Ordonnance bi ñungi ko vérifié.' 
        : 'Votre demande de lettre de garantie hospitalière et photo d\'ordonnance ont été soumises avec succès ! Le gérant UNAMUSC vérifie l\'ordonnance avant d\'élivrer le bon.');
    } else {
      // Création d'un Bon de Commande de Médicaments (Pharmacie Tiers-Payant 50%)
      const pharmCovered = estVal * 0.5;
      const pharmRest = estVal * 0.5;
      const newOrder = {
        id: Date.now(),
        first_name: applicantFirstName || activeFirstName,
        last_name: applicantLastName || activeLastName,
        cmu_number: applicantCmu || activeCmuNumber,
        items_json: JSON.stringify([
          { name: medicalAct, qty: 1, price: estVal }
        ]),
        total_amount: estVal,
        cmu_covered: pharmCovered,
        patient_pay: pharmRest,
        status: prescriptionPhoto ? 'pending_review' : 'active',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        prescription_photo: prescriptionPhoto || '/ordonnance_demo.jpg',
        order_code: `ORD-2026-PHARM-${Math.floor(100 + Math.random() * 900)}`
      };

      const currentOrders = JSON.parse(localStorage.getItem('cmu_purchase_orders') || '[]');
      localStorage.setItem('cmu_purchase_orders', JSON.stringify([newOrder, ...currentOrders]));

      setSuccessMsg(prescriptionPhoto 
        ? `Votre Bon de Commande Pharmacie (${newOrder.order_code}) et votre ordonnance ont été soumis. Le gérant UNAMUSC vérifiera l'ordonnance avant d'activer votre bon (Tiers-Payant 50%). Vous serez notifié dès validation.`
        : `Votre Bon de Commande Pharmacie (${newOrder.order_code}) a été généré (Prise en charge UNAMUSC 50%). Valable 48h dans toute pharmacie agréée UNAMUSC.`);
    }

    setMedicalAct('');
    setEstimatedAmount('');
    setActiveTab('list');
    setSubmitting(false);
  };

  const handleValidateAgent = async (status) => {
    if (!selectedLetter) return;
    const finalGuarantee = parseFloat(maxAmount) || (selectedLetter.estimated_amount * (guaranteedPct / 100));
    const finalRest = Math.max(0, selectedLetter.estimated_amount - finalGuarantee);

    const updated = letters.map(l => l.id === selectedLetter.id ? {
      ...l,
      status,
      guaranteed_percentage: parseFloat(guaranteedPct),
      max_amount: finalGuarantee,
      patient_rest: finalRest,
      agent_note: agentNote || (status === 'approved' ? 'Prise en charge accordée par l\'UNAMUSC.' : 'Demande rejetée.')
    } : l);

    setLetters(updated);

    try {
      await fetch(`/api/guarantees/${selectedLetter.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          guaranteed_percentage: parseFloat(guaranteedPct),
          max_amount: finalGuarantee,
          agent_note: agentNote
        })
      });
    } catch (err) {
      console.warn(err);
    }

    // Basculer sur l'onglet certificat si approuvé
    if (status === 'approved') {
      setSelectedLetter({
        ...selectedLetter,
        status: 'approved',
        guaranteed_percentage: parseFloat(guaranteedPct),
        max_amount: finalGuarantee,
        patient_rest: finalRest,
        agent_note: agentNote
      });
      setModalTab('certificate');
    } else {
      setSelectedLetter(null);
    }
  };

  const openInstructionModal = (item) => {
    setSelectedLetter(item);
    setGuaranteedPct(item.guaranteed_percentage || 80);
    setMaxAmount(item.max_amount || (item.estimated_amount * 0.8));
    setAgentNote(item.agent_note || 'Devis et dossier médical vérifiés conformes par l\'UNAMUSC.');
    setModalTab('instruction');
  };

  // KPIs
  const totalPending = letters.filter(l => l.status === 'pending').length;
  const totalApproved = letters.filter(l => l.status === 'approved').length;
  const totalGuaranteedSum = letters.filter(l => l.status === 'approved').reduce((acc, l) => acc + (l.max_amount || 0), 0);

  // ── PHARMACIEN : non concerné par les lettres de garantie ──
  if (isPharmacist) {
    return (
      <div className="container py-5 fade-in-up">
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div className="p-5 rounded-4 text-center text-white" style={{ background: 'linear-gradient(135deg, #047857 0%, #059669 100%)', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>💊</div>
            <span className="badge mb-3 d-inline-block" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 'bold' }}>Pharmacien Agréé UNAMUSC</span>
            <h2 className="fw-bold mb-3" style={{ color: '#fff', fontSize: '1.8rem' }}>Lettres de Garantie : Non concerné</h2>
            <p className="mb-4" style={{ color: '#d1fae5', lineHeight: '1.6', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
              Les lettres de garantie concernent les hospitalisations et actes médicaux lourds. En tant que pharmacien, votre espace est dédié à la validation des bons de commande médicaments.
            </p>
            <button className="btn btn-light fw-bold px-4 py-3" style={{ borderRadius: '12px', color: '#047857' }} onClick={() => (window.location.hash = '#/purchase-orders')}>
              💊 Accéder à mes Bons de Commande
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isCitizen && isSuspended) {
    return (
      <div className="container py-5 fade-in-up">
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          <div className="card shadow-lg border-0 p-4 p-md-5 text-center my-4" style={{ borderRadius: '24px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '2px solid #ef4444' }}>
            <div className="d-inline-flex align-items-center justify-content-center p-3 rounded-circle mb-3 mx-auto" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', width: '70px', height: '70px' }}>
              <span style={{ fontSize: '2.2rem' }}>⚠️</span>
            </div>
            
            <h3 className="fw-bold mb-2 text-danger" style={{ fontSize: '1.4rem' }}>⚠️ Accès aux garanties refusé : Couverture CSU suspendue</h3>
            
            <div className="mb-3">
              <code className="px-3 py-1.5 bg-dark text-warning border border-warning rounded-3 fw-bold d-inline-block" style={{ fontSize: '1.05rem', color: '#f59e0b' }}>
                {activeCmuNumber}
              </code>
            </div>

            <p className="lead mb-4 mx-auto" style={{ maxWidth: '640px', fontSize: '1.05rem', lineHeight: '1.65' }}>
              Votre cotisation annuelle n'est pas à jour. La demande et le téléchargement des lettres de garantie hospitalières sont suspendus.
              <br />
              <strong className="d-block mt-2 text-danger">Veuillez régulariser votre cotisation et celui des membres de votre famille pour un montant de 10 500 FCFA.</strong>
            </p>

            <div className="d-flex justify-content-center gap-3">
              <button 
                type="button" 
                className="btn btn-emerald btn-lg px-4 py-3 fw-bold d-inline-flex align-items-center gap-2 shadow"
                style={{ background: '#10b981', borderColor: '#10b981', color: '#ffffff', borderRadius: '16px', fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)' }}
                onClick={() => {
                  localStorage.setItem('cmu-pending-renewal', JSON.stringify({
                    cmuNumber: activeCmuNumber,
                    amount: 10500,
                    familyCount: 3,
                    firstName: activeFirstName,
                    lastName: activeLastName
                  }));
                  if (setView) setView('payments');
                  window.location.hash = '#payments';
                }}
              >
                💳 Renouveler ma cotisation (10 500 FCFA)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4 fade-in-up">
      {/* Banner signature de la plateforme */}
      <section 
        className="banner-mini text-white mb-5 rounded-4 overflow-hidden position-relative text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.38) 0%, rgba(16, 185, 129, 0.18) 100%), url("/csu_bsf_real.png") center/cover no-repeat',
          padding: '3.75rem 2.5rem',
          minHeight: '240px',
          borderRadius: '24px',
          boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.45)'
        }}
      >
        <div className="d-flex flex-column align-items-center justify-content-center position-relative text-center mx-auto" style={{ zIndex: 2, maxWidth: '900px' }}>
          <span 
            className="badge px-3.5 py-1.5 mb-3 fw-bold d-inline-block text-center"
            style={{
              background: 'rgba(255, 255, 255, 0.22)',
              color: '#ffffff',
              backdropFilter: 'blur(6px)',
              borderRadius: '20px',
              fontSize: '0.85rem',
              border: '1px solid rgba(255, 255, 255, 0.35)'
            }}
          >
            🇸🇳 UNAMUSC Sénégal : Lettres de garantie (80%) | bons pharmacie (50%)
          </span>
          <h1 className="fw-extrabold mb-2 text-white text-center" style={{ fontSize: '2.35rem', letterSpacing: '-0.02em', textShadow: '0 3px 6px rgba(0,0,0,0.4)' }}>
            {lang === 'wo' ? 'Bons de commande ak bataaxal u garansi' : 'Bons de commande : lettres de garantie'}
          </h1>
          <p className="mb-4 text-white-50 text-center mx-auto" style={{ fontSize: '1.05rem', lineHeight: '1.6', textShadow: '0 1px 3px rgba(0,0,0,0.3)', maxWidth: '780px' }}>
            {lang === 'wo'
              ? 'Yónnee sa demande ngir joto prise en charge d\'hospitalisation wala chirurgie.'
              : 'Demandez votre lettre de garantie hospitalière (80%) ou bon de commande pharmacie (50%) en ligne sous le Tiers-Payant UNAMUSC.'}
          </p>

          <div className="d-flex justify-content-center align-items-center flex-wrap mt-4.5 w-100" style={{ gap: '1.5rem', rowGap: '1rem', padding: '0.5rem 0' }}>
            <button
              type="button"
              style={{
                background: activeTab === 'list' ? '#059669' : 'rgba(255, 255, 255, 0.22)',
                color: '#ffffff',
                border: activeTab === 'list' ? '2.5px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.45)',
                borderRadius: '16px',
                fontSize: '0.98rem',
                fontWeight: '800',
                lineHeight: '1.4',
                padding: '1rem 1.85rem',
                boxShadow: activeTab === 'list' ? '0 6px 20px rgba(5, 150, 105, 0.65)' : '0 3px 10px rgba(0,0,0,0.2)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                flex: '1 1 280px',
                maxWidth: '420px',
                minHeight: '54px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem'
              }}
              onClick={() => setActiveTab('list')}
            >
              <span>📋</span> {canInstruire ? `Instructions agent (${letters.length})` : (isDoctor || isMidwife) ? `Dossiers patients (${visibleLetters.length})` : `Mes dossiers : attestations (${visibleLetters.length})`}
            </button>

            {(isCitizen || isSuperAdmin) && (
              <button
                type="button"
                style={{
                  background: activeTab === 'new' ? '#059669' : 'rgba(255, 255, 255, 0.22)',
                  color: '#ffffff',
                  border: activeTab === 'new' ? '2.5px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.45)',
                  borderRadius: '16px',
                  fontSize: '0.98rem',
                  fontWeight: '800',
                  lineHeight: '1.4',
                  padding: '1rem 1.85rem',
                  boxShadow: activeTab === 'new' ? '0 6px 20px rgba(5, 150, 105, 0.65)' : '0 3px 10px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer',
                  flex: '1 1 280px',
                  maxWidth: '420px',
                  minHeight: '54px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem'
                }}
                onClick={() => setActiveTab('new')}
              >
                <span>➕</span> {lang === 'wo' ? 'Demande bu bees' : 'Nouvelle demande (garantie : bon)'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* RANGÉE KPIS EXÉCUTIF GARANTIES (Rôle Agent / SuperAdmin) */}
      {canInstruire && (
        <div className="row g-3 mb-4">
          <div className="col-md-3 col-6">
            <div className="card shadow-sm border-0 p-3 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <span className="small text-muted mb-1 d-block">Demandes reçues</span>
              <h4 className="fw-bold mb-0 text-primary">{letters.length}</h4>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="card shadow-sm border-0 p-3 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <span className="small text-muted mb-1 d-block">En instruction agent</span>
              <h4 className="fw-bold mb-0 text-warning">{totalPending}</h4>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="card shadow-sm border-0 p-3 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <span className="small text-muted mb-1 d-block">Lettres accordées</span>
              <h4 className="fw-bold mb-0 text-success">{totalApproved}</h4>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="card shadow-sm border-0 p-3 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <span className="small text-muted mb-1 d-block">Total garanti UNAMUSC (FCFA)</span>
              <h4 className="fw-bold mb-0 text-success">{totalGuaranteedSum.toLocaleString()}</h4>
            </div>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success d-flex align-items-center mb-4 rounded-3 border-0 shadow-sm">
          <span className="fs-4 me-2">✅</span>
          <div style={{ color: 'var(--text-main)' }}>{successMsg}</div>
        </div>
      )}

      {/* FORMULAIRE NOUVELLE DEMANDE (React Portal : Centered on Screen) */}
      {activeTab === 'new' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div className="card shadow-lg border-0 p-4" style={{ maxWidth: '820px', width: '100%', maxHeight: '90vh', overflowY: 'auto', borderRadius: '24px', background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h4 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ color: 'var(--primary)' }}>
                <span>➕</span> Nouvelle demande sous le Tiers-Payant UNAMUSC
              </h4>
              <button type="button" className="btn-close" onClick={() => setActiveTab('list')}></button>
            </div>

            <p className="small text-muted mb-4">
              Sélectionnez le type de prestation (Hospitalisation ou Pharmacie) et renseignez les éléments de votre devis ou ordonnance.
            </p>

            {/* SÉLECTEUR CATEGORIE : GARANTIE HOSPITALIÈRE OU BON PHARMACIE */}
            <div className="d-flex gap-2 mb-4">
              <button 
                type="button" 
                className={`btn flex-fill py-2.5 fw-bold ${requestCategory === 'hospital' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                onClick={() => setRequestCategory('hospital')}
                style={{ borderRadius: '12px' }}
              >
                🏥 Lettre de Garantie Hospitalière
              </button>
              <button 
                type="button" 
                className={`btn flex-fill py-2.5 fw-bold ${requestCategory === 'pharmacy' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                onClick={() => setRequestCategory('pharmacy')}
                style={{ borderRadius: '12px' }}
              >
                💊 Bon de Commande Pharmacie (48h)
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Prénom de l'assuré *</label>
                  <input 
                    type="text" 
                    className="form-control input fw-bold" 
                    value={applicantFirstName} 
                    onChange={(e) => setApplicantFirstName(e.target.value)} 
                    style={{ borderRadius: '10px' }}
                    required
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Nom de l'assuré *</label>
                  <input 
                    type="text" 
                    className="form-control input fw-bold" 
                    value={applicantLastName} 
                    onChange={(e) => setApplicantLastName(e.target.value)} 
                    style={{ borderRadius: '10px' }}
                    required
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label small fw-semibold">N° Carte CSU Assuré *</label>
                  <input 
                    type="text" 
                    className="form-control input fw-bold text-success" 
                    value={applicantCmu} 
                    onChange={(e) => setApplicantCmu(e.target.value)} 
                    style={{ borderRadius: '10px' }}
                    required
                  />
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">
                    {requestCategory === 'hospital' ? 'Établissement d\'accueil récepteur *' : 'Pharmacie partenaire agréée UNAMUSC *'}
                  </label>
                  <select 
                    className="form-select input fw-bold" 
                    value={structureName} 
                    onChange={(e) => setStructureName(e.target.value)}
                    style={{ borderRadius: '10px' }}
                  >
                    {requestCategory === 'hospital' ? (
                      <>
                        <option value="Hôpital Universitaire de Fann (Dakar)">Hôpital Universitaire de Fann (Dakar)</option>
                        <option value="Hôpital Aristide Le Dantec">Hôpital Aristide Le Dantec</option>
                        <option value="Hôpital Général Idrissa Pouye (Pikine)">Hôpital Général Idrissa Pouye (Pikine)</option>
                        <option value="Centre Hospitalier Abass Ndao">Centre Hospitalier Abass Ndao</option>
                        <option value="Hôpital d'Enfants Albert Royer">Hôpital d'Enfants Albert Royer</option>
                      </>
                    ) : (
                      <>
                        <option value="Pharmacie de la Nation (Dakar)">Pharmacie de la Nation (Dakar)</option>
                        <option value="Pharmacie Cheikh Anta Diop">Pharmacie Cheikh Anta Diop</option>
                        <option value="Pharmacie Universelle Pikine">Pharmacie Universelle Pikine</option>
                        <option value="Pharmacie Populaire Guédiawaye">Pharmacie Populaire Guédiawaye</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Devis estimatif soumis (FCFA) *</label>
                  <input 
                    type="number" 
                    className="form-control input fw-bold"
                    placeholder="Ex: 250000"
                    value={estimatedAmount}
                    onChange={(e) => setEstimatedAmount(e.target.value)}
                    style={{ borderRadius: '10px' }}
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label small fw-semibold">
                  {requestCategory === 'hospital' 
                    ? 'Description de l\'acte médical : hospitalisation prescrite *' 
                    : 'Liste des médicaments prescrits (Ordonnance) *'}
                </label>
                <textarea 
                  className="form-control input" 
                  rows="3" 
                  placeholder={requestCategory === 'hospital' 
                    ? 'Ex: Intervention chirurgicale ORL, hospitalisation 5 jours en médecine interne...' 
                    : 'Ex: Amoxicilline 500mg (2 boîtes), Paracétamol 1g (1 boîte), Spasfon...'}
                  value={medicalAct}
                  onChange={(e) => setMedicalAct(e.target.value)}
                  style={{ borderRadius: '10px' }}
                  required
                />
              </div>

              {/* SECTION TÉLÉVERSEMENT ORDONNANCE (Pharmacie uniquement) */}
              {requestCategory === 'pharmacy' && (
                <div className="mb-4 p-4 rounded-3" style={{ background: 'rgba(5,150,105,0.07)', border: '2px dashed #059669', borderRadius: '16px' }}>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span style={{ fontSize: '1.4rem' }}>📋</span>
                    <div>
                      <strong className="d-block fw-bold" style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>Téléverser l'ordonnance médicale *</strong>
                      <small className="text-muted">Prenez en photo l'ordonnance prescrite par votre médecin et téléversez-la. Le gérant UNAMUSC vérifiera l'ordonnance avant d'accorder le bon de commande.</small>
                    </div>
                  </div>

                  <label
                    htmlFor="prescriptionUpload"
                    className="d-flex flex-column align-items-center justify-content-center p-3 rounded-3 mt-2 cursor-pointer"
                    style={{
                      border: '2px solid #059669',
                      background: 'var(--bg-body)',
                      borderRadius: '12px',
                      minHeight: '110px',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                  >
                    {prescriptionPreview ? (
                      <div className="text-center">
                        <img
                          src={prescriptionPreview}
                          alt="Aperçu ordonnance"
                          style={{ maxHeight: '160px', maxWidth: '100%', borderRadius: '8px', objectFit: 'contain', marginBottom: '0.5rem' }}
                        />
                        <small className="text-success fw-bold d-block">✅ Ordonnance chargée : Cliquer pour modifier</small>
                      </div>
                    ) : (
                      <div className="text-center text-muted">
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.4rem' }}>📷</div>
                        <span className="fw-semibold d-block" style={{ fontSize: '0.9rem' }}>Cliquer pour prendre/sélectionner la photo de l'ordonnance</span>
                        <small>Formats acceptés : JPG, PNG, HEIC (Max 10 Mo)</small>
                      </div>
                    )}
                    <input
                      id="prescriptionUpload"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      style={{ display: 'none' }}
                    />
                  </label>

                  {!prescriptionPreview && (
                    <small className="d-block text-warning fw-semibold mt-2">
                      ⚠️ Aucune ordonnance téléversée. Le bon ne sera accordé qu'après vérification par le gérant UNAMUSC.
                    </small>
                  )}
                </div>
              )}

              {(() => {
                const isPharm = requestCategory === 'pharmacy';
                const pct = isPharm ? 50 : 80;
                const pctFactor = isPharm ? 0.5 : 0.8;
                const estNum = parseFloat(estimatedAmount) || 0;
                const coveredVal = estNum * pctFactor;
                const restVal = estNum * (1 - pctFactor);

                return (
                  <div className="p-3.5 rounded-3 border mb-4" style={{ background: 'var(--card-bg)', borderColor: '#059669', borderLeft: '5px solid #059669' }}>
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                      <div>
                        <strong className="d-block small text-success fw-bold">
                          Estimation automatique UNAMUSC ({pct}%) :
                        </strong>
                        <span className="small text-muted d-block">
                          {isPharm 
                            ? 'Prise en charge directe 50% sur Bon de Commande Pharmacie (Tiers-Payant UNAMUSC). Ordonnance requise.' 
                            : 'Prise en charge directe 80% sur Lettre de Garantie Hospitalière (Tiers-Payant UNAMUSC).'}
                        </span>
                        {estNum > 0 && (
                          <small className="text-warning fw-bold d-block mt-1">
                            Ticket modérateur patient ({100 - pct}%) : {restVal.toLocaleString()} FCFA
                          </small>
                        )}
                      </div>
                      <div className="text-end">
                        <span className="small text-muted d-block fw-semibold">Montant pris en charge UNAMUSC ({pct}%) :</span>
                        <h4 className="fw-bold text-success mb-0">
                          {coveredVal.toLocaleString()} FCFA
                        </h4>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('list')}>Annuler</button>
                <button type="submit" className="btn btn-success text-white fw-bold px-4" disabled={submitting} style={{ borderRadius: '10px' }}>
                  {submitting ? 'Transmission...' : requestCategory === 'pharmacy' ? '📷 Soumettre ordonnance : demander bon pharmacie' : '📤 Soumettre la demande à l\'UNAMUSC'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* EXPERIENCE PORTAIL UNIFIEE POUR LES VISITEURS NON CONNECTÉS (Remplaçant l'ancien bloc restreint) */}
      {isPublic && !publicSearchCmu && activeTab === 'list' && (
        <div className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          {/* CARTE CENTRALE DE RECHERCHE : AUTHENTIFICATION */}
          <div className="card shadow-lg border-0 p-4 p-md-5 rounded-4 text-left" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', borderTop: '6px solid #059669', boxShadow: 'var(--shadow-lg)', padding: '2.75rem 2.25rem' }}>
            <div className="d-flex align-items-center gap-3.5 mb-4">
              <div style={{ background: 'rgba(5, 150, 105, 0.15)', color: '#059669', padding: '0.85rem 1rem', borderRadius: '18px', fontSize: '2rem' }}>
                🔒
              </div>
              <div>
                <h3 className="fw-extrabold mb-1.5" style={{ color: 'var(--primary)', fontSize: '1.45rem' }}>
                  Accès sécurisé : consultation des attestations UNAMUSC
                </h3>
                <p className="text-muted mb-0" style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                  Afin de préserver la confidentialité des données médicales des citoyens, la liste globale des garanties est réservée aux agents habilités. Saisissez votre N° de Carte CSU ou votre code de garantie pour consulter votre dossier.
                </p>
              </div>
            </div>

            {/* Barre de recherche avec exemples et bouton */}
            <div className="p-4 rounded-4 mb-4" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
              <label className="form-label small fw-bold mb-2.5 text-uppercase" style={{ color: 'var(--primary)', fontSize: '0.82rem', letterSpacing: '0.5px' }}>
                🔎 Rechercher directement mon dossier avec mon n° de carte CMU ou code d'homologation :
              </label>
              <div className="input-group mb-3">
                <input 
                  type="text" 
                  className="form-control fw-bold input" 
                  placeholder="Ex: CMU-DKR-2026-8812 ou GAR-2026-FANN-88" 
                  value={publicSearchCmu} 
                  onChange={(e) => setPublicSearchCmu(e.target.value)} 
                  style={{ borderRadius: '14px 0 0 14px', height: '54px', fontSize: '1.05rem', paddingLeft: '1.25rem' }}
                />
                <button 
                  className="btn btn-success fw-bold px-4" 
                  style={{ borderRadius: '0 14px 14px 0', background: '#059669', fontSize: '1rem', height: '54px' }}
                >
                  🔍 Consulter mon dossier
                </button>
              </div>

              {/* Suggestions rapides */}
              <div className="d-flex align-items-center flex-wrap gap-3 mt-3 pt-1">
                <span className="small text-muted fw-bold me-2" style={{ fontSize: '0.85rem' }}>Exemples de démonstration :</span>
                <div className="d-flex flex-wrap gap-2.5">
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary py-2 px-3.5 fw-bold"
                    style={{ fontSize: '0.82rem', borderRadius: '10px', margin: '0.15rem' }}
                    onClick={() => setPublicSearchCmu('CMU-DKR-2026-8812')}
                  >
                    CMU-DKR-2026-8812 (Amadou Sow)
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary py-2 px-3.5 fw-bold"
                    style={{ fontSize: '0.82rem', borderRadius: '10px', margin: '0.15rem' }}
                    onClick={() => setPublicSearchCmu('CMU-DKR-2026-4401')}
                  >
                    CMU-DKR-2026-4401 (Fatou Diop)
                  </button>
                </div>
              </div>
            </div>

            {/* Boutons d'action rapide */}
            <div className="d-flex gap-4 flex-wrap pt-3" style={{ marginTop: '0.75rem' }}>
              {setView && (
                <button 
                  className="btn btn-success fw-bold px-4 py-3" 
                  onClick={() => setView('login')} 
                  style={{ borderRadius: '14px', background: '#059669', fontSize: '0.98rem', boxShadow: '0 6px 16px rgba(5,150,105,0.35)', minHeight: '52px' }}
                >
                  🔐 Se connecter à mon espace assuré : agent
                </button>
              )}
              <button 
                className="btn btn-outline-success fw-bold px-4 py-3" 
                onClick={() => setActiveTab('new')} 
                style={{ borderRadius: '14px', fontSize: '0.98rem', minHeight: '52px' }}
              >
                ➕ Soumettre une demande de prise en charge (80%)
              </button>
            </div>
          </div>

          {/* SIMULATEUR INTERACTIF DE PRISE EN CHARGE CMU */}
          <div className="card shadow-md border-0 p-4 p-md-5 rounded-4 text-left" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '2.75rem 2.25rem' }}>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4 pb-2">
              <div>
                <span className="badge bg-success-subtle text-success border border-success px-3.5 py-1.5 fw-bold mb-2.5 d-inline-block" style={{ borderRadius: '20px', fontSize: '0.82rem' }}>
                  🧮 CALCULATEUR DE DEVIS : SIMULATEUR UNAMUSC
                </span>
                <h3 className="fw-extrabold mb-1.5" style={{ color: 'var(--primary)', fontSize: '1.45rem' }}>
                  Simulez la prise en charge de vos soins hospitaliers : médicaments
                </h3>
                <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
                  Estimez instantanément la part couverte par l'UNAMUSC et le ticket modérateur restant à votre charge.
                </p>
              </div>
            </div>

            <div className="row g-4 g-xl-5 align-items-center">
              <div className="col-lg-6">
                <div className="form-group mb-4">
                  <label className="form-label small fw-bold mb-2 text-uppercase" style={{ color: 'var(--primary)', fontSize: '0.82rem', letterSpacing: '0.5px' }}>Type de prestation sanitaire :</label>
                  <div className="d-flex gap-2.5">
                    <button 
                      type="button" 
                      className={`btn flex-fill fw-bold py-2.5 px-3 ${simType === 'hospital' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                      onClick={() => setSimType('hospital')}
                      style={{ borderRadius: '12px', fontSize: '0.9rem', height: '48px' }}
                    >
                      🏥 Hospitalisation : chirurgie (80%)
                    </button>
                    <button 
                      type="button" 
                      className={`btn flex-fill fw-bold py-2.5 px-3 ${simType === 'pharmacy' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                      onClick={() => setSimType('pharmacy')}
                      style={{ borderRadius: '12px', fontSize: '0.9rem', height: '48px' }}
                    >
                      💊 Ordonnance pharmacie (50%)
                    </button>
                  </div>
                </div>

                <div className="form-group mb-0">
                  <label className="form-label small fw-bold mb-2 text-uppercase" style={{ color: 'var(--primary)', fontSize: '0.82rem', letterSpacing: '0.5px' }}>Montant estimatif du devis soumis (FCFA) :</label>
                  <input 
                    type="number" 
                    className="form-control input fw-bold text-success fs-5 mb-2"
                    value={simAmount}
                    onChange={(e) => setSimAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{ borderRadius: '12px', height: '54px', paddingLeft: '1.25rem' }}
                    step={5000}
                  />
                  <small className="text-muted d-block" style={{ fontSize: '0.82rem' }}>Exemples : 100 000 FCFA (radiologies), 250 000 FCFA (chirurgie Fann), 500 000 FCFA (hospitalisation 10j)</small>
                </div>
              </div>

              <div className="col-lg-6">
                {(() => {
                  const pct = simType === 'hospital' ? 80 : 50;
                  const cmuPart = simAmount * (pct / 100);
                  const patientPart = simAmount - cmuPart;

                  return (
                    <div className="p-4 p-md-4.5 rounded-4 shadow-sm" style={{ background: 'var(--bg-card-subtle)', border: '2px solid #059669', padding: '1.75rem 1.5rem' }}>
                      <div className="d-flex justify-content-between align-items-center mb-3.5 border-bottom pb-3" style={{ borderColor: 'var(--border-color)' }}>
                        <span className="fw-bold fs-6" style={{ color: 'var(--text-main)' }}>Taux de garantie UNAMUSC :</span>
                        <span className="badge bg-success fs-6 fw-bold px-3.5 py-1.5" style={{ borderRadius: '12px' }}>{pct}% prise en charge</span>
                      </div>

                      <div className="row g-3 my-2">
                        <div className="col-6">
                          <span className="small text-muted d-block fw-bold mb-1" style={{ fontSize: '0.82rem' }}>Part payée par l'UNAMUSC ({pct}%) :</span>
                          <h3 className="fw-extrabold text-success mb-1" style={{ fontSize: '1.75rem' }}>{cmuPart.toLocaleString()} FCFA</h3>
                          <small className="text-success fw-bold" style={{ fontSize: '0.78rem' }}>Règlement direct à l'établissement</small>
                        </div>

                        <div className="col-6 border-start ps-3.5" style={{ borderColor: 'var(--border-color)' }}>
                          <span className="small text-muted d-block fw-bold mb-1" style={{ fontSize: '0.82rem' }}>Ticket modérateur patient ({100 - pct}%) :</span>
                          <h3 className="fw-extrabold text-warning mb-1" style={{ fontSize: '1.75rem' }}>{patientPart.toLocaleString()} FCFA</h3>
                          <small className="text-warning fw-bold" style={{ fontSize: '0.78rem' }}>À payer par l'assuré au guichet</small>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-top text-center" style={{ borderColor: 'var(--border-color)' }}>
                        <button 
                          className="btn btn-success fw-bold w-100 py-3" 
                          style={{ borderRadius: '12px', background: '#059669', height: '52px', fontSize: '1.02rem' }}
                          onClick={() => setActiveTab('new')}
                        >
                          📋 Demander cette prise en charge officielle
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* GRILLE DES 4 ENGAGEMENTS TIERS-PAYANT UNAMUSC */}
          <div className="grid grid-4" style={{ gap: '1.5rem' }}>
            <div className="card p-4 text-left shadow-sm" style={{ borderRadius: '20px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '1.75rem 1.5rem' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '0.75rem' }}>🏥</div>
              <h5 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>Hospitalisation : chirurgie</h5>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', margin: 0, lineHeight: '1.6' }}>
                Prise en charge à 80% des frais de bloc, séjour et soins intégraux dans tous les centres hospitaliers régionaux.
              </p>
            </div>

            <div className="card p-4 text-left shadow-sm" style={{ borderRadius: '20px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '1.75rem 1.5rem' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '0.75rem' }}>💊</div>
              <h5 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>Bons de commande pharmacie</h5>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', margin: 0, lineHeight: '1.6' }}>
                Délivrance directe des médicaments essentiels prescrits avec 50% de réduction immédiate en officine conventionnée.
              </p>
            </div>

            <div className="card p-4 text-left shadow-sm" style={{ borderRadius: '20px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '1.75rem 1.5rem' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '0.75rem' }}>⚡</div>
              <h5 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>Instruction rapide 48h</h5>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', margin: 0, lineHeight: '1.6' }}>
                Validation et homologation par l'Agent Régional mutualiste sous 48 heures ouvrées avec notification SMS.
              </p>
            </div>

            <div className="card p-4 text-left shadow-sm" style={{ borderRadius: '20px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '1.75rem 1.5rem' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '0.75rem' }}>📜</div>
              <h5 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>Attestation QR code officielle</h5>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', margin: 0, lineHeight: '1.6' }}>
                Tampon numérique infalsifiable imprimable ou téléchargeable en PDF A4 officiel pour les admissions d'urgence.
              </p>
            </div>
          </div>

          {/* RÉSEAU HOSPITALIER CONVENTIONNÉ SÉNÉGAL */}
          <div className="card shadow-sm border-0 p-4 p-md-5 rounded-4 text-left" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '2.5rem 2rem' }}>
            <h4 className="fw-bold mb-4 d-flex align-items-center gap-2.5" style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>
              <span>🏛️</span> Établissements Hospitaliers Référents Conventionnés Tiers-Payant UNAMUSC
            </h4>

            <div className="grid grid-3" style={{ gap: '1.25rem' }}>
              {[
                { name: 'Hôpital Universitaire de Fann', dept: 'Dakar Fann | Point E', badge: 'Centre Régional Habilité' },
                { name: 'Hôpital Aristide Le Dantec', dept: 'Dakar Plateau', badge: 'Chirurgie | Oncologie' },
                { name: 'Hôpital Général Idrissa Pouye', dept: 'Pikine | Guédiawaye', badge: 'Urgences 24h/7' },
                { name: 'Centre Hospitalier Abass Ndao', dept: 'Médina | Fass', badge: 'Maternité | Diabétologie' },
                { name: 'Hôpital d\'Enfants Albert Royer', dept: 'Fann | Pédiatrie', badge: 'Pédiatrie 100% CMU' },
                { name: 'Clinique Pasteur & Polycliniques', dept: 'Dakar Métropole', badge: 'Tiers-Payant Privé' }
              ].map((h, idx) => (
                <div key={idx} className="p-3.5 rounded-4 border" style={{ background: 'var(--bg-card-subtle)', borderColor: 'var(--border-color)', padding: '1.25rem 1.1rem' }}>
                  <span className="badge bg-success-subtle text-success border border-success mb-2" style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', borderRadius: '8px' }}>{h.badge}</span>
                  <h6 className="fw-bold mb-1" style={{ color: 'var(--primary)', fontSize: '0.98rem' }}>{h.name}</h6>
                  <small className="text-muted d-block" style={{ fontSize: '0.82rem' }}>{h.dept}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LISTE DES DEMANDES DE GARANTIE ACCESSIBLES SELON LE RÔLE */}
      {activeTab === 'list' && (isStaff || isCitizen || (isPublic && publicSearchCmu)) && (
        <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
          {/* Bannière de rôle distincte */}
          {isStaff && (
            <div className="mb-3 p-3 rounded-4 d-flex align-items-center gap-3" style={{
              borderRadius: '14px',
              background: isSuperAdmin ? 'linear-gradient(90deg, rgba(234,179,8,0.15) 0%, rgba(234,179,8,0.05) 100%)'
                       : isAgent   ? 'linear-gradient(90deg, #1e3a5f 0%, #1d4ed8 100%)'
                       : 'linear-gradient(90deg, #0f766e 0%, #0d9488 100%)',
              color: isSuperAdmin ? '#92400e' : '#ffffff',
              border: isSuperAdmin ? '1px solid rgba(234,179,8,0.4)' : 'none'
            }}>
              <span style={{ fontSize: '1.6rem' }}>
                {isSuperAdmin ? '👑' : isAgent ? '🛡️' : '🩺'}
              </span>
              <div className="d-flex flex-column gap-1">
                <h6 className="fw-extrabold mb-0" style={{ fontSize: '1.05rem', color: 'inherit', letterSpacing: '-0.01em' }}>
                  {isSuperAdmin && 'Mode superadmin'}
                  {isAgent && 'Mode agent UNAMUSC'}
                  {(isDoctor || isMidwife) && `Mode ${isDoctor ? 'médecin' : 'sage-femme'}`}
                  {isCitizen && 'Mode lecture seule'}
                </h6>
                <span className="small" style={{ opacity: 0.9, fontSize: '0.88rem', lineHeight: '1.45' }}>
                  {isSuperAdmin && 'Accès total : Tous les dossiers et toutes les actions sont disponibles.'}
                  {isAgent && 'Instruction & homologation : Validez, définissez le taux et le plafond, ou rejetez avec note.'}
                  {(isDoctor || isMidwife) && 'Consultation des dossiers : Consultez les garanties liées à vos patients (lecture + PDF).'}
                  {isCitizen && 'Espace assuré : Consultez vos lettres de garantie et téléchargez vos attestations certifiées.'}
                </span>
              </div>
            </div>
          )}

          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h4 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
              <span>📋</span> {canInstruire ? 'Gestion & instruction des lettres de garantie UNAMUSC' : (isDoctor || isMidwife) ? 'Dossiers patients — lettres de garantie' : 'Mes lettres de garantie & attestations habilitées'}
            </h4>

            {isCitizen && (
              <span className="badge bg-success-subtle text-success border border-success px-3 py-2 fw-bold" style={{ borderRadius: '12px' }}>
                👤 Assuré connecté : {activeFirstName} {activeLastName} ({activeCmuNumber})
              </span>
            )}
          </div>

          {loading ? (
            <div className="text-center py-5 text-muted">Chargement des dossiers de garantie...</div>
          ) : visibleLetters.length === 0 ? (
            <div className="text-center py-5 text-muted">
              {isCitizen 
                ? 'Aucune demande de garantie enregistrée pour votre compte assuré.' 
                : 'Aucun dossier ne correspond à ce N° de Carte CSU.'}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ color: 'var(--text-main)' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '0.85rem' }}>Assuré / Bénéficiaire</th>
                    <th style={{ padding: '0.85rem' }}>Acte médical & Établissement</th>
                    <th style={{ padding: '0.85rem' }}>Devis soumis</th>
                    <th style={{ padding: '0.85rem' }}>Prise en charge accordée</th>
                    <th style={{ padding: '0.85rem' }}>Statut & Homologation</th>
                    <th style={{ padding: '0.85rem' }}>Code Garantie</th>
                    <th style={{ padding: '0.85rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLetters.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem 0.85rem', minWidth: '230px', verticalAlign: 'top' }}>
                        {(() => {
                          const bInfo = getBeneficiaryInfo(`${item.first_name} ${item.last_name}`, item.cmu_number || activeCmuNumber);
                          return (
                            <div className="d-flex flex-column gap-1.5">
                              <div className="d-flex align-items-center gap-2 flex-wrap">
                                <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: '700' }}>
                                  {item.first_name} {item.last_name}
                                </strong>
                                {bInfo.index === 1 ? (
                                  <span className="badge bg-success-subtle text-success border border-success px-2 py-0.5" style={{ fontSize: '0.68rem', borderRadius: '6px' }}>
                                    Titulaire .1
                                  </span>
                                ) : (
                                  <span className="badge bg-warning-subtle text-warning border border-warning px-2 py-0.5" style={{ fontSize: '0.68rem', borderRadius: '6px' }}>
                                    Ayant droit .{bInfo.index}
                                  </span>
                                )}
                              </div>

                              <div className="d-flex flex-column gap-1 mt-0.5">
                                <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                  <span style={{ color: 'var(--text-sub)', fontSize: '0.76rem', fontWeight: '500' }}>N° CSU :</span>
                                  <code className="px-2 py-0.5 bg-dark text-success border border-success rounded-2 fw-bold" style={{ fontSize: '0.78rem' }}>
                                    {bInfo.beneficiaryCode}
                                  </code>
                                </div>

                                <div className="d-flex align-items-center gap-1.5 flex-wrap" style={{ fontSize: '0.74rem' }}>
                                  <span style={{ color: 'var(--text-sub)' }}>Code adhérent :</span>
                                  <span className="fw-semibold" style={{ color: 'var(--text-main)' }}>{bInfo.adherentCode}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '0.85rem', maxWidth: '260px' }}>
                        <span className="d-block fw-semibold small" style={{ color: 'var(--text-main)' }}>{item.medical_act}</span>
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        <span className="fw-bold" style={{ color: 'var(--text-main)' }}>{Number(item.estimated_amount).toLocaleString()} FCFA</span>
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        <span className="fw-bold text-success d-block">{Number(item.max_amount).toLocaleString()} FCFA</span>
                        <small className="badge bg-success-subtle text-success border border-success">
                          Taux : {item.guaranteed_percentage}%
                        </small>
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        {item.status === 'approved' && (
                          <span className="badge bg-success px-3 py-1.5" style={{ borderRadius: '12px' }}>
                            ✅ Validée UNAMUSC
                          </span>
                        )}
                        {item.status === 'pending' && (
                          <span className="badge bg-warning text-dark px-3 py-1.5" style={{ borderRadius: '12px' }}>
                            ⏳ En instruction agent
                          </span>
                        )}
                        {item.status === 'rejected' && (
                          <span className="badge bg-danger px-3 py-1.5" style={{ borderRadius: '12px' }}>
                            ❌ Rejetée
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        <code className="px-2.5 py-1 bg-dark text-success border border-success rounded-3 fw-bold">
                          {item.validation_code}
                        </code>
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.85rem' }}>
                        {canInstruire ? (
                          <button
                            type="button"
                            className="btn btn-sm text-white fw-bold px-3 py-1.5 shadow-sm"
                            onClick={() => openInstructionModal(item)}
                            style={{ background: isSuperAdmin ? '#92400e' : '#059669', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            {isSuperAdmin ? '👑' : '🛡️'} {item.status === 'approved' ? '📄 Certificat PDF / Garanties' : '⚙️ Instruire & Homologuer'}
                          </button>
                        ) : isDoctor || isMidwife ? (
                          <div className="d-flex justify-content-end align-items-center gap-2.5">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success fw-bold px-3 py-1.5"
                              onClick={() => openInstructionModal(item)}
                              title="Consultation du dossier patient (lecture)"
                              style={{ borderRadius: '8px', fontSize: '0.8rem', marginRight: '0.5rem' }}
                            >
                              🩺 Voir dossier patient
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm text-white fw-bold px-3 py-1.5"
                              onClick={() => generateAndPrintPDFWindow(item)}
                              style={{ background: '#059669', border: 'none', borderRadius: '8px', fontSize: '0.8rem' }}
                            >
                              🖨️ PDF
                            </button>
                          </div>
                        ) : (
                          /* Citoyen : impression de SES lettres uniquement (pas d'instruction) */
                          <button
                            type="button"
                            className="btn btn-sm text-white fw-bold px-3 py-1.5 shadow-sm"
                            onClick={() => generateAndPrintPDFWindow(item)}
                            style={{ background: '#059669', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            🖨️ Imprimer Certificat PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DECK D'INSTRUCTION ET CERTIFICAT OFFICIEL (React Portal — Centered on Screen) */}
      {selectedLetter && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div className="modal-content shadow-lg border-0" style={{ maxWidth: '1140px', width: '100%', maxHeight: '90vh', overflowY: 'auto', borderRadius: '24px', background: 'var(--bg-card)', color: 'var(--text-main)', margin: 'auto', overflow: 'hidden' }}>
            
            {/* Entête Modal Officielle UNAMUSC */}
            <div 
              className="modal-header p-4 text-white position-relative"
              style={{
                background: selectedLetter.status === 'approved' 
                  ? 'linear-gradient(135deg, #059669 0%, #064e3b 100%)' 
                  : 'linear-gradient(135deg, #d97706 0%, #78350f 100%)',
                borderBottom: '1px solid rgba(255,255,255,0.2)'
              }}
            >
              <div>
                <span className="badge px-3 py-1 mb-2 fw-bold text-white d-inline-block" style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '20px' }}>
                  🇸🇳 UNAMUSC — DOSSIER DE PRISE EN CHARGE #{selectedLetter.validation_code}
                </span>
                <h4 className="fw-bold mb-1 text-white">
                  📄 Instruction & attestation de garantie : {selectedLetter.first_name} {selectedLetter.last_name}
                </h4>
                <small className="text-white-50">
                  Homologation 100% humaine par l'agent habilité de l'Union Nationale des Mutuelles de Santé Communautaires (UNAMUSC).
                </small>
              </div>
              <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedLetter(null)}></button>
            </div>

            {/* Navigation Onglets Interne au Modal */}
            <div className="d-flex border-bottom p-3 gap-2 flex-wrap" style={{ background: 'var(--bg-card-subtle)', borderColor: 'var(--border-color)' }}>
              <button 
                type="button" 
                className="btn fw-bold px-4 py-2.5"
                style={{
                  background: modalTab === 'instruction' ? '#059669' : 'var(--bg-card)',
                  color: modalTab === 'instruction' ? '#ffffff' : 'var(--text-sub)',
                  border: modalTab === 'instruction' ? '2px solid #ffffff' : '1px solid var(--border-color)',
                  borderRadius: '10px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: modalTab === 'instruction' ? '0 4px 12px rgba(5, 150, 105, 0.4)' : 'none'
                }}
                onClick={() => setModalTab('instruction')}
              >
                ⚙️ 1. Instruction & Décision Agent UNAMUSC
              </button>
              <button 
                type="button" 
                className="btn fw-bold px-4 py-2.5"
                style={{
                  background: modalTab === 'certificate' ? '#059669' : 'var(--bg-card)',
                  color: modalTab === 'certificate' ? '#ffffff' : 'var(--text-sub)',
                  border: modalTab === 'certificate' ? '2px solid #ffffff' : '1px solid var(--border-color)',
                  borderRadius: '10px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: modalTab === 'certificate' ? '0 4px 12px rgba(5, 150, 105, 0.4)' : 'none'
                }}
                onClick={() => setModalTab('certificate')}
              >
                📄 2. Certificat Officiel & Prise en Charge PDF
              </button>
            </div>

            <div className="modal-body p-4">
              {/* ONGLET 1 : INSTRUCTION & CALCUL DE PRISE EN CHARGE */}
              {modalTab === 'instruction' && (
                <div className="fade-in-up">
                  <div className="row g-4 mb-4">
                    {/* Carte Bénéficiaire */}
                    <div className="col-md-6">
                      <div className="p-3.5 rounded-4 border" style={{ background: 'var(--bg-card-subtle)', borderColor: 'var(--border-color)' }}>
                        <span className="small text-muted d-block mb-1">👤 Assuré bénéficiaire :</span>
                        <h5 className="fw-bold mb-1" style={{ color: 'var(--text-main)' }}>{selectedLetter.first_name} {selectedLetter.last_name}</h5>
                        <div className="d-flex flex-wrap gap-2 align-items-center mt-2">
                          <code className="px-2.5 py-1 bg-dark text-success border border-success rounded-3 fw-bold">
                            N° {selectedLetter.cmu_number}
                          </code>
                          <span className="badge bg-secondary">
                            {selectedLetter.ipp_number || 'IPP-FANN-8812'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Carte Établissement & Acte */}
                    <div className="col-md-6">
                      <div className="p-3.5 rounded-4 border" style={{ background: 'var(--bg-card-subtle)', borderColor: 'var(--border-color)' }}>
                        <span className="small text-muted d-block mb-1">🏥 Acte & Établissement récepteur :</span>
                        <h6 className="fw-bold mb-1 text-success">{selectedLetter.medical_act}</h6>
                        <small className="text-muted d-block mt-1">Devis d'hospitalisation soumis : <strong>{Number(selectedLetter.estimated_amount).toLocaleString()} FCFA</strong></small>
                      </div>
                    </div>
                  </div>

                  {/* SECTION ORDONNANCE MÉDICALE : AFFICHAGE POUR LE GÉRANT */}
                  {selectedLetter.prescription_photo && selectedLetter.prescription_photo !== '/ordonnance_demo.jpg' && (
                    <div className="mb-4 p-3 rounded-3" style={{ background: 'rgba(5,150,105,0.07)', border: '2px dashed #059669', borderRadius: '14px' }}>
                      <strong className="d-block mb-2 fw-bold text-success" style={{ fontSize: '0.9rem' }}>
                        📋 Ordonnance médicale téléversée par l'assuré : À vérifier avant accord :
                      </strong>
                      <img
                        src={selectedLetter.prescription_photo}
                        alt="Ordonnance médicale"
                        style={{ maxWidth: '100%', maxHeight: '260px', borderRadius: '10px', objectFit: 'contain', border: '1.5px solid #059669', background: '#fff' }}
                      />
                      <div className="d-flex gap-2 mt-3 flex-wrap">
                        <span className="badge px-3 py-2 fw-bold" style={{ background: '#f59e0b', color: '#0f172a', borderRadius: '10px', fontSize: '0.82rem' }}>
                          ⏳ En attente de validation du gérant
                        </span>
                        <span className="badge bg-white text-dark border px-3 py-2 fw-bold" style={{ borderRadius: '10px', fontSize: '0.82rem' }}>
                          🔍 Vérifiez lisibilité, signature & tampon médecin
                        </span>
                      </div>
                    </div>
                  )}

                  {/* CALCULATEUR EXÉCUTIF DE COUVERTURE & RESTES À CHARGE */}
                  <div className="card p-4 rounded-4 border-0 mb-4 shadow-sm" style={{ background: 'rgba(5, 150, 105, 0.06)', borderLeft: '5px solid var(--primary)' }}>
                    <h5 className="fw-bold mb-3 text-success d-flex align-items-center gap-2">
                      <span>⚙️</span> Calculateur UNAMUSC de prise en charge & plafond tiers-payant
                    </h5>

                    <div className="row g-4 align-items-center mb-4">
                      <div className="col-md-6">
                        <label className="form-label fw-bold small">Taux de couverture accordé par l'UNAMUSC (%)</label>
                        <div className="d-flex align-items-center gap-2">
                          <input 
                            type="range" 
                            className="form-range flex-grow-1"
                            min="50"
                            max="100"
                            step="5"
                            value={guaranteedPct}
                            onChange={(e) => setGuaranteedPct(e.target.value)}
                          />
                          <span className="badge bg-success fs-6 px-3 py-2 fw-bold">{guaranteedPct}%</span>
                        </div>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label fw-bold small">Plafond maximum garanti ajusté (FCFA)</label>
                        <input 
                          type="number" 
                          className="form-control input fw-bold"
                          value={maxAmount}
                          onChange={(e) => setMaxAmount(e.target.value)}
                          style={{ borderRadius: '10px' }}
                        />
                      </div>
                    </div>

                    {/* Bilan financier dynamique */}
                    {(() => {
                      const estVal = parseFloat(selectedLetter.estimated_amount) || 0;
                      const pctVal = parseFloat(guaranteedPct) || 80;
                      const calcGuarantee = maxAmount !== '' ? (parseFloat(maxAmount) || 0) : (estVal * (pctVal / 100));
                      const calcRest = Math.max(0, estVal - calcGuarantee);

                      return (
                        <div className="p-3.5 rounded-3 border border-success" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)' }}>
                          <div className="row g-3 text-center">
                            <div className="col-md-4">
                              <span className="small d-block mb-1" style={{ color: 'var(--text-sub)' }}>Montant devis soumis</span>
                              <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>{Number(estVal).toLocaleString()} FCFA</h5>
                            </div>
                            <div className="col-md-4 border-start border-end" style={{ borderColor: 'var(--border-color)' }}>
                              <span className="text-success small d-block mb-1">Prise en charge UNAMUSC/CSU</span>
                              <h4 className="fw-bold mb-0 text-success">{Number(calcGuarantee).toLocaleString()} FCFA</h4>
                            </div>
                            <div className="col-md-4">
                              <span className="text-warning small d-block mb-1">Reste à charge patient (Ticket)</span>
                              <h5 className="fw-bold mb-0 text-warning">{Number(calcRest).toLocaleString()} FCFA</h5>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="mt-4">
                      <label className="form-label fw-bold small">Note d'instruction & observations de l'agent habilité UNAMUSC *</label>
                      <textarea 
                        className="form-control input" 
                        rows="3"
                        value={agentNote}
                        onChange={(e) => setAgentNote(e.target.value)}
                        placeholder="Saisissez ici le motif d'acceptation, d'ajustement du plafond ou de réserve..."
                        style={{ borderRadius: '10px' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ONGLET 2 : CERTIFICAT OFFICIEL HAUTE DÉFINITION (STYLE VOUCHER IMPRIMABLE) */}
              {modalTab === 'certificate' && (
                <div className="fade-in-up">
                  <div 
                    id="printable-certificate"
                    className="p-5 rounded-4 border shadow-sm position-relative overflow-hidden mb-4"
                    style={{ 
                      background: '#ffffff', 
                      color: '#0f172a',
                      fontFamily: 'Inter, Arial, sans-serif',
                      border: '2px solid #047857'
                    }}
                  >
                    {/* Entête Officiel Sénégal avec Drapeau 🇸🇳 et Logo Officiel UNAMUSC */}
                    <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-4" style={{ borderColor: '#cbd5e1' }}>
                      <div className="d-flex align-items-center gap-3">
                        <img 
                          src="/senegal_flag.png" 
                          alt="Drapeau du Sénégal 🇸🇳" 
                          style={{ width: '58px', height: '38px', objectFit: 'cover', borderRadius: '4px', border: '1.5px solid #d97706', boxShadow: '0 2px 5px rgba(0,0,0,0.15)' }} 
                        />
                        <div>
                          <h6 className="fw-bold mb-0 text-uppercase" style={{ color: '#047857', letterSpacing: '0.5px', fontSize: '0.92rem' }}>
                            RÉPUBLIQUE DU SÉNÉGAL
                          </h6>
                          <small className="text-muted fw-semibold" style={{ fontSize: '0.75rem' }}>Un Peuple — Un But — Une Foi</small><br />
                          <strong className="small text-uppercase" style={{ color: '#0f172a', fontSize: '0.82rem', letterSpacing: '0.2px' }}>
                            UNION NATIONALE DES MUTUELLES DE SANTÉ COMMUNAUTAIRES (UNAMUSC)
                          </strong><br />
                           <span className="badge bg-success-subtle text-success border border-success fw-semibold" style={{ fontSize: '0.72rem' }}>
                              PROGRAMME NATIONAL DE LA COUVERTURE SANITAIRE DU SÉNÉGAL
                           </span>
                        </div>
                      </div>

                      <div className="d-flex align-items-center gap-3 text-end">
                        <img 
                          src="/unamusc_logo.png" 
                          alt="Logo Officiel UNAMUSC" 
                          style={{ width: '75px', height: '75px', objectFit: 'contain' }} 
                        />
                      </div>
                    </div>

                    <div className="text-center my-4 p-3 rounded-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                      <h4 className="fw-bold text-uppercase mb-1" style={{ color: '#047857', letterSpacing: '1px' }}>
                        ATTESTATION OFFICIELLE DE PRISE EN CHARGE HOSPITALIÈRE
                      </h4>
                      <small className="text-muted fw-semibold">Émise sous le système de Tiers-Payant UNAMUSC — Programme National de la Couverture Sanitaire du Sénégal</small><br />
                      <code className="mt-2 d-inline-block px-3 py-1 bg-white text-success border border-success rounded-3 fw-bold fs-6">
                        Code Homologation : #{selectedLetter.validation_code}
                      </code>
                    </div>

                    {/* Grille des caractéristiques — Haute Lisibilité et Contraste Explicite */}
                    <div className="row g-4 mb-4 p-4 rounded-3" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', boxShadow: 'inset 0 0 0 1px #f1f5f9' }}>
                      <div className="col-md-6">
                        <span className="small fw-bold d-block mb-1" style={{ color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          👤 BÉNÉFICIAIRE ASSURÉ :
                        </span>
                        <h5 className="fw-bold mb-1" style={{ color: '#0f172a' }}>{selectedLetter.first_name} {selectedLetter.last_name}</h5>
                        <div className="small" style={{ color: '#334155' }}>
                          N° Carte CSU : <strong style={{ color: '#0f172a' }}>{selectedLetter.cmu_number}</strong> | IPP : <strong style={{ color: '#0f172a' }}>{selectedLetter.ipp_number || 'IPP-FANN-2026-8812'}</strong>
                        </div>
                        <small className="text-success fw-bold d-block mt-1">
                          Organisme Émetteur : Tiers-Payant UNAMUSC Sénégal
                        </small>
                      </div>

                      <div className="col-md-6">
                        <span className="small fw-bold d-block mb-1" style={{ color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          🏥 STRUCTURE HOSPITALIÈRE D'ACCUEIL :
                        </span>
                        <h6 className="fw-bold mb-1" style={{ color: '#047857', fontSize: '1rem' }}>
                          {selectedLetter.hospital_name || selectedLetter.medical_act}
                        </h6>
                        <div className="small" style={{ color: '#334155' }}>
                          Conventionné Tiers-Payant UNAMUSC (Validation 100% Humaine)
                        </div>
                      </div>

                      <div className="col-md-6 border-top pt-3" style={{ borderColor: '#e2e8f0' }}>
                        <span className="small fw-bold d-block mb-1" style={{ color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          📋 ACTE MÉDICAL / HOSPITALISATION PRESCRITE :
                        </span>
                        <strong className="d-block" style={{ color: '#0f172a', fontSize: '0.95rem' }}>{selectedLetter.medical_act}</strong>
                      </div>

                      <div className="col-md-6 border-top pt-3" style={{ borderColor: '#e2e8f0' }}>
                        <span className="small fw-bold d-block mb-1" style={{ color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          💰 MONTANT ESTIMÉ & ACCORD DE PRISE EN CHARGE :
                        </span>
                        <div className="small" style={{ color: '#334155' }}>
                          Devis Soumis : <strong style={{ color: '#0f172a' }}>{Number(selectedLetter.estimated_amount).toLocaleString()} FCFA</strong><br />
                          Prise en charge UNAMUSC ({selectedLetter.guaranteed_percentage || 80}%) : <strong style={{ color: '#047857', fontSize: '1.05rem' }}>{Number(selectedLetter.guaranteed_amount || (selectedLetter.estimated_amount * 0.8)).toLocaleString()} FCFA</strong><br />
                          <span style={{ color: '#b45309', fontWeight: 'bold' }}>Reste à charge patient (Ticket Modérateur) : {Number(selectedLetter.estimated_amount - (selectedLetter.guaranteed_amount || (selectedLetter.estimated_amount * 0.8))).toLocaleString()} FCFA</span>
                        </div>
                      </div>
                    </div>

                    {/* Engagement Financier Officiel UNAMUSC & Tampon Numérique */}
                    <div className="row g-4 align-items-center">
                      <div className="col-md-8">
                        <div className="p-3 rounded-3" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
                          <strong className="small d-block text-success mb-1 fw-bold">Clause officielle d'engagement financier UNAMUSC :</strong>
                          <p className="small mb-0 text-dark" style={{ lineHeight: '1.5', color: '#0f172a' }}>
                            {selectedLetter.agent_note || 'L\'Union Nationale des Mutuelles de Santé Communautaires (UNAMUSC) s\'engage sous le Programme National de la Couverture Sanitaire du Sénégal à régler directement à l\'établissement hospitalier le montant garanti sous présentation de la facture finale conforme.'}
                          </p>
                        </div>
                      </div>

                      <div className="col-md-4 text-center">
                        <div className="p-2 bg-white rounded-3 shadow-sm d-inline-block border mb-2">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://mutualis.sn/#/verify/${selectedLetter.validation_code}`)}`} 
                            alt="QR Code Validation" 
                            style={{ width: '80px', height: '80px' }} 
                          />
                        </div>
                        <div className="small fw-bold text-success">Tampon Numérique Officiel UNAMUSC</div>
                        <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Homologué par l'UNAMUSC — Signature Agent Habilité</small>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex justify-content-center gap-3 flex-wrap">
                    <button 
                      type="button" 
                      className="btn btn-success fw-bold text-white px-4 py-2.5 shadow-sm"
                      onClick={handleDownloadPDF}
                      style={{ borderRadius: '12px', background: '#059669', borderColor: '#059669' }}
                    >
                      📥 Télécharger le Certificat PDF officiel
                    </button>

                    <button 
                      type="button" 
                      className="btn btn-outline-success fw-bold px-4 py-2.5 shadow-sm"
                      onClick={() => {
                        setSelectedLetter(null);
                        if (setView) setView('verify');
                        window.location.hash = `#/verify/${selectedLetter.validation_code}`;
                      }}
                      style={{ borderRadius: '12px' }}
                    >
                      🔍 Tester la vérification instantanée (#/verify)
                    </button>

                    <button 
                      type="button" 
                      className="btn fw-bold px-4 py-2.5 shadow-sm"
                      onClick={handlePrintCertificate}
                      style={{ borderRadius: '12px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                    >
                      🖨️ Imprimer la lettre de garantie
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Pied de Modale & Boutons de validation finale */}
            <div className="modal-footer border-top p-3 d-flex justify-content-between" style={{ borderColor: 'var(--border-color)' }}>
              <button 
                type="button" 
                className="btn text-white fw-bold px-4" 
                onClick={() => setSelectedLetter(null)} 
                style={{ background: '#334155', border: '1px solid #475569', borderRadius: '10px', color: '#ffffff' }}
              >
                Fermer
              </button>

              {modalTab === 'instruction' && (
                <div className="d-flex gap-2">
                  <button 
                    type="button" 
                    className="btn btn-danger fw-bold px-3 py-2 text-white" 
                    onClick={() => handleValidateAgent('rejected')}
                    style={{ borderRadius: '10px' }}
                  >
                    ❌ Rejeter la demande
                  </button>

                  <button 
                    type="button" 
                    className="btn btn-success fw-bold px-4 py-2 text-white" 
                    onClick={() => handleValidateAgent('approved')}
                    style={{ background: '#059669', borderColor: '#059669', borderRadius: '10px' }}
                  >
                    ✅ Émettre & Certifier la Garantie à 100% / 80%
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
