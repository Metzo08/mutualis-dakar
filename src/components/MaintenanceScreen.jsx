// ─────────────────────────────────────────────
// ÉCRAN DE MAINTENANCE
//
// Affiché quand le backend renvoie 503 MAINTENANCE. Un écran d'erreur
// générique laisserait croire à une panne — alors que c'est une opération
// planifiée : l'utilisateur peut partir et revenir, il faut lui dire quand.
// ─────────────────────────────────────────────

import { useEffect, useState } from 'react';

export default function MaintenanceScreen({ message, onRetry }) {
  const [canRetry, setCanRetry] = useState(false);

  // Un délai court avant d'offrir « Réessayer » : sinon l'utilisateur
  // martèle le bouton pendant que l'équipe travaille, ce qui n'aide personne.
  useEffect(() => {
    const t = setTimeout(() => setCanRetry(true), 30_000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #f0fdf4 0%, #ecfdf5 50%, #f8fafc 100%)', padding: '1.5rem'
    }}>
      <div style={{
        maxWidth: '560px', width: '100%', background: '#ffffff', borderRadius: '28px',
        padding: '3rem 2.25rem', textAlign: 'center',
        border: '1px solid #a7f3d0', boxShadow: '0 20px 60px rgba(5, 150, 105, 0.12)'
      }}>
        <div style={{
          width: '88px', height: '88px', borderRadius: '50%', margin: '0 auto 1.25rem',
          background: 'rgba(5, 150, 105, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2.6rem'
        }}>🛠️</div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#065f46', marginBottom: '0.6rem' }}>
          Maintenance en cours
        </h1>
        <p style={{ color: '#374151', fontSize: '0.98rem', lineHeight: 1.65, marginBottom: '1.5rem' }}>
          {message || "La plateforme est momentanément indisponible pour une opération de maintenance. Vos données sont en sécurité — le service reprendra dans quelques instants."}
        </p>
        <div style={{
          background: '#f0fdf4', borderRadius: '14px', padding: '0.9rem 1.1rem',
          fontSize: '0.84rem', color: '#047857', marginBottom: '1.5rem',
          border: '1px solid #a7f3d0', lineHeight: 1.6
        }}>
          <strong>Urgence médicale ?</strong><br />
         Composez le <strong>1515</strong> (SAMU) ou le <strong>15</strong> (Sapeurs-pompiers) —
          ces services restent joignables indépendamment de la plateforme.
        </div>
        <button
          type="button"
          disabled={!canRetry}
          onClick={onRetry}
          style={{
            background: canRetry ? '#059669' : '#9ca3af', color: '#ffffff', border: 'none',
            borderRadius: '14px', padding: '0.85rem 2rem', fontSize: '0.95rem', fontWeight: '800',
            cursor: canRetry ? 'pointer' : 'not-allowed', transition: 'background 0.3s'
          }}
        >
          {canRetry ? '🔄 Réessayer maintenant' : 'Réessayer dans quelques secondes…'}
        </button>
      </div>
    </div>
  );
}
