import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface ModalProps {
  children: ReactNode;
}

/**
 * Renders its children into `document.body` via a portal.
 *
 * `position: fixed` is relative to the nearest ancestor with a transform (even
 * an identity one left behind by a finished `animate-*` with fill-mode `both`),
 * not just the viewport. Dashboard.tsx wraps every tab's content in such an
 * animation, so any `fixed inset-0` modal rendered in the normal tree ends up
 * positioned against the scrollable page instead of the viewport. Routing the
 * modal through this portal sidesteps that regardless of what the page wrapper
 * does.
 */
export default function Modal({ children }: ModalProps) {
  return createPortal(children, document.body);
}
