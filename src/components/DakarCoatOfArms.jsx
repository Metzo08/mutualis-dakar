/**
 * Armoiries de la Ville de Dakar — reproduction vectorielle (SVG) utilisée
 * comme FILIGRANE des cartes scolaires CMU-Élèves / CMU-Daara, conformément
 * au modèle officiel MSDD Dakar (`modele cartes cmu-eleves et daara`) :
 * couronne murale crénelée, écu au phare rouge rayonnant, voiliers blancs,
 * chevrons verts et branches de laurier.
 *
 * Le tracé est vectoriel (aucun fichier image) : il reste net à 600 dpi à
 * l'impression et suit la couleur des cartes sans asset binaire.
 */
export default function DakarCoatOfArms({ className = '', style = null }) {
  // Feuilles de laurier : positions (x, y) + rotation, répétées en miroir.
  const LAUREL = [
    { x: 74, y: 220, r: -18 },
    { x: 57, y: 200, r: -40 },
    { x: 45, y: 176, r: -62 },
    { x: 40, y: 150, r: -80 },
    { x: 42, y: 124, r: -100 },
    { x: 52, y: 100, r: -122 },
    { x: 68, y: 78, r: -142 }
  ];

  return (
    <svg
      viewBox="0 0 200 260"
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Armoiries de la Ville de Dakar"
    >
      {/* ── Branches de laurier (gauche puis miroir droit) ── */}
      <g fill="#8ccfa0">
        {LAUREL.map((l, i) => (
          <ellipse key={`lg${i}`} cx={l.x} cy={l.y} rx="7" ry="11" transform={`rotate(${l.r} ${l.x} ${l.y})`} />
        ))}
        {LAUREL.map((l, i) => (
          <ellipse key={`ld${i}`} cx={200 - l.x} cy={l.y} rx="7" ry="11" transform={`rotate(${-l.r} ${200 - l.x} ${l.y})`} />
        ))}
      </g>

      {/* ── Couronne murale crénelée + tour centrale ── */}
      <g fill="#d5cfbb" stroke="#aaa392" strokeWidth="1.2" strokeLinejoin="miter">
        <path d="M46 34 V22 H52 V30 H58 V22 H64 V30 H70 V22 H76 V30 H82 V22 H88 V30 H94 V22 H100 V30 H106 V22 H112 V30 H118 V22 H124 V30 H130 V22 H136 V30 H142 V22 H148 V30 H154 V22 V34 Z" />
        <path d="M86 24 V6 H93 V14 H100 V6 H107 V14 H114 V6 V24 Z" />
      </g>

      {/* ── Écu (champ léger pervenche) ── */}
      <path
        d="M56 40 H144 V124 C144 172 120 206 100 224 C80 206 56 172 56 124 Z"
        fill="#dfe3f5"
        stroke="#b6bed6"
        strokeWidth="1.6"
      />

      {/* ── Chef : bandeau d'or tenant le phare rouge rayonnant ── */}
      <path d="M56 40 H86 V82 H56 Z" fill="#f2dc92" />
      <path d="M114 40 H144 V82 H114 Z" fill="#f2dc92" />
      <rect x="86" y="40" width="28" height="42" fill="#f8f5ea" />
      <g stroke="#e6c765" strokeWidth="1.6" strokeLinecap="round">
        <line x1="84" y1="48" x2="66" y2="44" />
        <line x1="84" y1="58" x2="64" y2="58" />
        <line x1="84" y1="68" x2="66" y2="72" />
        <line x1="116" y1="48" x2="134" y2="44" />
        <line x1="116" y1="58" x2="136" y2="58" />
        <line x1="116" y1="68" x2="134" y2="72" />
      </g>
      <rect x="95.5" y="43" width="9" height="6" fill="#fdfdfb" stroke="#c9534f" strokeWidth="1.1" />
      <path d="M94 49 H106 L104 82 H96 Z" fill="#c9534f" />

      {/* ── Chevrons verts ── */}
      <g fill="none" stroke="#6fb189" strokeWidth="11" strokeLinejoin="round" strokeLinecap="butt">
        <path d="M64 138 L100 112 L136 138" />
        <path d="M64 162 L100 136 L136 162" />
        <path d="M64 186 L100 160 L136 186" />
      </g>

      {/* ── Voiliers blancs de part et d'autre ── */}
      <g fill="#ffffff" stroke="#c3cbdd" strokeWidth="1.2">
        <path d="M76 176 L88 138 L88 190 Z" />
        <path d="M124 176 L112 138 L112 190 Z" />
      </g>
    </svg>
  );
}
