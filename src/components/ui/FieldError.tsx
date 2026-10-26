import React from 'react';
import { AlertCircle } from 'lucide-react';

interface FieldErrorProps {
  /** Must match what useFormErrors().field(name) points at: `field-${name}-error`. */
  name: string;
  message?: string;
  className?: string;
}

/**
 * The inline error shown under a form field. It carries an icon and words (not just red),
 * is announced by screen readers when it appears, and is linked to its input by id.
 */
const FieldError: React.FC<FieldErrorProps> = ({ name, message, className = '' }) =>
  message ? (
    <p id={`field-${name}-error`} role="alert" className={`mt-1 flex items-start gap-1 text-sm text-red-600 animate-slide-up ${className}`}>
      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  ) : null;

export default FieldError;
