import { supabase } from '../../utils/supabase';
import type { GoalRecord, GoalMetricType, GoalStatus } from './goalProgress';

function mapRow(row: {
  id: string; name: string; metric_type: string; target_value: number; manual_current_value: number | null;
  period_start: string; period_end: string; status: string; notes: string | null;
}): GoalRecord {
  return {
    id: row.id,
    name: row.name,
    metricType: row.metric_type as GoalMetricType,
    targetValue: row.target_value,
    manualCurrentValue: row.manual_current_value,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status as GoalStatus,
    notes: row.notes,
  };
}

export async function listGoals(includeArchived = false): Promise<GoalRecord[]> {
  let query = supabase.from('business_goals').select('*').order('period_end', { ascending: true });
  if (!includeArchived) query = query.neq('status', 'archived');
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export interface CreateGoalInput {
  name: string;
  metricType: GoalMetricType;
  targetValue: number;
  periodStart: string;
  periodEnd: string;
  notes?: string;
}

export async function createGoal(input: CreateGoalInput): Promise<GoalRecord> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to create a goal.');

  const { data, error } = await supabase
    .from('business_goals')
    .insert({
      user_id: user.id,
      name: input.name,
      metric_type: input.metricType,
      target_value: input.targetValue,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      notes: input.notes ?? null,
      manual_current_value: input.metricType === 'custom' ? 0 : null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function updateGoalManualValue(id: string, value: number): Promise<void> {
  const { error } = await supabase.from('business_goals').update({ manual_current_value: value }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setGoalStatus(id: string, status: GoalStatus): Promise<void> {
  const { error } = await supabase.from('business_goals').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('business_goals').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
