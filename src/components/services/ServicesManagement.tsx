import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, Plus, Pencil, Trash2, Search, Clock, User, Image as ImageIcon, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../utils/supabase';
import { formatCurrency } from '../../utils/format';
import { getAccountCurrency } from '../../utils/accountCurrency';
import { toNum, parseInput, type NumericInput } from '../../utils/numberInput';
import { enqueueWrite, isNetworkError } from '../../services/offline/offlineQueue';
import { uploadPublicImage, ImageUploadError } from '../../services/storage/publicImageUpload';
import { syncProductCatalog } from '../../services/inventory/productCatalog';
import { PageHeader, Card, Button } from '../ui';
import { useFormErrors } from '../../hooks/useFormErrors';
import FieldError from '../ui/FieldError';

type RateType = 'flat' | 'hourly' | 'per_session';

interface ServiceRow {
  id: string;
  product_name: string;
  category: string | null;
  description: string | null;
  selling_price: number | null;
  service_type: RateType | null;
  duration_minutes: number | null;
  staff_name: string | null;
  is_active: boolean | null;
  image_url: string | null;
}

interface FormState {
  name: string;
  category: string;
  description: string;
  rate: NumericInput;
  rateType: RateType;
  duration: NumericInput;
  staff: string;
  active: boolean;
  image_url: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  category: '',
  description: '',
  rate: '',
  rateType: 'flat',
  duration: '',
  staff: '',
  active: true,
  image_url: '',
};

const RATE_LABEL: Record<RateType, string> = {
  flat: 'Flat fee',
  hourly: 'Per hour',
  per_session: 'Per session',
};

