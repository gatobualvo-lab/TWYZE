import { describe, it, expect } from 'vitest';
import { describeLimitReached, describeRemaining, formatWait } from './aiLimits';

describe('describeRemaining', () => {
  it('says how many questions are left and for how long', () => {
    expect(describeRemaining({ remaining: 3, window: 'day' })).toBe('3 questions left today');
    expect(describeRemaining({ remaining: 1, window: 'month' })).toBe('1 question left this month');
    expect(describeRemaining({ remaining: 0, window: 'hour' })).toBe('0 questions left this hour');
  });
});

describe('formatWait', () => {
  it('uses minutes, hours and days in plain words', () => {
    expect(formatWait(20)).toBe('a minute');
    expect(formatWait(20 * 60)).toBe('about 20 minutes');
    expect(formatWait(3 * 3600)).toBe('about 3 hours');
    expect(formatWait(3600)).toBe('about 1 hour');
    expect(formatWait(5 * 86400)).toBe('about 5 days');
  });
});

describe('describeLimitReached', () => {
  it('tells someone on a smaller plan that upgrading gives more Guide questions', () => {
    const text = describeLimitReached('guide', 'free', 'day', 3 * 3600);
    expect(text).toContain("today's questions for the Guide");
    expect(text).toContain('about 3 hours');
    expect(text).toContain('Upgrading your plan');
  });

  it('does not push an upgrade on the Business plan or for the Advisor', () => {
    expect(describeLimitReached('guide', 'business', 'hour', 600)).not.toContain('Upgrading');
    expect(describeLimitReached('advisor', 'business', 'month', 86400 * 3)).toContain("this month's questions for the Business Advisor");
    expect(describeLimitReached('advisor', 'business', 'month', 86400 * 3)).not.toContain('Upgrading');
  });
});
