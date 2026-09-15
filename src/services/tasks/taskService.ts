import { supabase } from '../../utils/supabase';

export interface BusinessTask {
  id: string;
  title: string;
  taskType: string;
  completed: boolean;
  dueDate: string | null;
  createdAt: string | null;
}

function mapRow(row: {
  id: string; title: string; task_type: string | null; completed: boolean | null;
  due_date: string | null; created_at: string | null;
}): BusinessTask {
  return {
    id: row.id,
    title: row.title,
    taskType: row.task_type ?? 'general',
    completed: row.completed ?? false,
    dueDate: row.due_date,
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
}

export async function createTask(input: CreateTaskInput): Promise<BusinessTask> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to add a task.');

  const { data, error } = await supabase
    .from('business_tasks')
    .insert({ title: input.title, task_type: input.taskType, due_date: input.dueDate ?? null, user_id: user.id })
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
