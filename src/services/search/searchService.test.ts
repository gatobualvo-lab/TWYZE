import { describe, it, expect, beforeEach } from 'vitest';
import { getRecentSearches, saveRecentSearch } from './searchService';
import type { SearchResult } from './searchService';

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return { type: 'customer', id: 'c1', title: 'Jane Doe', subtitle: '0712345678', actionTab: 'customer-timeline', ...overrides };
}

describe('recent searches', () => {
  beforeEach(() => localStorage.clear());

  it('returns an empty list when nothing has been saved', () => {
    expect(getRecentSearches()).toEqual([]);
  });

  it('saves a search and reads it back most-recent-first', () => {
    saveRecentSearch(result({ id: 'c1', title: 'Jane Doe' }));
    saveRecentSearch(result({ id: 'c2', title: 'John Smith' }));
    const recent = getRecentSearches();
    expect(recent[0].title).toBe('John Smith');
    expect(recent[1].title).toBe('Jane Doe');
  });

  it('moves a re-selected result to the front instead of duplicating it', () => {
    saveRecentSearch(result({ id: 'c1', title: 'Jane Doe' }));
    saveRecentSearch(result({ id: 'c2', title: 'John Smith' }));
    saveRecentSearch(result({ id: 'c1', title: 'Jane Doe' }));
    const recent = getRecentSearches();
    expect(recent).toHaveLength(2);
    expect(recent[0].id).toBe('c1');
  });

  it('caps the list at 5 entries', () => {
    for (let i = 0; i < 8; i++) saveRecentSearch(result({ id: `c${i}`, title: `Customer ${i}` }));
    expect(getRecentSearches()).toHaveLength(5);
  });

  it('never throws even if localStorage contains malformed JSON', () => {
    localStorage.setItem('trackwyze_recent_searches', '{not valid json');
    expect(() => getRecentSearches()).not.toThrow();
    expect(getRecentSearches()).toEqual([]);
  });
});
