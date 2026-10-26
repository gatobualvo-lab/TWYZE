import React from 'react';

type Padding = 'none' | 'sm' | 'md' | 'lg';

const PADDING_CLASSES: Record<Padding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Lifts on hover with a soft pointer-following glow — use for cards that are themselves clickable/navigable. */
  hoverable?: boolean;
  padding?: Padding;
}

/** The one card shell every panel in the app is built from — consistent radius, border, tinted shadow, and (optionally) a hover lift with a spotlight that follows the pointer. */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, padding = 'md', className = '', children, onMouseMove, ...rest }, ref) => (
    <div
      ref={ref}
      onMouseMove={
        hoverable
          ? e => {
              const rect = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
              e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
              onMouseMove?.(e);
            }
          : onMouseMove
      }
      className={`bg-white rounded-2xl shadow-sm border border-gray-200/70 transition-all duration-300 ease-smooth ${
        hoverable ? 'spotlight hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 cursor-pointer active:translate-y-0 active:scale-[0.995]' : ''
      } ${PADDING_CLASSES[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
);
Card.displayName = 'Card';

export default Card;
