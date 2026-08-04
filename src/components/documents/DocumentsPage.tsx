import React, { useState } from 'react';
import { FileText, FilePlus, Receipt, ClipboardList, Settings, ArrowLeft } from 'lucide-react';
import DocumentList from './DocumentList';
import DocumentForm from './DocumentForm';
import DocumentPreview from './DocumentPreview';
import BusinessSettings from './BusinessSettings';
import { useTheme } from '../../contexts/ThemeContext';

type DocumentView = 'list' | 'create' | 'edit' | 'preview' | 'settings';
type DocumentType = 'quotation' | 'invoice' | 'receipt';

interface DocumentsPageProps {
  initialTab?: DocumentType | 'settings';
}

const DocumentsPage: React.FC<DocumentsPageProps> = ({ initialTab }) => {
  const { theme } = useTheme();
  const [activeDocType, setActiveDocType] = useState<DocumentType>(
    initialTab && initialTab !== 'settings' ? initialTab : 'invoice'
  );
  const [view, setView] = useState<DocumentView>(initialTab === 'settings' ? 'settings' : 'list');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const tabs: { key: DocumentType; label: string; icon: React.ReactNode }[] = [
    { key: 'quotation', label: 'Quotations', icon: <ClipboardList className="w-4 h-4" /> },
    { key: 'invoice', label: 'Invoices', icon: <FileText className="w-4 h-4" /> },
    { key: 'receipt', label: 'Receipts', icon: <Receipt className="w-4 h-4" /> },
  ];

  const handleTabChange = (type: DocumentType) => {
    setActiveDocType(type);
    setView('list');
    setSelectedDocId(null);
  };

  const handleCreateNew = () => setView('create');

  const handleView = (id: string) => {
    setSelectedDocId(id);
    setView('preview');
  };

  const handleEdit = (id: string) => {
    setSelectedDocId(id);
    setView('edit');
  };

  const handleSaved = () => {
    setView('list');
    setSelectedDocId(null);
  };

  const handleCancel = () => {
    setView('list');
    setSelectedDocId(null);
  };

  if (view === 'settings') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setView('list')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Documents
        </button>
        <BusinessSettings />
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="space-y-4">
        <button
          onClick={handleCancel}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {activeDocType === 'quotation' ? 'Quotations' : activeDocType === 'invoice' ? 'Invoices' : 'Receipts'}
        </button>
        <DocumentForm
          documentType={activeDocType}
          onSave={handleSaved}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  if (view === 'edit' && selectedDocId) {
    return (
      <div className="space-y-4">
        <button
          onClick={handleCancel}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to List
        </button>
        <DocumentForm
          documentType={activeDocType}
          existingDocumentId={selectedDocId}
          onSave={handleSaved}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  if (view === 'preview' && selectedDocId) {
    return (
      <DocumentPreview
        documentId={selectedDocId}
        onClose={handleCancel}
        onEdit={() => handleEdit(selectedDocId)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className={`rounded-xl shadow-sm border p-1 inline-flex gap-1 ${
        theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
      }`}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeDocType === tab.key
                ? 'bg-blue-600 text-white shadow-sm'
                : theme === 'dark'
                  ? 'text-gray-300 hover:bg-slate-700'
                  : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        <button
          onClick={() => setView('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            theme === 'dark' ? 'text-gray-300 hover:bg-slate-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>

      {/* Document List */}
      <DocumentList
        documentType={activeDocType}
        onCreateNew={handleCreateNew}
        onView={handleView}
        onEdit={handleEdit}
      />
    </div>
  );
};

export default DocumentsPage;
