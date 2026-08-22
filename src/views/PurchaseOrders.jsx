import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getBeneficiaryInfo, getAdherentCode, getBeneficiaryCode } from '../utils/csuFormatter';

export default function PurchaseOrders({ lang = 'fr', userRole = 'citizen', citizenUser = null, agentUser = null, partnerUser = null, setView = null }) {
  const defaultOrders = [
    { id: 101, first_name: 'Amadou', last_name: 'Sow', cmu_number: 'CSU-DKR-2026-8812.2', items_json: JSON.stringify([{ name: 'Amoxicilline 500mg (Gélules)', qty: 2, price: 3500 }, { name: 'Paracétamol 1000mg', qty: 1, price: 1500 }]), total_amount: 8500, cmu_covered: 4250, patient_pay: 4250, status: 'active', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), order_code: 'ORD-2026-PHARM-881' },
    { id: 102, first_name: 'Fatou', last_name: 'Diop', cmu_number: 'CMU-DKR-2026-4401', items_json: JSON.stringify([{ name: 'Sirop Toux Enfant', qty: 1, price: 2800 }, { name: 'Sérum Physiologique (Boîte)', qty: 2, price: 1200 }]), total_amount: 5200, cmu_covered: 2600, patient_pay: 2600, status: 'used', created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(), expires_at: new Date(Date.now() + 12 * 3600 * 1000).toISOString(), order_code: 'ORD-2026-PHARM-440' },
    { id: 103, first_name: 'Modou', last_name: 'Diop', cmu_number: 'SN-DK-MED-1001.1', items_json: JSON.stringify([{ name: 'Metformine 850mg (Diabète)', qty: 3, price: 4200 }, { name: 'Amlodipine 10mg (HTA)', qty: 2, price: 3800 }]), total_amount: 20200, cmu_covered: 10100, patient_pay: 10100, status: 'used', created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), expires_at: new Date().toISOString(), order_code: 'ORD-2026-PHARM-101' },
    { id: 104, first_name: 'Awa', last_name: 'Ndiaye', cmu_number: 'SN-DK-PIK-9001', items_json: JSON.stringify([{ name: 'Fer + Acide Folique Maternité', qty: 2, price: 2500 }, { name: 'Calcium + Vitamine D3', qty: 1, price: 3100 }]), total_amount: 8100, cmu_covered: 4050, patient_pay: 4050, status: 'used', created_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(), expires_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), order_code: 'ORD-2026-PHARM-900' },
    { id: 105, first_name: 'Moustapha', last_name: 'Ndiaye', cmu_number: 'SN-DK-PIK-9021', items_json: JSON.stringify([{ name: 'Ibuprofène 400mg', qty: 2, price: 2100 }, { name: 'Bande Velpeau 10cm', qty: 3, price: 1500 }]), total_amount: 8700, cmu_covered: 4350, patient_pay: 4350, status: 'active', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), order_code: 'ORD-2026-PHARM-902' }
  ];

  const [orderPage, setOrderPage] = useState(1);

  // ═══════════════════════════════════════════════════════
  // RBAC — Définition granulaire des rôles (cohérent avec MedicalProfile)
  // ═══════════════════════════════════════════════════════
  const isSuperAdmin = userRole === 'superadmin' || agentUser?.role === 'SuperAdmin' || agentUser?.role === 'Super Admin';
  const isPharmacist = userRole === 'pharmacist' || agentUser?.role?.includes('Pharmacien');
  const isDoctor     = userRole === 'doctor' || (userRole === 'partner' && partnerUser?.role?.toLowerCase().includes('médecin'));
  const isMidwife    = userRole === 'midwife' || (userRole === 'partner' && partnerUser?.role?.toLowerCase().includes('sage'));
  const isAgent      = (userRole === 'agent' || (!!agentUser && !isPharmacist && !isSuperAdmin)) && !isSuperAdmin;
  const isCitizen    = !isAgent && !isDoctor && !isMidwife && !isPharmacist && !isSuperAdmin && (!!citizenUser && (userRole === 'citizen' || userRole === 'citizen_suspended'));
  const isPublic     = !isAgent && !isDoctor && !isMidwife && !isPharmacist && !isSuperAdmin && !isCitizen;
  const isStaff      = isDoctor || isMidwife || isAgent || isPharmacist || isSuperAdmin;
  // Peut valider les ordonnances en attente (agent gérant ou superadmin)
  const canValidateOrders = isAgent || isSuperAdmin;
  // Peut valider la délivrance en pharmacie
  const canRedeemAtPharmacy = isPharmacist || isSuperAdmin;

  const [publicSearchCmu, setPublicSearchCmu] = useState('');

  const activeCmuNumber = citizenUser?.cmu_number || citizenUser?.cmuNumber || localStorage.getItem('cmu-active-number') || 'CMU-DKR-2026-8812';
  const activeFirstName = citizenUser?.first_name || citizenUser?.firstName || 'Amadou';
  const activeLastName = citizenUser?.last_name || citizenUser?.lastName || 'Sow';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [medicineName, setMedicineName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [prescriptionPhoto, setPrescriptionPhoto] = useState(null);
  const [prescriptionFileName, setPrescriptionFileName] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [editedPharmacyPrice, setEditedPharmacyPrice] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState('');
  const [creating, setCreating] = useState(false);

  const handlePrescriptionFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setPrescriptionFileName(file.name);
      const reader = new FileReader();
      reader.onload = (evt) => {
        setPrescriptionPhoto(evt.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // ── States & handlers pour CRUD complet (Créer, Modifier, Supprimer) des Bons de Commande ──
  const [editingOrderObj, setEditingOrderObj] = useState(null);
  const [isNewOrderObj, setIsNewOrderObj] = useState(false);
  const [confirmDeleteObj, setConfirmDeleteObj] = useState(null); // { title: string, onConfirm: function }

  const handleSaveOrderObj = (e) => {
    e.preventDefault();
    if (!editingOrderObj) return;
    if (!editingOrderObj.first_name || !editingOrderObj.cmu_number) {
      alert('Veuillez renseigner le nom du bénéficiaire et son N° de Carte CSU.');
      return;
    }

    const totalSum = parseFloat(editingOrderObj.total_amount) || 0;
    const cmuCovered = totalSum * 0.5;
    const patientPay = totalSum * 0.5;

    const orderToSave = {
      ...editingOrderObj,
      id: editingOrderObj.id || Date.now(),
      total_amount: totalSum,
      cmu_covered: cmuCovered,
      patient_pay: patientPay,
      order_code: editingOrderObj.order_code || `ORD-2026-PHARM-${Math.floor(100 + Math.random() * 900)}`,
      created_at: editingOrderObj.created_at || new Date().toISOString()
    };

    let updated;
    if (isNewOrderObj) {
      updated = [orderToSave, ...orders];
    } else {
      updated = orders.map(o => o.id === orderToSave.id ? orderToSave : o);
    }
    setOrders(updated);
    localStorage.setItem('cmu_purchase_orders', JSON.stringify(updated));
    setEditingOrderObj(null);
    setIsNewOrderObj(false);
  };

  const handleDeleteOrderObj = (ord) => {
    setConfirmDeleteObj({
      title: `le bon de commande "${ord.order_code || 'ORD'}" de ${ord.first_name} ${ord.last_name}`,
      onConfirm: () => {
        const updated = orders.filter(o => o.id !== ord.id);
        setOrders(updated);
        localStorage.setItem('cmu_purchase_orders', JSON.stringify(updated));
      }
    });
  };

  // Générateur PDF / Fenêtre d'Impression A4 pour les Bons de Commande Pharmacie
  const generateAndPrintPurchaseOrderPDF = (voucher) => {
    if (!voucher) return;
    let itemsList = [];
    try {
      itemsList = typeof voucher.items_json === 'string' ? JSON.parse(voucher.items_json) : (voucher.items_json || []);
    } catch (e) {
      itemsList = [];
    }

    const totalAmt = voucher.total_amount || itemsList.reduce((acc, it) => acc + (it.price * it.qty), 0);
    const cmuAmt = voucher.cmu_covered || (totalAmt * 0.5);
    const patientAmt = voucher.patient_pay || (totalAmt * 0.5);

    const printWin = window.open('', '_blank', 'width=980,height=1150');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bon_De_Commande_Pharmacie_${voucher.order_code || voucher.id}.pdf</title>
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
            <button onclick="window.print()" class="btn btn-success fw-bold px-4 py-2 me-2" style="background: #059669; border-color: #059669;">🖨️ Imprimer / Télécharger le Bon PDF A4</button>
            <button onclick="window.close()" class="btn btn-secondary fw-bold px-3 py-2">Fermer la fenêtre</button>
          </div>

          <div class="cert-box">
            <!-- Entête Officiel Sénégal & UNAMUSC -->
            <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-4" style="border-color: #cbd5e1 !important;">
              <div class="d-flex align-items-center gap-3">
                <img src="/senegal_flag.png" alt="Drapeau du Sénégal" style="width: 54px; height: 36px; object-fit: cover; border-radius: 4px; border: 1.5px solid #d97706;" />
                <div>
                  <h6 class="fw-bold mb-0" style="color: #047857;">République du Sénégal</h6>
                  <small class="text-muted fw-semibold" style="font-size: 0.75rem;">Un Peuple — Un But — Une Foi</small><br />
                  <strong class="small" style="color: #0f172a; font-size: 0.82rem;">Union nationale des mutuelles de santé communautaires (UNAMUSC)</strong><br />
                  <span class="badge bg-success-subtle text-success border border-success fw-semibold" style="font-size: 0.72rem;">Programme national de la couverture sanitaire du Sénégal</span>
                </div>
              </div>
              <div class="text-end">
                <img src="/unamusc_logo.png" alt="UNAMUSC Sénégal" style="width: 85px; height: auto; object-fit: contain;" />
                   <!-- Titre du Bon Pharmacie -->
            <div class="text-center my-4 p-3 rounded-3" style="background: #f0fdf4; border: 1px solid #bbf7d0;">
              <h4 class="fw-bold mb-1" style="color: #047857; letter-spacing: 0.5px;">Bon de commande de médicaments (48h)</h4>
              <small class="text-muted fw-semibold">Système de Tiers-Payant UNAMUSC (Prise en charge 50% — Pharmacies agréées)</small><br />
              <code class="mt-2 d-inline-block px-3 py-1 bg-white text-success border border-success rounded-3 fw-bold fs-6">Code Bon : #${voucher.order_code || `ORD-${voucher.id}`}</code>
            </div>

            <!-- Identification Assuré -->
            <div class="row g-3 mb-4 p-3 rounded-3" style="background: #f8fafc; border: 1.5px solid #cbd5e1;">
              <div class="col-6">
                <span class="small fw-bold d-block text-muted">👤 Bénéficiaire assuré :</span>
                <h5 class="fw-bold mb-0" style="color: #0f172a;">${voucher.first_name} ${voucher.last_name}</h5>
                <small class="text-muted">N° Carte CSU : <strong>${voucher.cmu_number}</strong></small>
              </div>
              <div class="col-6 text-end">
                <span class="small fw-bold d-block text-muted">📅 Date d'émission & validité :</span>
                <strong class="d-block" style="color: #0f172a;">${new Date(voucher.created_at || Date.now()).toLocaleDateString('fr-FR')}</strong>
                <span class="badge bg-warning text-dark fw-bold">Valide 48 Heures</span>
              </div>
            </div>

            <!-- Liste des Médicaments & Tarification Officielle Pharmacie -->
            <h6 class="fw-bold mb-2" style="color: #047857;">💊 Détail des médicaments prescrits & tarification officielle :</h6>
            <table class="table table-bordered align-middle mb-4">
              <thead style="background: #f1f5f9;">
                <tr>
                  <th>Désignation Médicament</th>
                  <th class="text-center">Quantité</th>
                  <th class="text-end">Prix Unitaire Officine</th>
                  <th class="text-end">Total TTC (FCFA)</th>
                </tr>
              </thead>
              <tbody>
                ${itemsList.map(it => `
                  <tr>
                    <td class="fw-bold">${it.name}</td>
                    <td class="text-center"><span class="badge bg-secondary">${it.qty}</span></td>
                    <td class="text-end">${Number(it.price).toLocaleString()} FCFA</td>
                    <td class="text-end fw-bold">${Number(it.price * it.qty).toLocaleString()} FCFA</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <!-- Décompte Financier Officiel -->
            <div class="p-3 rounded-3 mb-4" style="background: #0f172a; color: #ffffff;">
              <div class="row text-center align-items-center">
                <div class="col-4">
                  <span class="small text-white-50 d-block">Montant Réel Officine</span>
                  <strong class="fs-6 text-white">${Number(totalAmt).toLocaleString()} FCFA</strong>
                </div>
                <div class="col-4 border-start border-end border-secondary">
                  <span class="small text-success d-block">Prise en Charge UNAMUSC (50%)</span>
                  <strong class="fs-4 text-success">${Number(cmuAmt).toLocaleString()} FCFA</strong>
                </div>
                <div class="col-4">
                  <span class="small text-warning d-block">Ticket Modérateur Patient (50%)</span>
                  <strong class="fs-6 text-warning">${Number(patientAmt).toLocaleString()} FCFA</strong>
                </div>
              </div>
            </div>

            <!-- Validation Pharmacien & QR Code -->
            <div class="row g-4 align-items-center border-top pt-3" style="border-color: #cbd5e1 !important;">
              <div class="col-8">
                <strong class="small d-block text-success mb-1 fw-bold">Certification Officine & Tiers-Payant :</strong>
                <p class="small text-muted mb-0" style="line-height: 1.5;">
                  Ce bon certifié permet la délivrance immédiate des médicaments prescrits dans toute pharmacie agréée UNAMUSC. Le montant pris en charge (50%) est réglé directement par l'UNAMUSC au pharmacien sous présentation du bon signé.
                </p>
              </div>
              <div class="col-4 text-center">
                <div class="p-2 bg-white rounded-3 shadow-sm d-inline-block border mb-1">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://mutualis.sn/#/verify/${voucher.order_code || `ORD-${voucher.id}`}`)}" alt="QR Code" style="width: 75px; height: 75px;" />
                </div>
                <div class="small fw-bold text-success" style="font-size: 0.75rem;">Tampon numérique pharmacie</div>
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

  const openPharmacistEditModal = (ord) => {
    setEditingVoucher(ord);
    setEditedPharmacyPrice(ord.total_amount || '');
  };

  const handlePharmacistValidate = async (e) => {
    e.preventDefault();
    if (!editingVoucher) return;

    const finalRealPrice = parseFloat(editedPharmacyPrice) || editingVoucher.total_amount || 0;
    const finalCmuCovered = finalRealPrice * 0.5;
    const finalPatientPay = finalRealPrice * 0.5;

    const updatedOrder = {
      ...editingVoucher,
      total_amount: finalRealPrice,
      cmu_covered: finalCmuCovered,
      patient_pay: finalPatientPay,
      status: 'used'
    };

    const updatedOrders = orders.map(o => o.id === editingVoucher.id ? updatedOrder : o);
    setOrders(updatedOrders);
    localStorage.setItem('cmu_purchase_orders', JSON.stringify(updatedOrders));

    setRedeemSuccess(`✅ Bon ${updatedOrder.order_code} certifié & délivré en pharmacie avec le montant réel arrêté de ${finalRealPrice.toLocaleString()} FCFA !`);
    setEditingVoucher(null);

    // Déclenchement automatique du téléchargement / impression du bon certifié avec le montant arrêté de l'officine
    setTimeout(() => {
      generateAndPrintPurchaseOrderPDF(updatedOrder);
    }, 200);
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const storedLocal = JSON.parse(localStorage.getItem('cmu_purchase_orders') || '[]');
      const res = await fetch('/api/purchase-orders');
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        setOrders([...storedLocal, ...json.data]);
      } else {
        setOrders([...storedLocal, ...defaultOrders]);
      }
    } catch (err) {
      console.warn('Utilisation des bons de commande de démonstration:', err);
      const storedLocal = JSON.parse(localStorage.getItem('cmu_purchase_orders') || '[]');
      setOrders([...storedLocal, ...defaultOrders]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!medicineName || !estimatedPrice) return;
    setItems([
      ...items,
      {
        name: medicineName,
        qty: parseInt(quantity) || 1,
        price: parseFloat(estimatedPrice) || 0
      }
    ]);
    setMedicineName('');
    setQuantity(1);
    setEstimatedPrice('');
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };
  
  const visibleOrders = orders.filter((o) => {
    if (isStaff) return true; // Les agents UNAMUSC, médecins et pharmaciens ont accès à tous les bons de commande
    if (isCitizen) {
      // L'assuré connecté ne voit STRICTEMENT QUE SES PROPRES BONS DE COMMANDE
      const cmuMatch = (o.cmu_number || '').trim().toLowerCase() === (activeCmuNumber || '').trim().toLowerCase();
      const nameMatch = (o.first_name?.trim().toLowerCase() === activeFirstName?.trim().toLowerCase() && 
                         o.last_name?.trim().toLowerCase() === activeLastName?.trim().toLowerCase());
      return cmuMatch || nameMatch;
    }
    if (publicSearchCmu.trim()) {
      return o.cmu_number.toLowerCase().includes(publicSearchCmu.trim().toLowerCase());
    }
    return false;
  });

  const handleCreateOrder = async () => {
    if (items.length === 0) return;
    setCreating(true);
    setRedeemSuccess('');

    const totalSum = items.reduce((a, b) => a + (b.price * b.qty), 0);
    const cmuCovered = totalSum * 0.5;
    const patientPay = totalSum * 0.5;

    const newOrder = {
      id: Date.now(),
      first_name: activeFirstName,
      last_name: activeLastName,
      cmu_number: activeCmuNumber,
      prescription_photo: prescriptionPhoto,
      prescription_file_name: prescriptionFileName,
      items_json: JSON.stringify(items),
      total_amount: totalSum,
      cmu_covered: cmuCovered,
      patient_pay: patientPay,
      status: 'active',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      order_code: `ORD-2026-PHARM-${Math.floor(100 + Math.random() * 900)}`
    };

    try {
      await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beneficiary_id: 1,
          items: items,
          total_amount: totalSum
        })
      });
    } catch (err) {
      console.warn(err);
    }

    const updated = [newOrder, ...orders];
    setOrders(updated);
    localStorage.setItem('cmu_purchase_orders', JSON.stringify(updated));

    setRedeemSuccess(`🎉 Bon de commande ${newOrder.order_code} émis avec succès sous Tiers-Payant UNAMUSC (Valable 48h) !`);
    setItems([]);
    setCreating(false);

    // Déclenchement automatique de l'impression / téléchargement PDF du bon actif généré
    setTimeout(() => {
      generateAndPrintPurchaseOrderPDF(newOrder);
    }, 300);
  };

  const handleRedeem = async (id) => {
    const updated = orders.map(o => o.id === id ? { ...o, status: 'used' } : o);
    setOrders(updated);
    localStorage.setItem('cmu_purchase_orders', JSON.stringify(updated));

    try {
      await fetch(`/api/purchase-orders/${id}/redeem`, { method: 'POST' });
    } catch (err) {
      console.warn(err);
    }

    setRedeemSuccess('✅ Bon de commande validé avec succès par la pharmacie ! Médicaments délivrés.');
  };

  const overrideActive = (
    localStorage.getItem(`cmu-status-${citizenUser?.cmuNumber || citizenUser?.cmu_number}`) === 'active' ||
    localStorage.getItem('cmu-portal-mode') === 'citizen'
  );

  const isSuspended = !overrideActive && (
    userRole === 'citizen_suspended' || 
    citizenUser?.status === 'suspended' || 
    citizenUser?.status === 'inactif' || 
    citizenUser?.status === 'suspendu' || 
    localStorage.getItem('cmu-portal-mode') === 'citizen_suspended' ||
    localStorage.getItem('cmu-cotisation-suspended') === 'true'
  );

  if (isCitizen && isSuspended) {
    return (
      <div className="container py-5 fade-in-up">
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          <div className="card shadow-lg border-0 p-4 p-md-5 text-center my-4" style={{ borderRadius: '24px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '2px solid #ef4444' }}>
            <div className="d-inline-flex align-items-center justify-content-center p-3 rounded-circle mb-3 mx-auto" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', width: '70px', height: '70px' }}>
              <span style={{ fontSize: '2.2rem' }}>⚠️</span>
            </div>
            
            <h3 className="fw-bold mb-2 text-danger" style={{ fontSize: '1.4rem' }}>⚠️ Accès à la pharmacie refusé — Couverture CSU suspendue</h3>
            
            <div className="mb-3">
              <code className="px-3 py-1.5 bg-dark text-warning border border-warning rounded-3 fw-bold d-inline-block" style={{ fontSize: '1.05rem', color: '#f59e0b' }}>
                {activeCmuNumber}
              </code>
            </div>

            <p className="lead mb-4 mx-auto" style={{ maxWidth: '640px', fontSize: '1.05rem', lineHeight: '1.65' }}>
              Votre cotisation annuelle n'est pas à jour. La délivrance et l'utilisation des bons de commande pharmacie sont suspendues.
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
      {/* Banner signature de la vue */}
      <section 
        className="banner-mini text-white mb-5 rounded-4 overflow-hidden position-relative text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.38) 0%, rgba(16, 185, 129, 0.18) 100%), url("/csu_bsf_real.png") center/cover no-repeat',
          padding: '3.75rem 2.5rem',
          minHeight: '240px',
          borderRadius: '24px',
          boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.45)',
          marginBottom: '3.5rem'
        }}
      >
        <div className="d-flex flex-column align-items-center justify-content-center position-relative text-center mx-auto" style={{ zIndex: 2, maxWidth: '850px' }}>
          <span 
            className="badge px-3 py-1 mb-2 fw-semibold d-inline-block text-center"
            style={{
              background: 'rgba(255, 255, 255, 0.22)',
              color: '#ffffff',
              backdropFilter: 'blur(4px)',
              borderRadius: '20px',
              fontSize: '0.82rem',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}
          >
            🇸🇳 UNAMUSC Sénégal — Bons de Commande Médicaments (Prise en charge 50%)
          </span>
          <h1 className="fw-bold mb-2 text-white text-center" style={{ fontSize: '2rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {lang === 'wo' ? '💊 Bonu Garab Pharmacie Tiers-Payant' : '💊 Bons de Commande de Médicaments'}
          </h1>
          <p className="mb-3 text-white-50 text-center mx-auto" style={{ fontSize: '0.98rem', lineHeight: '1.6', textShadow: '0 1px 2px rgba(0,0,0,0.2)', maxWidth: '750px' }}>
            {lang === 'wo' 
              ? 'Genereel sa bon bu garab ngir jénd garab ci pharmacie ak Tiers-Payant UNAMUSC (50% prise en charge).' 
              : 'Générez et présentez vos bons de commande de médicaments délivrés directement en pharmacie agréée sous le Tiers-Payant UNAMUSC (50% mutuelle, 50% ticket modérateur).'}
          </p>
        </div>
      </section>

      {redeemSuccess && (
        <div className="alert alert-success d-flex align-items-center mb-4 rounded-3 shadow-sm border-0">
          <span className="fs-4 me-2">✅</span>
          <div style={{ color: 'var(--text-main)' }}>{redeemSuccess}</div>
        </div>
      )}

      {agentValidationMsg && (
        <div className="alert alert-info d-flex align-items-center mb-4 rounded-3 shadow-sm border-0">
          <span className="fs-4 me-2">🛡️</span>
          <div style={{ color: 'var(--text-main)' }}>{agentValidationMsg}</div>
        </div>
      )}

      {/* BANNIÈRE DE RÔLE — distincte selon le profil */}
      {isStaff && (
        <div className="mb-4 p-3 rounded-4 d-flex align-items-center gap-3" style={{
          borderRadius: '14px',
          background: isSuperAdmin ? 'linear-gradient(90deg, rgba(234,179,8,0.15) 0%, rgba(234,179,8,0.05) 100%)'
                   : isAgent   ? 'linear-gradient(90deg, #1e3a5f 0%, #1d4ed8 100%)'
                   : isPharmacist ? 'linear-gradient(90deg, #047857 0%, #059669 100%)'
                   : 'linear-gradient(90deg, #0f766e 0%, #0d9488 100%)',
          color: isSuperAdmin ? '#92400e' : '#ffffff',
          border: isSuperAdmin ? '1px solid rgba(234,179,8,0.4)' : 'none'
        }}>
          <span style={{ fontSize: '1.6rem' }}>
            {isSuperAdmin ? '👑' : isAgent ? '🛡️' : isPharmacist ? '💊' : '🩺'}
          </span>
          <div className="d-flex flex-column gap-1">
            <h6 className="fw-extrabold mb-0" style={{ fontSize: '1.05rem', color: 'inherit', letterSpacing: '-0.01em' }}>
              {isSuperAdmin && 'Mode superadmin'}
              {isAgent && 'Mode agent UNAMUSC'}
              {isPharmacist && 'Mode pharmacien agréé'}
              {(isDoctor || isMidwife) && `Mode ${isDoctor ? 'médecin' : 'sage-femme'} prescripteur`}
              {isCitizen && 'Mode lecture seule'}
            </h6>
            <span className="small" style={{ opacity: 0.9, fontSize: '0.88rem', lineHeight: '1.45' }}>
              {isSuperAdmin && 'Accès total : Toutes les actions sont disponibles sur tous les bons.'}
              {isAgent && 'Validation des ordonnances : Validez ou rejetez les ordonnances soumises par les assurés.'}
              {isPharmacist && 'Validation de la délivrance : Certifiez le montant réel d\'officine et délivrez les médicaments.'}
              {(isDoctor || isMidwife) && 'Suivi des ordonnances : Consultez le statut de délivrance des ordonnances prescrites.'}
              {isCitizen && 'Espace assuré : Consultez vos bons de commande pharmacie et téléchargez vos ordonnances.'}
            </span>
          </div>
        </div>
      )}

      {/* RANGÉE KPIS EXÉCUTIF BONS PHARMACIE (Assuré vs Personnel de Santé/Admin) */}
      {(() => {
        const citizenTotalCount = visibleOrders.length;
        const citizenDeliveredCount = visibleOrders.filter(o => o.status === 'redeemed' || o.status === 'approved').length;
        const citizenPendingCount = visibleOrders.filter(o => o.status === 'pending').length;
        const citizenTotalCovered = visibleOrders.reduce((sum, o) => sum + (Number(o.cmu_covered || (o.total_amount * 0.5)) || 0), 0);

        if (isCitizen) {
          return (
            <div className="row g-3 mb-4">
              <div className="col-md-3 col-6">
                <div className="card shadow-sm border-0 p-3.5 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)' }}>
                  <span className="small text-muted mb-1 d-block fw-bold">Mes ordonnances & bons</span>
                  <h3 className="fw-extrabold mb-0 text-primary" style={{ fontSize: '1.75rem' }}>{citizenTotalCount}</h3>
                  <small className="text-muted" style={{ fontSize: '0.74rem' }}>Ordonnances enregistrées</small>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="card shadow-sm border-0 p-3.5 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)' }}>
                  <span className="small text-muted mb-1 d-block fw-bold">Délivrés en pharmacie</span>
                  <h3 className="fw-extrabold mb-0 text-success" style={{ fontSize: '1.75rem' }}>{citizenDeliveredCount}</h3>
                  <small className="text-success fw-bold" style={{ fontSize: '0.74rem' }}>Médicaments retirés</small>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="card shadow-sm border-0 p-3.5 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)' }}>
                  <span className="small text-muted mb-1 d-block fw-bold">Bons actifs (48h)</span>
                  <h3 className="fw-extrabold mb-0 text-warning" style={{ fontSize: '1.75rem' }}>{citizenPendingCount}</h3>
                  <small className="text-warning fw-bold" style={{ fontSize: '0.74rem' }}>À retirer en officine</small>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="card shadow-sm border-0 p-3.5 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)' }}>
                  <span className="small text-muted mb-1 d-block fw-bold">Prise en charge pharmacie</span>
                  <h3 className="fw-extrabold mb-0 text-success" style={{ fontSize: '1.55rem' }}>{citizenTotalCovered.toLocaleString('fr-FR')} FCFA</h3>
                  <small className="text-success fw-bold" style={{ fontSize: '0.74rem' }}>Économie Tiers-payant 50%</small>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="row g-3 mb-4">
            <div className="col-md-3 col-6">
              <div className="card shadow-sm border-0 p-3.5 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                <span className="small text-muted mb-1 d-block fw-bold">Bons de commande émis</span>
                <h3 className="fw-extrabold mb-0 text-primary" style={{ fontSize: '1.75rem' }}>1 240</h3>
                <small className="text-muted" style={{ fontSize: '0.74rem' }}>En pharmacie & officines</small>
              </div>
            </div>
            <div className="col-md-3 col-6">
              <div className="card shadow-sm border-0 p-3.5 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                <span className="small text-muted mb-1 d-block fw-bold">Délivrés en officine</span>
                <h3 className="fw-extrabold mb-0 text-success" style={{ fontSize: '1.75rem' }}>1 080</h3>
                <small className="text-success fw-bold" style={{ fontSize: '0.74rem' }}>Prise en charge 50% / 100%</small>
              </div>
            </div>
            <div className="col-md-3 col-6">
              <div className="card shadow-sm border-0 p-3.5 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                <span className="small text-muted mb-1 d-block fw-bold">En cours de validité (48h)</span>
                <h3 className="fw-extrabold mb-0 text-warning" style={{ fontSize: '1.75rem' }}>160</h3>
                <small className="text-warning fw-bold" style={{ fontSize: '0.74rem' }}>En attente au guichet</small>
              </div>
            </div>
            <div className="col-md-3 col-6">
              <div className="card shadow-sm border-0 p-3.5 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                <span className="small text-muted mb-1 d-block fw-bold">Total médicaments pris en charge</span>
                <h3 className="fw-extrabold mb-0 text-success" style={{ fontSize: '1.75rem' }}>42 350 000 FCFA</h3>
                <small className="text-success fw-bold" style={{ fontSize: '0.74rem' }}>Tiers-payant UNAMUSC</small>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Formulaire de création de bon de commande */}
      <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
        <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
          <span>🛒</span> Nouveau bon de commande / ordonnance médicale UNAMUSC
        </h4>

        {/* Bloc Téléversement / Prise de Photo de l'ordonnance médicale */}
        <div className="mb-4 p-3.5 rounded-4" style={{ background: 'var(--bg-body)', border: '1.5px dashed var(--primary)' }}>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
            <label className="form-label small fw-extrabold mb-0 d-flex align-items-center gap-2 text-primary" style={{ fontSize: '0.95rem' }}>
              <span>📷 Photo / Scan de l'ordonnance médicale (Smartphone, Tablette ou Ordinateur) *</span>
            </label>
            {prescriptionPhoto && <span className="badge bg-success text-white">🟢 Ordonnance originale numérisée & jointe</span>}
          </div>

          <input 
            type="file" 
            id="desktopPrescriptionFileInput" 
            accept="image/*,.pdf" 
            capture="environment" 
            onChange={handlePrescriptionFileUpload} 
            style={{ display: 'none' }} 
          />

          {!prescriptionPhoto ? (
            <div className="d-flex flex-wrap gap-2 mt-2">
              <button 
                type="button" 
                className="btn btn-emerald text-white fw-bold py-2.5 px-4 d-inline-flex align-items-center gap-2 shadow-sm"
                style={{ borderRadius: '12px', background: '#059669', borderColor: '#059669', fontSize: '0.9rem' }}
                onClick={() => document.getElementById('desktopPrescriptionFileInput')?.click()}
              >
                <span>📷</span> Prendre en photo / Scanner l'ordonnance
              </button>
              <button 
                type="button" 
                className="btn btn-outline-secondary fw-bold py-2.5 px-4 d-inline-flex align-items-center gap-2"
                style={{ borderRadius: '12px', fontSize: '0.9rem' }}
                onClick={() => document.getElementById('desktopPrescriptionFileInput')?.click()}
              >
                <span>📁</span> Importer un fichier image / PDF
              </button>
            </div>
          ) : (
            <div className="d-flex align-items-center gap-3 mt-2 p-2.5 bg-white rounded-3 border">
              <img 
                src={prescriptionPhoto} 
                alt="Aperçu ordonnance" 
                style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #cbd5e1' }} 
              />
              <div className="flex-grow-1 overflow-hidden" style={{ minWidth: 0 }}>
                <strong className="d-block text-truncate" style={{ fontSize: '0.9rem', color: '#0f172a' }}>{prescriptionFileName || 'ordonnance_scanné.jpg'}</strong>
                <span className="badge bg-success-subtle text-success border border-success" style={{ fontSize: '0.75rem' }}>Document de santé certifié prêt</span>
              </div>
              <button 
                type="button" 
                className="btn btn-sm btn-outline-danger" 
                onClick={() => { setPrescriptionPhoto(null); setPrescriptionFileName(''); }}
                style={{ borderRadius: '10px' }}
              >
                🗑️ Remplacer
              </button>
            </div>
          )}
          <small className="text-muted d-block mt-2" style={{ fontSize: '0.78rem' }}>
            💡 Vous pouvez prendre une photo directe avec la caméra de votre téléphone/tablette ou importer le fichier scanné depuis votre ordinateur.
          </small>
        </div>

        <form onSubmit={handleAddItem}>
          <div className="row g-3 align-items-end mb-3">
            <div className="col-md-5">
              <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.4rem' }}>Nom du médicament prescrit *</label>
              <input 
                type="text" 
                className="form-control input"
                placeholder="ex: Amoxicilline 500mg, Paracétamol..."
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
                style={{ borderRadius: '10px', height: '48px' }}
                required
              />
            </div>
            <div className="col-md-2">
              <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.4rem' }}>Quantité</label>
              <input 
                type="number" 
                className="form-control input"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                style={{ borderRadius: '10px', height: '48px' }}
                required
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.4rem' }}>Prix unitaire estimé (FCFA)</label>
              <input 
                type="number" 
                className="form-control input"
                placeholder="ex: 3500"
                value={estimatedPrice}
                onChange={(e) => setEstimatedPrice(e.target.value)}
                style={{ borderRadius: '10px', height: '48px' }}
                required
              />
            </div>
            <div className="col-md-2">
              <button 
                type="submit" 
                className="btn text-white w-100 fw-bold"
                style={{ height: '48px', borderRadius: '10px', background: 'var(--primary)', borderColor: 'var(--primary)' }}
              >
                ➕ Ajouter
              </button>
            </div>
          </div>
        </form>

        {items.length > 0 && (
          <div className="border rounded-3 p-3.5 mb-3" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
            <h6 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>💊 Médicaments sur ce bon de commande :</h6>
            <div className="list-group mb-3">
              {items.map((it, idx) => (
                <div key={idx} className="list-group-item d-flex justify-content-between align-items-center p-3 rounded-3 mb-2" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <div>
                    <strong className="d-block" style={{ color: 'var(--text-main)' }}>{it.name}</strong>
                    <span className="badge bg-secondary">Quantité: {it.qty}</span>
                  </div>
                  <div className="d-flex align-items-center gap-3">
                    <div>
                      <span className="fw-bold text-primary d-block">{(it.price * it.qty).toLocaleString()} FCFA</span>
                      <small className="text-success">Pris en charge CSU (50%): {((it.price * it.qty) * 0.5).toLocaleString()} FCFA</small>
                    </div>
                    <button className="btn btn-sm btn-outline-danger py-1 px-2" onClick={() => handleRemoveItem(idx)}>
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-dark text-white rounded-3 mb-3 border border-success">
              <div className="row g-2 text-center">
                <div className="col-4">
                  <span className="small text-white-50 d-block">Prix Public Total</span>
                  <strong className="fs-6">{items.reduce((a, b) => a + (b.price * b.qty), 0).toLocaleString()} FCFA</strong>
                </div>
                <div className="col-4 border-start border-end border-secondary">
                  <span className="small text-success d-block">Prise en charge CSU (50%)</span>
                  <strong className="fs-5 text-success">{(items.reduce((a, b) => a + (b.price * b.qty), 0) * 0.5).toLocaleString()} FCFA</strong>
                </div>
                <div className="col-4">
                  <span className="small text-warning d-block">Ticket patient (50%)</span>
                  <strong className="fs-6 text-warning">{(items.reduce((a, b) => a + (b.price * b.qty), 0) * 0.5).toLocaleString()} FCFA</strong>
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 pt-2">
              <span className="small text-muted">Valide pendant 48 heures dans toutes les pharmacies agréées du Sénégal.</span>
              <button className="btn btn-success px-4 py-2.5 fw-bold text-white shadow-sm" onClick={handleCreateOrder} disabled={creating} style={{ borderRadius: '12px', background: '#059669', borderColor: '#059669' }}>
                {creating ? 'Émission...' : '✅ Émettre le bon pharmacie 48h certifié'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BANNIÈRE SÉCURITÉ S'IL S'AGIT D'UN VISITEUR NON CONNECTÉ SANS RECHERCHE */}
      {isPublic && !publicSearchCmu && (
        <div className="card shadow-sm border-0 p-4 mb-4 text-center rounded-4" style={{ background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.85) 0%, rgba(4, 120, 87, 0.9) 100%), url("/csu_bsf_real.png") center/cover no-repeat', color: '#ffffff', border: 'none' }}>
          <div className="fs-1 mb-2">🔒</div>
          <h4 className="fw-bold text-white">Accès sécurisé aux bons de commande pharmacie</h4>
          <p className="mx-auto" style={{ maxWidth: '650px', lineHeight: '1.6', color: 'rgba(255,255,255,0.9)' }}>
            Par mesure de protection des données de santé, la consultation des bons de commande est strictement réservée aux assurés identifiés ou aux pharmaciens agréés UNAMUSC.
          </p>

          <div className="d-flex justify-content-center align-items-center gap-3 flex-wrap mt-2">
            {setView && (
              <button className="btn fw-bold px-4 py-2.5" onClick={() => setView('login')} style={{ borderRadius: '12px', background: '#ffffff', color: '#047857' }}>
                🔐 Se connecter à mon espace assuré / pharmacie
              </button>
            )}
          </div>

          <div className="mt-4 pt-3 border-top mx-auto" style={{ maxWidth: '520px', borderColor: 'var(--border-color)' }}>
            <label className="form-label small text-muted fw-bold mb-2">Rechercher directement votre bon avec votre N° de Carte CSU :</label>
            <div className="input-group">
              <input 
                type="text" 
                className="form-control fw-bold input" 
                placeholder="Ex: CMU-DKR-2026-8812" 
                value={publicSearchCmu} 
                onChange={(e) => setPublicSearchCmu(e.target.value)} 
                style={{ borderRadius: '12px 0 0 12px', height: '48px' }}
              />
              <button className="btn btn-success fw-bold px-4" style={{ borderRadius: '0 12px 12px 0', background: '#059669' }}>
                🔍 Consulter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liste des bons de commande */}
      {(isStaff || isCitizen || (isPublic && publicSearchCmu)) && (
        <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
            <h4 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>
              📋 {isDoctor ? 'Ordonnances & bons de commande prescrits' : isAgent ? 'Gestion & validation des bons pharmacie UNAMUSC' : 'Mes bons de commande médicaments (48h)'}
            </h4>

            <div className="d-flex align-items-center gap-2 flex-wrap">
              <button 
                type="button" 
                className="btn btn-emerald fw-bold text-white px-3.5 py-2 d-inline-flex align-items-center gap-2 shadow-sm" 
                style={{ background: '#059669', border: 'none', borderRadius: '12px', fontSize: '0.88rem' }}
                onClick={() => {
                  setIsNewOrderObj(true);
                  setEditingOrderObj({
                    first_name: '',
                    last_name: '',
                    cmu_number: activeCmuNumber,
                    items_json: JSON.stringify([{ name: 'Amoxicilline 500mg', qty: 1, price: 3500 }]),
                    total_amount: 3500,
                    status: 'active',
                    order_code: `ORD-2026-PHARM-${Math.floor(100 + Math.random() * 900)}`
                  });
                }}
              >
                <span>➕ Émettre un bon de commande pharmacie</span>
              </button>

              {isCitizen && (
                <span className="badge bg-success-subtle text-success border border-success px-3 py-2 fw-bold" style={{ borderRadius: '12px' }}>
                  👤 Assuré connecté : {activeFirstName} {activeLastName} ({activeCmuNumber})
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5 text-muted">Chargement des bons de commande...</div>
          ) : visibleOrders.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <span style={{ fontSize: '3rem' }}>💊</span>
              <p className="mt-2" style={{ fontSize: '0.9rem' }}>
                {isCitizen 
                  ? 'Aucun bon de commande disponible pour votre compte assuré.' 
                  : 'Aucun bon de commande ne correspond à ce N° de Carte CSU.'}
              </p>
            </div>
          ) : (
            <div className="table-responsive rounded-4 border" style={{ borderColor: 'rgba(255, 255, 255, 0.25)', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
              <table className="table align-middle mb-0" style={{ color: 'var(--text-main)', borderCollapse: 'collapse', minWidth: '1500px' }}>
                <thead>
                  <tr style={{ background: 'var(--card-bg)' }}>
                    <th style={{ padding: '1.1rem 1rem', fontSize: '0.85rem', fontWeight: '800', border: '1px solid rgba(255, 255, 255, 0.25)', textTransform: 'none', letterSpacing: 'normal' }}>Code & date</th>
                    <th style={{ padding: '1.1rem 1rem', fontSize: '0.85rem', fontWeight: '800', border: '1px solid rgba(255, 255, 255, 0.25)', textTransform: 'none', letterSpacing: 'normal' }}>Assuré / bénéficiaire</th>
                    <th style={{ padding: '1.1rem 1rem', fontSize: '0.85rem', fontWeight: '800', border: '1px solid rgba(255, 255, 255, 0.25)', textTransform: 'none', letterSpacing: 'normal' }}>Médicaments prescrits</th>
                    <th style={{ padding: '1.1rem 1rem', fontSize: '0.85rem', fontWeight: '800', border: '1px solid rgba(255, 255, 255, 0.25)', textTransform: 'none', letterSpacing: 'normal' }}>Prise en charge CSU</th>
                    <th style={{ padding: '1.1rem 1rem', fontSize: '0.85rem', fontWeight: '800', border: '1px solid rgba(255, 255, 255, 0.25)', textTransform: 'none', letterSpacing: 'normal' }}>Chrono validité</th>
                    <th style={{ padding: '1.1rem 1rem', fontSize: '0.85rem', fontWeight: '800', border: '1px solid rgba(255, 255, 255, 0.25)', textTransform: 'none', letterSpacing: 'normal' }}>Statut & homologation</th>
                    <th style={{ padding: '1.1rem 1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: '800', border: '1px solid rgba(255, 255, 255, 0.25)', textTransform: 'none', letterSpacing: 'normal', minWidth: '450px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((ord, idx) => {
                    let itemsList = [];
                    try {
                      itemsList = typeof ord.items_json === 'string' ? JSON.parse(ord.items_json) : (ord.items_json || []);
                    } catch (e) {}

                    const bInfo = getBeneficiaryInfo(`${ord.first_name} ${ord.last_name}`, ord.cmu_number || activeCmuNumber);

                    return (
                      <tr 
                        key={ord.id} 
                        style={{ 
                          background: idx % 2 === 1 ? 'rgba(255, 255, 255, 0.03)' : 'transparent' 
                        }}
                      >
                        {/* 1. Code & date */}
                        <td style={{ padding: '1.1rem 1rem', border: '1px solid rgba(255, 255, 255, 0.2)', verticalAlign: 'top' }}>
                          <code className="px-3 py-1.5 bg-dark text-success border border-success rounded-3 fw-bold d-inline-block mb-1 shadow-sm" style={{ fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                            {ord.order_code || `ORD-2026-${ord.id}`}
                          </code>
                          <small className="text-muted d-block mt-0.5" style={{ fontSize: '0.82rem' }}>
                            📅 {new Date(ord.created_at).toLocaleDateString('fr-FR')}
                          </small>
                        </td>

                        {/* 2. Assuré / bénéficiaire */}
                        <td style={{ padding: '1.1rem 1rem', border: '1px solid rgba(255, 255, 255, 0.2)', verticalAlign: 'top', minWidth: '230px' }}>
                          <div className="d-flex flex-column" style={{ gap: '0.45rem' }}>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <strong style={{ color: 'var(--text-main)', fontSize: '0.98rem', fontWeight: '800' }}>
                                {ord.first_name} {ord.last_name}
                              </strong>
                              {bInfo.index === 1 ? (
                                <span className="badge bg-success-subtle text-success border border-success px-2 py-0.5" style={{ fontSize: '0.72rem', borderRadius: '6px' }}>
                                  Titulaire .1
                                </span>
                              ) : (
                                <span className="badge bg-warning-subtle text-warning border border-warning px-2 py-0.5" style={{ fontSize: '0.72rem', borderRadius: '6px' }}>
                                  Ayant droit .{bInfo.index}
                                </span>
                              )}
                            </div>

                            <div className="text-muted" style={{ fontSize: '0.82rem' }}>
                              <span className="fw-semibold">N° CSU : </span>
                              <code className="px-2 py-0.5 bg-dark text-success border border-success rounded-2 fw-bold" style={{ fontSize: '0.8rem' }}>
                                {bInfo.beneficiaryCode}
                              </code>
                            </div>

                            <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                              <span className="fw-semibold">Code adhérent : </span>
                              <span className="fw-bold" style={{ color: 'var(--text-main)' }}>{bInfo.adherentCode}</span>
                            </div>
                          </div>
                        </td>

                        {/* 3. Médicaments prescrits */}
                        <td style={{ padding: '1.1rem 1rem', border: '1px solid rgba(255, 255, 255, 0.2)', verticalAlign: 'top', maxWidth: '250px' }}>
                          <div className="d-flex flex-wrap gap-1">
                            {itemsList.map((i, idx) => (
                              <span key={idx} className="badge bg-dark-subtle text-body border me-1 my-1 p-2" style={{ borderRadius: '6px', fontSize: '0.8rem' }}>
                                💊 {i.name} (x{i.qty})
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* 4. Prise en charge CSU */}
                        <td style={{ padding: '1.1rem 1rem', border: '1px solid rgba(255, 255, 255, 0.2)', verticalAlign: 'top' }}>
                          <div className="d-flex flex-column gap-1">
                            <div className="text-muted" style={{ fontSize: '0.88rem', fontWeight: '700' }}>
                              Devis estimé: {Number(ord.total_amount).toLocaleString('fr-FR')} FCFA
                            </div>
                            <div className="text-success" style={{ fontSize: '0.94rem', fontWeight: '800' }}>
                              Accord UNAMUSC (50%): {Number(ord.cmu_covered || (ord.total_amount * 0.5)).toLocaleString('fr-FR')} FCFA
                            </div>
                            <div className="text-warning small" style={{ fontSize: '0.82rem', fontWeight: '700' }}>
                              Part assuré (50%): {Number(ord.patient_pay || (ord.total_amount * 0.5)).toLocaleString('fr-FR')} FCFA
                            </div>
                            <div>
                              <span className="badge bg-success-subtle text-success border border-success px-2 py-0.5 fw-bold" style={{ fontSize: '0.74rem', borderRadius: '6px' }}>
                                Taux officiel pharmacie : 50%
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 5. Chrono validité */}
                        <td style={{ padding: '1.1rem 1rem', border: '1px solid rgba(255, 255, 255, 0.2)', verticalAlign: 'top' }}>
                          <span className="badge bg-warning text-dark px-3 py-2 fw-bold d-inline-block shadow-sm" style={{ borderRadius: '10px', fontSize: '0.78rem' }}>
                            ⏳ Validité 48h
                          </span>
                        </td>

                        {/* 6. Statut & homologation */}
                        <td style={{ padding: '1.1rem 1rem', border: '1px solid rgba(255, 255, 255, 0.2)', verticalAlign: 'top' }}>
                          {ord.status === 'active' && <span className="badge bg-success px-3 py-2 text-white fw-bold d-inline-block shadow-sm" style={{ borderRadius: '12px', fontSize: '0.8rem' }}>✅ Actif (Prêt)</span>}
                          {ord.status === 'used' && <span className="badge bg-secondary px-3 py-2 text-white fw-bold d-inline-block shadow-sm" style={{ borderRadius: '12px', fontSize: '0.8rem' }}>🔒 Délivré en pharmacie</span>}
                          {ord.status === 'expired' && <span className="badge bg-danger px-3 py-2 text-white fw-bold d-inline-block shadow-sm" style={{ borderRadius: '12px', fontSize: '0.8rem' }}>⚠️ Expiré</span>}
                          {ord.status === 'pending_review' && <span className="badge px-3 py-2 fw-bold d-inline-block shadow-sm" style={{ borderRadius: '12px', background: '#f59e0b', color: '#0f172a', fontSize: '0.8rem' }}>⏳ En attente validation ordonnance</span>}
                        </td>

                        {/* 7. Actions */}
                        <td className="text-end" style={{ padding: '1.1rem 1rem', border: '1px solid rgba(255, 255, 255, 0.2)', verticalAlign: 'top', whiteSpace: 'nowrap', minWidth: '450px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success fw-bold px-3 py-2 hover-lift"
                              onClick={() => generateAndPrintPurchaseOrderPDF(ord)}
                              style={{ borderRadius: '10px', fontSize: '0.82rem' }}
                            >
                              📄 PDF
                            </button>

                            {/* Validation délivrance — Pharmacien / SuperAdmin uniquement sur bons actifs */}
                            {canRedeemAtPharmacy && ord.status === 'active' && (
                              <button
                                type="button"
                                className="btn btn-sm btn-success fw-bold px-3 py-2 text-white shadow-sm hover-lift"
                                onClick={() => openPharmacistEditModal(ord)}
                                style={{ borderRadius: '10px', fontSize: '0.82rem', background: '#059669', borderColor: '#059669' }}
                              >
                                💊 Valider pharmacie
                              </button>
                            )}

                            {/* Modifier le bon de commande */}
                            <button
                              type="button"
                              className="btn btn-sm fw-bold px-3 py-2 d-inline-flex align-items-center gap-1.5 hover-lift"
                              style={{
                                background: 'rgba(59, 130, 246, 0.18)',
                                color: '#60a5fa',
                                border: '1.5px solid #3b82f6',
                                borderRadius: '10px',
                                fontSize: '0.84rem',
                                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)'
                              }}
                              title="Modifier le bon de commande"
                              onClick={() => {
                                setEditingOrderObj({ ...ord });
                                setIsNewOrderObj(false);
                              }}
                            >
                              ✏️ Modifier
                            </button>

                            {/* Supprimer le bon de commande */}
                            <button
                              type="button"
                              className="btn btn-sm fw-bold px-3 py-2 d-inline-flex align-items-center gap-1.5 hover-lift"
                              style={{
                                background: 'rgba(239, 68, 68, 0.18)',
                                color: '#f87171',
                                border: '1.5px solid #ef4444',
                                borderRadius: '10px',
                                fontSize: '0.84rem',
                                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)'
                              }}
                              title="Supprimer le bon"
                              onClick={() => handleDeleteOrderObj(ord)}
                            >
                              🗑️ Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        {/* Pagination Controls */}
        {(() => {
          const pageSize = 10;
          const citizenTotalCovered = visibleOrders.reduce((sum, o) => sum + (Number(o.cmu_covered || (o.total_amount * 0.5)) || 0), 0);
          const totalVolume = isCitizen ? visibleOrders.length : 1240;
          const totalPages = Math.max(1, Math.ceil(totalVolume / pageSize));
          const safePage = Math.min(orderPage, totalPages);
          const startItem = totalVolume === 0 ? 0 : (safePage - 1) * pageSize + 1;
          const endItem = Math.min(safePage * pageSize, totalVolume);

          const getVisiblePages = () => {
            const pages = [1];
            if (safePage > 3) pages.push('...');
            for (let p = Math.max(2, safePage - 1); p <= Math.min(totalPages - 1, safePage + 1); p++) {
              if (!pages.includes(p)) pages.push(p);
            }
            if (safePage < totalPages - 2) pages.push('...');
            if (!pages.includes(totalPages)) pages.push(totalPages);
            return pages;
          };

          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: '600' }}>
                {isCitizen ? (
                  <>
                    Affichage de <strong style={{ color: 'var(--text-main)' }}>{startItem}</strong> à <strong style={{ color: 'var(--text-main)' }}>{endItem}</strong> sur <strong style={{ color: '#059669' }}>{totalVolume} bon(s) de commande</strong> ({citizenTotalCovered.toLocaleString('fr-FR')} FCFA pris en charge)
                  </>
                ) : (
                  <>
                    Affichage de <strong style={{ color: 'var(--text-main)' }}>{startItem.toLocaleString('fr-FR')}</strong> à <strong style={{ color: 'var(--text-main)' }}>{endItem.toLocaleString('fr-FR')}</strong> sur <strong style={{ color: '#059669' }}>1 240 bons de commande pharmacie</strong> (42 350 000 FCFA délivrés)
                  </>
                )}
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-outline btn-sm hover-lift"
                    disabled={safePage <= 1}
                    onClick={() => setOrderPage(prev => Math.max(1, prev - 1))}
                    style={{ borderRadius: '10px' }}
                  >
                    ⬅️ Précédent
                  </button>

                  {getVisiblePages().map((p, idx) => {
                    if (p === '...') return <span key={`dots-${idx}`} style={{ padding: '0 0.2rem', color: 'var(--text-sub)' }}>...</span>;
                    return (
                      <button
                        key={p}
                        className={`btn btn-sm hover-lift ${safePage === p ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setOrderPage(p)}
                        style={{ minWidth: '36px', fontWeight: safePage === p ? '800' : 'normal', borderRadius: '10px' }}
                      >
                        {p}
                      </button>
                    );
                  })}

                  <button
                    className="btn btn-outline btn-sm"
                    disabled={safePage >= totalPages}
                    onClick={() => setOrderPage(prev => Math.min(totalPages, prev + 1))}
                  >
                    Suivant ➡️
                  </button>
                </div>
              )}
            </div>
          );
        })()}
        </div>
      )}

      {/* MODALE DE REJET AGENT — ordonnance pending_review (React Portal) */}
      {validatingOrder && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div className="shadow-lg border-0" style={{ maxWidth: '560px', width: '100%', borderRadius: '20px', background: 'var(--bg-card, #1e293b)', backgroundColor: '#1e293b', color: 'var(--text-main)', margin: 'auto', border: '1px solid var(--border-color, rgba(255,255,255,0.15))', overflow: 'hidden' }}>
            <div className="p-3.5 d-flex justify-content-between align-items-center" style={{ background: '#dc2626', color: '#ffffff' }}>
              <h5 className="fw-bold mb-0" style={{ fontSize: '1.1rem' }}>
                ❌ Rejet d'ordonnance — #{validatingOrder.order_code}
              </h5>
              <button type="button" className="btn-close btn-close-white" onClick={() => setValidatingOrder(null)}></button>
            </div>
            <div className="p-4" style={{ background: 'var(--bg-card, #1e293b)' }}>
              <p className="small mb-3" style={{ color: 'var(--text-sub)', lineHeight: 1.5 }}>
                Vous êtes sur le point de <strong style={{ color: '#ef4444' }}>rejeter</strong> le bon de commande de
                <strong style={{ color: 'var(--text-main)' }}> {validatingOrder.first_name} {validatingOrder.last_name}</strong> ({validatingOrder.cmu_number}).
                L'assuré sera notifié et devra corriger son ordonnance.
              </p>
              <label className="form-label small fw-bold text-danger mb-1">Note de refus (visible par l'assuré) *</label>
              <textarea
                className="form-control input"
                rows={3}
                placeholder="Ex : Ordonnance illisible, médicament non couvert, prescription manquante..."
                value={agentRejectNote}
                onChange={(e) => setAgentRejectNote(e.target.value)}
                style={{ borderRadius: '12px' }}
              />
              <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" className="btn btn-secondary fw-bold" style={{ borderRadius: '10px' }} onClick={() => setValidatingOrder(null)}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn fw-bold px-4 text-white"
                  style={{ background: '#dc2626', borderColor: '#dc2626', borderRadius: '10px' }}
                  onClick={() => handleRejectOrder(validatingOrder.id, agentRejectNote)}
                >
                  ❌ Confirmer le rejet
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODALE DE REVISION DES PRIX RÉELS ET VALIDATION PHARMACIEN (React Portal — Centered on Screen) */}
      {editingVoucher && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div className="shadow-lg border-0" style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', borderRadius: '22px', background: 'var(--bg-card, #1e293b)', backgroundColor: '#1e293b', color: 'var(--text-main)', margin: 'auto', border: '1.5px solid rgba(16,185,129,0.4)', overflow: 'hidden' }}>
            {/* Header émeraude */}
            <div className="p-3.5 d-flex justify-content-between align-items-center" style={{ background: 'linear-gradient(135deg, #047857 0%, #059669 50%, #10b981 100%)', color: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.2rem' }}>💊</span>
                <h5 className="fw-bold mb-0" style={{ fontSize: '1.05rem', color: '#ffffff', textTransform: 'none' }}>
                  Validation pharmacie & tarification officielle — #{editingVoucher.order_code}
                </h5>
              </div>
              <button type="button" className="btn-close btn-close-white" onClick={() => setEditingVoucher(null)}></button>
            </div>

            <form onSubmit={handlePharmacistValidate} className="p-4" style={{ background: 'var(--bg-card, #1e293b)' }}>
              {/* Infos assuré */}
              <div style={{ padding: '1rem', borderRadius: '14px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.72rem', display: 'block', fontWeight: 600 }}>Assuré(e) bénéficiaire</small>
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.98rem' }}>{editingVoucher.first_name} {editingVoucher.last_name}</strong>
                </div>
                <span style={{ background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', fontFamily: 'monospace' }}>
                  {editingVoucher.cmu_number}
                </span>
              </div>

              <p className="small mb-3" style={{ color: 'var(--text-sub)', lineHeight: 1.5 }}>
                Ajustez ou confirmez le <strong>Montant réel officine (FCFA)</strong> calculé au comptoir pour la délivrance des médicaments.
              </p>

              <div className="mb-3">
                <label className="form-label small fw-bold" style={{ color: '#10b981' }}>Montant réel total arrêté par la pharmacie (FCFA) *</label>
                <input 
                  type="number" 
                  className="form-control input fw-bold" 
                  value={editedPharmacyPrice}
                  onChange={(e) => setEditedPharmacyPrice(e.target.value)}
                  style={{ borderRadius: '12px', fontSize: '1.25rem', height: '52px', color: '#10b981', border: '1px solid #10b981' }}
                  required
                />
                <small style={{ color: 'var(--text-sub)', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>L'estimatif initial soumis par le client était de {editingVoucher.total_amount?.toLocaleString()} FCFA.</small>
              </div>

              {/* Répartition de la prise en charge */}
              <div style={{ padding: '1.15rem', borderRadius: '14px', background: 'rgba(5, 150, 105, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', textAlign: 'center' }}>
                  <div style={{ paddingRight: '1rem', borderRight: '1px solid var(--border-color)' }}>
                    <small style={{ color: '#10b981', fontSize: '0.74rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Tiers-payant UNAMUSC (50%)</small>
                    <strong style={{ color: '#10b981', fontSize: '1.25rem', fontWeight: 800 }}>
                      {((parseFloat(editedPharmacyPrice) || 0) * 0.5).toLocaleString()} FCFA
                    </strong>
                  </div>
                  <div>
                    <small style={{ color: '#f59e0b', fontSize: '0.74rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Ticket modérateur client (50%)</small>
                    <strong style={{ color: '#f59e0b', fontSize: '1.25rem', fontWeight: 800 }}>
                      {((parseFloat(editedPharmacyPrice) || 0) * 0.5).toLocaleString()} FCFA
                    </strong>
                  </div>
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-secondary fw-bold" style={{ borderRadius: '12px', padding: '0.65rem 1.25rem' }} onClick={() => setEditingVoucher(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn fw-bold text-white" style={{ background: 'linear-gradient(135deg, #047857 0%, #059669 50%, #10b981 100%)', border: 'none', borderRadius: '12px', padding: '0.65rem 1.5rem', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}>
                  ✅ Valider prix & édition automatique PDF
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODALE AFFICHAGE DU VOUCHER DE COMMANDE PAR PHARMACIE (React Portal — Centered on Screen) */}
      {selectedVoucher && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div className="shadow-lg border-0" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', borderRadius: '22px', background: 'var(--bg-card, #1e293b)', backgroundColor: '#1e293b', color: 'var(--text-main)', margin: 'auto', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <div className="p-3.5 d-flex justify-content-between align-items-center" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card-subtle)' }}>
              <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.05rem', textTransform: 'none' }}>
                💊 Bon pharmacie tiers-payant — #{selectedVoucher.order_code || `ORD-${selectedVoucher.id}`}
              </h5>
              <button type="button" className="btn-close" onClick={() => setSelectedVoucher(null)}></button>
            </div>

            <div className="p-4 text-center" style={{ background: 'var(--bg-card, #1e293b)' }}>
              <div className="p-4 rounded-4 border bg-white text-dark text-start mb-3" style={{ border: '2px solid #047857' }}>
                <div className="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
                  <div>
                    <h6 className="fw-bold text-success mb-0" style={{ textTransform: 'none' }}>Bon de commande de médicaments (48h)</h6>
                    <small className="text-muted">Tiers-payant UNAMUSC — Programme national de la couverture sanitaire</small>
                  </div>
                  <code className="bg-dark text-success p-2 rounded fw-bold">
                    {selectedVoucher.order_code || `ORD-${selectedVoucher.id}`}
                  </code>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <span className="small text-muted d-block">Bénéficiaire :</span>
                    <strong>{selectedVoucher.first_name} {selectedVoucher.last_name}</strong>
                  </div>
                  <div className="col-6 text-end">
                    <span className="small text-muted d-block">Code carte CSU :</span>
                    <strong>{selectedVoucher.cmu_number}</strong>
                  </div>
                </div>

                <h6 className="fw-bold mb-2">Prescriptions :</h6>
                <ul className="list-group mb-3">
                  {(() => {
                    try {
                      const items = typeof selectedVoucher.items_json === 'string' ? JSON.parse(selectedVoucher.items_json) : selectedVoucher.items_json;
                      return items.map((it, idx) => (
                        <li key={idx} className="list-group-item d-flex justify-content-between align-items-center">
                          <span>💊 {it.name} (x{it.qty})</span>
                          <strong>{(it.price * it.qty).toLocaleString()} FCFA</strong>
                        </li>
                      ));
                    } catch (e) {
                      return <li className="list-group-item">Prescription médicamenteuse</li>;
                    }
                  })()}
                </ul>

                <div className="d-flex justify-content-between align-items-center p-3 bg-light rounded-3">
                  <div>
                    <span className="small text-muted d-block">Montant pris en charge CMU (50%) :</span>
                    <h5 className="fw-bold text-success mb-0">{(selectedVoucher.total_amount * 0.5).toLocaleString()} FCFA</h5>
                  </div>
                  <div className="text-end">
                    <span className="small text-muted d-block">Ticket patient (50%) :</span>
                    <h6 className="fw-bold text-warning mb-0">{(selectedVoucher.total_amount * 0.5).toLocaleString()} FCFA</h6>
                  </div>
                </div>
              </div>

              <div className="d-flex justify-content-center gap-3">
                <button 
                  type="button" 
                  className="btn btn-success fw-bold px-4" 
                  onClick={() => generateAndPrintPurchaseOrderPDF(selectedVoucher)}
                  style={{ background: '#059669', borderColor: '#059669', borderRadius: '12px' }}
                >
                  📥 Télécharger le bon PDF
                </button>
                <button type="button" className="btn btn-secondary fw-bold" style={{ borderRadius: '12px' }} onClick={() => setSelectedVoucher(null)}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* MODAL DE CRÉATION / ÉDITION DE BON DE COMMANDE PHARMACIE (React Portal) */}
      {editingOrderObj && createPortal(
        <div 
          style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', overflowY: 'auto' }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingOrderObj(null); }}
        >
          <form onSubmit={handleSaveOrderObj} style={{ maxWidth: '720px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1.5px solid #059669', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', margin: 'auto' }}>
            
            <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 'bold' }}>
                  💊
                </div>
                <div>
                  <h5 className="fw-extrabold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>
                    {isNewOrderObj ? 'Émettre un bon de commande pharmacie (48h)' : 'Modifier le bon de commande'}
                  </h5>
                  <span className="badge bg-success-subtle text-success border border-success fw-bold" style={{ borderRadius: '6px', fontSize: '0.74rem' }}>
                    UNAMUSC • Tiers-Payant Officine
                  </span>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setEditingOrderObj(null)}></button>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label small fw-bold mb-1">Prénom du bénéficiaire *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingOrderObj.first_name || ''}
                  onChange={(e) => setEditingOrderObj({ ...editingOrderObj, first_name: e.target.value })}
                  placeholder="Ex: Amadou"
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-bold mb-1">Nom du bénéficiaire *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingOrderObj.last_name || ''}
                  onChange={(e) => setEditingOrderObj({ ...editingOrderObj, last_name: e.target.value })}
                  placeholder="Ex: Sow"
                  required
                />
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label small fw-bold mb-1">N° de Carte CSU *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingOrderObj.cmu_number || ''}
                  onChange={(e) => setEditingOrderObj({ ...editingOrderObj, cmu_number: e.target.value })}
                  placeholder="Ex: CSU-DKR-2026-8812.2"
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-bold mb-1">Code Bon de Commande *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingOrderObj.order_code || ''}
                  onChange={(e) => setEditingOrderObj({ ...editingOrderObj, order_code: e.target.value })}
                  placeholder="Ex: ORD-2026-PHARM-881"
                  required
                />
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label small fw-bold mb-1">Montant total estimé (FCFA) *</label>
                <input 
                  type="number" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingOrderObj.total_amount || ''}
                  onChange={(e) => setEditingOrderObj({ ...editingOrderObj, total_amount: e.target.value })}
                  placeholder="Ex: 8500"
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-bold mb-1">Statut du bon de commande *</label>
                <select 
                  className="form-select"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingOrderObj.status || 'active'}
                  onChange={(e) => setEditingOrderObj({ ...editingOrderObj, status: e.target.value })}
                >
                  <option value="active">✅ Actif (Prêt pour pharmacie)</option>
                  <option value="used">🔒 Délivré en pharmacie</option>
                  <option value="pending_review">⏳ En attente validation ordonnance</option>
                  <option value="rejected">❌ Rejeté</option>
                  <option value="expired">⚠️ Expiré</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold mb-1">Remarque / Note agent</label>
              <input 
                type="text" 
                className="form-control" 
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                value={editingOrderObj.agentNote || ''}
                onChange={(e) => setEditingOrderObj({ ...editingOrderObj, agentNote: e.target.value })}
                placeholder="Ex: Ordonnance vérifiée et prise en charge accordée à 80%."
              />
            </div>

            <div className="d-flex justify-content-between align-items-center pt-3.5 border-top w-100" style={{ borderColor: 'var(--border-color)' }}>
              <button 
                type="button" 
                className="btn px-4 py-2.5 fw-bold" 
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.88rem' }} 
                onClick={() => setEditingOrderObj(null)}
              >
                Annuler
              </button>
              <button 
                type="submit" 
                className="btn px-4.5 py-2.5 fw-bold text-white" 
                style={{ background: '#059669', border: 'none', borderRadius: '12px', fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}
              >
                💾 Enregistrer le bon pharmacie
              </button>
            </div>

          </form>
        </div>,
        document.body
      )}
      {/* MODAL / POP-UP DE CONFIRMATION DE SUPPRESSION (React Portal) */}
      {confirmDeleteObj && createPortal(
        <div 
          style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.82)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDeleteObj(null); }}
        >
          <div 
            className="shadow-2xl text-center" 
            style={{ maxWidth: '480px', width: '100%', background: 'var(--bg-card, #1e293b)', color: 'var(--text-main, #ffffff)', borderRadius: '24px', padding: '2.25rem 1.75rem', border: '1.5px solid rgba(239, 68, 68, 0.4)', boxShadow: '0 25px 70px rgba(239, 68, 68, 0.25), 0 10px 30px rgba(0, 0, 0, 0.5)', margin: 'auto' }}
          >
            <div 
              style={{ width: '72px', height: '72px', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.35) 100%)', border: '2px solid #ef4444', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', margin: '0 auto 1.25rem auto', boxShadow: '0 10px 25px rgba(239, 68, 68, 0.3)' }}
            >
              🗑️
            </div>

            <h4 className="fw-extrabold mb-2" style={{ color: 'var(--text-main)', fontSize: '1.25rem' }}>
              Confirmer la suppression
            </h4>

            <p className="mb-4" style={{ color: 'var(--text-sub, #94a3b8)', fontSize: '0.92rem', lineHeight: '1.55' }}>
              Voulez-vous vraiment supprimer définitivement <strong style={{ color: '#ef4444' }}>{confirmDeleteObj.title}</strong> ?
              <br />
              <small className="text-muted d-block mt-1">Cette action est irréversible dans le système UNAMUSC.</small>
            </p>

            <div className="d-flex justify-content-center gap-3 pt-2">
              <button
                type="button"
                className="btn px-4 py-2.5 fw-bold"
                style={{ background: 'var(--bg-card-subtle, #334155)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--border-color, #475569)', borderRadius: '12px', fontSize: '0.88rem' }}
                onClick={() => setConfirmDeleteObj(null)}
              >
                Annuler
              </button>

              <button
                type="button"
                className="btn px-4 py-2.5 fw-bold text-white"
                style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)', border: 'none', borderRadius: '12px', fontSize: '0.88rem', boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)' }}
                onClick={() => {
                  confirmDeleteObj.onConfirm();
                  setConfirmDeleteObj(null);
                }}
              >
                🗑️ Supprimer définitivement
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
