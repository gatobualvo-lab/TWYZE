import React, { useEffect, useMemo, useState } from 'react';
import { Target, Plus, X, CheckCircle2, AlertTriangle, Clock, TrendingUp, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMetricsContext } from '../../services/metrics/MetricsProvider';
import { calculateGoalProgress } from '../../services/goals/goalProgress';
import type { GoalRecord, GoalMetricType } from '../../services/goals/goalProgress';
import { listGoals, createGoal, updateGoalManualValue, setGoalStatus, deleteGoal } from '../../services/goals/goalService';
import { formatCurrency, formatDate } from '../../utils/format';
import { toNum } from '../../utils/number';
import { PageHeader, EmptyState, SkeletonPage } from '../ui';

const METRIC_LABELS: Record<GoalMetricType, string> = {
  revenue: 'Revenue', profit: 'Profit', sales_count: 'Number of Sales', expense_cap: 'Expense Budget', custom: 'Custom',
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatValue(metricType: GoalMetricType, value: number): string {
  return metricType === 'sales_count' ? Math.round(value).toString() : formatCurrency(value);
}

const GoalCard: React.FC<{ goal: GoalRecord; onChanged: () => void }> = ({ goal, onChanged }) => {
  const ctx = useMetricsContext();
  const range = useMemo(() => ({ start: goal.periodStart, end: goal.periodEnd < todayStr() ? goal.periodEnd : todayStr() }), [goal]);

  useEffect(() => {
    if (goal.metricType !== 'custom') ctx.loadMetrics(range).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end, goal.metricType]);

  const entry = goal.metricType === 'custom' ? null : ctx.getMetrics(range);
  const progress = calculateGoalProgress(goal, entry?.data ?? null);
  const [manualDraft, setManualDraft] = useState(String(goal.manualCurrentValue ?? 0));

  const handleManualSave = async () => {
    const value = toNum(manualDraft);
    try {
      await updateGoalManualValue(goal.id, value);
      onChanged();
    } catch {
      toast.error('Failed to update progress');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete goal "${goal.name}"?`)) return;
    try {
      await deleteGoal(goal.id);
      toast.success('Goal deleted');
      onChanged();
    } catch {
      toast.error('Failed to delete goal');
    }
  };

  useEffect(() => {
    if (progress.isAchieved && goal.status === 'active') setGoalStatus(goal.id, 'completed').then(onChanged).catch(() => {});
    else if (progress.isExpired && !progress.isAchieved && goal.status === 'active') setGoalStatus(goal.id, 'missed').then(onChanged).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.isAchieved, progress.isExpired]);

  const barColor = progress.isAchieved ? 'bg-green-500' : progress.isAtRisk ? 'bg-amber-500' : goal.status === 'missed' ? 'bg-red-500' : 'bg-blue-500';
  const StatusIcon = progress.isAchieved ? CheckCircle2 : progress.isAtRisk || goal.status === 'missed' ? AlertTriangle : Clock;
  const statusColor = progress.isAchieved ? 'text-green-600' : progress.isAtRisk || goal.status === 'missed' ? 'text-amber-600' : 'text-blue-600';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 animate-slide-up">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <p className="font-semibold text-gray-900">{goal.name}</p>
          <span className="text-xs text-gray-400">{METRIC_LABELS[goal.metricType]} · {formatDate(goal.periodStart)} – {formatDate(goal.periodEnd)}</span>
        </div>
        <button onClick={handleDelete} className="text-gray-300 hover:text-red-500 flex-shrink-0 transition-colors"><Trash2 className="w-4 h-4" /></button>
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium text-gray-900 tabular-nums">
            {formatValue(goal.metricType, progress.currentValue)}
            <span className="text-gray-400 font-normal"> / {formatValue(goal.metricType, progress.targetValue)}</span>
          </span>
          <span className="text-gray-500 tabular-nums">{Math.round(progress.progressPct)}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ease-smooth ${barColor}`} style={{ width: `${Math.min(100, progress.progressPct)}%` }} />
        </div>
      </div>

      <div className={`flex items-center gap-1.5 mt-2 text-xs ${statusColor}`}>
        <StatusIcon className="w-3.5 h-3.5" />
        {progress.paceExplanation}
      </div>

      {goal.metricType === 'custom' && goal.status === 'active' && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          <input
            type="number"
            value={manualDraft}
            onChange={e => setManualDraft(e.target.value)}
            className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-lg"
          />
          <button onClick={handleManualSave} className="text-xs font-medium text-blue-600 hover:text-blue-800">
            Update progress
          </button>
        </div>
      )}
    </div>
  );
};

const BusinessGoals: React.FC = () => {
  const [goals, setGoals] = useState<GoalRecord[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', metricType: 'revenue' as GoalMetricType, targetValue: '',
    periodStart: todayStr(), periodEnd: todayStr(), notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => { listGoals().then(setGoals).catch(() => setGoals([])); };
  useEffect(refresh, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = toNum(form.targetValue);
    if (!form.name.trim() || target <= 0 || form.periodEnd < form.periodStart) {
      toast.error('Please fill in a name, a positive target, and a valid date range.');
      return;
    }
    try {
      setSubmitting(true);
      await createGoal({
        name: form.name.trim(), metricType: form.metricType, targetValue: target,
        periodStart: form.periodStart, periodEnd: form.periodEnd, notes: form.notes || undefined,
      });
      toast.success('Goal created');
      setShowForm(false);
      setForm({ name: '', metricType: 'revenue', targetValue: '', periodStart: todayStr(), periodEnd: todayStr(), notes: '' });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create goal');
    } finally {
      setSubmitting(false);
    }
  };

  if (goals === null) return <SkeletonPage />;

  const active = goals.filter(g => g.status === 'active');
  const finished = goals.filter(g => g.status !== 'active');

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Target}
        title="Business Goals"
        description="Set a target, track real progress against it, get warned before you miss it."
        actions={
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all duration-150 active:scale-[0.97]"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'New Goal'}
          </button>
        }
      >
        {showForm && (
          <form onSubmit={handleCreate} className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-slide-up">
            <input
              type="text" placeholder="Goal name (e.g. August Revenue Target)" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <select
              value={form.metricType}
              onChange={e => setForm(f => ({ ...f, metricType: e.target.value as GoalMetricType }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {Object.entries(METRIC_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <input
              type="number" placeholder="Target value" value={form.targetValue}
              onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <div>
              <label className="text-xs text-gray-500">Start</label>
              <input
                type="date" value={form.periodStart}
                onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">End</label>
              <input
                type="date" value={form.periodEnd}
                onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <button
              type="submit" disabled={submitting}
              className="sm:col-span-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg"
            >
              {submitting ? 'Creating…' : 'Create Goal'}
            </button>
          </form>
        )}
      </PageHeader>

      {active.length === 0 && finished.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No goals set yet."
          description="Set a revenue, profit, or expense target to track progress against."
        />
      ) : (
        <>
          {active.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {active.map(g => <GoalCard key={g.id} goal={g} onChanged={refresh} />)}
            </div>
          )}
          {finished.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-3">Completed &amp; Past Goals</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {finished.map(g => <GoalCard key={g.id} goal={g} onChanged={refresh} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BusinessGoals;
