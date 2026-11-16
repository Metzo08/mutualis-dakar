import { useEffect, useRef } from 'react';

/**
 * Composant Nuage Vocal Interactif 3D / Fluid Orb (Style ChatGPT Voice / Siri / Gemini Live)
 * 
 * Réagit en temps réel au rythme de la voix (Web Audio API AnalyserNode) :
 * - En veille : rotation douce, respiration céleste (émeraude, cyan, violet)
 * - L'usager parle : ondulations et changements de couleurs vibrants au rythme de la parole
 * - Zahara parle : pulsations irisées et ondes sonores synchronisées avec l'audio
 */
export default function VoiceCloudOrb({
  isListening = false,
  isSpeaking = false,
  isThinking = false,
  audioLevel = 0, // 0.0 à 1.0 (fourni par l'analyseur micro ou généré)
  size = 180,
  lang = 'wo'
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const stateRef = useRef({
    angle: 0,
    pulse: 0,
    smoothedLevel: 0,
    particles: []
  });

  // Initialisation des particules stellaires dans le nuage
  useEffect(() => {
    const particles = [];
    const count = 36;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: (Math.random() - 0.5) * size * 0.8,
        y: (Math.random() - 0.5) * size * 0.8,
        radius: Math.random() * 3 + 1.5,
        speedX: (Math.random() - 0.5) * 0.6,
        speedY: (Math.random() - 0.5) * 0.6,
        alpha: Math.random() * 0.7 + 0.3,
        hue: Math.random() * 60 + 140 // Vert émeraude à cyan
      });
    }
    stateRef.current.particles = particles;
  }, [size]);

  // Boucle de rendu Canvas 60 FPS réactive à la voix
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      const state = stateRef.current;
      state.angle += (isListening || isSpeaking) ? 0.035 : 0.015;
      state.pulse += 0.04;

      // Lissage du volume audio
      const targetLevel = (isListening || isSpeaking) ? Math.max(audioLevel, 0.25) : 0.08;
      state.smoothedLevel += (targetLevel - state.smoothedLevel) * 0.15;
      const energy = state.smoothedLevel;

      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;

      ctx.clearRect(0, 0, width, height);

      // ── 1. Ondes de halo extérieures rayonnantes au rythme de la voix ──
      if (isListening || isSpeaking) {
        const ringCount = 3;
        for (let r = 1; r <= ringCount; r++) {
          const ringProgress = (state.pulse * 0.8 + r * (Math.PI * 2 / ringCount)) % (Math.PI * 2);
          const ringRadius = (size * 0.45) + (ringProgress / (Math.PI * 2)) * (size * 0.45) * (1 + energy * 0.5);
          const ringAlpha = Math.max(0, (1 - ringRadius / (size * 0.85))) * (0.2 + energy * 0.4);

          ctx.beginPath();
          ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = isListening 
            ? `rgba(16, 185, 129, ${ringAlpha})` // Émeraude sénégalaise
            : `rgba(56, 189, 248, ${ringAlpha})`; // Cyan électrique Zahara
          ctx.lineWidth = 2 + energy * 3;
          ctx.stroke();
        }
      }

      // ── 2. Nuage Organique Principal (Multiples dégradés radiaux mouvants) ──
      const baseRadius = (size * 0.34) * (1 + energy * 0.35 + Math.sin(state.pulse) * 0.05);

      // Couleurs dynamiques selon l'état
      let color1, color2, color3, color4;
      if (isListening) {
        // Mode Écoute : Teintes Vert Émeraude & Or Sénégalais vives
        color1 = `rgba(16, 185, 129, ${0.85 + energy * 0.15})`; // Vert CSU
        color2 = `rgba(245, 158, 11, ${0.75 + energy * 0.2})`;  // Or ambré
        color3 = `rgba(6, 182, 212, ${0.65 + energy * 0.2})`;  // Cyan
        color4 = 'rgba(4, 120, 87, 0)';
      } else if (isSpeaking) {
        // Mode Réponse Zahara : Cyan, Indigo & Violet chatoyants
        color1 = `rgba(56, 189, 248, ${0.85 + energy * 0.15})`; // Ciel
        color2 = `rgba(139, 92, 246, ${0.80 + energy * 0.15})`; // Violet
        color3 = `rgba(236, 72, 153, ${0.60 + energy * 0.2})`;  // Rose magenta
        color4 = 'rgba(30, 58, 138, 0)';
      } else if (isThinking) {
        // Mode Réflexion : Violet & Or irisé tourbillonnant
        color1 = 'rgba(168, 85, 247, 0.85)';
        color2 = 'rgba(234, 179, 8, 0.75)';
        color3 = 'rgba(99, 102, 241, 0.65)';
        color4 = 'rgba(88, 28, 135, 0)';
      } else {
        // Mode Veille : Harmonie douce émeraude et azur
        color1 = 'rgba(16, 185, 129, 0.70)';
        color2 = 'rgba(14, 165, 233, 0.60)';
        color3 = 'rgba(99, 102, 241, 0.45)';
        color4 = 'rgba(6, 78, 59, 0)';
      }

      // Décalages orbitaux fluides pour l'effet de nuage rotatif
      const offsetX1 = Math.cos(state.angle) * (baseRadius * 0.28);
      const offsetY1 = Math.sin(state.angle) * (baseRadius * 0.28);
      const offsetX2 = Math.cos(state.angle + Math.PI * 0.7) * (baseRadius * 0.25);
      const offsetY2 = Math.sin(state.angle + Math.PI * 0.7) * (baseRadius * 0.25);
      const offsetX3 = Math.cos(state.angle + Math.PI * 1.4) * (baseRadius * 0.22);
      const offsetY3 = Math.sin(state.angle + Math.PI * 1.4) * (baseRadius * 0.22);

      // Couche 1 : Coeur externe
      const g1 = ctx.createRadialGradient(cx + offsetX1, cy + offsetY1, 4, cx, cy, baseRadius * 1.25);
      g1.addColorStop(0, color1);
      g1.addColorStop(0.5, color2);
      g1.addColorStop(1, color4);
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // Couche 2 : Tourbillon interne (blend-mode)
      ctx.globalCompositeOperation = 'screen';
      const g2 = ctx.createRadialGradient(cx + offsetX2, cy + offsetY2, 2, cx, cy, baseRadius);
      g2.addColorStop(0, color2);
      g2.addColorStop(0.6, color3);
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.fill();

      // Couche 3 : Coeur lumineux central (lueur blanche / or)
      const g3 = ctx.createRadialGradient(cx + offsetX3, cy + offsetY3, 1, cx, cy, baseRadius * 0.65);
      g3.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      g3.addColorStop(0.3, color1);
      g3.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g3;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * 0.65, 0, Math.PI * 2);
      ctx.fill();

      // ── 3. Particules en suspension dans l'orb ──
      state.particles.forEach((p) => {
        p.x += p.speedX * (1 + energy * 2);
        p.y += p.speedY * (1 + energy * 2);
        const dist = Math.sqrt(p.x * p.x + p.y * p.y);
        if (dist > baseRadius * 0.85) {
          p.x = (Math.random() - 0.5) * baseRadius * 0.5;
          p.y = (Math.random() - 0.5) * baseRadius * 0.5;
        }

        ctx.beginPath();
        ctx.arc(cx + p.x, cy + p.y, p.radius * (1 + energy * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * (0.6 + energy * 0.4)})`;
        ctx.fill();
      });

      ctx.globalCompositeOperation = 'source-over';

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isListening, isSpeaking, isThinking, audioLevel, size]);

  return (
    <div 
      className="voice-cloud-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        margin: '0 auto'
      }}
    >
      {/* Canvas Rendu Nuage / Orb */}
      <canvas
        ref={canvasRef}
        width={size * 1.4}
        height={size * 1.4}
        style={{
          width: `${size * 1.4}px`,
          height: `${size * 1.4}px`,
          position: 'absolute',
          top: `-${size * 0.2}px`,
          left: `-${size * 0.2}px`,
          pointerEvents: 'none',
          filter: 'drop-shadow(0 0 25px rgba(16, 185, 129, 0.35))'
        }}
      />
    </div>
  );
}
