import React, { useId } from 'react';

interface SparklineProps {
  values: number[];
  className?: string;
  /** Stroke colour; the soft fill underneath uses the same colour. */
  color?: string;
}

const W = 100;
const H = 32;
const PAD = 3;

/** A tiny trend line for a KPI card. It draws itself once when it appears. Decorative: the number beside it is the real information. */
const Sparkline: React.FC<SparklineProps> = ({ values, className = 'w-20 h-8', color = '#0e9f6e' }) => {
  const gradientId = useId();
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = (W - PAD * 2) / (values.length - 1);
  const points = values.map((v, i) => [PAD + i * step, H - PAD - ((v - min) / span) * (H - PAD * 2)] as const);

  // Smooth the line through the points with midpoint curves.
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const mx = (px + x) / 2;
    d += ` Q ${px} ${py} ${mx} ${(py + y) / 2}`;
    if (i === points.length - 1) d += ` T ${x} ${y}`;
  }
  const last = points[points.length - 1];
  const area = `${d} L ${last[0]} ${H} L ${points[0][0]} ${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} className="animate-fade-in" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
        strokeDasharray={1}
        className="animate-[draw-line_1.1s_cubic-bezier(0.22,1,0.36,1)_both]"
      />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} className="animate-pop-check" style={{ animationDelay: '0.9s', animationFillMode: 'both' }} />
    </svg>
  );
};

export default Sparkline;
