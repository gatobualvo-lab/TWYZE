import { describe, it, expect } from 'vitest';
import { parseAssistantResponse } from './responseSchema';

const VALID_RESPONSE = {
  answer: 'Your profit is up 12% this month.',
  facts: ['Revenue: KES 100,000', 'Net profit: KES 15,000'],
  calculatedInsights: ['Net margin: 15%'],
  predictions: [],
  recommendations: ['Consider restocking your best-selling item.'],
  confidenceNote: null,
  followUpQuestions: ['What are my most profitable products?'],
  actionTab: 'profit-analytics',
};

describe('parseAssistantResponse', () => {
  it('accepts a fully valid response', () => {
    const parsed = parseAssistantResponse(VALID_RESPONSE);
    expect(parsed).toEqual(VALID_RESPONSE);
  });

  it('accepts null for confidenceNote and actionTab', () => {
    const parsed = parseAssistantResponse({ ...VALID_RESPONSE, confidenceNote: null, actionTab: null });
    expect(parsed).not.toBeNull();
    expect(parsed?.confidenceNote).toBeNull();
    expect(parsed?.actionTab).toBeNull();
  });

  it('accepts a string confidenceNote', () => {
    const parsed = parseAssistantResponse({ ...VALID_RESPONSE, confidenceNote: 'Not enough sales history to answer reliably.' });
    expect(parsed?.confidenceNote).toBe('Not enough sales history to answer reliably.');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'not an object'],
    ['a number', 42],
    ['an array', []],
  ])('rejects %s as the top-level payload', (_label, value) => {
    expect(parseAssistantResponse(value)).toBeNull();
  });

  it('rejects a response missing a required field', () => {
    const { answer: _answer, ...withoutAnswer } = VALID_RESPONSE;
    expect(parseAssistantResponse(withoutAnswer)).toBeNull();
  });

  it('rejects a response where a string-array field is actually a single string', () => {
    expect(parseAssistantResponse({ ...VALID_RESPONSE, facts: 'Revenue: KES 100,000' })).toBeNull();
  });

  it('rejects a response where a string-array field contains a non-string item', () => {
    expect(parseAssistantResponse({ ...VALID_RESPONSE, facts: ['ok', 42] })).toBeNull();
  });

  it('rejects a response where confidenceNote is a number instead of string/null', () => {
    expect(parseAssistantResponse({ ...VALID_RESPONSE, confidenceNote: 42 })).toBeNull();
  });

  it('rejects a response where answer is missing or not a string', () => {
    expect(parseAssistantResponse({ ...VALID_RESPONSE, answer: null })).toBeNull();
    expect(parseAssistantResponse({ ...VALID_RESPONSE, answer: 123 })).toBeNull();
  });

  it('never throws, even on deeply malformed input', () => {
    expect(() => parseAssistantResponse(undefined)).not.toThrow();
    expect(() => parseAssistantResponse('garbage')).not.toThrow();
    expect(() => parseAssistantResponse({ nested: { garbage: true } })).not.toThrow();
  });
});
