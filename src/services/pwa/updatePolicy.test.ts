import { describe, it, expect } from 'vitest';
import { UPDATE_CHECK_EVERY_MS, decideUpdateAction } from './updatePolicy';

describe('decideUpdateAction', () => {
  it('does nothing until a newer version is ready', () => {
    for (const interacted of [true, false]) {
      for (const hidden of [true, false]) {
        expect(decideUpdateAction({ updateReady: false, interacted, hidden })).toBe('wait');
      }
    }
  });

  it('switches at once if the person has not touched anything yet', () => {
    expect(decideUpdateAction({ updateReady: true, interacted: false, hidden: false })).toBe('apply-now');
  });

  it('never reloads under someone who is using the app; it offers instead', () => {
    expect(decideUpdateAction({ updateReady: true, interacted: true, hidden: false })).toBe('offer');
  });

  it('switches when the app goes to the background, even after use', () => {
    expect(decideUpdateAction({ updateReady: true, interacted: true, hidden: true })).toBe('apply-now');
  });

  it('checks for a newer version every 20 minutes', () => {
    expect(UPDATE_CHECK_EVERY_MS).toBe(20 * 60 * 1000);
  });
});
