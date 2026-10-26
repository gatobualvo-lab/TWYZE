import React from 'react';
import Spinner from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type Size = 'sm' | 'md';

const VARIANT_CLASSES: Record<Variant, string> = {
  // Lit teal with a thin top highlight; glows and sweeps a sheen on hover.
  primary:
    'sheen-host bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-md shadow-inset hover:shadow-glow hover:from-blue-500 hover:to-blue-600 active:from-blue-700 active:to-blue-700 disabled:from-blue-300 disabled:to-blue-300 disabled:shadow-none',
  // Saffron: for the single most important action on a screen.
  accent:
    'sheen-host bg-gradient-to-b from-accent-300 to-accent-500 text-gray-900 shadow-md shadow-inset hover:shadow-glow-accent active:from-accent-500 active:to-accent-500 disabled:from-accent-200 disabled:to-accent-200 disabled:text-gray-600 disabled:shadow-none',
  secondary:
    'bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 active:bg-gray-100 disabled:text-gray-300',
  ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200 disabled:text-gray-300',
  danger:
    'sheen-host bg-gradient-to-b from-red-500 to-red-700 text-white shadow-md shadow-inset hover:from-red-500 hover:to-red-600 active:from-red-700 active:to-red-700 disabled:from-red-300 disabled:to-red-300 disabled:shadow-none',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 min-h-[32px]',
  md: 'px-4 py-2 text-sm gap-2 min-h-[40px]',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

/** Opt-in button with consistent press/hover feedback and a built-in loading spinner. Existing hand-styled buttons keep working unchanged — this is for new and newly-redesigned surfaces. */
const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'md', loading = false, icon: Icon, disabled, className = '', children, ...rest }) => (
  <button
    disabled={disabled || loading}
    className={`inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 ease-smooth active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    {...rest}
  >
    {loading ? <Spinner className="w-4 h-4" tone={variant === 'secondary' || variant === 'ghost' ? 'brand' : 'light'} /> : Icon && <Icon className="w-4 h-4" />}
    {children}
  </button>
);

export default Button;
