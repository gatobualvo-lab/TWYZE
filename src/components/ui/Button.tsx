import React from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-300 shadow-sm hover:shadow',
  secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 disabled:text-gray-300',
  ghost: 'text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:text-gray-300',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:bg-red-300 shadow-sm hover:shadow',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-sm gap-2',
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
    className={`inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    {...rest}
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : Icon && <Icon className="w-4 h-4" />}
    {children}
  </button>
);

export default Button;
