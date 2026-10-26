import React, { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  value: number;
  /** Turns the in-flight number into text, e.g. formatCurrency. */
  format?: (n: number) => string;
  /** Milliseconds for a full count. */
  duration?: number;
  className?: string;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Fast start, long soft landing: feels like a gauge settling rather than a stopwatch.
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * The animated value itself: counts from 0 up to `value` the first time, and from the
 * old value to the new one whenever it changes. Anyone who prefers reduced motion gets
 * the final number immediately.
 */
export function useCountUp(value: number, duration = 1000): number {
  const target = Number.isFinite(value) ? value : 0;
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? target : 0));
  const from = useRef(shown);

  useEffect(() => {
    if (prefersReducedMotion()) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const current = origin + (target - origin) * easeOutExpo(progress);
      from.current = current;
      setShown(current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return shown;
}

/** A number that counts up to its value. Screen readers get the final value immediately. */
const CountUp: React.FC<CountUpProps> = ({ value, format = n => Math.round(n).toLocaleString(), duration = 1000, className }) => {
  const target = Number.isFinite(value) ? value : 0;
  const shown = useCountUp(target, duration);
  return (
    <span className={className} aria-label={format(target)}>
      <span aria-hidden="true">{format(shown)}</span>
    </span>
  );
};

export default CountUp;
