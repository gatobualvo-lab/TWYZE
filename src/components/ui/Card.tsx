import React from 'react';

type Padding = 'none' | 'sm' | 'md' | 'lg';

const PADDING_CLASSES: Record<Padding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Lifts on hover with a slightly deeper shadow — use for cards that are themselves clickable/navigable. */
  hoverable?: boolean;
  padding?: Padding;
}

/** The one card shell every panel in the app is built from — consistent radius, border, shadow, and (optionally) a subtle hover lift, instead of every page hand-writing the same className string. */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, padding = 'md', className = '', children, ...rest }, ref) => (
    <div
      ref={ref}
      className={`bg-white rounded-xl shadow-sm border border-gray-100 transition-all duration-200 ${
        hoverable ? 'hover:shadow-md hover:border-gray-200 hover:-translate-y-0.5 cursor-pointer' : ''
      } ${PADDING_CLASSES[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
);
Card.displayName = 'Card';

export default Card;
