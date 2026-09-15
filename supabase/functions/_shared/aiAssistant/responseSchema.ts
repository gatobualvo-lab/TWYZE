// Deno copy of src/services/aiAssistant/responseSchema.ts.
// SOURCE OF TRUTH: src/services/aiAssistant/responseSchema.ts — keep in sync manually.

export interface AssistantStructuredResponse {
  answer: string;
  facts: string[];
  calculatedInsights: string[];
  predictions: string[];
  recommendations: string[];
  confidenceNote: string | null;
  followUpQuestions: string[];
  actionTab: string | null;
}

export const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string', description: 'The main answer, in plain language.' },
    facts: { type: 'array', items: { type: 'string' }, description: 'Statements taken directly from the provided business data, no interpretation.' },
    calculatedInsights: { type: 'array', items: { type: 'string' }, description: 'Things derived by combining or comparing facts.' },
    predictions: { type: 'array', items: { type: 'string' }, description: 'Forward-looking estimates beyond what is directly known.' },
    recommendations: { type: 'array', items: { type: 'string' }, description: 'Suggested actions.' },
    confidenceNote: { type: ['string', 'null'], description: 'Explicit note when the data is insufficient to answer reliably; null otherwise.' },
    followUpQuestions: { type: 'array', items: { type: 'string' }, description: 'Up to 3 natural follow-up questions the owner might ask next.' },
    actionTab: { type: ['string', 'null'], description: 'A TrackWyze nav tab id most relevant to this answer, if any, for one-click navigation.' },
  },
  required: ['answer', 'facts', 'calculatedInsights', 'predictions', 'recommendations', 'confidenceNote', 'followUpQuestions', 'actionTab'],
  additionalProperties: false,
} as const;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function parseAssistantResponse(raw: unknown): AssistantStructuredResponse | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.answer !== 'string') return null;
  if (!isStringArray(r.facts)) return null;
  if (!isStringArray(r.calculatedInsights)) return null;
  if (!isStringArray(r.predictions)) return null;
  if (!isStringArray(r.recommendations)) return null;
  if (!isNullableString(r.confidenceNote)) return null;
  if (!isStringArray(r.followUpQuestions)) return null;
  if (!isNullableString(r.actionTab)) return null;

  return {
    answer: r.answer,
    facts: r.facts,
    calculatedInsights: r.calculatedInsights,
    predictions: r.predictions,
    recommendations: r.recommendations,
    confidenceNote: r.confidenceNote,
    followUpQuestions: r.followUpQuestions,
    actionTab: r.actionTab,
  };
}
