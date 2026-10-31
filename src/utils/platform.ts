// Which kind of device and shell Trackwyze is running in, so behaviour that genuinely
// differs (keyboard shortcut symbols, install steps, Bluetooth) can be chosen in one place.

export type PlatformName = 'ios' | 'android' | 'windows' | 'mac' | 'linux' | 'other';

interface NavigatorLike {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
}

export function detectPlatform(nav: NavigatorLike = typeof navigator !== 'undefined' ? navigator : {}): PlatformName {
  const ua = nav.userAgent ?? '';
  const platform = nav.platform ?? '';

  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  // iPadOS 13+ identifies itself as a Mac; a touch screen gives it away.
  if (/Mac/i.test(platform || ua) && (nav.maxTouchPoints ?? 0) > 1) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Win/i.test(platform || ua)) return 'windows';
  if (/Mac/i.test(platform || ua)) return 'mac';
  if (/Linux|X11/i.test(platform || ua)) return 'linux';
  return 'other';
}

export function isApplePlatform(platform: PlatformName = detectPlatform()): boolean {
  return platform === 'ios' || platform === 'mac';
}

/** The modifier key people on this device actually press: ⌘ on Apple devices, Ctrl elsewhere. */
export function shortcutModifierLabel(platform: PlatformName = detectPlatform()): string {
  return isApplePlatform(platform) ? '⌘' : 'Ctrl';
}

/** True inside the Trackwyze desktop (Electron) app rather than a browser. */
export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && (window as { trackwyze?: { isDesktop?: boolean } }).trackwyze?.isDesktop === true;
}

interface ViewportLike {
  innerWidth: number;
  matchMedia?: (query: string) => { matches: boolean };
}

interface ScreenLike {
  width: number;
  height: number;
}

/** Widths below this get the phone layout (drawer menu, bottom bar). Matches Tailwind's md. */
export const PHONE_MAX_WIDTH = 768;

/**
 * True on a phone (or small touch tablet) or in a narrow window.
 *
 * Judged by the device's real screen as well as the page width: when something on a page runs
 * wider than the screen, mobile browsers widen the page to fit it and report that wider number,
 * which used to flip a phone into the desktop layout (menu pushing the page sideways).
 */
export function detectPhone(
  win: ViewportLike = typeof window !== 'undefined' ? window : { innerWidth: 1280 },
  scr: ScreenLike = typeof screen !== 'undefined' ? screen : { width: 1920, height: 1080 }
): boolean {
  if (win.innerWidth < PHONE_MAX_WIDTH) return true;
  const touch = win.matchMedia?.('(pointer: coarse)').matches ?? false;
  return touch && Math.min(scr.width, scr.height) < PHONE_MAX_WIDTH;
}
