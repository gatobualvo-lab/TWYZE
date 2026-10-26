import React, { useEffect, useState } from 'react';
import Spinner from './ui/Spinner';
import { LogoMark, Wordmark } from './brand/Logo';

interface LoadingScreenProps {
  /**
   * true (default): a roomy, branded loader that fills the page content area.
   * false: a compact inline block, for use inside a page that already has its own header/chrome.
   */
  fullScreen?: boolean;
  /** "splash" is the dark, full-viewport screen used while the app itself starts up. */
  variant?: 'page' | 'splash';
}

const MESSAGES = [
  'Counting your sales…',
  'Checking your stock…',
  'Tidying the books…',
  'Lining up your numbers…',
  'Almost there…',
];

/** Cycles through short, friendly status lines so a slow load never looks frozen. */
export function useRotatingMessage(intervalMs = 1900): string {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex(i => (i + 1) % MESSAGES.length), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return MESSAGES[index];
}

/** True only after `ms` has passed. A page that loads in a blink should not flash a loader. */
function useAfterDelay(ms: number): boolean {
  const [ready, setReady] = useState(ms === 0);
  useEffect(() => {
    if (ms === 0) return;
    const timer = setTimeout(() => setReady(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return ready;
}

/** The logo tile with a breathing glow and a saffron dot orbiting it. */
const LoaderMark: React.FC<{ light?: boolean }> = ({ light = false }) => (
  <div className="relative w-24 h-24 mx-auto">
    <span aria-hidden="true" className="absolute inset-3 rounded-2xl animate-ring-pulse" />
    <span aria-hidden="true" className="absolute inset-0 animate-[spin_2.6s_linear_infinite]">
      <span className="absolute left-1/2 top-0 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-accent-400 shadow-glow-accent" />
    </span>
    <span aria-hidden="true" className={`absolute inset-1 rounded-full border border-dashed ${light ? 'border-white/25' : 'border-blue-300/60'}`} />
    <LogoMark
      variant={light ? 'dark' : 'navy'}
      title="TrackWyze"
      className="absolute inset-[18px] w-[60px] h-[60px] drop-shadow-lg animate-[float_3s_ease-in-out_infinite]"
    />
  </div>
);

const ProgressBar: React.FC<{ light?: boolean }> = ({ light = false }) => (
  <div className={`relative w-36 h-1.5 rounded-full mx-auto overflow-hidden ${light ? 'bg-white/15' : 'bg-blue-100'}`}>
    <div className="absolute inset-y-0 w-1/2 rounded-full bg-gradient-to-r from-blue-400 via-blue-300 to-accent-400 animate-loading-bar" />
  </div>
);

const LoadingScreen: React.FC<LoadingScreenProps> = ({ fullScreen = true, variant = 'page' }) => {
  const message = useRotatingMessage();
  const ready = useAfterDelay(variant === 'splash' ? 0 : 200);

  if (!ready) {
    // Hold the space so the page doesn't jump, but stay quiet unless loading drags on.
    return <div aria-busy="true" className={fullScreen ? 'min-h-[70vh]' : 'py-14'} />;
  }

  if (variant === 'splash') {
    return (
      <div className="min-h-screen flex items-center justify-center mesh-brand animated-mesh text-white" role="status" aria-live="polite">
        <div aria-hidden="true" className="absolute inset-0 bg-dots opacity-40" />
        <div className="relative text-center px-6">
          <LoaderMark light />
          <h1 className="mt-6">
            <Wordmark onDark className="text-4xl" />
          </h1>
          <p className="text-white/60 text-sm font-medium mt-1 mb-7">Track Smart. Profit Wise.</p>
          <ProgressBar light />
          <p key={message} className="mt-4 text-sm text-white/70 animate-fade-in h-5">{message}</p>
        </div>
      </div>
    );
  }

  if (!fullScreen) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-14" role="status" aria-live="polite">
        <Spinner className="w-9 h-9" />
        <p key={message} className="text-sm text-gray-500 animate-fade-in">{message}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh] animate-fade-in" role="status" aria-live="polite">
      <div className="text-center">
        <LoaderMark />
        <h2 className="mt-5">
          <Wordmark className="text-2xl" />
        </h2>
        <p className="text-gray-500 text-sm mt-0.5 mb-5">Track Smart. Profit Wise.</p>
        <ProgressBar />
        <p key={message} className="mt-4 text-sm text-gray-500 animate-fade-in h-5">{message}</p>
      </div>
    </div>
  );
};

export default LoadingScreen;
