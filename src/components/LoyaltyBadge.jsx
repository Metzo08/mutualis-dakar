import React from 'react';

export default function LoyaltyBadge({ level, points, showLabel = true }) {
  const getLevelStyle = () => {
    switch (level?.toLowerCase()) {
      case 'or':
        return {
          gradient: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
          shadow: '0 4px 12px rgba(217, 119, 6, 0.25)',
          emoji: '🥇',
          label: 'Or'
        };
      case 'argent':
        return {
          gradient: 'linear-gradient(135deg, #94a3b8 0%, #475569 100%)',
          shadow: '0 4px 12px rgba(71, 85, 105, 0.25)',
          emoji: '🥈',
          label: 'Argent'
        };
      case 'bronze':
        return {
          gradient: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)',
          shadow: '0 4px 12px rgba(120, 53, 15, 0.25)',
          emoji: '🥉',
          label: 'Bronze'
        };
      default:
        return {
          gradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
          shadow: '0 4px 12px rgba(4, 120, 87, 0.25)',
          emoji: '🌱',
          label: 'Nouveau'
        };
    }
  };

  const style = getLevelStyle();

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.4rem 0.8rem',
      borderRadius: '20px',
      background: style.gradient,
      color: '#fff',
      fontWeight: 'bold',
      fontSize: '0.8rem',
      boxShadow: style.shadow,
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <span>{style.emoji}</span>
      {showLabel && <span>{style.label} {points !== undefined ? `(${points} pts)` : ''}</span>}
    </div>
  );
}
