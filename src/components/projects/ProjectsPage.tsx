import React, { useEffect, useState } from 'react';
import { Briefcase, Plus, X, Trash2, Check, CheckCircle2, Archive } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchProjectSummaries, type ProjectSummary } from '../../services/projects/projectRollupService';
import { createProject, updateProjectStatus, deleteProject } from '../../services/projects/projectService';
import { formatCurrency } from '../../utils/format';
import { toNum } from '../../utils/number';
import { PageHeader, EmptyState, SkeletonList } from '../ui';

const ProjectRow: React.FC<{ project: ProjectSummary; onChanged: () => void }> = ({ project, onChanged }) => {
  const [pendingDelete, setPendingDelete] = useState(false);

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-100 text-sm">
        <div>
          <p className="text-xs text-gray-400">Budget</p>
          <p className="font-medium tabular-nums">{project.budget != null ? formatCurrency(project.budget) : '—'}</p>
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
    </div>
  );
};

const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', clientName: '', budget: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => { fetchProjectSummaries().then(setProjects).catch(() => setProjects([])); };
  useEffect(refresh, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Enter a project name');
      return;
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
      setForm({ name: '', clientName: '', budget: '', notes: '' });
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
        description="Track budget vs. money invoiced and spent for a job billed across multiple invoices."
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
          <form onSubmit={handleCreate} className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-slide-up">
            <input
              type="text" placeholder="Project name" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
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
          description="Add a job you're billing a client across multiple invoices to track its budget against what's been invoiced and spent."
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