const ServicesManagement: React.FC = () => {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { errors, fail, field, formRef } = useFormErrors<'name' | 'rate'>();

  const load = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, product_name, category, description, selling_price, service_type, duration_minutes, staff_name, is_active, image_url')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .eq('item_type', 'service')
        .order('product_name');
      if (error) throw error;
      setServices((data ?? []) as ServiceRow[]);
    } catch (error) {
      console.error('Error loading services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter(s =>
      (s.product_name ?? '').toLowerCase().includes(q) ||
      (s.category ?? '').toLowerCase().includes(q) ||
      (s.staff_name ?? '').toLowerCase().includes(q)
    );
  }, [services, search]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (s: ServiceRow) => {
    setEditing(s);
    setForm({
      name: s.product_name ?? '',
      category: s.category ?? '',
      description: s.description ?? '',
      rate: s.selling_price ?? '',
      rateType: s.service_type ?? 'flat',
      duration: s.duration_minutes ?? '',
      staff: s.staff_name ?? '',
      active: s.is_active !== false,
      image_url: s.image_url ?? '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error('You must be logged in');
      const url = await uploadPublicImage({
        bucket: 'product-images',
        userId: uid,
        prefix: 'service',
        file,
        maxDim: 900,
        previousUrl: form.image_url,
      });
      setForm(prev => ({ ...prev, image_url: url }));
    } catch (error) {
      toast.error(error instanceof ImageUploadError ? error.message : 'Could not upload the photo');
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const problems: { name?: string; rate?: string } = {};
    if (!name) problems.name = 'Give the service a name';
    if (toNum(form.rate) <= 0) problems.rate = 'Enter the price for this service';
    if (Object.keys(problems).length > 0) {
      toast.error('Please fix the highlighted fields');
      return fail(problems);
    }

    setSaving(true);
    try {
      let userId: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id ?? null;
      } catch {
        // offline: fall back to the stored session below
      }
      if (!userId) {
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id ?? null;
      }
      if (!userId) return toast.error('You must be logged in');

      const duration = Math.round(toNum(form.duration));
      const row = {
        id: editing?.id ?? crypto.randomUUID(),
        user_id: userId,
        product_name: name,
        item_type: 'service',
        category: form.category.trim() || null,
        description: form.description.trim() || null,
        selling_price: toNum(form.rate),
        cost_price: 0,
        current_stock: 0,
        reorder_level: 0,
        service_type: form.rateType,
        duration_minutes: duration > 0 ? duration : null,
        staff_name: form.staff.trim() || null,
        is_active: form.active,
        image_url: form.image_url || null,
      };

      const { error } = await supabase.from('inventory_items').upsert(row);
      if (error) {
        if (!isNetworkError(error)) throw error;
        enqueueWrite({ id: row.id, kind: 'inventory_item', table: 'inventory_items', payload: row, label: `Service: ${name}` });
        toast.success("Saved offline — will sync when you're back online", { duration: 5000 });
        closeForm();
        return;
      }

      await syncProductCatalog(userId, name, 0, row.selling_price, {
        item_type: 'service',
        image_url: row.image_url,
        is_active: row.is_active,
      });
      toast.success(editing ? 'Service updated' : 'Service added');
      closeForm();
      load();
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: ServiceRow) => {
    const next = s.is_active === false;
    setServices(prev => prev.map(x => (x.id === s.id ? { ...x, is_active: next } : x)));
    const { error } = await supabase.from('inventory_items').update({ is_active: next }).eq('id', s.id);
    if (error) {
      setServices(prev => prev.map(x => (x.id === s.id ? { ...x, is_active: !next } : x)));
      toast.error('Could not update the service');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await syncProductCatalog(user.id, s.product_name, 0, toNum(s.selling_price), { item_type: 'service', is_active: next });
    }
  };

  const remove = async (s: ServiceRow) => {
    if (!confirm(`Delete "${s.product_name}"? Past sales that used it are not affected.`)) return;
    const { error } = await supabase.from('inventory_items').update({ is_deleted: true }).eq('id', s.id);
    if (error) return toast.error('Failed to delete service');
    setServices(prev => prev.filter(x => x.id !== s.id));
    toast.success('Service deleted');
  };

  const fieldClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const rateWord = form.rateType === 'hourly' ? 'hour' : form.rateType === 'per_session' ? 'session' : 'job';

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Briefcase}
        title="Services"
        description="Things you do for customers. Set the price, how it is charged, how long it takes and who does it."
        actions={<Button icon={Plus} onClick={openAdd}>Add Service</Button>}
      />

      {showForm && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">{editing ? 'Edit service' : 'New service'}</h3>
            <button type="button" onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close form">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form ref={formRef} noValidate onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Service name *</label>
              <input {...field('name')} type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={fieldClass} placeholder="e.g., Haircut, Consultation, Delivery run" />
              <FieldError name="name" message={errors.name} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">How is it charged?</label>
              <select value={form.rateType} onChange={e => setForm(p => ({ ...p, rateType: e.target.value as RateType }))} className={fieldClass}>
                <option value="flat">Flat fee (one price per job)</option>
                <option value="hourly">Per hour</option>
                <option value="per_session">Per session</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price per {rateWord} ({getAccountCurrency()}) *</label>
              <input {...field('rate')} type="number" min="0" step="0.01" value={form.rate} onChange={e => setForm(p => ({ ...p, rate: parseInput(e.target.value) }))} className={fieldClass} placeholder="0.00" />
              <FieldError name="rate" message={errors.rate} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usual duration (minutes)</label>
              <input type="number" min="0" step="5" value={form.duration} onChange={e => setForm(p => ({ ...p, duration: parseInput(e.target.value) }))} className={fieldClass} placeholder="e.g., 45" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usually done by</label>
              <input type="text" value={form.staff} onChange={e => setForm(p => ({ ...p, staff: e.target.value }))} className={fieldClass} placeholder="Staff member (optional)" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input type="text" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={fieldClass} placeholder="e.g., Beauty, Repairs" />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer pb-2">
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} className="w-4 h-4" />
                Available for sale (untick to hide it from Add Sale)
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className={fieldClass} placeholder="What is included (optional)" />
            </div>

            <div className="md:col-span-2 flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg border border-dashed border-gray-300 bg-white flex items-center justify-center overflow-hidden">
                {form.image_url ? <img src={form.image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-gray-300" />}
              </div>
              <div className="space-y-1">
                <label className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                  {uploading ? 'Uploading...' : form.image_url ? 'Replace photo' : 'Add photo (optional)'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleImage} disabled={uploading} />
                </label>
                {form.image_url && (
                  <button type="button" onClick={() => setForm(p => ({ ...p, image_url: '' }))} className="block text-xs text-red-600 hover:text-red-700">Remove photo</button>
                )}
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={closeForm}>Cancel</Button>
              <Button type="submit" loading={saving} disabled={saving}>{saving ? 'Saving...' : editing ? 'Save changes' : 'Add service'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services..." className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading services...</p>
        ) : visible.length === 0 ? (
          <div className="text-center py-10">
            <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-600 font-medium">{services.length === 0 ? 'No services yet' : 'No services match your search'}</p>
            {services.length === 0 && <p className="text-sm text-gray-400 mt-1">Add the services you offer, then pick them when recording a sale.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visible.map(s => {
              const active = s.is_active !== false;
              return (
                <div key={s.id} className={`border rounded-xl p-4 flex gap-3 ${active ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-70'}`}>
                  <div className="w-14 h-14 rounded-lg bg-blue-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {s.image_url ? <img src={s.image_url} alt="" className="w-full h-full object-cover" /> : <Briefcase className="w-6 h-6 text-blue-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-800 truncate">{s.product_name}</p>
                      <div className="flex gap-1 flex-shrink-0">
                        <button type="button" onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Edit service"><Pencil className="w-4 h-4" /></button>
                        <button type="button" onClick={() => remove(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" aria-label="Delete service"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(s.selling_price)}
                      <span className="text-xs font-normal text-gray-500"> {RATE_LABEL[s.service_type ?? 'flat'].toLowerCase()}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                      {s.duration_minutes ? <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{s.duration_minutes} min</span> : null}
                      {s.staff_name ? <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{s.staff_name}</span> : null}
                      {s.category ? <span>{s.category}</span> : null}
                    </div>
                    {s.description && <p className="mt-1 text-xs text-gray-500 line-clamp-2">{s.description}</p>}
                    <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={active} onChange={() => toggleActive(s)} className="w-3.5 h-3.5" />
                      {active ? 'Available for sale' : 'Hidden from Add Sale'}
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ServicesManagement;
