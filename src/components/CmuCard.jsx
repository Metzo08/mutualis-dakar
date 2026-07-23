import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

// Carte CMU numérique : affiche les informations de l'assuré + QR code vérifiable.
// Le QR code encode une URL de vérification publique (/api/cmu-card/:cmuNumber).
// Fonctionne hors-ligne (les données sont issues du state citoyen connecté).
export default function CmuCard({ citizen }) {
  const [qrUrl, setQrUrl] = useState('');
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!citizen || !citizen.cmuNumber) return;
    // Résout l'origine de la carte : si on est en local (localhost) et qu'on a l'IP du serveur réseau local,
    // on l'utilise pour que le portable puisse y accéder lors du scan.
    let origin = window.location.origin;
    const serverIp = localStorage.getItem('cmu-server-ip');
    if (serverIp && serverIp !== 'localhost' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      origin = `http://${serverIp}:5180`;
    }
    const verifyUrl = `${origin}/#/verify/${citizen.cmuNumber}`;
    QRCode.toDataURL(verifyUrl, {
      margin: 1,
      width: 200,
      color: { dark: '#064e3b', light: '#ffffff' }
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(''));
  }, [citizen]);

  if (!citizen) return null;

  const isActive = citizen.status === 'active';
  const fullName = `${citizen.firstName || ''} ${citizen.lastName || ''}`.trim();

  return (
    <div className="cmu-card-wrapper" style={{ perspective: '1000px', marginBottom: '1.5rem' }}>
      <div
        className="cmu-card"
        onClick={() => setFlipped(!flipped)}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '380px',
          height: '220px',
          margin: '0 auto',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          cursor: 'pointer',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* RECTO : informations de l'assuré */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)',
            color: '#fff',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflow: 'hidden'
          }}
        >
          {/* Décor d'arrière-plan */}
          <div style={{
            position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px',
            background: 'rgba(255,255,255,0.08)', borderRadius: '50%'
          }} />
          <div style={{
            position: 'absolute', bottom: '-40px', left: '-20px', width: '100px', height: '100px',
            background: 'rgba(255,255,255,0.06)', borderRadius: '50%'
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
            <div>
              <div style={{ fontSize: '0.7rem', opacity: 0.9, letterSpacing: '1px', textTransform: 'uppercase' }}>
                Couverture Maladie Universelle
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', letterSpacing: '0.5px' }}>
                MUTUALIS DAKAR 🇸🇳
              </div>
            </div>
            <span style={{
              background: isActive ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)',
              padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.65rem', fontWeight: '700',
              whiteSpace: 'nowrap'
            }}>
              {isActive ? '● ACTIF' : '● SUSPENDU'}
            </span>
          </div>

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.15rem' }}>{fullName}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.9, display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <span>📦 {citizen.packageType || '—'}</span>
              <span>🏥 {citizen.mutuelleName || '—'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative', zIndex: 1 }}>
            <div>
              <div style={{ fontSize: '0.55rem', opacity: 0.8, textTransform: 'uppercase' }}>N° Carte CMU / Code Patient IPP</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '700', fontFamily: 'monospace', letterSpacing: '1px' }}>
                {citizen.cmuNumber || '—'} {citizen.patientCode ? `| IPP: ${citizen.patientCode}` : '| IPP: IPP-COUD-2026-88'}
              </div>
            </div>
            <div style={{ fontSize: '0.6rem', opacity: 0.8, textAlign: 'right' }}>
              👆 Toucher pour<br />le QR Code Tri-Layer
            </div>
          </div>

          {/* Encart publicitaire & Sponsoring RSE */}
          <div style={{ 
            position: 'relative', 
            zIndex: 1, 
            marginTop: '0.2rem', 
            padding: '0.15rem 0.5rem', 
            background: 'rgba(255,255,255,0.15)', 
            borderRadius: '6px', 
            fontSize: '0.55rem', 
            display: 'flex', 
            justify: 'space-between', 
            alignItems: 'center' 
          }}>
            <span>✨ Sponsorisé par <strong>PATISEN</strong> & <strong>Wave</strong></span>
            <span style={{ opacity: 0.8 }}>RÉPUBLIQUE DU SÉNÉGAL 🇸🇳</span>
          </div>
        </div>

        {/* VERSO : QR code de vérification Tri-Layer */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderRadius: '16px',
            background: '#fff',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.3rem',
            border: '2px solid var(--primary)'
          }}
        >
          {qrUrl ? (
            <img src={qrUrl} alt="QR code CMU" style={{ width: '110px', height: '110px' }} />
          ) : (
            <div style={{ width: '110px', height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', borderRadius: '8px', fontSize: '0.7rem', color: '#999' }}>
              Génération...
            </div>
          )}
          <div style={{ textAlign: 'center', color: 'var(--text-color)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary)' }}>
              🔒 QR Code Tri-Layer Sécurisé
            </div>
            <div style={{ fontSize: '0.6rem', color: '#64748b' }}>
              Scanner pour Statut CMU, Urgence SOS & Imagerie
            </div>
          </div>
        </div>
      </div>

      {/* Actions carte */}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        {qrUrl && (
          <a
            href={qrUrl}
            download={`carte-cmu-${citizen.cmuNumber}.png`}
            className="btn btn-outline btn-sm"
            style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', textDecoration: 'none' }}
          >
            ⬇️ Télécharger QR
          </a>
        )}
      </div>
    </div>
  );
}
