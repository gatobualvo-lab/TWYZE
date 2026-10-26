// A short burst of brand-coloured confetti for the moments that earn it (a recorded sale).
// Drawn on one temporary full-screen canvas that ignores pointer input and removes itself,
// so nothing underneath is blocked. Skipped entirely for anyone who prefers reduced motion.

const COLORS = ['#0e9f6e', '#34d399', '#f5a524', '#fbc84f', '#6ee7b7', '#ffffff'];
const DURATION_MS = 1700;
const COUNT = 70;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  color: string;
  round: boolean;
}

export function celebrate(origin?: { x: number; y: number }): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: `${width}px`,
    height: `${height}px`,
    pointerEvents: 'none',
    zIndex: '9999',
  });
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  document.body.appendChild(canvas);

  const ox = origin?.x ?? width / 2;
  const oy = origin?.y ?? height * 0.72;
  const pieces: Piece[] = Array.from({ length: COUNT }, () => {
    // Fan upward, then let gravity bring it all back down.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95;
    const speed = 7 + Math.random() * 8;
    return {
      x: ox,
      y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 5 + Math.random() * 6,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      round: Math.random() < 0.3,
    };
  });

  const start = performance.now();
  const frame = (now: number) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, width, height);
    const fade = elapsed > DURATION_MS * 0.7 ? Math.max(0, 1 - (elapsed - DURATION_MS * 0.7) / (DURATION_MS * 0.3)) : 1;

    for (const p of pieces) {
      p.vy += 0.24;
      p.vx *= 0.992;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
    }

    if (elapsed < DURATION_MS) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
