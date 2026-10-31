import { describe, it, expect } from 'vitest';
import { detectPhone, detectPlatform, isApplePlatform, shortcutModifierLabel } from './platform';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

describe('detectPlatform', () => {
  it('recognises the common devices', () => {
    expect(detectPlatform({ userAgent: IPHONE, platform: 'iPhone' })).toBe('ios');
    expect(detectPlatform({ userAgent: ANDROID, platform: 'Linux armv81' })).toBe('android');
    expect(detectPlatform({ userAgent: WINDOWS, platform: 'Win32' })).toBe('windows');
    expect(detectPlatform({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 })).toBe('mac');
  });

  it('treats an iPad that reports itself as a Mac as iOS', () => {
    expect(detectPlatform({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 5 })).toBe('ios');
  });

  it('does not mistake Android (a Linux kernel) for desktop Linux', () => {
    expect(detectPlatform({ userAgent: ANDROID, platform: 'Linux armv81' })).not.toBe('linux');
  });

  it('falls back to other when nothing matches', () => {
    expect(detectPlatform({ userAgent: 'curl/8', platform: '' })).toBe('other');
  });
});

describe('shortcut label', () => {
  it('uses the command key on Apple devices and Ctrl elsewhere', () => {
    expect(isApplePlatform('mac')).toBe(true);
    expect(isApplePlatform('ios')).toBe(true);
    expect(isApplePlatform('windows')).toBe(false);
    expect(shortcutModifierLabel('mac')).toBe('⌘');
    expect(shortcutModifierLabel('windows')).toBe('Ctrl');
    expect(shortcutModifierLabel('android')).toBe('Ctrl');
  });
});

describe('detectPhone', () => {
  const touch = { innerWidth: 980, matchMedia: () => ({ matches: true }) };
  const mouse = { innerWidth: 1280, matchMedia: () => ({ matches: false }) };

  it('a narrow window is a phone layout', () => {
    expect(detectPhone({ innerWidth: 390 }, { width: 1920, height: 1080 })).toBe(true);
  });

  it('a wide desktop window is not', () => {
    expect(detectPhone(mouse, { width: 1920, height: 1080 })).toBe(false);
  });

  it('a phone whose page was widened by overflowing content still counts as a phone', () => {
    expect(detectPhone(touch, { width: 393, height: 852 })).toBe(true);
    expect(detectPhone(touch, { width: 852, height: 393 })).toBe(true);
  });

  it('a tablet or touch laptop is not a phone', () => {
    expect(detectPhone({ innerWidth: 1024, matchMedia: () => ({ matches: true }) }, { width: 1024, height: 768 })).toBe(false);
    expect(detectPhone({ innerWidth: 1366, matchMedia: () => ({ matches: true }) }, { width: 1920, height: 1080 })).toBe(false);
  });

  it('copes with no matchMedia', () => {
    expect(detectPhone({ innerWidth: 1000 }, { width: 390, height: 800 })).toBe(false);
  });
});
