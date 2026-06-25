import React, { useState, useEffect } from 'react';

export default function Medicaments({ lang }) {
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all'); // all, medicament, soin
  const [selectedCovered, setSelectedCovered] = useState('all'); // all, true, false
  const [loading, setLoading] = useState(true);

  // Calculator states
  const [calcType, setCalcType] = useState('80'); // rate percentage: 100, 80, 50
  const [calcAmount, setCalcAmount] = useState('10000');
  const [calcResult, setCalcResult] = useState(null);

  const dict = {
    fr: {
      title: 'Guide de prise en charge',
      subtitle: 'Consultez la liste officielle des médicaments et actes médicaux couverts par la CMU au Sénégal, leurs taux de remboursement, et le simulateur de reste à charge.',
      searchPlaceholder: 'Rechercher un médicament ou acte médical...',
      filterType: 'Type de prestation',
      filterCovered: 'Statut de prise en charge',
      all: 'Tous',
      medicament: 'Médicament',
      soin: 'Soin / acte médical',
      statusCovered: 'Pris en charge',
      statusUncovered: 'Non pris en charge',
      thName: 'Médicament / acte de soin',
      thCategory: 'Catégorie',
      thRate: 'Taux cmu',
      thStatus: 'Couverture',
      calcTitle: 'Simulateur de reste à charge',
      calcDesc: 'Calculez instantanément la part remboursée par votre mutuelle CMU et le montant restant à votre charge chez le médecin ou pharmacien.',
      calcAmountLabel: 'Montant de la facture (FCFA)',
      calcRateLabel: 'Taux de couverture cmu',
      calcBtn: 'Calculer le remboursement',
      calcShareCmu: 'Part de la mutuelle cmu',
      calcShareUser: 'Reste à votre charge',
      calcTiersPayant: 'Éligible au tiers-payant (paiement direct à 80%)',
      noData: 'Aucun médicament ou acte de soin trouvé.'
    },
    wo: {
      title: 'Dossier garab ak fajj',
      subtitle: 'Xoolal garab yi ak fajj yi CMU di fay ci Sénégal, taux de remboursement yi, ak calculateu reste à charge.',
      searchPlaceholder: 'Seet garab walla soin...',
      filterType: 'Soin walla Garab',
      filterCovered: 'Mën na fajjoo cmu',
      all: 'Lépp',
      medicament: 'Garab',
      soin: 'Fajj / soin',
      statusCovered: 'Cmu di na ko fay',
      statusUncovered: 'Fayul cmu',
      thName: 'Garab / fajj',
      thCategory: 'Catégorie',
      thRate: 'Taux cmu',
      thStatus: 'Couverture',
      calcTitle: 'Simulateur reste à charge',
      calcDesc: 'Xoolal nimu di di fayé ak xalis bi nga wara fay ci pharmacie walla docteur.',
      calcAmountLabel: 'Facture bi (FCFA)',
      calcRateLabel: 'Taux cmu',
      calcBtn: 'Calculer',
      calcShareCmu: 'Part cmu',
      calcShareUser: 'Sa part (reste)',
      calcTiersPayant: 'Tiers-payant (fay direct)',
      noData: 'Guissunuko garab walla soin.'
    }
  };

  const t = dict[lang];

  useEffect(() => {
    setLoading(true);
    let url = 'http://localhost:5000/api/coverage-items';
    const params = [];
    if (searchQuery) params.push(`search=${encodeURIComponent(searchQuery)}`);
    if (selectedType !== 'all') params.push(`type=${encodeURIComponent(selectedType)}`);
    if (selectedCovered !== 'all') params.push(`covered=${encodeURIComponent(selectedCovered)}`);

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    fetch(url)
      .then(res => res.json())
      .then(data => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        // Fallback local data if offline
        const localItems = [
          { name: 'Paracétamol 500mg', type: 'medicament', covered: true, coverage_rate: 80, category: 'Antalgique', description: 'Médicament générique essentiel pour la douleur et la fièvre.' },
          { name: 'Amoxicilline 500mg', type: 'medicament', covered: true, coverage_rate: 80, category: 'Antibiotique', description: 'Antibiotique courant pris en charge à 80%.' },
          { name: 'ACT (traitement paludisme)', type: 'medicament', covered: true, coverage_rate: 100, category: 'Antipaludéen', description: 'Traitement du paludisme simple couvert à 100%.' },
          { name: 'Insuline Humaine', type: 'medicament', covered: true, coverage_rate: 50, category: 'Diabète', description: 'Insuline pour le diabète de type 1, prise en charge à 50%.' },
          { name: 'Métformine 500mg', type: 'medicament', covered: true, coverage_rate: 80, category: 'Diabète', description: 'Antidiabétique oral, couvert à 80%.' },
          { name: 'Consultation médecine générale', type: 'soin', covered: true, coverage_rate: 80, category: 'Consultation', description: 'Consultation chez un médecin généraliste conventionné.' },
          { name: 'Consultation pédiatrique', type: 'soin', covered: true, coverage_rate: 80, category: 'Consultation', description: 'Prise en charge de l\'examen clinique pédiatrique.' },
          { name: 'Accouchement Simple', type: 'soin', covered: true, coverage_rate: 100, category: 'Maternité', description: 'Accouchement simple en hôpital public, couvert à 100%.' },
          { name: 'Césarienne d\'urgence', type: 'soin', covered: true, coverage_rate: 100, category: 'Maternité', description: 'Acte chirurgical couvert à 100% dans le public.' },
          { name: 'Radiographie pulmonaire', type: 'soin', covered: true, coverage_rate: 80, category: 'Imagerie', description: 'Examen radiographique du thorax sur ordonnance.' },
          { name: 'Chimiothérapie complexe', type: 'soin', covered: false, coverage_rate: 0, category: 'Oncologie', description: 'Protocoles de chimiothérapie spécialisés hors liste nationale CMU.' },
          { name: 'Chirurgie esthétique de confort', type: 'soin', covered: false, coverage_rate: 0, category: 'Chirurgie', description: 'Actes esthétiques non reconstructeurs, non pris en charge.' },
          { name: 'Implants dentaires cosmétiques', type: 'soin', covered: false, coverage_rate: 0, category: 'Dentaire', description: 'Dentisterie esthétique et prothèses haut de gamme.' },
          { name: 'Verres progressifs de luxe', type: 'soin', covered: false, coverage_rate: 0, category: 'Optique', description: 'Verres correcteurs importés haut de gamme.' },
          { name: 'Compléments alimentaires', type: 'medicament', covered: false, coverage_rate: 0, category: 'Confort', description: 'Vitamines de confort achetées sans ordonnance.' }
        ];
        
        let filtered = localItems;
        if (selectedType !== 'all') filtered = filtered.filter(i => i.type === selectedType);
        if (selectedCovered !== 'all') filtered = filtered.filter(i => i.covered === (selectedCovered === 'true'));
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
        }
        setItems(filtered);
      });
  }, [searchQuery, selectedType, selectedCovered]);

  const handleCalculate = (e) => {
    e.preventDefault();
    const amount = parseFloat(calcAmount);
    if (isNaN(amount) || amount <= 0) return;

    const rate = parseInt(calcType);
    const cmuShare = (amount * rate) / 100;
    const userShare = amount - cmuShare;

    setCalcResult({
      total: amount,
      cmuShare,
      userShare,
      rate
    });
  };

  return (
    <div className="medicaments-view fade-in-up">
      {/* Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(to right, rgba(5, 150, 105, 0.7), rgba(5, 150, 105, 0.4)), url("/meds_hero_real.png") center/cover no-repeat',
        borderBottom: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ textAlign: 'left', position: 'relative', zIndex: 2 }}>
          <span className="badge badge-info" style={{ marginBottom: '0.75rem', background: 'rgba(255, 255, 255, 0.15)', color: '#fff' }}>
            🏥 ANNUAIRE CMU SÉNÉGAL
          </span>
          <h1 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: '0.5rem' }}>{t.title}</h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.9rem', maxWidth: '800px', lineHeight: '1.5' }}>{t.subtitle}</p>
        </div>
      </section>

      {/* Grid Layout: Simulator & Table */}
      <div className="grid grid-2" style={{ gap: '2rem', alignItems: 'start' }}>
        
        {/* Left Side: Reimbursement Calculator */}
        <div className="card" style={{ padding: '2rem', textAlign: 'left' }}>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>
            🧮 {t.calcTitle}
          </h3>
          <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
            {t.calcDesc}
          </p>

          <form onSubmit={handleCalculate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{t.calcAmountLabel}</label>
              <input
                type="number"
                className="form-control"
                value={calcAmount}
                onChange={(e) => setCalcAmount(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{t.calcRateLabel}</label>
              <select
                className="form-control"
                value={calcType}
                onChange={(e) => setCalcType(e.target.value)}
              >
                <option value="80">80% (Taux standard CMU Sénégal)</option>
                <option value="50">50% (Médicaments de spécialité)</option>
                <option value="100">100% (accouchements, césariennes, ACT paludisme)</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              {t.calcBtn}
            </button>
          </form>

          {calcResult && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1.25rem',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              fontSize: '0.9rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <span>Montant Total :</span>
                <strong>{calcResult.total.toLocaleString()} FCFA</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)', fontWeight: 'bold' }}>
                <span>{t.calcShareCmu} ({calcResult.rate}%) :</span>
                <span>{calcResult.cmuShare.toLocaleString()} FCFA</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--secondary)', fontWeight: 'bold' }}>
                <span>{t.calcShareUser} :</span>
                <span>{calcResult.userShare.toLocaleString()} FCFA</span>
              </div>
              
              {calcResult.rate === 80 && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(5, 150, 105, 0.1)',
                  color: 'var(--success)',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  textAlign: 'center'
                }}>
                  ✓ {t.calcTiersPayant}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Directory Directory Table list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Filters Bar */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '200px' }}>
              <input
                type="text"
                className="form-control"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div style={{ flex: 1, minWidth: '130px' }}>
              <select
                className="form-control"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <option value="all">{t.all} ({t.filterType})</option>
                <option value="medicament">{t.medicament}</option>
                <option value="soin">{t.soin}</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '130px' }}>
              <select
                className="form-control"
                value={selectedCovered}
                onChange={(e) => setSelectedCovered(e.target.value)}
              >
                <option value="all">{t.all} ({t.filterCovered})</option>
                <option value="true">{t.statusCovered}</option>
                <option value="false">{t.statusUncovered}</option>
              </select>
            </div>
          </div>

          {/* Table list */}
          <div className="directory-table-container">
            <table className="directory-table">
              <thead>
                <tr>
                  <th style={{ padding: '1rem 1.25rem' }}>{t.thName}</th>
                  <th style={{ padding: '1rem 1.25rem' }}>{t.thCategory}</th>
                  <th style={{ padding: '1rem 1.25rem' }}>{t.thRate}</th>
                  <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>{t.thStatus}</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? (
                  items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'left' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{item.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.description}</div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'left' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)', fontWeight: '500' }}>{item.category}</span>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'left', fontWeight: 'bold' }}>
                        {item.covered ? `${item.coverage_rate}%` : '0%'}
                      </td>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <span className={`badge ${item.covered ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                          {item.covered ? t.statusCovered : t.statusUncovered}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {loading ? '...' : t.noData}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
