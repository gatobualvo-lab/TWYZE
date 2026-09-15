import React, { useMemo, useState } from 'react';
import { Lightbulb, DollarSign, Users, TrendingUp, Package, Receipt, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useOpportunities } from '../../services/opportunities/useOpportunities';
import { formatCurrency } from '../../utils/format';
import type { Opportunity, OpportunityCategory } from '../../services/opportunities/opportunityEngine';
import { PageHeader, EmptyState, SkeletonList } from '../ui';

const CATEGORY_META: Record<OpportunityCategory, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  revenue: { icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
  collections: { icon: DollarSign, color: 'text-green-600 bg-green-50' },
  profit: { icon: TrendingUp, color: 'text-purple-600 bg-purple-50' },
  inventory: { icon: Package, color: 'text-orange-600 bg-orange-50' },
  expenses: { icon: Receipt, color: 'text-red-600 bg-red-50' },
  retention: { icon: Users, color: 'text-pink-600 bg-pink-50' },
};

const PRIORITY_STYLES = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-500',
  low: 'border-l-gray-300',
};

const OpportunityCard: React.FC<{ opportunity: Opportunity; onNavigate: (tab: string) => void }> = ({ opportunity, onNavigate }) => {
  const meta = CATEGORY_META[opportunity.category];
  const Icon = meta.icon;
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 animate-slide-up ${PRIORITY_STYLES[opportunity.priority]}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg flex-shrink-0 ${meta.color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{opportunity.title}</p>
          <p className="text-sm text-gray-600 mt-1">{opportunity.detected}</p>
          <p className="text-xs text-gray-400 mt-1.5">{opportunity.whyItMatters}</p>

          {opportunity.evidence.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {opportunity.evidence.map((e, i) => (
                <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                  <span className="text-gray-300">·</span> {e}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100">
            <div>
              {opportunity.estimatedImpact && (
                <p className="text-sm font-bold text-gray-900 tabular-nums">
                  {formatCurrency(opportunity.estimatedImpact.amount)}
                  <span className="text-xs font-normal text-gray-400 ml-1">{opportunity.estimatedImpact.label}</span>
                </p>
              )}
              <p className="text-xs text-gray-500 mt-0.5">{opportunity.recommendedAction}</p>
            </div>
            <button
              onClick={() => onNavigate(opportunity.actionTab)}
              className="group flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 flex-shrink-0"
            >
              Take action <ChevronRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const OpportunityCenter: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { opportunities, loading } = useOpportunities();
  const [categoryFilter, setCategoryFilter] = useState<OpportunityCategory | 'all'>('all');

  const filtered = categoryFilter === 'all' ? opportunities : opportunities.filter(o => o.category === categoryFilter);

  const categoryCounts = useMemo(() => {
    const counts = {} as Record<OpportunityCategory, number>;
    for (const o of opportunities) counts[o.category] = (counts[o.category] ?? 0) + 1;
    return counts;
  }, [opportunities]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-2">
          <div className="h-6 w-48 skeleton-shimmer rounded-md" />
          <div className="h-4 w-96 skeleton-shimmer rounded-md" />
        </div>
        <SkeletonList rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Lightbulb}
        iconColor="text-amber-500"
        title="Opportunity Center"
        description="Things worth acting on, found in your actual sales, customers, inventory, and expenses — nothing here is guessed."
      />

      {opportunities.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          tone="positive"
          title="Nothing urgent found right now."
          description="Check back as more sales and activity come in."
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all duration-150 active:scale-95 ${
                categoryFilter === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              All ({opportunities.length})
            </button>
            {(Object.keys(categoryCounts) as OpportunityCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium capitalize transition-all duration-150 active:scale-95 ${
                  categoryFilter === cat ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {cat} ({categoryCounts[cat]})
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filtered.map(o => (
              <OpportunityCard key={o.id} opportunity={o} onNavigate={onNavigate ?? (() => {})} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default OpportunityCenter;
