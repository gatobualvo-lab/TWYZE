import { useCallback, useRef, useState } from 'react';

type Errors<K extends string> = Partial<Record<K, string>>;

/**
 * Field-level validation feedback that works for keyboard and screen-reader users:
 *
 *   const { errors, fail, field, formRef } = useFormErrors<'name' | 'amount'>();
 *   <form ref={formRef} noValidate>
 *     <input {...field('name')} />
 *     <FieldError name="name" message={errors.name} />
 *
 * `fail({ name: 'Enter a name' })` shows the messages and moves focus to the first
 * invalid field. The error clears as soon as the user edits that field.
 *
 * For a custom component that isn't a plain input (a dropdown, a picker), wrap it in
 * `<div {...group('name')}>` so the error still gets a focus target.
 */
export function useFormErrors<K extends string>() {
  const [errors, setErrors] = useState<Errors<K>>({});
  // A <form>, or any container (for fields inside a modal that is not a <form>).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formRef = useRef<any>(null);

  const clear = useCallback((name: K) => {
    setErrors(prev => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setErrors({}), []);

  /** Show these errors and take the user to the first one. Returns false so callers can `return fail(...)`. */
  const fail = useCallback((next: Errors<K>): false => {
    setErrors(next);
    window.setTimeout(() => {
      const root: ParentNode = formRef.current ?? document;
      const target = root.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]');
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target?.focus({ preventScroll: true });
    }, 60);
    return false;
  }, []);

  const field = useCallback(
    (name: K) => ({
      id: `field-${name}`,
      'aria-invalid': errors[name] ? (true as const) : undefined,
      'aria-describedby': errors[name] ? `field-${name}-error` : undefined,
      onInput: () => clear(name),
    }),
    [errors, clear]
  );

  /** Props for a wrapper <div> around a custom (non-input) control. */
  const group = useCallback(
    (name: K) => ({
      id: `field-${name}`,
      tabIndex: -1,
      'data-invalid': errors[name] ? (true as const) : undefined,
      'aria-describedby': errors[name] ? `field-${name}-error` : undefined,
      onInput: () => clear(name),
      onClick: () => clear(name),
    }),
    [errors, clear]
  );

  return { errors, fail, field, group, clear, clearAll, formRef, hasErrors: Object.keys(errors).length > 0 };
}
