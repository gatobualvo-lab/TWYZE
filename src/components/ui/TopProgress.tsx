import React, { useEffect, useRef, useState } from 'react';

interface TopProgressProps {
  /** Changes whenever the user moves to another page; each change plays the bar once. */
  routeKey: string;
}

/** A thin teal-to-saffron bar across the top of the screen that sweeps once on every page change, like GitHub or YouTube. Purely visual feedback that the tap registered. */
const TopProgress: React.FC<TopProgressProps> = ({ routeKey }) => {
  const [run, setRun] = useState(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setRun(n => n + 1);
  }, [routeKey]);

  if (run === 0) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed top-0 left-0 right-0 z-[70] h-[3px]">
      <div key={run} className="h-full origin-left bg-gradient-to-r from-blue-500 via-blue-300 to-accent-400 shadow-glow animate-[progress-run_0.9s_cubic-bezier(0.22,1,0.36,1)_forwards]" />
    </div>
  );
};

export default TopProgress;
