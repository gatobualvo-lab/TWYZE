import React from 'react';

type Tone = 'brand' | 'light' | 'current';

const TONE_CLASSES: Record<Tone, string> = {
  brand: 'text-blue-600',
  light: 'text-white',
  current: '',
};

interface SpinnerProps {
  className?: string;
  /** brand: teal with a saffron comet; light: for buttons with a dark/teal fill; current: inherits the surrounding text colour. */
  tone?: Tone;
  /** Read out by screen readers. */
  label?: string;
}

/**
 * Trackwyze's loading indicator: a faint track, a rounded arc that eases around it
 * (fast through the middle, slower at the ends, so it feels like it has weight),
 * and a small saffron "comet" chasing the arc. Size it with w-/h- classes.
 */
const Spinner: React.FC<SpinnerProps> = ({ className = 'w-5 h-5', tone = 'brand', label = 'Loading' }) => (
  <svg
    role="status"
    aria-label={label}
    viewBox="0 0 24 24"
    fill="none"
    className={`flex-shrink-0 animate-[spin_0.8s_linear_infinite] ${TONE_CLASSES[tone]} ${className}`}
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.18" strokeWidth="3" />
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="15 42" />
    {tone === 'brand' && <circle cx="21" cy="12" r="1.9" fill="#f5a524" />}
  </svg>
);

export default Spinner;
