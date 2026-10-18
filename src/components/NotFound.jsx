// ═══════════════════════════════════════════════════════════════════════════
// PAGE 404 — URL introuvable
// ═══════════════════════════════════════════════════════════════════════════
//
// Avant, un hash inconnu (#/pages-inexistante) retombait silencieusement sur
// l'accueil : l'utilisateur ne comprenait pas pourquoi il voyait la page
// d'accueil alors qu'il avait tapé une URL précise (ex. depuis un favori ou
// un QR code périmé). Désormais on affiche une vraie page 404 avec des
// raccourcis vers les sections les plus utilisées.
// ═══════════════════════════════════════════════════════════════════════════

const SHORTCUTS = [
  { icon: '🏠', label: 'Accueil', view: 'home' },
  { icon: '👥', label: 'Bénéficiaires', view: 'beneficiaries' },
  { icon: '🧰', label: 'Services en ligne', view: 'services' },
  { icon: '🏥', label: 'Cartographie', view: 'map' },
  { icon: '📋', label: 'Réclamations', view: 'complaints' },
  { icon: '🔐', label: 'Connexion', view: 'login' }
];

export default function NotFound({ requestedView, setView }) {
  return (
    <div className="container" style={{ padding: '4rem 1rem', maxWidth: '720px' }}>
      <div
        className="card text-center fade-in-up"
        style={{
          padding: '3rem 2rem',
          borderRadius: '24px',
          borderLeft: '6px solid var(--warning, #f59e0b)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.08)'
        }}
      >
        <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>🧭</div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: '850', color: 'var(--text-main)', marginBottom: '0.4rem' }}>
          404
        </h1>
        <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.75rem' }}>
          Cette page n'existe pas
        </h2>
        <p style={{ color: 'var(--text-sub)', fontSize: '0.95rem', lineHeight: 1.65, marginBottom: '0.5rem' }}>
          L'adresse <code style={{ background: 'var(--bg-card-subtle)', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.85rem' }}>
            #/{requestedView || ''}
          </code> ne correspond à aucune section de MUTUALIS.
          Le lien est peut-être expiré, ou l'URL a été mal recopiée.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
          Si vous pensiez être sur la bonne page, signalez-le à votre agent mutualiste.
        </p>

        <div style={{
          display: 'flex',
          gap: '0.6rem',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          {SHORTCUTS.map(s => (
            <button
              key={s.view}
              className="btn btn-outline fw-bold"
              style={{ borderRadius: '12px', padding: '0.55rem 1rem', fontSize: '0.85rem' }}
              onClick={() => setView(s.view)}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
