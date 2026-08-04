import React, { useState, useEffect } from 'react';
import { Plus, DollarSign, Calendar, Save, Receipt } from 'lucide-react';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import { toNum, parseInput, NumericInput } from '../utils/numberInput';

interface GeneralExpenseFormData {
  expense_type: string;
  amount: NumericInput;
  date: string;
  notes: string;
}

const EXPENSE_TYPES = [
  'Rent',
  'Utilities',
  'Salaries',
  'Internet',
  'Transport',
  'Packaging',
  'Office Supplies',
  'Maintenance',
  'Insurance',
  'Licenses',
  'Subscriptions',
  'Marketing Materials',
  'Professional Services',
  'Bank Charges',
  'Other'
];

const GeneralExpenseForm: React.FC = () => {
  const [formData, setFormData] = useState<GeneralExpenseFormData>({
    expense_type: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userExpenseTypes, setUserExpenseTypes] = useState<string[]>([]);

  useEffect(() => {
    fetchUserExpenseTypes();
  }, []);

  const fetchUserExpenseTypes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_expense_types')
        .select('name')
        .eq('user_id', user.id)
        .order('name');

      setUserExpenseTypes(data?.map(item => item.name) || []);
    } catch (error) {
      console.error('Error fetching user expense types:', error);
    }
  };

  const handleInputChange = (field: keyof GeneralExpenseFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addNewExpenseType = async (expenseType: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_expense_types')
        .insert({ user_id: user.id, name: expenseType });

      if (!error) {
        setUserExpenseTypes(prev => [...prev, expenseType]);
        toast.success('Expense type added to your list');
      }
    } catch (error) {
      console.error('Error adding expense type:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.expense_type || toNum(formData.amount) <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to add expenses');
        return;
      }

      // Add new expense type if it doesn't exist
      if (!userExpenseTypes.includes(formData.expense_type) && !EXPENSE_TYPES.includes(formData.expense_type)) {
        await addNewExpenseType(formData.expense_type);
      }

      const expenseData = {
        id: crypto.randomUUID(),
        user_id: user.id,
        ...formData,
        amount: toNum(formData.amount)
      };

      const { error } = await supabase
        .from('general_expenses')
        .insert(expenseData);

      if (error) {
        throw error;
      }

      toast.success('General expense recorded successfully!');
      
      // Reset form
      setFormData({
        expense_type: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });

    } catch (error: any) {
      console.error('Error adding general expense:', error);
      toast.error(error.message || 'Failed to record general expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const allExpenseTypes = [...new Set([...EXPENSE_TYPES, ...userExpenseTypes])].sort();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-orange-100">
            <Receipt className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Record General Expense</h2>
            <p className="text-gray-600">Track your business operating expenses</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Expense Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Receipt className="w-4 h-4 inline mr-1" />
              Expense Type *
            </label>
            <input
              type="text"
              list="expense-types"
              value={formData.expense_type}
              onChange={(e) => handleInputChange('expense_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Select or enter expense type"
              required
            />
            <datalist id="expense-types">
              {allExpenseTypes.map(type => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Amount (KES) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', parseInput(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="0.00"
              required
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Expense Date *
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Additional details about this expense..."
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-medium rounded-lg transition-colors"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Recording...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Record Expense
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GeneralExpenseForm;