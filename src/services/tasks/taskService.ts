import { supabase } from '../../utils/supabase';
import { computeRemindAt } from './reminders';

export interface BusinessTask {
  id: string;
  title: string;
  taskType: string;
  completed: boolean;
  dueDate: string | null;
  /** HH:MM, local time, or null when the task only has a date. */
  dueTime: string | null;
  /** When the owner wants to be reminded (ISO), or null. */
  remindAt: string | null;
  createdAt: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  task_type: string | null;
  completed: boolean | null;
  due_date: string | null;
  due_time?: string | null;
  remind_at?: string | null;
  created_at: string | null;
}

function mapRow(row: TaskRow): BusinessTask {
  return {
    id: row.id,
    title: row.title,
    taskType: row.task_type ?? 'general',
    completed: row.completed ?? false,
    dueDate: row.due_date,
    dueTime: row.due_time ?? null,
    remindAt: row.remind_at ?? null,
    createdAt: row.created_at,
  };
}

export async function listTasks(): Promise<BusinessTask[]> {
  const { data, error } = await supabase
    .from('business_tasks')
    .select('*')
    .order('completed', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export interface CreateTaskInput {
  title: string;
  taskType: string;
  dueDate?: string | null;
  /** HH:MM, local time. */
  dueTime?: string | null;
  /** Minutes before the due moment to remind; null/undefined for no reminder. */
  remindMinutesBefore?: number | null;
}

export async function createTask(input: CreateTaskInput): Promise<BusinessTask> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to add a task.');

  const dueDate = input.dueDate ?? null;
  const remindAt = computeRemindAt(dueDate, input.dueTime, input.remindMinutesBefore);

  const { data, error } = await supabase
    .from('business_tasks')
    .insert({
      title: input.title,
      task_type: input.taskType,
      due_date: dueDate,
      due_time: dueDate && input.dueTime ? input.dueTime : null,
      remind_at: remindAt,
      user_id: user.id,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function toggleTaskCompleted(id: string, completed: boolean): Promise<void> {
  const { error } = await supabase.from('business_tasks').update({ completed: !completed }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('business_tasks').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Open tasks whose reminder time has arrived, oldest first. */
export async function listDueReminders(now: Date = new Date()): Promise<BusinessTask[]> {
  const { data, error } = await supabase
    .from('business_tasks')
    .select('*')
    .eq('completed', false)
    .not('remind_at', 'is', null)
    .lte('remind_at', now.toISOString())
    .order('remind_at', { ascending: true })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}
