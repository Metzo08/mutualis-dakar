import React, { useState, useEffect } from 'react';

export default function MedicalProfile({ lang = 'fr' }) {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Formulaire antécédents
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [allergies, setAllergies] = useState('');
  const [chronicConditions, setChronicConditions] = useState('');
  const [pastSurgeries, setPastSurgeries] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
      const benId = citizenData.id || 1;
      const res = await fetch(`/api/medical-profile/${benId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setProfileData(json.data);
        if (json.data.antecedents) {
          const a = json.data.antecedents;
          setBloodGroup(a.blood_group || 'O+');
          setAllergies(a.allergies || '');
          setChronicConditions(a.chronic_conditions || '');
          setPastSurgeries(a.past_surgeries || '');
          setEmergencyName(a.emergency_contact_name || '');
          setEmergencyPhone(a.emergency_contact_phone || '');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveAntecedents = async (e) => {
    e.preventDefault();
    setSavedMsg('');
    try {
      const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
      const benId = citizenData.id || 1;
      const res = await fetch(`/api/medical-profile/${benId}/antecedents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blood_group: bloodGroup,
          allergies,
          chronic_conditions: chronicConditions,
          past_surgeries: pastSurgeries,
          emergency_contact_name: emergencyName,
          emergency_contact_phone: emergencyPhone
        })
      });
      const json = await res.json();
      if (json.success) {
        setSavedMsg('Antécédents médicaux enregistrés avec succès.');
        fetchProfile();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="container py-4">
      <div className="mb-4">
        <h2 style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '0.25rem' }}>
          🩺 {lang === 'wo' ? 'Tére fajj bu féex (Dossier Médical & Antécédents)' : 'Dossier Médical, Antécédents & Résultats d\'Imagerie'}
        </h2>
        <p className="text-muted mb-0">
          {lang === 'wo'
            ? 'Fi nga mën a gise sa groupe sanguin, allergies ak résultats radio/scanner ci sa QR code.'
            : 'Consultez vos antécédents, votre groupe sanguin, vos résultats d\'examens (scanner/radio) et vos codes patients hospitaliers.'}
        </p>
      </div>

      {savedMsg && (
        <div className="alert alert-success d-flex align-items-center mb-4">
          <span className="me-2">✅</span> {savedMsg}
        </div>
      )}

      {loading ? (
        <div>Chargement du dossier médical...</div>
      ) : (
        <div className="row g-4">
          {/* Antécédents médicaux & Groupe Sanguin */}
          <div className="col-md-6">
            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)' }}>
              <h4 className="fw-bold mb-3">🩸 Antécédents Médicaux & Groupe Sanguin</h4>
              <form onSubmit={handleSaveAntecedents}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Groupe Sanguin & Rhésus</label>
                  <select className="form-select fw-bold text-danger" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                    <option value="O+">O Rhésus Positif (O+)</option>
                    <option value="O-">O Rhésus Négatif (O-)</option>
                    <option value="A+">A Rhésus Positif (A+)</option>
                    <option value="A-">A Rhésus Négatif (A-)</option>
                    <option value="B+">B Rhésus Positif (B+)</option>
                    <option value="B-">B Rhésus Négatif (B-)</option>
                    <option value="AB+">AB Rhésus Positif (AB+)</option>
                    <option value="AB-">AB Rhésus Négatif (AB-)</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Allergies Majeures (Médicamenteuses & Alimentaires)</label>
                  <input type="text" className="form-control" placeholder="ex: Pénicilline, Aspirine..." value={allergies} onChange={(e) => setAllergies(e.target.value)} />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Maladies Chroniques (HTA, Diabète, Drépanocytose...)</label>
                  <input type="text" className="form-control" placeholder="ex: Diabète Type 2, HTA" value={chronicConditions} onChange={(e) => setChronicConditions(e.target.value)} />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Chirurgies ou Hospitalisations Antérieures</label>
                  <input type="text" className="form-control" placeholder="ex: Appendicectomie 2021" value={pastSurgeries} onChange={(e) => setPastSurgeries(e.target.value)} />
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Contact Urgence (Nom)</label>
                    <input type="text" className="form-control" placeholder="ex: Moussa Sow" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Téléphone Urgence (ICE)</label>
                    <input type="text" className="form-control" placeholder="ex: +221 77 450 12 34" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary w-100">
                  💾 Enregistrer mes Antécédents
                </button>
              </form>
            </div>
          </div>

          {/* Examens d'Imagerie (Scanners/Radios) & Codes Patients Hospitaliers */}
          <div className="col-md-6">
            <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '16px', background: 'var(--card-bg)' }}>
              <h4 className="fw-bold mb-3">🩻 Examens d'Imagerie & Radiologie (Accessible sur QR Code)</h4>
              {profileData?.imaging?.length === 0 ? (
                <p className="text-muted">Aucun résultat de radio ou scanner téléversé.</p>
              ) : (
                <div className="list-group">
                  {profileData?.imaging?.map((img) => (
                    <div key={img.id} className="list-group-item p-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <h6 className="fw-bold mb-1">{img.title}</h6>
                        <span className="badge bg-info">{img.exam_type}</span>
                      </div>
                      <small className="text-muted">📅 Date d'examen : {new Date(img.exam_date).toLocaleDateString('fr-FR')}</small>
                      <p className="small mb-2 mt-1"><strong>Conclusion Médecin :</strong> {img.doctor_notes}</p>
                      <button className="btn btn-sm btn-outline-primary" onClick={() => alert('Ouverture du rapport d\'imagerie médicale...')}>
                        📄 Consulter le Compte-Rendu PDF / Clichés HD
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Codes Patients Interopérables (SIGOB / DHIS2 / Hôpitaux) */}
            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)' }}>
              <h4 className="fw-bold mb-3">🔗 Codes Patients Hospitaliers Interopérables</h4>
              <p className="small text-muted mb-3">Ces identifiants permettent aux logiciels des hôpitaux (Dantec, Fann, Principal) de reconnaître automatiquement votre dossier lors du scan de votre QR Code.</p>

              {profileData?.externalCodes?.length === 0 ? (
                <div className="badge bg-secondary p-2">Aucun code externe associé pour le moment.</div>
              ) : (
                <ul className="list-group">
                  {profileData?.externalCodes?.map((code) => (
                    <li key={code.id} className="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{code.system_name}</strong>
                        <br />
                        <code className="text-primary fw-bold">{code.external_patient_code}</code>
                      </div>
                      <span className="badge bg-success">Actif & Synchronisé</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
