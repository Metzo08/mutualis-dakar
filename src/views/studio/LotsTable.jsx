/**
 * LotsTable.jsx — Tableau paginé des adhésions de masse (§1.2 — Étape 2).
 * Props : lotsData, lotsPage, lotsLoading, onPage, onProduction.
 */
function formatFcfa(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' FCFA';
}

export default function LotsTable({ lotsData, lotsPage, lotsLoading, onPage, onProduction }) {
  if (lotsLoading) return null;
  if (!lotsData || lotsData.error || (lotsData.data || []).length === 0) return null;
  const okV = { background: '#dcfce7', color: '#15803d', borderRadius: '12px', padding: '0.15rem 0.55rem', fontSize: '0.72rem', fontWeight: 800 };
  const warnV = { background: '#fef9c3', color: '#854d0e', borderRadius: '12px', padding: '0.15rem 0.55rem', fontSize: '0.72rem', fontWeight: 800 };
  const okP = { background: '#dbeafe', color: '#1d4ed8', borderRadius: '12px', padding: '0.15rem 0.55rem', fontSize: '0.72rem', fontWeight: 800 };
  const waitP = { background: '#f1f5f9', color: '#64748b', borderRadius: '12px', padding: '0.15rem 0.55rem', fontSize: '0.72rem', fontWeight: 800 };
  return (
    <>
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '0.75rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
              <th style={{ padding: '0.55rem 0.7rem' }}>Référence</th>
              <th style={{ padding: '0.55rem 0.7rem' }}>Titre</th>
              <th style={{ padding: '0.55rem 0.7rem' }}>MSD</th>
              <th style={{ padding: '0.55rem 0.7rem' }}>Adhérents</th>
              <th style={{ padding: '0.55rem 0.7rem' }}>Validation</th>
              <th style={{ padding: '0.55rem 0.7rem' }}>Production</th>
              <th style={{ padding: '0.55rem 0.7rem', textAlign: 'right' }}>Revenu</th>
              <th style={{ padding: '0.55rem 0.7rem' }}></th>
            </tr>
          </thead>
          <tbody>
            {lotsData.data.map((l) => (
              <tr key={l.reference} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.5rem 0.7rem', fontWeight: 800 }}>{l.reference}</td>
                <td style={{ padding: '0.5rem 0.7rem' }}>{l.titre || '—'}</td>
                <td style={{ padding: '0.5rem 0.7rem' }}>{l.msdCode || '—'}</td>
                <td style={{ padding: '0.5rem 0.7rem' }}>{l.adherents} <span style={{ color: '#64748b' }}>({l.conformes} conformes)</span></td>
                <td style={{ padding: '0.5rem 0.7rem' }}>
                  <span style={l.etatValidation === 'VALIDE' ? okV : warnV}>
                    {l.etatValidation === 'VALIDE' ? '✅ Valide' : `⚠️ ${l.aCorriger} à corriger`}
                  </span>
                </td>
                <td style={{ padding: '0.5rem 0.7rem' }}>
                  <span style={l.etatProduction === 'IMPRIME' ? okP : waitP}>
                    {l.etatProduction === 'IMPRIME' ? '🖨️ Imprimé' : '⏳ En attente'}
                  </span>
                </td>
                <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', fontWeight: 800 }}>{formatFcfa(l.revenuFcfa)}</td>
                <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right' }}>
                  <button type="button" onClick={() => onProduction(l.reference)}
                    style={{ background: 'transparent', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.25rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', color: '#0f172a' }}>
                    📜 Production
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#475569' }}>
        <button type="button" disabled={!(lotsData.pagination?.hasPrev)} onClick={() => onPage(lotsPage - 1)}
          style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.3rem 0.8rem', background: '#fff' }}>
          ◀ Précédent
        </button>
        <span>Page {lotsData.pagination?.page} / {lotsData.pagination?.totalPages}</span>
        <button type="button" disabled={!(lotsData.pagination?.hasNext)} onClick={() => onPage(lotsPage + 1)}
          style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.3rem 0.8rem', background: '#fff' }}>
          Suivant ▶
        </button>
      </div>
    </>
  );
}
