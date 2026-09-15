import type { HealthScoreResult } from '../metrics/healthScore';
import type { Opportunity } from '../opportunities/opportunityEngine';

// AI Business Advisor: a deterministic narrator over data this app already
// computed (Health Score, Opportunity Center), not a call to an external
// LLM. That's a deliberate choice, not a shortcut — an external AI API
// would mean either exposing a key client-side (unsafe) or standing up a
// backend proxy (real new infrastructure this project doesn't have), plus
// sending real business financials to a third party for a feature that
// doesn't need it: everything worth saying here is already sitting in
// numbers this app computed itself. "Intelligent" here means synthesizing
// real findings into plain language, not generating text from a model.

export type AdvisorTone = 'positive' | 'warning' | 'neutral';

export interface AdvisorInsight {
  id: string;
  tone: AdvisorTone;
  headline: string;
  body: string;
  actionTab?: string;
}

export function buildAdvisorBriefing(input: {
  healthScore: HealthScoreResult;
  topOpportunities: Opportunity[]; // already sorted by priority/impact
}): AdvisorInsight[] {
  const insights: AdvisorInsight[] = [];
  const { healthScore, topOpportunities } = input;

  // 1. Opening read on overall condition.
  if (healthScore.score === null) {
    insights.push({
      id: 'opening',
      tone: 'neutral',
      headline: "Not enough data yet for a confident read",
      body: healthScore.insufficientDataReason ?? 'Record a few more sales and check back — I need some history to work with.',
    });
  } else if (healthScore.score >= 80) {
    insights.push({
      id: 'opening',
      tone: 'positive',
      headline: `Things are in good shape — ${healthScore.score}/100`,
      body: `Your business is healthy this period across most of what I check. Keep doing what's working.`,
    });
  } else if (healthScore.score >= 60) {
    insights.push({
      id: 'opening',
      tone: 'positive',
      headline: `Solid overall — ${healthScore.score}/100`,
      body: `Good fundamentals, with some room to tighten up. Here's where I'd focus.`,
    });
  } else if (healthScore.score >= 40) {
    insights.push({
      id: 'opening',
      tone: 'neutral',
      headline: `Steady, but a few things need attention — ${healthScore.score}/100`,
      body: `Nothing urgent, but a few numbers are worth watching closely this period.`,
    });
  } else {
    insights.push({
      id: 'opening',
      tone: 'warning',
      headline: `This period needs attention — ${healthScore.score}/100`,
      body: `A few core numbers are under pressure. I'd address these before they compound.`,
    });
  }

  // 2. Call out the single weakest scored factor, if there is one worth
  // naming (below 50 — otherwise everything's fine enough not to single out).
  if (healthScore.factors.length > 0) {
    const weakest = [...healthScore.factors].sort((a, b) => a.score - b.score)[0];
    if (weakest.score < 50) {
      insights.push({
        id: 'weakest-factor',
        tone: 'warning',
        headline: `Your biggest lever right now: ${weakest.label}`,
        body: weakest.explanation,
      });
    }
  }

  // 3. Narrate the top 3 opportunities as direct advice, in the same
  // priority order Opportunity Center already computed — no re-ranking,
  // no separate logic, just a different voice for the same findings.
  const top = topOpportunities.slice(0, 3);
  for (const [index, opp] of top.entries()) {
    insights.push({
      id: `opportunity-${opp.id}`,
      tone: opp.priority === 'high' ? 'warning' : 'neutral',
      headline: index === 0 ? `I'd start here: ${opp.title}` : opp.title,
      body: `${opp.detected} ${opp.recommendedAction}`,
      actionTab: opp.actionTab,
    });
  }

  // 4. Closing note if there's genuinely nothing else to flag.
  if (top.length === 0 && (healthScore.score === null || healthScore.score >= 60)) {
    insights.push({
      id: 'closing',
      tone: 'positive',
      headline: "Nothing else stands out right now",
      body: "I'll flag anything worth your attention as new sales, expenses, and inventory activity come in.",
    });
  }

  return insights;
}
