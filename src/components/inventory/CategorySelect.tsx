import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { mergeCategories, resolveCategory } from '../../services/inventory/categories';

const ADD_NEW = '__add_new_category__';

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  /** Categories already on the business's products. Fetched when not supplied. */
  categories?: string[];
  id?: string;
  className?: string;
}

/** Remembers what was loaded so the next product form opens with the list ready. */
let fetchedCategories: string[] | null = null;

async function loadCategories(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('inventory_items')
    .select('category')
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .not('category', 'is', null)
    .range(0, 9999);
  fetchedCategories = mergeCategories((data ?? []).map((row: { category: string | null }) => row.category));
  return fetchedCategories;
}

/**
 * Category as a dropdown of the business's existing categories, with "Add new category" at
 * the bottom for one that isn't there yet.
 */
export default function CategorySelect({ value, onChange, categories, id, className = '' }: CategorySelectProps) {
  const [loaded, setLoaded] = useState<string[]>(fetchedCategories ?? []);
  const [added, setAdded] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (categories) return;
    let cancelled = false;
    loadCategories().then(list => { if (!cancelled) setLoaded(list); }).catch(() => { /* the field still works typed-in */ });
    return () => { cancelled = true; };
  }, [categories]);

  const options = mergeCategories(categories ?? loaded, added, value);
  // A product saved as "office chair" while the list says "Office Chair" still shows that entry.
  const shown = options.find(name => name.toLowerCase() === value.trim().toLowerCase()) ?? '';
  const fieldClass = `w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`;

  const confirm = () => {
    const name = resolveCategory(draft, options);
    if (name) {
      setAdded(prev => (prev.includes(name) ? prev : [...prev, name]));
      onChange(name);
    }
    setDraft('');
    setAdding(false);
  };

  if (adding) {
    return (
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          autoFocus
          value={draft}
          maxLength={40}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); confirm(); }
            if (e.key === 'Escape') { e.preventDefault(); setDraft(''); setAdding(false); }
          }}
          placeholder="New category name"
          aria-label="New category name"
          className={`${fieldClass} min-w-0`}
        />
        <button
          type="button"
          onClick={confirm}
          disabled={!draft.trim()}
          aria-label="Add category"
          className="px-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center"
        >
          <Check className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => { setDraft(''); setAdding(false); }}
          aria-label="Cancel adding a category"
          className="px-3 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <select
      id={id}
      value={shown}
      onChange={e => {
        if (e.target.value === ADD_NEW) setAdding(true);
        else onChange(e.target.value);
      }}
      className={fieldClass}
    >
      <option value="">No category</option>
      {options.map(name => (
        <option key={name} value={name}>{name}</option>
      ))}
      <option value={ADD_NEW}>+ Add new category…</option>
    </select>
  );
}
