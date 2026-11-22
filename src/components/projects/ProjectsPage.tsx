import React, { useEffect, useState } from 'react';
import { useFormErrors } from '../../hooks/useFormErrors';
import FieldError from '../ui/FieldError';
import { Briefcase, Plus, X, Trash2, Check, CheckCircle2, Archive, FolderOpen, ChevronUp, FileText, Receipt, ListChecks, Ticket } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchProjectSummaries, type ProjectSummary } from '../../services/projects/projectRollupService';
import { createProject, updateProjectStatus, deleteProject } from '../../services/projects/projectService';
import { formatCurrency, formatDate } from '../../utils/format';
import { fetchProjectContents, type ProjectContents } from '../../services/projects/projectContentsService';
import { createTask, toggleTaskCompleted } from '../../services/tasks/taskService';
import { toNum } from '../../utils/number';
import { PageHeader, EmptyState, SkeletonList } from '../ui';

// Events (festivals, weddings, conferences) moved to their own standalone page
// (src/components/events/EventsPage.tsx) — this page is general-purpose projects only.

const ProjectRow: React.FC<{ project: ProjectSummary; onChanged: () => void }> = ({ project, onChanged }) => {
  const [pendingDelete, setPendingDelete] = useState(false);
  const [open, setOpen] = useState(false);
  const [contents, setContents] = useState<ProjectContents | null>(null);
  const [loadingContents, setLoadingContents] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const refreshContents = async () => {
    setLoadingContents(true);
    try {
      setContents(await fetchProjectContents(project.id));
    } catch {
      toast.error('Could not load this project');
    } finally {
      setLoadingContents(false);
    }
  };

  const toggleFolder = async () => {
    const next = !open;
    setOpen(next);
    // Always refetch on open: invoices/expenses/tasks are added from other pages.
    if (next) await refreshContents();
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    try {
      await createTask({
        title: newTaskTitle.trim(),
        taskType: 'general',
        dueDate: newTaskDueDate || null,
        projectId: project.id,
      });
      setNewTaskTitle('');
      setNewTaskDueDate('');
      await refreshContents();
    } catch {
      toast.error('Could not add that task');
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    // Optimistic: the checklist should feel instant, not wait on a round trip.
    setContents(prev => prev && {
      ...prev,
      tasks: prev.tasks.map(t => (t.id === taskId ? { ...t, completed: !completed } : t)),
    });
    try {
      await toggleTaskCompleted(taskId, completed);
    } catch {
      toast.error('Could not update that task');
      await refreshContents();
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProject(project.id);
      toast.success('Project deleted');
      onChanged();
    } catch {
      toast.error('Failed to delete project');
    } finally {
      setPendingDelete(false);
    }
  };

  const handleToggleStatus = async () => {
    const nextStatus = project.status === 'completed' ? 'active' : 'completed';
    try {
      await updateProjectStatus(project.id, nextStatus);
      onChanged();
    } catch {
      toast.error('Failed to update project');
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 transition-all duration-200 hover:shadow-md animate-slide-up ${project.status !== 'active' ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">{project.name}</p>
          {project.clientName && <p className="text-xs text-gray-400 mt-0.5">{project.clientName}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleToggleStatus}
            className="text-gray-400 hover:text-gray-600 transition-all duration-150 active:scale-90"
            aria-label={project.status === 'completed' ? 'Mark active' : 'Mark completed'}
            title={project.status === 'completed' ? 'Mark active' : 'Mark completed'}
          >
            {project.status === 'completed' ? <Archive className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          </button>
          {pendingDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={handleDelete} className="text-red-500 hover:text-red-700 transition-all duration-150 active:scale-90" aria-label="Confirm delete">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setPendingDelete(false)} className="text-gray-300 hover:text-gray-500 transition-all duration-150 active:scale-90" aria-label="Cancel">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => setPendingDelete(true)} className="text-gray-300 hover:text-red-500 transition-all duration-150 active:scale-90" aria-label="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3 pt-3 border-t border-gray-100 text-sm">
        <div>
          <p className="text-xs text-gray-400">Budget</p>
          <p className="font-medium tabular-nums">{project.budget != null ? formatCurrency(project.budget) : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Sales</p>
          <p className="font-medium tabular-nums text-green-600">{formatCurrency(project.salesTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Invoiced</p>
          <p className="font-medium tabular-nums text-blue-600">{formatCurrency(project.invoicedTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Spent</p>
          <p className="font-medium tabular-nums text-red-600">{formatCurrency(project.spentTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Remaining</p>
          <p className={`font-medium tabular-nums ${project.remainingBudget != null && project.remainingBudget < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {project.remainingBudget != null ? formatCurrency(project.remainingBudget) : '—'}
          </p>
        </div>
      </div>

      <button
        onClick={toggleFolder}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        {open ? <ChevronUp className="w-4 h-4" /> : <FolderOpen className="w-4 h-4" />}
        {open ? 'Close folder' : 'Open folder'}
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-4">
          {loadingContents && <p className="text-sm text-gray-400">Loading...</p>}
          {contents && (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5" /> Sales ({contents.sales.length})
                </p>
                {contents.sales.length === 0 ? (
                  <p className="text-sm text-gray-400">No sales yet. Pick this project when you record one.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {contents.sales.map(s => (
                      <li key={s.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          <Ticket className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="truncate">{s.productName}</span>
                        </span>
                        <span className="text-right flex-shrink-0">
                          <span className="block font-medium tabular-nums text-green-600">{formatCurrency(s.amount)}</span>
                          <span className="block text-xs text-gray-400">{formatDate(s.date)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Documents ({contents.documents.length})</p>
                {contents.documents.length === 0 ? (
                  <p className="text-sm text-gray-400">No invoices or quotations yet. Pick this project when you create one.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {contents.documents.map(d => (
                      <li key={d.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <span className="truncate"><span className="font-medium">{d.number}</span> <span className="text-gray-400 capitalize">{d.type}{d.customer ? ` · ${d.customer}` : ''}</span></span>
                        </span>
                        <span className="text-right flex-shrink-0">
                          <span className="block font-medium tabular-nums">{formatCurrency(d.total)}</span>
                          <span className="block text-xs text-gray-400">{formatDate(d.date)}{d.status ? ` · ${d.status}` : ''}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Expenses ({contents.expenses.length})</p>
                {contents.expenses.length === 0 ? (
                  <p className="text-sm text-gray-400">No expenses yet. Pick this project when you record one.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {contents.expenses.map(e => (
                      <li key={`${e.kind}-${e.id}`} className="py-2 flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          <Receipt className="w-4 h-4 text-red-400 flex-shrink-0" />
                          <span className="truncate">{e.label} <span className="text-gray-400">· {e.kind}</span></span>
                        </span>
                        <span className="text-right flex-shrink-0">
                          <span className="block font-medium tabular-nums text-red-600">{formatCurrency(e.amount)}</span>
                          <span className="block text-xs text-gray-400">{formatDate(e.date)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5">
                  <ListChecks className="w-3.5 h-3.5" /> Timeline ({contents.tasks.length})
                </p>
                {contents.tasks.length === 0 ? (
                  <p className="text-sm text-gray-400 mb-2">No checklist items yet.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 mb-2">
                    {contents.tasks.map(t => (
                      <li key={t.id} className="py-2 flex items-center gap-3 text-sm">
                        <button
                          type="button"
                          onClick={() => handleToggleTask(t.id, t.completed)}
                          aria-label={t.completed ? 'Mark not done' : 'Mark done'}
                          className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${t.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}
                        >
                          {t.completed && <Check className="w-3 h-3 text-white" />}
                        </button>
                        <span className={`flex-1 min-w-0 truncate ${t.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{t.title}</span>
                        {t.dueDate && <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(t.dueDate)}</span>}
                      </li>
                    ))}
                  </ul>
                )}
                <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Add a checklist item"
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={e => setNewTaskDueDate(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                    aria-label="Due date"
                  />
                  <button
                    type="submit"
                    disabled={addingTask || !newTaskTitle.trim()}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg flex-shrink-0"
                  >
                    {addingTask ? 'Adding…' : 'Add'}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const EMPTY_FORM = { name: '', clientName: '', budget: '', notes: '' };

const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const { errors, fail, field, formRef } = useFormErrors<'name'>();
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => { fetchProjectSummaries().then(setProjects).catch(() => setProjects([])); };
  useEffect(refresh, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Enter a project name');
      return fail({ name: 'Give the project a name' });
    }
    try {
      setSubmitting(true);
      await createProject({
        name: form.name.trim(),
        clientName: form.clientName.trim() || undefined,
        budget: form.budget ? toNum(form.budget) : undefined,
        notes: form.notes.trim() || undefined,
      });
      toast.success('Project added');
      setShowForm(false);
      setForm(EMPTY_FORM);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add project');
    } finally {
      setSubmitting(false);
    }
  };

  if (projects === null) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-2">
          <div className="h-6 w-52 skeleton-shimmer rounded-md" />
          <div className="h-4 w-80 skeleton-shimmer rounded-md" />
        </div>
        <SkeletonList rows={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Briefcase}
        title="Projects"
        actions={
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all duration-150 active:scale-[0.97]"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'New Project'}
          </button>
        }
      >
        {showForm && (
          <form ref={formRef} noValidate onSubmit={handleCreate} className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-slide-up">
            <input {...field('name')}
              type="text" placeholder="Project name" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <FieldError name="name" message={errors.name} />
            <input
              type="text" placeholder="Client name (optional)" value={form.clientName}
              onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              type="number" placeholder="Budget (optional)" value={form.budget}
              onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <textarea
              placeholder="Notes (optional)" value={form.notes} rows={2}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <button
              type="submit" disabled={submitting}
              className="sm:col-span-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg"
            >
              {submitting ? 'Saving…' : 'Save Project'}
            </button>
          </form>
        )}
      </PageHeader>

      {projects.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No projects yet."
          description="Add a job you're billing a client across multiple invoices to track its budget against what's been invoiced and spent. Planning an event? See Events in the sidebar."
        />
      ) : (
        <div className="space-y-2">
          {projects.map(p => <ProjectRow key={p.id} project={p} onChanged={refresh} />)}
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
