/**
 * ProductionPanel.jsx — Historique de production d'un lot (§1.3 — Étape 2).
 * Événements INITIAL, REPRINT, REPLACEMENT, DESTROYED avec tarifs figés.
 * Props : detail ({ code, loading, events, error, revenuTotalFcfa }), onClose.
 */
function formatFcfa(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' FCFA';
}

function labelEvent(t) {
  if (t === 'INITIAL') return '🖨️ Initiale';
  if (t === 'REPRINT') return '🔁 Réimpression';
  if (t === 'REPLACEMENT') return '🔄 Remplacement';
  return '🗑️ Destruction';
}

export default function ProductionPanel({ detail, onClose }) {
  if (!detail) return null;
  return (
    <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '14px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h4 style={{ margin: 0, fontWeight: 900, fontSize: '1rem', color: '#92400e' }}>
          📜 Production — {detail.code}
        </h4>
        <button type="button" onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#92400e', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
          ✖ Fermer
        </button>
      </div>
      {detail.loading ? (
        <div style={{ fontSize: '0.82rem', color: '#92400e', marginTop: '0.5rem' }}>⏳ Chargement de l'historique…</div>
      ) : detail.error ? (
        <div style={{ fontSize: '0.82rem', color: '#991b1b', marginTop: '0.5rem' }}>❌ {detail.error}</div>
      ) : (detail.events || []).length === 0 ? (
        <div style={{ fontSize: '0.82rem', color: '#78350f', marginTop: '0.5rem' }}>Aucun événement — le lot n'a pas encore été remis.</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', background: '#fff', borderRadius: '8px' }}>
              <thead>
                <tr style={{ background: '#fef3c7', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem 0.65rem' }}>Événement</th>
                  <th style={{ padding: '0.5rem 0.65rem' }}>Cartes</th>
                  <th style={{ padding: '0.5rem 0.65rem' }}>Tarif</th>
                  <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right' }}>Revenu</th>
                  <th style={{ padding: '0.5rem 0.65rem' }}>Acteur</th>
                  <th style={{ padding: '0.5rem 0.65rem' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {detail.events.map((e, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #fde68a' }}>
                    <td style={{ padding: '0.45rem 0.65rem', fontWeight: 800 }}>{labelEvent(e.type)}</td>
                    <td style={{ padding: '0.45rem 0.65rem' }}>{e.cartes}</td>
                    <td style={{ padding: '0.45rem 0.65rem' }}>{Number(e.tarifUnitaire || 0).toLocaleString('fr-FR')} FCFA</td>
                    <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right', fontWeight: 800 }}>{formatFcfa(e.revenuFcfa)}</td>
                    <td style={{ padding: '0.45rem 0.65rem' }}>{e.acteur || '—'}</td>
                    <td style={{ padding: '0.45rem 0.65rem' }}>{e.date ? new Date(e.date).toLocaleDateString('fr-FR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#92400e', marginTop: '0.6rem', textAlign: 'right' }}>
            Revenu total figé : {formatFcfa(detail.revenuTotalFcfa)}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#78350f', marginTop: '0.25rem' }}>
            Production initiale, réimpressions et remplacements : 350 FCFA/carte. Destructions : 0 FCFA.
          </div>
        </>
      )}
    </div>
  );
}
