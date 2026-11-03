// When a newer version of the app has been downloaded in the background, when is it safe to switch to it?
// Switching reloads the page, so it must never happen while someone is part-way through recording a sale.
//
//   - Before the person has touched anything since opening the app: switch straight away (it looks like
//     the app simply took a moment to start).
//   - Once they have started using it: wait, and offer an "Update now" button instead.
//   - When the app goes to the background (they switch to another app or lock the phone): switch then.

export type UpdateAction = 'apply-now' | 'offer' | 'wait';

export interface UpdateSituation {
  /** A newer version is downloaded and ready. */
  updateReady: boolean;
  /** The person has tapped or typed since the app opened. */
  interacted: boolean;
  /** The app is in the background (hidden tab, locked phone, another app in front). */
  hidden: boolean;
}

export function decideUpdateAction({ updateReady, interacted, hidden }: UpdateSituation): UpdateAction {
  if (!updateReady) return 'wait';
  if (hidden || !interacted) return 'apply-now';
  return 'offer';
}

/** How often an open app asks whether a newer version exists. */
export const UPDATE_CHECK_EVERY_MS = 20 * 60 * 1000;
