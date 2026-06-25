import React, { useState, useEffect } from 'react';

// Vue publique de vérification d'une carte CMU.
// Accessible via #/verify/:cmuNumber — utilisée par les structures de soins
// pour vérifier instantanément la validité d'une carte scannée.
export default function VerifyCard({ lang }) {
  const [cmuNumber, setCmuNumber] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Extrait le numéro CMU du hash URL (#/verify/SN-DK-MED-8472)
  useEffect(() => {
    const hash = window.location.hash.replace(/^#\/?verify\/?/, '');
    if (hash) {
      setCmuNumber(decodeURIComponent(hash));
      verify(decodeURIComponent(hash));
    }
  }, []);

  const verify = async (num) => {
    const target = num || cmuNumber;
    if (!target) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`http://localhost:5000/api/cmu-card/${encodeURIComponent(target)}`);
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Carte introuvable.');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    verify();
  };

  const t = {
    fr: {
      title: 'Vérification de carte CMU',
      subtitle: 'Structure de soins — vérifiez la validité d\'une carte d\'assuré',
      placeholder: 'Numéro CMU (ex: SN-DK-MED-8472)',
      btn: 'Vérifier',
      valid: 'Carte valide et active',
      invalid: 'Carte suspendue ou inactive',
      notFound: 'Carte introuvable',
      name: 'Nom de l\'assuré',
      phone: 'Téléphone',
      mutuelle: 'Mutuelle',
      package: 'Formule',
      family: 'Ayants droit',
      checkedAt: 'Vérifié le',
      none: 'Aucun ayant droit'
    },
    wo: {
      title: 'Saytu kàrt CMU',
      subtitle: 'Fajukaay — saytu kàrt bu assuré',
      placeholder: 'N° CMU (ex: SN-DK-MED-8472)',
      btn: 'Saytu',
      valid: 'Kàrt bi baax na',
      invalid: 'Kàrt bi teye nanu ko',
      notFound: 'Kàrt bi gissu',
      name: 'Touru assuré',
      phone: 'Portable',
      mutuelle: 'Mutuelle',
      package: 'Formule',
      family: 'Njabot',
      checkedAt: 'Saytu ci',
      none: 'Amul njabot'
    }
  }[lang] || {};

  return (
    <div className="verify-view fade-in-up" style={{ padding: '2rem 1rem', maxWidth: '700px', margin: '0 auto' }}>
      <div className="card" style={{ padding: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.25rem' }}>🔍 {t.title}</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{t.subtitle}</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <input
            type="text"
            className="input"
            placeholder={t.placeholder}
            value={cmuNumber}
            onChange={(e) => setCmuNumber(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '...' : t.btn}
          </button>
        </form>

        {error && (
          <div className="alert alert-danger" style={{ padding: '1rem', borderRadius: '8px' }}>
            ❌ {t.notFound}: {error}
          </div>
        )}

        {result && (
          <div style={{
            border: `2px solid ${result.valid ? '#22c55e' : '#ef4444'}`,
            borderRadius: '12px',
            padding: '1.5rem',
            background: result.valid ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)'
          }}>
            <div style={{
              display: 'inline-block', padding: '0.4rem 1rem', borderRadius: '20px',
              background: result.valid ? '#22c55e' : '#ef4444', color: '#fff',
              fontWeight: '700', fontSize: '0.85rem', marginBottom: '1rem'
            }}>
              {result.valid ? `✅ ${t.valid}` : `⚠️ ${t.invalid}`}
            </div>

            <div className="grid grid-2" style={{ gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.name}</div>
                <div style={{ fontWeight: '700' }}>{result.firstName} {result.lastName}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.phone}</div>
                <div style={{ fontWeight: '600' }}>{result.phone}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.mutuelle}</div>
                <div style={{ fontWeight: '600' }}>{result.mutuelleName}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.package}</div>
                <div style={{ fontWeight: '600' }}>{result.packageType}</div>
              </div>
            </div>

            {result.familyMembers && result.familyMembers.length > 0 && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t.family}</div>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {result.familyMembers.map((f, i) => (
                    <li key={i} style={{
                      background: 'var(--bg-secondary)', padding: '0.3rem 0.8rem', borderRadius: '20px',
                      fontSize: '0.8rem'
                    }}>
                      {f.name} ({f.relation})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginTop: '1rem', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>
              {t.checkedAt}: {new Date(result.checkedAt).toLocaleString('fr-FR')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
