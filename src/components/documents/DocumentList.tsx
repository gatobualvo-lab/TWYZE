import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import toast from 'react-hot-toast';
import { Eye, CreditCard as Edit2, Trash2, Plus, Search, Filter, Check, AlertCircle, TrendingUp } from 'lucide-react';

interface Document {
  id: string;
  user_id: string;
  document_type: 'quotation' | 'invoice' | 'receipt';
  document_number: string;
  status: string;
  date: string;
  due_date: string | null;
  expiry_date: string | null;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  payment_method: string | null;
  notes: string | null;
  template: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

interface DocumentListProps {
  documentType: 'quotation' | 'invoice' | 'receipt';
  onCreateNew: () => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
}

const formatCurrency = (amount: number) => 'KES ' + amount.toLocaleString();

const getStatusColor = (status: string) => {
  const statusLower = status.toLowerCase();
  switch (statusLower) {
    case 'draft':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    case 'sent':
    case 'pending':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'paid':
    case 'accepted':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'overdue':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'cancelled':
      return 'bg-gray-200 text-gray-900 dark:bg-gray-600 dark:text-gray-100';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }
};

export const DocumentList: React.FC<DocumentListProps> = ({
  documentType,
  onCreateNew,
  onView,
  onEdit,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'total'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch documents
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
          toast.error('Please log in');
          return;
        }

        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('document_type', documentType)
          .eq('user_id', user.data.user.id)
          .order('date', { ascending: false });

        if (error) throw error;
        setDocuments(data || []);
      } catch (error) {
        console.error('Error fetching documents:', error);
        toast.error('Failed to load documents');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [documentType]);

