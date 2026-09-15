import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

const LegalPageLayout: React.FC<{ title: string; lastUpdated: string; children: React.ReactNode }> = ({ title, lastUpdated, children }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <button
          onClick={() => navigate('/landing')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to TrackWyze
        </button>

        <div className="flex items-start gap-3 mb-6 p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>
            <strong>Draft document.</strong> This is a starting point generated for TrackWyze, not a document reviewed by a lawyer.
            Fields in <span className="font-mono bg-amber-100 px-1 rounded">[brackets]</span> need to be filled in with your
            actual business/legal details, and the whole document should be reviewed by a qualified lawyer before you rely on it or publish it.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-10">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-400 mt-1 mb-8">Last updated: {lastUpdated}</p>
          <div className="prose prose-sm max-w-none text-gray-700 space-y-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:mt-8 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-blue-600 [&_a]:hover:underline">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalPageLayout;
