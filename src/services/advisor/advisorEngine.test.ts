import { describe, it, expect } from 'vitest';
import { buildAdvisorBriefing } from './advisorEngine';
import type { HealthScoreResult } from '../metrics/healthScore';
import type { Opportunity } from '../opportunities/opportunityEngine';

function healthResult(overrides: Partial<HealthScoreResult> = {}): HealthScoreResult {
  return {
    score: 75, band: 'good', bandLabel: 'Good', factors: [], factorsIncluded: 4, factorsPossible: 5,
    insufficientDataReason: null,
    ...overrides,
  };
}

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opp-1', category: 'collections', priority: 'high', title: 'Test opportunity',
    detected: 'Something was detected.', whyItMatters: 'It matters.', estimatedImpact: null,
    evidence: [], recommendedAction: 'Do the thing.', actionTab: 'dashboard',
    ...overrides,
  };
}

describe('buildAdvisorBriefing', () => {
  it('never fabricates a score narrative when there is no score', () => {
    const result = buildAdvisorBriefing({
      healthScore: healthResult({ score: null, band: null, insufficientDataReason: 'Not enough data.' }),
      topOpportunities: [],
    });
    expect(result[0].tone).toBe('neutral');
    expect(result[0].body).toContain('Not enough data');
  });

  it('opens positively for a high health score', () => {
    const result = buildAdvisorBriefing({ healthScore: healthResult({ score: 90 }), topOpportunities: [] });
    expect(result[0].tone).toBe('positive');
  });

  it('opens with a warning tone for a low health score', () => {
    const result = buildAdvisorBriefing({ healthScore: healthResult({ score: 15, band: 'critical' }), topOpportunities: [] });
    expect(result[0].tone).toBe('warning');
  });

  it('surfaces the weakest factor only when it is genuinely weak', () => {
    const withWeakFactor = buildAdvisorBriefing({
      healthScore: healthResult({
        factors: [
          { key: 'profitability', label: 'Profitability', score: 90, weight: 0.5, explanation: 'Great margin.' },
          { key: 'collections', label: 'Collections', score: 20, weight: 0.5, explanation: 'Lots owed.' },
        ],
      }),
      topOpportunities: [],
    });
    expect(withWeakFactor.some(i => i.id === 'weakest-factor')).toBe(true);

    const allHealthy = buildAdvisorBriefing({
      healthScore: healthResult({
        factors: [
          { key: 'profitability', label: 'Profitability', score: 90, weight: 0.5, explanation: 'Great margin.' },
          { key: 'collections', label: 'Collections', score: 70, weight: 0.5, explanation: 'Fine.' },
        ],
      }),
      topOpportunities: [],
    });
    expect(allHealthy.some(i => i.id === 'weakest-factor')).toBe(false);
  });

  it('narrates the top opportunities in the same order Opportunity Center ranked them, without re-sorting', () => {
    const opportunities = [
      opportunity({ id: 'first', title: 'First' }),
      opportunity({ id: 'second', title: 'Second' }),
      opportunity({ id: 'third', title: 'Third' }),
      opportunity({ id: 'fourth', title: 'Fourth (should be dropped, only top 3)' }),
    ];
    const result = buildAdvisorBriefing({ healthScore: healthResult(), topOpportunities: opportunities });
    const opportunityInsights = result.filter(i => i.id.startsWith('opportunity-'));
    expect(opportunityInsights).toHaveLength(3);
    expect(opportunityInsights[0].id).toBe('opportunity-first');
    expect(opportunityInsights[0].headline).toContain('First');
  });

  it('gives a genuine "nothing to flag" close only when things are actually fine', () => {
    const result = buildAdvisorBriefing({ healthScore: healthResult({ score: 80 }), topOpportunities: [] });
    expect(result.some(i => i.id === 'closing')).toBe(true);

    const resultWithProblems = buildAdvisorBriefing({ healthScore: healthResult({ score: 30 }), topOpportunities: [] });
    expect(resultWithProblems.some(i => i.id === 'closing')).toBe(false);
  });
});
