import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User, UserPlus, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createCustomer, listCustomers, type Customer } from '../../services/customers/customerService';

export interface PickedCustomer {
  name: string;
  phone: string;
  customerId: string | null;
}

interface CustomerPickerProps {
  /** The customer name currently on the sale (may be typed free-hand). */
  name: string;
  phone: string;
  onChange: (customer: PickedCustomer) => void;
}

const CustomerPicker: React.FC<CustomerPickerProps> = ({ name, phone, onChange }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ name: '', phone: '', email: '' });
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listCustomers().then(setCustomers).catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const query = name.trim().toLowerCase();
  const matches = useMemo(() => {
    const list = query
      ? customers.filter(c => c.name.toLowerCase().includes(query) || (c.phone ?? '').replace(/\s/g, '').includes(query.replace(/\s/g, '')))
      : customers;
    return list.slice(0, 8);
  }, [customers, query]);

  const exact = customers.find(c => c.name.toLowerCase() === query);
  const selected = exact ?? null;

  const pick = (c: Customer) => {
    onChange({ name: c.name, phone: c.phone ?? '', customerId: c.id });
    setOpen(false);
  };

  const startCreate = () => {
    setDraft({ name: name.trim(), phone, email: '' });
    setCreating(true);
    setOpen(false);
  };

  const saveNew = async () => {
    if (!draft.name.trim()) return toast.error('Enter the customer name');
    setSaving(true);
    try {
      const created = await createCustomer(draft);
      setCustomers(prev => (prev.some(c => c.id === created.id) ? prev : [...prev, created].sort((a, b) => a.name.localeCompare(b.name))));
      pick(created);
      setCreating(false);
      toast.success(`${created.name} added to your customers`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add the customer');
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        <User className="w-4 h-4 inline mr-1" />
        Customer
      </label>
      <div className="relative">
        <input
          type="text"
          value={name}
          onChange={e => {
            onChange({ name: e.target.value, phone, customerId: null });
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className={`${input} ${selected ? 'pr-9' : ''}`}
          placeholder="Search or type a customer name"
          autoComplete="off"
        />
        {selected && <Check className="w-4 h-4 text-green-600 absolute right-3 top-1/2 -translate-y-1/2" aria-label="Existing customer" />}
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {matches.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between gap-3"
            >
              <span className="text-sm text-gray-800 truncate">{c.name}</span>
              {c.phone && <span className="text-xs text-gray-400 flex-shrink-0">{c.phone}</span>}
            </button>
          ))}
          {matches.length === 0 && !query && <p className="px-3 py-2 text-sm text-gray-400">No customers yet</p>}
          <button
            type="button"
            onClick={startCreate}
            className="w-full text-left px-3 py-2 border-t border-gray-100 text-sm font-medium text-blue-600 hover:bg-blue-50 flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            {query && !exact ? `Add "${name.trim()}" as a new customer` : 'Add a new customer'}
          </button>
        </div>
      )}

      {query && !exact && !open && (
        <p className="mt-1 text-xs text-gray-400">
          Not in your customers yet.{' '}
          <button type="button" onClick={startCreate} className="text-blue-600 hover:underline">Add them</button>
          {' '}or leave it and they are added when you record the sale.
        </p>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">New customer</h3>
              <button type="button" onClick={() => setCreating(false)} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input type="text" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} className={input} placeholder="Name *" autoFocus />
            <input type="tel" value={draft.phone} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))} className={input} placeholder="Phone (for WhatsApp receipts)" />
            <input type="email" value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} className={input} placeholder="Email (optional)" />
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setCreating(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={saveNew} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Saving...' : 'Add customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerPicker;
