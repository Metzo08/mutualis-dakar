import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Modale universelle de confirmation de suppression ultra-moderne (Design Émeraude & Crimson Red Glassmorphism).
 * Utilisée sur toute la plateforme MUTUALIS DAKAR pour valider les actions de suppression.
 */
export default function DeleteModal({
  isOpen,
  title = 'Élément sélectionné',
  itemType = 'Enregistrement médical',
  onConfirm,
  onClose
}) {
  if (!isOpen) return null;

  return createPortal(
    <div 
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        width: '100vw', height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        boxSizing: 'border-box'
      }}
      className="fade-in"
      onClick={onClose}
    >
      <div 
        style={{
          maxWidth: '480px',
          width: '100%',
          backgroundColor: '#0f172a',
          border: '2px solid #ef4444',
          borderRadius: '24px',
          boxShadow: '0 25px 70px rgba(220, 38, 38, 0.35)',
          color: '#ffffff',
          padding: '2rem 1.75rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}
        className="fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cercles décoratifs d'arrière-plan */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.12)',
          filter: 'blur(20px)',
          pointerEvents: 'none'
        }} />

        {/* Icône Corbeille rouge fluo */}
        <div style={{
          width: '68px',
          height: '68px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.25) 100%)',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.1rem',
          margin: '0 auto 1.25rem auto',
          border: '2px solid rgba(239, 68, 68, 0.4)',
          boxShadow: '0 0 25px rgba(239, 68, 68, 0.35)'
        }}>
          🗑️
        </div>

        <h4 style={{ color: '#ffffff', fontWeight: '850', fontSize: '1.4rem', marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>
          Confirmation de suppression
        </h4>

        <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: '1.5', marginBottom: '1.25rem' }}>
          Êtes-vous sûr de vouloir supprimer définitivement cet enregistrement de la plateforme UNAMUSC ?
        </p>

        {/* Boîte résumé de l'élément ciblé */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          padding: '1rem 1.15rem',
          marginBottom: '1.25rem',
          textAlign: 'left'
        }}>
          <small style={{ color: '#ef4444', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.72rem', display: 'block', marginBottom: '0.3rem', letterSpacing: '0.05em' }}>
            ÉLÉMENT À SUPPRIMER ({itemType.toUpperCase()}) :
          </small>
          <strong style={{ color: '#f8fafc', fontSize: '0.98rem', display: 'block', lineHeight: '1.4' }}>
            {title}
          </strong>
        </div>

        {/* Warning traçabilité DHIS2 */}
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '14px',
          padding: '0.85rem 1rem',
          marginBottom: '1.5rem',
          fontSize: '0.8rem',
          color: '#fca5a5',
          textAlign: 'left',
          lineHeight: '1.45'
        }}>
          ⚠️ <strong>Attention :</strong> Cette action est irréversible et sera immédiatement journalisée dans le registre national de sécurité et d'audit UNAMUSC.
        </div>

        {/* Boutons d'action */}
        <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center' }}>
          <button 
            type="button" 
            className="btn btn-secondary fw-bold"
            onClick={onClose}
            style={{
              flex: 1,
              borderRadius: '14px',
              padding: '0.75rem 1.25rem',
              background: '#334155',
              borderColor: '#334155',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: '700'
            }}
          >
            Annuler
          </button>
          
          <button 
            type="button" 
            className="btn btn-danger fw-bold"
            onClick={() => {
              if (onConfirm) onConfirm();
              onClose();
            }}
            style={{
              flex: 1.2,
              borderRadius: '14px',
              padding: '0.75rem 1.25rem',
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: '700',
              boxShadow: '0 6px 20px rgba(220, 38, 38, 0.4)'
            }}
          >
            🗑️ Confirmer la suppression
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
