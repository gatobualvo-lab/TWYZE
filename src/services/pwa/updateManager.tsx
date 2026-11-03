import { registerSW } from 'virtual:pwa-register';
import toast from 'react-hot-toast';
import { UPDATE_CHECK_EVERY_MS, decideUpdateAction } from './updatePolicy';

// Keeps the installed app (and the Android/Windows packages, which load the same site) on the newest
// version. Without this, an installed app keeps showing the copy it saved earlier until it has been
// closed and reopened twice, so a fix that is already live can look like it is still broken.
// See updatePolicy.ts for when it is safe to switch.

let started = false;

export function startUpdateManager(): void {
  if (started || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  // The desktop app loads its files from disk and has no service worker.
  if (!window.location.protocol.startsWith('http')) return;
  started = true;

  let updateReady = false;
  let interacted = false;
  let offered = false;
  let registration: ServiceWorkerRegistration | undefined;

  const markInteracted = () => { interacted = true; };
  window.addEventListener('pointerdown', markInteracted, { capture: true, once: true });
  window.addEventListener('keydown', markInteracted, { capture: true, once: true });

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady = true;
      evaluate();
    },
    onRegisteredSW(_url, reg) {
      registration = reg;
    },
  });

  function evaluate() {
    const action = decideUpdateAction({ updateReady, interacted, hidden: document.visibilityState === 'hidden' });
    if (action === 'apply-now') {
      void updateSW(true);
    } else if (action === 'offer' && !offered) {
      offered = true;
      toast.custom(
        (t) => (
          <div
            role="status"
            className={`flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-lg border border-gray-200 ${t.visible ? 'animate-fade-in' : 'opacity-0'}`}
          >
            <span className="text-sm text-gray-800">A new version of TrackWyze is ready.</span>
            <button
              type="button"
              onClick={() => { toast.dismiss(t.id); void updateSW(true); }}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Update now
            </button>
          </div>
        ),
        { id: 'app-update', duration: Infinity }
      );
    }
  }

  const checkForUpdate = () => {
    registration?.update().catch(() => { /* offline: try again later */ });
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
    evaluate(); // going to the background is the safe moment to switch
  });
  window.setInterval(checkForUpdate, UPDATE_CHECK_EVERY_MS);
}
