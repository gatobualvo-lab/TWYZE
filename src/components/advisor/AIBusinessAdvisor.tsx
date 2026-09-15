import React, { useEffect, useState } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, Info, ChevronRight, Lock } from 'lucide-react';
import { useHealthScore } from '../../services/metrics/useHealthScore';
import { useOpportunities } from '../../services/opportunities/useOpportunities';
import { buildAdvisorBriefing } from '../../services/advisor/advisorEngine';
import type { AdvisorTone } from '../../services/advisor/advisorEngine';
import { PageHeader, SkeletonList, EmptyState, Button } from '../ui';
import { useFeatureFlag } from '../../services/featureFlags/useFeatureFlag';
import { fetchMySubscription } from '../../services/payments/paymentService';
import AIChatPanel from './AIChatPanel';

const TONE_META: Record<AdvisorTone, { icon: React.ComponentType<{ className?: string }>; border: string; iconColor: string }> = {
  positive: { icon: CheckCircle2, border: 'border-l-green-500', iconColor: 'text-green-600' },
  warning: { icon: AlertTriangle, border: 'border-l-amber-500', iconColor: 'text-amber-600' },
  neutral: { icon: Info, border: 'border-l-blue-400', iconColor: 'text-blue-500' },
};

const AIBusinessAdvisor: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { result: healthScore, loading: healthLoading } = useHealthScore();
  const { opportunities, loading: opportunitiesLoading } = useOpportunities();
  const { enabled: assistantFlagEnabled, loading: flagLoading } = useFeatureFlag('ai_business_assistant');
  const [subscriptionActive, setSubscriptionActive] = useState<boolean | null>(null);

  useEffect(() => {
    fetchMySubscription()
      .then(sub => setSubscriptionActive(sub.status === 'active'))
      .catch(() => setSubscriptionActive(false));
  }, []);

  const loading = healthLoading || opportunitiesLoading;
  if (loading || !healthScore) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-2">
          <div className="h-6 w-48 skeleton-shimmer rounded-md" />
          <div className="h-4 w-full max-w-lg skeleton-shimmer rounded-md" />
        </div>
        <SkeletonList rows={4} />
      </div>
    );
  }

  const insights = buildAdvisorBriefing({ healthScore, topOpportunities: opportunities });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sparkles}
        iconColor="text-purple-500"
        title="Business Advisor"
        description="A plain-language read on this month, built from your Health Score and Opportunity Center — plus a real conversation with your own business data below."
      />

      <div className="space-y-3">
        {insights.map((insight, index) => {
          const meta = TONE_META[insight.tone];
          const Icon = meta.icon;
          return (
            <div
              key={insight.id}
              className={`bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 p-5 transition-all duration-200 hover:shadow-md animate-slide-up ${meta.border}`}
              style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'backwards' }}
            >
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${meta.iconColor}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{insight.headline}</p>
                  <p className="text-sm text-gray-600 mt-1">{insight.body}</p>
                  {insight.actionTab && onNavigate && (
                    <button
                      onClick={() => onNavigate(insight.actionTab!)}
                      className="group flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 mt-2"
                    >
                      Go there <ChevronRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                    </button>
                  )}
                </div>
                {index === 0 && (
                  <span className="text-xs text-gray-300 flex-shrink-0">This month</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {subscriptionActive === null || flagLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="h-6 w-40 skeleton-shimmer rounded-md mb-3" />
          <div className="h-32 w-full skeleton-shimmer rounded-md" />
        </div>
      ) : subscriptionActive && assistantFlagEnabled ? (
        <AIChatPanel onNavigate={onNavigate} />
      ) : (
        <EmptyState
          icon={Lock}
          title={subscriptionActive ? 'AI Business Assistant is coming soon' : 'Unlock the AI Business Assistant'}
          description={
            subscriptionActive
              ? "This account is on a paid plan — the assistant just isn't switched on for your account yet."
              : 'Ask questions about your real business data in plain language. Upgrade to a paid plan to unlock it.'
          }
          action={
            !subscriptionActive && onNavigate ? (
              <Button size="sm" onClick={() => onNavigate('payment-management')}>Upgrade plan</Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
};

export default AIBusinessAdvisor;
