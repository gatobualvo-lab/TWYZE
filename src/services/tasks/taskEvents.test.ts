import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notifyTasksChanged, onCalendarDateRequested, onTasksChanged, requestCalendarDate, takeRequestedCalendarDate } from './taskEvents';

beforeEach(() => sessionStorage.clear());

describe('task change notices', () => {
  it('tells every listener, and stops after unsubscribing', () => {
    const a = vi.fn();
    const b = vi.fn();
    const stopA = onTasksChanged(a);
    const stopB = onTasksChanged(b);
    notifyTasksChanged();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    stopA();
    notifyTasksChanged();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
    stopB();
  });

  it('says who changed it, so they can skip reloading for their own change', () => {
    const me = {};
    const seen: unknown[] = [];
    const stop = onTasksChanged(origin => seen.push(origin));
    notifyTasksChanged(me);
    notifyTasksChanged();
    expect(seen[0]).toBe(me);
    expect(seen[1]).toBeUndefined();
    stop();
  });
});

describe('opening the calendar on a day', () => {
  it('moves a calendar that is already open', () => {
    const shown = vi.fn();
    const stop = onCalendarDateRequested(shown);
    requestCalendarDate('2026-11-12');
    expect(shown).toHaveBeenCalledWith('2026-11-12');
    // it was delivered, so nothing is left waiting for a calendar opened later
    expect(takeRequestedCalendarDate()).toBeNull();
    stop();
  });

  it('is kept for a calendar opened afterwards, once', () => {
    requestCalendarDate('2026-12-01');
    expect(takeRequestedCalendarDate()).toBe('2026-12-01');
    expect(takeRequestedCalendarDate()).toBeNull();
  });

  it('ignores anything that is not a date', () => {
    const shown = vi.fn();
    const stop = onCalendarDateRequested(shown);
    requestCalendarDate('tomorrow');
    expect(shown).not.toHaveBeenCalled();
    sessionStorage.setItem('trackwyze_calendar_date', '<script>');
    expect(takeRequestedCalendarDate()).toBeNull();
    stop();
  });
});
