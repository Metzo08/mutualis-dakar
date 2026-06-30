import React, { useState, useEffect } from 'react';

export default function AuditLogs({ lang }) {
  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [loading, setLoading] = useState(true);

  const dict = {
    fr: {
      title: 'Journal d\'audit régional',
      subtitle: 'Historique exhaustif et immuable des connexions, des pré-inscriptions en ligne, des transactions de cotisations et des modifications administratives de statut.',
      searchPlaceholder: 'Rechercher par action, acteur ou détails...',
      thDate: 'Date & heure',
      thAction: 'Action',
      thActor: 'Acteur',
      thDetails: 'Détails de l\'événement',
      noLogs: 'Aucun enregistrement d\'audit correspondant.',
      exportBtn: 'Exporter le registre (CSV)'
    },
    wo: {
      title: 'Registre d\'audit',
      subtitle: 'Registre yeup yi soti ci portal cmu ndakaaru (connexions, cotisations, adhésions).',
      searchPlaceholder: 'Seet log...',
      thDate: 'Date',
      thAction: 'Action',
      thActor: 'Acteur',
      thDetails: 'Détails',
      noLogs: 'Amul audit log.',
      exportBtn: 'Exporter (CSV)'
    }
  };

  const t = dict[lang];

  useEffect(() => {
    setLoading(true);
    let url = `http://localhost:5000/api/audit-logs?page=${page}`;
    if (searchQuery) {
      url += `&search=${encodeURIComponent(searchQuery)}`;
    }

    fetch(url, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('cmu-token') || ''}` }
    })
      .then(res => res.json())
      .then(payload => {
        const list = Array.isArray(payload) ? payload : (payload.data || []);
        const pag = payload.pagination || { page: 1, totalPages: 1, hasNext: false, hasPrev: false };
        setLogs(list);
        setPage(pag.page);
        setTotalPages(pag.totalPages);
        setHasNext(pag.hasNext);
        setHasPrev(pag.hasPrev);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        // Fallback local data if offline
        const localLogs = [
          { created_at: '2026-06-18T18:00:00.000Z', action: 'SYSTEM_INIT', actor: 'Système', details: 'Initialisation et seeding de la base de données MUTUALIS DAKAR.' },
          { created_at: '2026-06-18T18:10:00.000Z', action: 'CONNEXION_AGENT', actor: 'agent@cmu.sn', details: 'Connexion réussie de l\'agent Amadou Sall (Superviseur Régional).' },
          { created_at: '2026-06-18T18:12:00.000Z', action: 'CONNEXION_CITOYEN', actor: '771234567', details: 'Connexion réussie de l\'assuré Modou Diop.' }
        ];
        setLogs(localLogs);
        setPage(1);
        setTotalPages(1);
        setHasNext(false);
        setHasPrev(false);
      });
  }, [searchQuery, page]);

  const formatDate = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
    } catch {
      return isoString;
    }
  };

  const getActionBadgeClass = (action) => {
    if (action.includes('CONNEXION_AGENT')) return 'badge-info';
    if (action.includes('CONNEXION_CITOYEN')) return 'badge-info';
    if (action.includes('RENOUVELLEMENT')) return 'badge-success';
    if (action.includes('APPROBATION')) return 'badge-success';
    if (action.includes('DEPOS')) return 'badge-warning';
    if (action.includes('SUPPRESSION')) return 'badge-warning';
    return '';
  };

  return (
    <div className="audit-logs-view fade-in-up">
      {/* Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(to right, rgba(5, 150, 105, 0.7), rgba(5, 150, 105, 0.4)), url("/bg_audit_stock.jpg") center/cover no-repeat',
        borderBottom: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ textAlign: 'left', position: 'relative', zIndex: 2 }}>
          <span className="badge" style={{ marginBottom: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.2)', color: '#fff', border: 'none' }}>
            🔒 Administratif & sécurité
          </span>
          <h1 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: '0.5rem', fontWeight: '800', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{t.title}</h1>
          <p style={{ color: '#f8fafc', fontSize: '1rem', maxWidth: '800px', lineHeight: '1.5', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{t.subtitle}</p>
        </div>
      </section>

      {/* Action bar */}
      <div className="card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', textAlign: 'left' }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <input
            type="text"
            className="form-control"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => {
          // Génération et téléchargement du fichier CSV depuis les logs
          const csvEscape = (val) => {
            const str = String(val ?? '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
          };
          const header = 'Date,Action,Acteur,Détails';
          const rows = logs.map(log =>
            [formatDate(log.created_at), log.action, log.actor, log.details].map(csvEscape).join(',')
          );
          const csvContent = '\uFEFF' + [header, ...rows].join('\n');
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `audit_logs_${new Date().toISOString().slice(0,10)}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }}>
          📥 {t.exportBtn}
        </button>
      </div>

      {/* Table list */}
      <div className="directory-table-container">
        <table className="directory-table">
          <thead>
            <tr>
              <th style={{ padding: '1rem 1.25rem', width: '180px' }}>{t.thDate}</th>
              <th style={{ padding: '1rem 1.25rem', width: '180px' }}>{t.thAction}</th>
              <th style={{ padding: '1rem 1.25rem', width: '180px' }}>{t.thActor}</th>
              <th style={{ padding: '1rem 1.25rem' }}>{t.thDetails}</th>
            </tr>
          </thead>
          <tbody>
            {logs.length > 0 ? (
              logs.map((log, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'left', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                    {formatDate(log.created_at)}
                  </td>
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'left' }}>
                    <span className={`badge ${getActionBadgeClass(log.action)}`} style={{ fontSize: '0.65rem' }}>
                      {log.action ? (log.action.charAt(0).toUpperCase() + log.action.slice(1).toLowerCase().replace(/_/g, ' ')) : ''}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'left', fontWeight: '600', fontSize: '0.88rem' }}>
                    {log.actor}
                  </td>
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'left', color: 'var(--text-sub)', fontSize: '0.88rem' }}>
                    {log.details}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {loading ? '...' : t.noLogs}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Dynamic pagination controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
          <button
            className="btn btn-outline btn-sm"
            disabled={!hasPrev}
            onClick={() => setPage(prev => Math.max(1, prev - 1))}
          >
            ⬅️ Précédent / Bi weesu
          </button>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-sub)', fontWeight: '600' }}>
            Page {page} sur {totalPages}
          </span>
          <button
            className="btn btn-outline btn-sm"
            disabled={!hasNext}
            onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
          >
            Suivant / Bi ci top ➡️
          </button>
        </div>
      )}
    </div>
  );
}
