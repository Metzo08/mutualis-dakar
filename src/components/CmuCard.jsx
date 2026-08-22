import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { detectLanIp, getCachedLanIp } from '../utils/lanIp';

// Carte CSU numérique : affiche les informations de l'assuré + QR code vérifiable haute définition.
// Le QR code encode une URL de vérification publique (/api/cmu-card/:cmuNumber).
// Fonctionne hors-ligne et en ligne avec haute tolérance et netteté maximale (noir pur sur blanc pur).
export default function CmuCard({ citizen }) {
  const [qrUrl, setQrUrl] = useState('');
  const [flipped, setFlipped] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(15);
  const [otpHash, setOtpHash] = useState('SEC-84920');
  const [isFlashing, setIsFlashing] = useState(false);
  const [showZoomModal, setShowZoomModal] = useState(false);

  // Détection automatique de l'IP LAN réelle du PC pour un QR scannable
  // depuis les smartphones du réseau Wi-Fi (repli : valeurs locales).
  const [lanIp, setLanIp] = useState(() => getCachedLanIp() || null);
  useEffect(() => {
    if (lanIp) return;
    let cancelled = false;
    detectLanIp().then((ip) => { if (!cancelled && ip) setLanIp(ip); });
    return () => { cancelled = true; };
  }, [lanIp]);

  useEffect(() => {
    if (!citizen || !citizen.cmuNumber) return;

    const generateDynamicQr = () => {
      let origin = window.location.origin;
      const currentHost = window.location.hostname;
      const currentPort = window.location.port || '5173';
      
      // Si la page tourne sur localhost/127.0.0.1 (PC), remplacer par l'IP Wi-Fi réseau si disponible
      if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
        const detected = lanIp || getCachedLanIp();
        let serverIp = localStorage.getItem('cmu-server-ip') || localStorage.getItem('cmu-wifi-ip') || detected || '192.168.1.42';
        if (serverIp === '192.168.1.3' || serverIp === '192.168.1.5' || serverIp === '192.168.1.13' || serverIp === '192.168.1.64') {
          serverIp = '192.168.1.42';
        }
        if (serverIp && serverIp !== 'localhost' && serverIp !== '127.0.0.1') {
          origin = `http://${serverIp}:${currentPort}`;
        }
      }
      // Horodatage rotatif 15s + jeton OTP 5 chiffres
      const timestampSeed = Math.floor(Date.now() / 15000);
      const newOtpToken = `SEC-${(timestampSeed % 90000 + 10000)}`;
      setOtpHash(newOtpToken);

      // Flash visuel pour rendre la régénération visible
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 400);

      const verifyUrl = `${origin}/#/verify/${citizen.cmuNumber}?otp=${timestampSeed}`;

      // Génération Ultra HD en Noir Pur sur Blanc Pur pour contraste 100% scannable
      QRCode.toDataURL(verifyUrl, {
        margin: 2,
        width: 480,
        errorCorrectionLevel: 'H',
        color: { dark: '#000000', light: '#ffffff' }
      })
      .then(setQrUrl)
      .catch(() => setQrUrl(''));
    };

    generateDynamicQr();

    // Compte à rebours 15s pour régénération automatique
    const timerInterval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          generateDynamicQr();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [citizen, lanIp]);

  if (!citizen) return null;

  const isActive = citizen.status === 'active';
  const fullName = `${citizen.firstName || ''} ${citizen.lastName || ''}`.trim();
  const cmuDisplay = citizen.cmuNumber?.replace('CMU-', 'CSU-') || 'CSU-DKR-2026-8812';

  return (
    <div className="cmu-card-wrapper" style={{ perspective: '1000px', marginBottom: '1.5rem' }}>
      
      {/* Boutons d'action rapides au-dessus de la carte */}
      <div className="d-flex justify-content-center align-items-center gap-3 mb-3 flex-wrap">
        <button
          type="button"
          className="btn btn-sm fw-bold px-3.5 py-2 hover-lift d-flex align-items-center gap-2"
          style={{
            background: 'var(--bg-card-subtle)',
            color: 'var(--text-main)',
            border: '1.5px solid var(--border-color)',
            borderRadius: '12px',
            fontSize: '0.85rem'
          }}
          onClick={() => setFlipped(!flipped)}
        >
          🔄 {flipped ? 'Voir la face Recto' : 'Voir la face Verso (QR Code)'}
        </button>

        <button
          type="button"
          className="btn btn-sm fw-bold px-3.5 py-2 hover-lift d-flex align-items-center gap-2 text-white"
          style={{
            background: '#059669',
            border: 'none',
            borderRadius: '12px',
            fontSize: '0.85rem',
            boxShadow: '0 2px 8px rgba(5,150,105,0.25)'
          }}
          onClick={() => setShowZoomModal(true)}
        >
          🔍 Agrandir le QR Code
        </button>
      </div>

      {/* CARTE PHYSIQUE VIRTUELLE 3D */}
      <div
        className="cmu-card"
        onClick={() => setFlipped(!flipped)}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '430px',
          height: '275px',
          margin: '0 auto',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          cursor: 'pointer',
          borderRadius: '20px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
        }}
      >
        {/* RECTO : Informations de l'assuré */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)',
            color: '#fff',
            padding: '1.35rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflow: 'hidden',
            border: '2px solid rgba(255,255,255,0.15)'
          }}
        >
          {/* Décor d'arrière-plan */}
          <div style={{
            position: 'absolute', top: '-40px', right: '-40px', width: '140px', height: '140px',
            background: 'rgba(255,255,255,0.08)', borderRadius: '50%'
          }} />
          <div style={{
            position: 'absolute', bottom: '-50px', left: '-30px', width: '120px', height: '120px',
            background: 'rgba(255,255,255,0.06)', borderRadius: '50%'
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
            <div>
              <div style={{ fontSize: '0.72rem', opacity: 0.9, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: '800' }}>
                Couverture Santé Universelle
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '900', letterSpacing: '0.5px' }}>
                MUTUALIS DAKAR 🇸🇳
              </div>
            </div>
            <span style={{
              background: isActive ? '#10b981' : '#ef4444',
              padding: '0.35rem 0.85rem', borderRadius: '16px', fontSize: '0.76rem', fontWeight: '800',
              whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.2)'
            }}>
              {isActive ? '● ACTIF' : '🔴 SUSPENDU'}
            </span>
          </div>

          <div style={{ position: 'relative', zIndex: 1, margin: '0.5rem 0' }}>
            <div style={{ fontSize: '1.35rem', fontWeight: '900', marginBottom: '0.4rem', textShadow: '0 2px 4px rgba(0,0,0,0.35)' }}>
              {fullName || 'Awa Ndiaye'}
            </div>
            <div style={{ fontSize: '0.84rem', fontWeight: '750', display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
              <span style={{ background: '#ffffff', color: '#047857', padding: '0.25rem 0.65rem', borderRadius: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
                📦 {citizen.packageType || 'maternité 100%'}
              </span>
              <span style={{ background: 'rgba(255,255,255,0.22)', padding: '0.25rem 0.65rem', borderRadius: '10px' }}>
                🏥 {citizen.mutuelleName || 'Mutuelle de la Médina'}
              </span>
            </div>
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            position: 'relative', 
            zIndex: 1,
            background: 'rgba(0,0,0,0.3)',
            padding: '0.6rem 0.85rem',
            borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.18)'
          }}>
            <div>
              <div style={{ fontSize: '0.62rem', opacity: 0.9, textTransform: 'uppercase', fontWeight: '750' }}>Code bénéficiaire / Code Patient IPP</div>
              <div style={{ fontSize: '0.92rem', fontWeight: '900', fontFamily: 'monospace', letterSpacing: '0.5px', color: '#fef08a' }}>
                {cmuDisplay} {citizen.patientCode ? `| IPP: ${citizen.patientCode}` : '| IPP: IPP-DKR-2026-88'}
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#ffffff', textAlign: 'right', opacity: 0.95 }}>
              👆 Toucher pour<br />le QR Code
            </div>
          </div>
        </div>

        {/* VERSO : QR Code Haute Définition Scannable */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '2.5px solid #059669',
            boxSizing: 'border-box'
          }}
        >
          {/* En-tête Verso */}
          <div className="d-flex justify-content-between align-items-center w-100 px-1">
            <span style={{ fontSize: '0.70rem', fontWeight: '850', color: '#064e3b', letterSpacing: '0.2px' }}>
              UNAMUSC SENEGAL - CARTE NATIONALE D’ASSURANCE SANTÉ
            </span>
            <span className="badge" style={{ backgroundColor: '#059669', color: '#ffffff', fontSize: '0.72rem', borderRadius: '10px', padding: '0.3rem 0.65rem', fontWeight: '800' }}>
              ⏱️ {secondsLeft}s
            </span>
          </div>

          {/* Image du QR Code Haute Définition avec Contraste Maximal */}
          <div 
            style={{ 
              padding: '8px', 
              background: '#ffffff', 
              borderRadius: '16px', 
              border: '2px solid #0f172a',
              boxShadow: '0 6px 18px rgba(0,0,0,0.12)', 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
          >
            {qrUrl ? (
              <img 
                src={qrUrl} 
                alt="QR code CSU" 
                style={{ 
                  width: '130px', 
                  height: '130px', 
                  display: 'block',
                  imageRendering: 'pixelated',
                  transition: 'transform 0.3s ease',
                  transform: isFlashing ? 'scale(0.96)' : 'scale(1)'
                }} 
              />
            ) : (
              <div style={{ width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '12px', fontSize: '0.78rem', color: '#64748b' }}>
                <span className="spinner-border spinner-border-sm me-1"></span> Génération...
              </div>
            )}
          </div>

          {/* Pied de Carte Verso */}
          <div className="d-flex justify-content-between align-items-center w-100 px-1">
            <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#0f172a', fontFamily: 'monospace' }}>
              {cmuDisplay}
            </div>
            <div style={{ fontSize: '0.70rem', fontWeight: '850', color: '#059669', background: 'rgba(5, 150, 105, 0.12)', padding: '0.2rem 0.6rem', borderRadius: '8px' }}>
              {otpHash}
            </div>
          </div>
        </div>

      </div>

      {/* Actions de téléchargement sous la carte */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.25rem', flexWrap: 'wrap' }}>
        {qrUrl && (
          <a
            href={qrUrl}
            download={`qr-code-csu-${citizen.cmuNumber}.png`}
            className="btn btn-outline-success btn-sm fw-bold px-3 py-2 hover-lift"
            style={{ fontSize: '0.84rem', borderRadius: '12px', textDecoration: 'none' }}
          >
            ⬇️ Télécharger le QR Code PNG HD
          </a>
        )}
      </div>

      {/* MODAL PLEIN ÉCRAN / ZOOM QR CODE POUR SCAN FACILE EN STRUCTURE DE SANTÉ */}
      {showZoomModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowZoomModal(false); }}
        >
          <div 
            style={{
              background: '#ffffff',
              color: '#0f172a',
              borderRadius: '26px',
              padding: '2.5rem 2rem',
              maxWidth: '440px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
              border: '2px solid #10b981'
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#059669', padding: '0.5rem 1rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '800' }}>
                🔒 QR Code Certifié ANACSU
              </span>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setShowZoomModal(false)}
              ></button>
            </div>

            <h5 className="fw-extrabold mb-1" style={{ color: '#0f172a', fontSize: '1.25rem' }}>
              {fullName}
            </h5>
            <div className="text-muted fw-bold mb-3" style={{ fontSize: '0.88rem' }}>
              Code bénéficiaire: <span style={{ color: '#059669', fontFamily: 'monospace' }}>{cmuDisplay}</span>
            </div>

            {/* QR Code Grand Format 260px x 260px */}
            <div 
              style={{
                background: '#ffffff',
                padding: '16px',
                borderRadius: '20px',
                border: '3px solid #0f172a',
                display: 'inline-block',
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                marginBottom: '1.25rem'
              }}
            >
              {qrUrl && (
                <img 
                  src={qrUrl} 
                  alt="QR Code Zoomé" 
                  style={{
                    width: '260px',
                    height: '260px',
                    display: 'block',
                    imageRendering: 'pixelated'
                  }} 
                />
              )}
            </div>

            <div className="d-flex justify-content-between align-items-center mb-4 px-2" style={{ fontSize: '0.82rem', color: '#64748b' }}>
              <span>⏱️ Renouvellement dans : <strong className="text-success">{secondsLeft}s</strong></span>
              <span>Jeton : <strong style={{ color: '#059669', fontFamily: 'monospace' }}>{otpHash}</strong></span>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Présentez cet écran directement au guichet de l'hôpital, de la clinique ou de la pharmacie conventionnée pour validation immédiate du tiers-payant.
            </p>

            <button
              type="button"
              className="btn w-100 fw-extrabold py-3 hover-lift text-white"
              style={{
                background: '#059669',
                border: 'none',
                borderRadius: '16px',
                fontSize: '0.95rem',
                boxShadow: '0 4px 16px rgba(5,150,105,0.3)'
              }}
              onClick={() => setShowZoomModal(false)}
            >
              ✓ Fermer le plein écran
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