  // Handle search and filtering
  useEffect(() => {
    let result = documents;

    // Filter by status
    if (selectedStatus !== 'all') {
      result = result.filter(
        (doc) => doc.status.toLowerCase() === selectedStatus.toLowerCase()
      );
    }

    // Search by customer name or document number
    if (searchTerm) {
      result = result.filter(
        (doc) =>
          doc.customer_name
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          doc.document_number
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let compareValue = 0;

      if (sortBy === 'date') {
        compareValue = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortBy === 'total') {
        compareValue = a.total - b.total;
      }

      return sortOrder === 'desc' ? -compareValue : compareValue;
    });

    setFilteredDocuments(result);
  }, [documents, searchTerm, selectedStatus, sortBy, sortOrder]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Delete document
  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setDocuments(documents.filter((doc) => doc.id !== id));
      setDeleteConfirm(null);
      toast.success('Document deleted');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  // Mark invoice as paid
  const handleMarkAsPaid = async (id: string) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ status: 'Paid', amount_paid: documents.find(d => d.id === id)?.total, balance_due: 0 })
        .eq('id', id);

      if (error) throw error;

      setDocuments(
        documents.map((doc) =>
          doc.id === id
            ? {
                ...doc,
                status: 'Paid',
                amount_paid: doc.total,
                balance_due: 0,
              }
            : doc
        )
      );
      toast.success('Marked as paid');
    } catch (error) {
      console.error('Error updating document:', error);
      toast.error('Failed to update document');
    }
  };

  // Calculate summary statistics
  const totalCount = filteredDocuments.length;
  const draftCount = filteredDocuments.filter(
    (doc) => doc.status.toLowerCase() === 'draft'
  ).length;
  const sentCount = filteredDocuments.filter(
    (doc) =>
      doc.status.toLowerCase() === 'sent' ||
      doc.status.toLowerCase() === 'pending'
  ).length;
  const totalValue = filteredDocuments.reduce((sum, doc) => sum + doc.total, 0);

  // Get unique statuses
  const uniqueStatuses = [
    'all',
    ...Array.from(
      new Set(documents.map((doc) => doc.status.toLowerCase()))
    ),
  ];

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center min-h-96 ${
          isDark ? 'bg-gray-900' : 'bg-white'
        }`}
      >
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p
            className={`mt-4 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            Loading documents...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Total"
          value={totalCount.toString()}
          icon={<TrendingUp className="w-5 h-5" />}
          isDark={isDark}
        />
        <SummaryCard
          title="Draft"
          value={draftCount.toString()}
          icon={<AlertCircle className="w-5 h-5" />}
          isDark={isDark}
        />
        <SummaryCard
          title={documentType === 'invoice' ? 'Pending' : 'Sent'}
          value={sentCount.toString()}
          icon={<Filter className="w-5 h-5" />}
          isDark={isDark}
        />
        <SummaryCard
          title="Total Value"
          value={formatCurrency(totalValue)}
          icon={<TrendingUp className="w-5 h-5" />}
          isDark={isDark}
          isValue={true}
        />
      </div>

      {/* Header with Create Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2
          className={`text-2xl font-bold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          {documentType.charAt(0).toUpperCase() + documentType.slice(1)}s
        </h2>
        <button
          onClick={onCreateNew}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create New
        </button>
      </div>

      {/* Search and Filter Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer or document number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                isDark
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className={`px-4 py-2 rounded-lg border ${
              isDark
                ? 'bg-gray-800 border-gray-700 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            {uniqueStatuses.map((status) => (
              <option key={status} value={status}>
                {status === 'all'
                  ? 'All Status'
                  : status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Controls */}
        <div className="flex gap-4">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'total')}
            className={`px-4 py-2 rounded-lg border ${
              isDark
                ? 'bg-gray-800 border-gray-700 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            <option value="date">Sort by Date</option>
            <option value="total">Sort by Total</option>
          </select>
          <button
            onClick={() =>
              setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
            }
            className={`px-4 py-2 rounded-lg border ${
              isDark
                ? 'bg-gray-800 border-gray-700 text-white hover:bg-gray-700'
                : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
            } transition-colors`}
          >
            {sortOrder === 'desc' ? '↓ Newest' : '↑ Oldest'}
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredDocuments.length === 0 ? (
        <div
          className={`text-center py-12 rounded-lg ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}
        >
          <AlertCircle
            className={`w-16 h-16 mx-auto mb-4 ${
              isDark ? 'text-gray-600' : 'text-gray-400'
            }`}
          />
          <p
            className={`text-lg font-semibold ${
              isDark ? 'text-gray-300' : 'text-gray-900'
            }`}
          >
            No documents found
          </p>
          <p
            className={`mt-2 ${
              isDark ? 'text-gray-500' : 'text-gray-600'
            }`}
          >
            {searchTerm || selectedStatus !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create your first document to get started'}
          </p>
          <button
            onClick={onCreateNew}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Create New {documentType}
          </button>
        </div>
      ) : isMobile ? (
        /* Mobile Card View */
        <div className="space-y-4">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className={`rounded-lg p-4 border ${
                isDark
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p
                    className={`font-semibold ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {doc.document_number}
                  </p>
                  <p
                    className={`text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    {doc.customer_name}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${getStatusColor(
                    doc.status
                  )}`}
                >
                  {doc.status}
                </span>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-sm">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                    Date:
                  </span>
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>
                    {new Date(doc.date).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                    Total:
                  </span>
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>
                    {formatCurrency(doc.total)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onView(doc.id)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded transition-colors"
                >
                  <Eye className="w-4 h-4 inline mr-1" />
                  View
                </button>
                <button
                  onClick={() => onEdit(doc.id)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-sm font-semibold py-2 rounded transition-colors"
                >
                  <Edit2 className="w-4 h-4 inline mr-1" />
                  Edit
                </button>
                {documentType === 'invoice' &&
                  doc.status.toLowerCase() !== 'paid' && (
                    <button
                      onClick={() => handleMarkAsPaid(doc.id)}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 rounded transition-colors"
                    >
                      <Check className="w-4 h-4 inline mr-1" />
                      Paid
                    </button>
                  )}
                <button
                  onClick={() => setDeleteConfirm(doc.id)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4 inline" />
                </button>
              </div>

              {deleteConfirm === doc.id && (
                <DeleteConfirmation
                  onConfirm={() => handleDelete(doc.id)}
                  onCancel={() => setDeleteConfirm(null)}
                  isDark={isDark}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Desktop Table View */
        <div
          className={`rounded-lg overflow-hidden border ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
          }`}
        >
          <table className="w-full">
            <thead
              className={`${
                isDark ? 'bg-gray-700' : 'bg-gray-100'
              } border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
            >
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Document #
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold">
                  Total
                </th>
                <th className="px-6 py-3 text-center text-sm font-semibold">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-sm font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.map((doc, index) => (
                <tr
                  key={doc.id}
                  className={`border-b ${
                    isDark ? 'border-gray-700' : 'border-gray-200'
                  } ${
                    index % 2 === 0
                      ? isDark
                        ? 'bg-gray-800'
                        : 'bg-white'
                      : isDark
                        ? 'bg-gray-750'
                        : 'bg-gray-50'
                  } hover:${isDark ? 'bg-gray-700' : 'bg-gray-100'} transition-colors`}
                >
                  <td
                    className={`px-6 py-4 text-sm font-semibold ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {doc.document_number}
                  </td>
                  <td
                    className={`px-6 py-4 text-sm ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    {doc.customer_name}
                  </td>
                  <td
                    className={`px-6 py-4 text-sm ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}
                  >
                    {new Date(doc.date).toLocaleDateString()}
                  </td>
                  <td
                    className={`px-6 py-4 text-sm font-semibold text-right ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {formatCurrency(doc.total)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`text-xs font-semibold px-3 py-1 rounded-full ${getStatusColor(
                        doc.status
                      )}`}
                    >
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => onView(doc.id)}
                        title="View"
                        className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900 rounded text-blue-600 dark:text-blue-400 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEdit(doc.id)}
                        title="Edit"
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-400 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {documentType === 'invoice' &&
                        doc.status.toLowerCase() !== 'paid' && (
                          <button
                            onClick={() => handleMarkAsPaid(doc.id)}
                            title="Mark as paid"
                            className="p-2 hover:bg-green-100 dark:hover:bg-green-900 rounded text-green-600 dark:text-green-400 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                      <button
                        onClick={() => setDeleteConfirm(doc.id)}
                        title="Delete"
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600 dark:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {deleteConfirm === doc.id && (
                      <DeleteConfirmationTableCell
                        onConfirm={() => handleDelete(doc.id)}
                        onCancel={() => setDeleteConfirm(null)}
                        isDark={isDark}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  isDark: boolean;
  isValue?: boolean;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  icon,
  isDark,
  isValue,
}) => {
  return (
    <div
      className={`rounded-lg p-4 border ${
        isDark
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p
            className={`text-sm font-medium ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {title}
          </p>
          <p
            className={`text-2xl font-bold mt-1 ${
              isDark ? 'text-white' : 'text-gray-900'
            } ${isValue ? 'text-lg' : ''}`}
          >
            {value}
          </p>
        </div>
        <div
          className={`p-3 rounded-lg ${
            isDark ? 'bg-gray-700' : 'bg-gray-100'
          } text-blue-600`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
};

interface DeleteConfirmationProps {
  onConfirm: () => void;
  onCancel: () => void;
  isDark: boolean;
}

const DeleteConfirmation: React.FC<DeleteConfirmationProps> = ({
  onConfirm,
  onCancel,
  isDark,
}) => {
  return (
    <div
      className={`mt-3 p-3 rounded border-l-4 border-red-500 ${
        isDark ? 'bg-red-900 bg-opacity-20' : 'bg-red-50'
      }`}
    >
      <p
        className={`text-sm mb-3 ${
          isDark ? 'text-red-300' : 'text-red-800'
        }`}
      >
        Are you sure you want to delete this document? This action cannot be
        undone.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-1 rounded transition-colors"
        >
          Delete
        </button>
        <button
          onClick={onCancel}
          className={`flex-1 ${
            isDark
              ? 'bg-gray-700 hover:bg-gray-600'
              : 'bg-gray-300 hover:bg-gray-400'
          } text-sm font-semibold py-1 rounded transition-colors`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const DeleteConfirmationTableCell: React.FC<DeleteConfirmationProps> = ({
  onConfirm,
  onCancel,
  isDark,
}) => {
  return (
    <div className={`flex items-center gap-2 p-2 rounded ${isDark ? 'bg-red-900/30' : 'bg-red-50'}`}>
      <span className={`text-xs ${isDark ? 'text-red-300' : 'text-red-700'}`}>Delete?</span>
      <button
        onClick={onConfirm}
        className={`px-2 ${
          isDark ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
        } text-xs font-semibold py-1 rounded transition-colors`}
      >
        Yes
      </button>
      <button
        onClick={onCancel}
        className={`px-2 ${
          isDark ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
        } text-xs font-semibold py-1 rounded transition-colors`}
      >
        Cancel
      </button>
    </div>
  );
};

export default DocumentList;

