import { useState } from 'react';
import { X, Tag, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../utils/supabase';
import { resolveCategory } from '../../services/inventory/categories';
import Modal from '../ui/Modal';

interface InventoryItemLite {
  id: string;
  product_name: string;
  category: string | null;
}

interface CategoryManagerProps {
  items: InventoryItemLite[];
  categories: string[];
  onClose: () => void;
  /** Called after a rename or a bulk product assignment is saved, so the caller can refetch. */
  onSaved: () => void;
}

/**
 * Lets a business rename a category across every product that has it, and move a batch of
 * existing products into a category — the two things typing a category into one product's
 * own edit form can't do.
 */
export default function CategoryManager({ items, categories, onClose, onSaved }: CategoryManagerProps) {
  const [renameFrom, setRenameFrom] = useState(categories[0] ?? '');
  const [renameTo, setRenameTo] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [assignTo, setAssignTo] = useState('');
  const [assignDraft, setAssignDraft] = useState('');
  const [addingNewTarget, setAddingNewTarget] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredItems = items.filter(item =>
    !search.trim() || item.product_name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const handleRename = async () => {
    const from = renameFrom.trim();
    const to = resolveCategory(renameTo, categories);
    if (!from || !to) {
      toast.error('Pick a category and type its new name');
      return;
    }
    if (from.toLowerCase() === to.toLowerCase()) {
      toast.error('That’s already its name');
      return;
    }
    setRenaming(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in');
      const { error } = await supabase
        .from('inventory_items')
        .update({ category: to })
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .ilike('category', from);
      if (error) throw error;
      toast.success(`Renamed "${from}" to "${to}"`);
      setRenameTo('');
      onSaved();
    } catch (error: any) {
      console.error('Error renaming category:', error);
      toast.error(error.message || 'Failed to rename category');
    } finally {
      setRenaming(false);
    }
  };

  const handleAssign = async () => {
    const target = addingNewTarget ? resolveCategory(assignDraft, categories) : assignTo;
    if (!target) {
      toast.error('Choose or type a category to assign to');
      return;
    }
    if (selected.size === 0) {
      toast.error('Pick at least one product');
      return;
    }
    setAssigning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in');
      const { error } = await supabase
        .from('inventory_items')
        .update({ category: target })
        .eq('user_id', user.id)
        .in('id', Array.from(selected));
      if (error) throw error;
      toast.success(`Moved ${selected.size} product${selected.size === 1 ? '' : 's'} to "${target}"`);
      setSelected(new Set());
      setAssignDraft('');
      setAddingNewTarget(false);
      onSaved();
    } catch (error: any) {
      console.error('Error assigning category:', error);
      toast.error(error.message || 'Failed to update products');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Modal>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-600" /> Manage Categories
          </h3>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          {/* Rename */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Rename a category</h4>
            {categories.length === 0 ? (
              <p className="text-sm text-gray-400">No categories yet — add one from a product's edit form first.</p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={renameFrom}
                  onChange={(e) => setRenameFrom(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:w-44"
                >
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="text"
                  value={renameTo}
                  onChange={(e) => setRenameTo(e.target.value)}
                  placeholder="New name"
                  maxLength={40}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleRename}
                  disabled={renaming || !renameTo.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50 whitespace-nowrap"
                >
                  {renaming ? 'Renaming…' : 'Rename'}
                </button>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1.5">Updates every product currently in that category.</p>
          </div>

          <div className="border-t border-gray-100" />

          {/* Assign existing products */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Add existing products to a category</h4>

            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              {addingNewTarget ? (
                <input
                  type="text"
                  autoFocus
                  value={assignDraft}
                  onChange={(e) => setAssignDraft(e.target.value)}
                  placeholder="New category name"
                  maxLength={40}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              ) : (
                <select
                  value={assignTo}
                  onChange={(e) => setAssignTo(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Choose a category…</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <button
                type="button"
                onClick={() => { setAddingNewTarget(v => !v); setAssignDraft(''); setAssignTo(''); }}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap"
              >
                {addingNewTarget ? 'Pick existing instead' : '+ New category'}
              </button>
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />

            <div className="border border-gray-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-gray-100">
              {filteredItems.length === 0 ? (
                <p className="text-sm text-gray-400 p-3">No products match.</p>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selected.has(item.id);
                  return (
                    <label
                      key={item.id}
                      className="flex items-center gap-3 px-3 py-2.5 min-h-[44px] cursor-pointer hover:bg-gray-50"
                    >
                      <span className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(item.id)}
                        className="sr-only"
                      />
                      <span className="text-sm text-gray-800 flex-1 truncate">{item.product_name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{item.category || 'No category'}</span>
                    </label>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={handleAssign}
              disabled={assigning || selected.size === 0}
              className="mt-3 w-full px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50"
            >
              {assigning ? 'Moving…' : `Move ${selected.size || ''} product${selected.size === 1 ? '' : 's'} to this category`.replace('  ', ' ')}
            </button>
          </div>
        </div>
      </div>
    </div>
    </Modal>
  );
}
