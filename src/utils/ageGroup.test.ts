import { describe, it, expect } from 'vitest';
import { AGE_GROUPS, isAllowedAgeGroup } from './ageGroup';

describe('isAllowedAgeGroup', () => {
  it('lets every adult age group sign up', () => {
    for (const group of AGE_GROUPS.filter(g => g.value !== 'under_18')) expect(isAllowedAgeGroup(group.value)).toBe(true);
  });

  it('does not let under 18 sign up', () => {
    expect(isAllowedAgeGroup('under_18')).toBe(false);
  });

  it('does not accept nothing chosen or an unknown value', () => {
    expect(isAllowedAgeGroup('')).toBe(false);
    expect(isAllowedAgeGroup('teen')).toBe(false);
  });

  it('offers under 18 so a child is told why, rather than being stopped without a reason', () => {
    expect(AGE_GROUPS[0].value).toBe('under_18');
  });
});
