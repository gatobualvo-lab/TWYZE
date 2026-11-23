import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import type { ProjectSummary } from '../../services/projects/projectRollupService';
import type { ProjectContents } from '../../services/projects/projectContentsService';
import { listSponsors, type EventSponsor } from '../../services/events/eventSponsorService';

// Net P&L reuses the two numbers the rest of the app already trusts
// (event.salesTotal / event.invoicedTotal / event.spentTotal, all sourced
// from the single get_project_summary RPC) rather than re-summing sales/
// expenses here — that keeps this tab's totals identical to the Overview
// tab's. Sponsorship pledges are shown separately as a memo, since a pledge
// only becomes real revenue once it's invoiced (same rule EventSponsors.tsx
// already states) — counting it here too would double-count once invoiced.

const Row: React.FC<{ label: string; value: number; negative?: boolean; muted?: boolean }> = ({ label, value, negative, muted }) => (
  <div className="flex items-center justify-between text-sm">
    <span className={muted ? 'text-gray-400' : 'text-gray-600'}>{label}</span>
    <span className={`font-medium tabular-nums ${negative ? 'text-red-600' : muted ? 'text-gray-500' : 'text-gray-900'}`}>
      {negative ? '-' : ''}{formatCurrency(value)}
    </span>
  </div>
);

const TotalRow: React.FC<{ label: string; value: number; negative?: boolean }> = ({ label, value, negative }) => (
  <div className="flex items-center justify-between text-sm pt-2 mt-1 border-t border-gray-100 font-semibold">
    <span>{label}</span>
    <span className={`tabular-nums ${negative ? 'text-red-600' : 'text-gray-900'}`}>
      {negative ? '-' : ''}{formatCurrency(value)}
    </span>
  </div>
);

const EventPnL: React.FC<{ event: ProjectSummary; contents: ProjectContents | null }> = ({ event, contents }) => {
  const [sponsors, setSponsors] = useState<EventSponsor[] | null>(null);

  useEffect(() => {
    listSponsors(event.id).then(setSponsors).catch(() => setSponsors([]));
  }, [event.id]);

  const revenue = event.salesTotal + event.invoicedTotal;
  const totalExpenses = event.spentTotal;
  const net = revenue - totalExpenses;
  const margin = revenue > 0 ? (net / revenue) * 100 : null;

  const expensesByKind = (contents?.expenses ?? []).reduce<Record<string, number>>((acc, e) => {
    acc[e.kind] = (acc[e.kind] ?? 0) + e.amount;
    return acc;
  }, {});

  const sponsorTotal = (sponsors ?? []).reduce((sum, s) => sum + (s.amount ?? 0), 0);
  const sponsorInvoiced = (sponsors ?? []).filter(s => s.documentId).reduce((sum, s) => sum + (s.amount ?? 0), 0);
  const sponsorPending = sponsorTotal - sponsorInvoiced;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Revenue</p>
        <Row label="Ticket & product sales" value={event.salesTotal} />
        <Row label="Invoiced (sponsors, clients)" value={event.invoicedTotal} />
        <TotalRow label="Total revenue" value={revenue} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Expenses</p>
        {Object.keys(expensesByKind).length === 0 ? (
          <p className="text-sm text-gray-400">No expenses recorded yet.</p>
        ) : (
          Object.entries(expensesByKind).map(([kind, amt]) => (
            <Row key={kind} label={`${kind} expenses`} value={amt} negative />
          ))
        )}
        <TotalRow label="Total expenses" value={totalExpenses} negative />
      </div>

      <div className={`rounded-xl shadow-sm border p-4 ${net >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-semibold text-gray-700">
            {net >= 0 ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
            Net {net >= 0 ? 'profit' : 'loss'}
          </span>
          <span className={`text-lg font-bold tabular-nums ${net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {net < 0 ? '-' : ''}{formatCurrency(Math.abs(net))}
          </span>
        </div>
        {margin !== null && (
          <p className="text-xs text-gray-400 mt-1">{margin.toFixed(1)}% margin on {formatCurrency(revenue)} revenue</p>
        )}
      </div>

      {event.budget != null && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Budget</p>
          <Row label="Budget" value={event.budget} muted />
          <Row label="Remaining after expenses" value={event.remainingBudget ?? 0} negative={(event.remainingBudget ?? 0) < 0} />
        </div>
      )}

      {sponsors !== null && sponsors.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
            Sponsorships (not counted above until invoiced)
          </p>
          <Row label="Pledged" value={sponsorTotal} muted />
          <Row label="Already invoiced" value={sponsorInvoiced} muted />
          {sponsorPending > 0 && (
            <p className="text-xs text-amber-600 pt-1">
              {formatCurrency(sponsorPending)} pledged but not yet invoiced — invoice a sponsor from the Sponsors tab so it counts in Revenue.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default EventPnL;
