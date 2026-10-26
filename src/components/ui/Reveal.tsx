import React, { useEffect, useRef, useState } from 'react';

interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Extra wait before this block animates in, so neighbours can cascade. */
  delay?: number;
}

/**
 * Fades, lifts and un-blurs its content the first time it scrolls into view.
 * Content is fully visible without JavaScript/IntersectionObserver support and
 * for anyone who prefers reduced motion (see .reveal in index.css).
 */
const Reveal: React.FC<RevealProps> = ({ delay = 0, className = '', style, children, ...rest }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ ...style, ['--reveal-delay' as string]: `${delay}ms` }}
      {...rest}
    >
      {children}
    </div>
  );
};

export default Reveal;
