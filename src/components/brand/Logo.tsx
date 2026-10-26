import React from 'react';

// The Trackwyze logo, drawn from the brand files (primary logo + variations):
// a rounded tile holding a rising zig-zag trend line, with an amber dot at the
// peak. The wordmark is "Track" + "Wyze" in Sora Bold, tightly tracked.

export type MarkVariant = 'navy' | 'dark' | 'emerald';

const MARK_COLORS: Record<MarkVariant, { tile: string; stroke: string }> = {
  // Primary: on light backgrounds.
  navy: { tile: '#0F1B2D', stroke: '#0E9F6E' },
  // On dark backgrounds (sidebar, splash): a lighter tile and a brighter green so it doesn't sink.
  dark: { tile: '#1C2B42', stroke: '#34D399' },
  // App-icon style: green tile, white line.
  emerald: { tile: '#0E9F6E', stroke: '#FFFFFF' },
};

export const BRAND_AMBER = '#F5A524';
export const TAGLINE = 'Track Smart. Profit Wise.';

interface LogoMarkProps {
  className?: string;
  variant?: MarkVariant;
  /** Decorative by default (the wordmark next to it carries the name). Pass a title to make it a labelled image. */
  title?: string;
}

export const LogoMark: React.FC<LogoMarkProps> = ({ className = 'w-10 h-10', variant = 'navy', title }) => {
  const { tile, stroke } = MARK_COLORS[variant];
  return (
    <svg
      viewBox="0 0 64 64"
      className={`flex-shrink-0 ${className}`}
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      <rect x="0" y="0" width="64" height="64" rx="16" fill={tile} />
      <polyline points="12,22 22,46 32,30 42,46 52,16" fill="none" stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="52" cy="16" r="5" fill={BRAND_AMBER} />
    </svg>
  );
};

interface WordmarkProps {
  className?: string;
  /** White "Track" and a brighter green "Wyze", for dark backgrounds. */
  onDark?: boolean;
}

export const Wordmark: React.FC<WordmarkProps> = ({ className = 'text-2xl', onDark = false }) => (
  <span className={`font-display font-bold tracking-[-0.04em] leading-none whitespace-nowrap ${className}`}>
    <span className={onDark ? 'text-white' : 'text-gray-900'}>Track</span>
    <span className={onDark ? 'text-blue-400' : 'text-blue-500'}>Wyze</span>
  </span>
);

interface LogoProps {
  onDark?: boolean;
  /** Show "Track Smart. Profit Wise." under the name. */
  showTagline?: boolean;
  markClassName?: string;
  wordmarkClassName?: string;
  className?: string;
}

/** Mark + wordmark (+ tagline), the horizontal lock-up. */
export const Logo: React.FC<LogoProps> = ({ onDark = false, showTagline = false, markClassName = 'w-10 h-10', wordmarkClassName = 'text-2xl', className = '' }) => (
  <span className={`inline-flex items-center gap-3 ${className}`}>
    <LogoMark variant={onDark ? 'dark' : 'navy'} className={markClassName} />
    <span className="flex flex-col gap-1.5">
      <Wordmark onDark={onDark} className={wordmarkClassName} />
      {showTagline && (
        <span className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${onDark ? 'text-white/55' : 'text-gray-600'}`}>{TAGLINE}</span>
      )}
    </span>
  </span>
);

export default Logo;
