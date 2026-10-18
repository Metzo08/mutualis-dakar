/**
 * StudioOverview.jsx — Vue d'ensemble Studio Cartes MUTUALIS
 *
 * Tableau de bord général : régions, départements, MSD, adhésions de masse,
 * statistiques de production et revenus Sen-E-Carte.
 *
 * Toutes les données proviennent de GET /api/studio/geo/overview.
 * Aucune donnée fictive : si la base est vide, les compteurs affichent 0.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../utils/api';
import LotsTable from './LotsTable';
import ProductionPanel from './ProductionPanel';

const PRIX_CARTE_FCFA = 350;

function formatFcfa(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' FCFA';
}

function StatCard({ icon, label, value, sub, color = '#059669', small = false }) {
  return (
    <div style={{
      background: 'var(--bg-card, #fff)',
      border: '1px solid var(--border-color, #e2e8f0)',
      borderLeft: `4px solid ${color}`,
      borderRadius: '12px',
      padding: small ? '0.75rem 1rem' : '1rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      minWidth: 0
    }}>
      <span style={{ fontSize: small ? '1.4rem' : '1.8rem', flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: small ? '1.2rem' : '1.6rem', fontWeight: 900, color: 'var(--text-main, #0f172a)', lineHeight: 1.1 }}>
          {value}
        </div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-sub, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-sub, #94a3b8)', marginTop: '0.1rem' }}>{sub}</div>}
      </div>
    </div>
  );
}

function RegionCard({ region, onSelect }) {
  return (
    <div
      onClick={() => onSelect(region)}
      style={{
        background: 'var(--bg-card, #fff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '14px',
        padding: '1.1rem 1.25rem',
        cursor: 'pointer',
        transition: 'box-shadow 0.18s, transform 0.18s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(5,150,105,0.15)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--text-main, #0f172a)' }}>
            🗺️ {region.name}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-sub, #64748b)', marginTop: '0.15rem' }}>
            {region.departmentCount} département{region.departmentCount > 1 ? 's' : ''} · {region.msdCount} MSD
          </div>
        </div>
        <span style={{
          background: '#f0fdf4',
          color: '#059669',
          borderRadius: '8px',
          padding: '0.2rem 0.6rem',
          fontSize: '0.72rem',
          fontWeight: 800
        }}>
          {region.printedCount > 0 ? `${region.printedCount} imprimée${region.printedCount > 1 ? 's' : ''}` : 'En cours'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
        {[
          { label: 'Adhésions', val: region.enrollmentCount },
          { label: 'Adhérents', val: region.beneficiaryCount },
          { label: 'Revenus', val: formatFcfa(region.revenueFcfa) }
        ].map(item => (
          <div key={item.label} style={{ textAlign: 'center', background: 'var(--bg-subtle, #f8fafc)', borderRadius: '8px', padding: '0.35rem 0.2rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main, #0f172a)' }}>{item.val}</div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-sub, #94a3b8)', textTransform: 'uppercase' }}>{item.label}</div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'right', marginTop: '0.6rem' }}>
        <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>Voir les détails →</span>
      </div>
    </div>
  );
}

export default function StudioOverview({ onSelectRegion }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Détail régional : la région sélectionnée charge ses départements (§2.3).
  const [regionDetail, setRegionDetail] = useState(null);
  const [regionLoading, setRegionLoading] = useState(false);
  // Détail départemental (drill-down niveau 3) : la sélection d'un département
  // charge la liste de ses MSD via GET /api/studio/geo/dept/:name.
  const [deptDetail, setDeptDetail] = useState(null);
  const [deptLoading, setDeptLoading] = useState(false);
  // Recherche paginée des adhésions de masse (§1.2 Étape 2).
  const [lotsQuery, setLotsQuery] = useState('');
  const [lotsStatus, setLotsStatus] = useState('');
  const [lotsPage, setLotsPage] = useState(1);
  const [lotsData, setLotsData] = useState(null);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [prodDetail, setProdDetail] = useState(null); // { code, events, loading }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/studio/geo/overview');
      if (!res || !res.ok) throw new Error(res ? `Statut ${res.status}` : 'Backend injoignable');
      const payload = await res.json();
      setData(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRegionDetail = useCallback(async (name) => {
    setRegionLoading(true);
    setRegionDetail(null);
    // Changer de région réinitialise le détail départemental éventuellement
    // ouvert : deux niveaux de drill-down ne doivent pas rester empilés.
    setDeptDetail(null);
    try {
      const res = await apiFetch(`/api/studio/geo/region/${encodeURIComponent(name)}`);
      if (!res || !res.ok) throw new Error(res ? `Statut ${res.status}` : 'Backend injoignable');
      setRegionDetail(await res.json());
    } catch (err) {
      setRegionDetail({ name, error: err.message });
    } finally {
      setRegionLoading(false);
    }
  }, []);

  const loadDeptDetail = useCallback(async (name) => {
    setDeptLoading(true);
    setDeptDetail(null);
    try {
      const res = await apiFetch(`/api/studio/geo/dept/${encodeURIComponent(name)}`);
      if (!res || !res.ok) throw new Error(res ? `Statut ${res.status}` : 'Backend injoignable');
      setDeptDetail(await res.json());
    } catch (err) {
      setDeptDetail({ name, error: err.message });
    } finally {
      setDeptLoading(false);
    }
  }, []);

  // Recherche paginée des adhésions de masse (§1.2 Étape 2) : référence unique,
  // titre, date, MSD, adhérents, états de validation/production, revenu figé.
  const loadLots = useCallback(async (page = 1, q = lotsQuery, status = lotsStatus) => {
    setLotsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      const res = await apiFetch(`/api/studio/lots?${params.toString()}`);
      if (!res || !res.ok) throw new Error(res ? `Statut ${res.status}` : 'Backend injoignable');
      setLotsData(await res.json());
      setLotsPage(page);
    } catch {
      setLotsData({ data: [], pagination: { page, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false }, error: true });
    } finally {
      setLotsLoading(false);
    }
  }, [lotsQuery, lotsStatus]);

  // Historique de production d'un lot (§1.3 Étape 2) : événements INITIAL,
  // REPRINT, REPLACEMENT, DESTROYED avec tarifs figés.
  const loadProduction = useCallback(async (code) => {
    setProdDetail({ code, loading: true, events: [] });
    try {
      const res = await apiFetch(`/api/studio/lot/${encodeURIComponent(code)}/production`);
      if (!res || !res.ok) throw new Error(res ? `Statut ${res.status}` : 'Backend injoignable');
      const payload = await res.json();
      setProdDetail({ code, loading: false, ...payload });
    } catch (err) {
      setProdDetail({ code, loading: false, events: [], error: err.message });
    }
  }, []);

  useEffect(() => {
    // Lancement différé : load() appelle setLoading synchronisé dès l'entrée —
    // on l'exécute hors du corps synchrone de l'effet pour respecter la règle
    // react-hooks/set-state-in-effect (rendus en cascade interdits).
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-sub, #64748b)' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
      <div>Chargement du tableau de bord…</div>
    </div>
  );

  if (error) return (
    <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '1.5rem', margin: '1rem 0' }}>
      <div style={{ fontWeight: 800, color: '#dc2626', marginBottom: '0.5rem' }}>❌ Données non disponibles</div>
      <div style={{ fontSize: '0.85rem', color: '#7f1d1d' }}>{error}</div>
      <button
        onClick={load}
        style={{ marginTop: '0.75rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.4rem 1rem', fontWeight: 700, cursor: 'pointer' }}
      >
        🔄 Réessayer
      </button>
    </div>
  );

  if (!data) return null;
  const { global: g = {}, regions = [] } = data;

  return (
    <div>
      {/* En-tête */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.35rem', color: 'var(--text-main, #0f172a)' }}>
          📊 Vue générale — Studio Cartes
        </h2>
        <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: 'var(--text-sub, #64748b)' }}>
          Production des cartes CSU sur l'ensemble des régions · Tarif unitaire : {PRIX_CARTE_FCFA} FCFA/carte imprimée
        </p>
      </div>

      {/* KPI globaux */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.75rem' }}>
        <StatCard icon="🗺️" label="Régions" value={g.regionCount ?? regions.length} color="#7c3aed" />
        <StatCard icon="🏛️" label="Départements" value={g.departmentCount ?? '—'} color="#2563eb" />
        <StatCard icon="🏥" label="MSD" value={g.msdCount ?? '—'} color="#0891b2" />
        <StatCard icon="📋" label="Adhésions" value={g.enrollmentCount ?? 0} sub="campagnes de masse" color="#059669" />
        <StatCard icon="👥" label="Adhérents" value={(g.beneficiaryCount ?? 0).toLocaleString('fr-FR')} sub="enregistrés" color="#65a30d" />
        <StatCard icon="✅" label="Conformes" value={(g.conformCount ?? 0).toLocaleString('fr-FR')} sub="dossiers validés" color="#16a34a" />
        <StatCard icon="🖨️" label="Imprimées" value={(g.printedCount ?? 0).toLocaleString('fr-FR')} sub="cartes produites" color="#d97706" />
        <StatCard icon="💰" label="Revenus" value={formatFcfa(g.revenueFcfa)} sub="Sen-E-Carte" color="#b45309" />
      </div>

      {/* Alerte si anomalies */}
      {g.beneficiaryCount > 0 && (g.beneficiaryCount - g.conformCount) > 0 && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          borderLeft: '4px solid #f59e0b',
          borderRadius: '10px',
          padding: '0.75rem 1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <span style={{ fontSize: '1.3rem' }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#92400e' }}>
              {(g.beneficiaryCount - g.conformCount).toLocaleString('fr-FR')} dossier(s) nécessitent une correction
            </div>
            <div style={{ fontSize: '0.78rem', color: '#78350f' }}>
              Photo manquante, données incomplètes ou correspondance ambiguë.
            </div>
          </div>
        </div>
      )}

      {/* Régions */}
      <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
          Régions couvertes
        </h3>
        <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: '20px', padding: '0.1rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>
          {regions.length}
        </span>
      </div>

      {/* Détail de la région sélectionnée (§2.3) : départements cliquables */}
      {regionLoading && (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-sub, #64748b)' }}>
          <div className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div> Chargement de la région…
        </div>
      )}
      {regionDetail && !regionLoading && (
        <div style={{
          background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '14px',
          padding: '1rem 1.25rem', marginBottom: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h4 style={{ margin: 0, fontWeight: 900, fontSize: '1.05rem', color: '#065f46' }}>
              🗺️ {regionDetail.region || regionDetail.name}
            </h4>
            <button
              type="button"
              onClick={() => setRegionDetail(null)}
              style={{ background: 'transparent', border: 'none', color: '#065f46', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
            >✖ Fermer le détail</button>
          </div>
          {regionDetail.error ? (
            <div style={{ fontSize: '0.82rem', color: '#991b1b', marginTop: '0.5rem' }}>❌ {regionDetail.error}</div>
          ) : (
            <>
              <div style={{ fontSize: '0.8rem', color: '#047857', margin: '0.35rem 0 0.75rem' }}>
                {regionDetail.departmentCount} département(s) · {regionDetail.msdCount} MSD
              </div>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.6rem' }}>
                {(regionDetail.departments || []).map((d) => (
                  <div key={d.name} role="button" tabIndex={0} onClick={() => loadDeptDetail(d.name)}
                       onKeyDown={(e) => { if (e.key === 'Enter') loadDeptDetail(d.name); }}
                       style={{
                    background: '#fff', border: '1px solid #d1fae5', borderRadius: '10px', padding: '0.65rem 0.8rem', cursor: 'pointer'
                  }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main, #0f172a)' }}>🏛️ {d.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-sub, #64748b)', marginTop: '0.2rem' }}>
                      {d.msdCount} MSD · {d.beneficiaryCount} adhérent(s)
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>
                      {d.conformCount} dossier(s) conforme(s) · Cliquer pour voir les MSD →
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {deptLoading && (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-sub, #64748b)' }}>
          <div className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div> Chargement du département…
        </div>
      )}
      {deptDetail && !deptLoading && (
        <div style={{
          background: '#eff6ff', border: '1.5px solid #93c5fd', borderRadius: '14px',
          padding: '1rem 1.25rem', marginBottom: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h4 style={{ margin: 0, fontWeight: 900, fontSize: '1.05rem', color: '#1e40af' }}>
              🏛️ {deptDetail.department || deptDetail.name}
            </h4>
            <button
              type="button"
              onClick={() => setDeptDetail(null)}
              style={{ background: 'transparent', border: 'none', color: '#1e40af', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
            >✖ Fermer le détail</button>
          </div>
          {deptDetail.error ? (
            <div style={{ fontSize: '0.82rem', color: '#991b1b', marginTop: '0.5rem' }}>❌ {deptDetail.error}</div>
          ) : (
            <>
              <div style={{ fontSize: '0.8rem', color: '#1d4ed8', margin: '0.35rem 0 0.75rem' }}>
                {(deptDetail.msds || []).length} MSD · {(deptDetail.msds || []).reduce((s, m) => s + (m.beneficiaryCount || 0), 0).toLocaleString('fr-FR')} adhérent(s) au total
              </div>
              {(deptDetail.msds || []).length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Aucune MSD enregistrée dans ce département.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.6rem' }}>
                  {deptDetail.msds.map((m) => (
                    <div key={m.name} style={{
                      background: '#fff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '0.65rem 0.8rem'
                    }}>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main, #0f172a)' }}>🏥 {m.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-sub, #64748b)', marginTop: '0.2rem' }}>
                        {m.commune} · {m.status || 'statut inconnu'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#1d4ed8', fontWeight: 700 }}>
                        {m.beneficiaryCount} adhérent(s) · {m.conformCount} conforme(s)
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {regions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-sub, #94a3b8)', background: 'var(--bg-subtle, #f8fafc)', borderRadius: '12px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🗺️</div>
          <div style={{ fontWeight: 600 }}>Aucune région configurée</div>
          <div style={{ fontSize: '0.8rem', marginTop: '0.3rem' }}>Importez des données via le module d'importation.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {regions.map(region => (
            <RegionCard key={region.code || region.name} region={region} onSelect={(r) => {
              loadRegionDetail(r.name);
              if (onSelectRegion) onSelectRegion(r);
            }} />
          ))}
        </div>
      )}

      {/* Recherche des adhésions de masse (§1.2 Étape 2) */}
      <div style={{ marginBottom: '0.75rem', marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
          Adhésions de masse
        </h3>
        {lotsData && !lotsData.error && (
          <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: '20px', padding: '0.1rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>
            {lotsData.pagination?.total ?? 0} lot(s)
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={lotsQuery}
            onChange={(e) => setLotsQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') loadLots(1, e.target.value, lotsStatus); }}
            placeholder="Rechercher (référence, titre, fichier…)"
            style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', padding: '0.4rem 0.7rem', fontSize: '0.82rem', minWidth: '220px' }}
          />
          <select
            value={lotsStatus}
            onChange={(e) => { setLotsStatus(e.target.value); setLotsPage(1); }}
            style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
          >
            <option value="">Tous statuts</option>
            <option value="IMPRIME">Imprimés</option>
            <option value="EN_ATTENTE">En attente</option>
          </select>
          <button
            type="button"
            onClick={() => loadLots(1)}
            style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.4rem 1rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
          >
            🔍 Rechercher
          </button>
        </div>
      </div>

      {lotsLoading && (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-sub, #64748b)' }}>⏳ Recherche en cours…</div>
      )}
      {lotsData && !lotsLoading && !lotsData.error && (lotsData.data || []).length === 0 && lotsData.pagination && (
        <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1rem' }}>Aucune adhésion ne correspond à la recherche.</div>
      )}

      <LotsTable
        lotsData={lotsData}
        lotsPage={lotsPage}
        lotsLoading={lotsLoading}
        onPage={(p) => loadLots(p)}
        onProduction={loadProduction}
      />
      <ProductionPanel detail={prodDetail} onClose={() => setProdDetail(null)} />
      {/* Note financière */}
      <div style={{
        background: 'var(--bg-subtle, #f8fafc)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '10px',
        padding: '0.75rem 1rem',
        marginTop: '1.5rem',
        fontSize: '0.78rem',
        color: 'var(--text-sub, #64748b)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem'
      }}>
        <span>ℹ️</span>
        <div>
          <strong>Règle financière</strong> : Sen-E-Carte perçoit <strong>{PRIX_CARTE_FCFA} FCFA</strong> par carte dont l'impression est effectivement enregistrée
          (production initiale, réimpression ou remplacement — destruction exclue).
          Les revenus affichés correspondent aux montants figés au jour de chaque événement.
        </div>
      </div>
    </div>
  );
}
