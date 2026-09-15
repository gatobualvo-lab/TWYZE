import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Search, MessageCircle } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  title: string;
  items: FaqItem[];
}

const CATEGORIES: FaqCategory[] = [
  {
    title: 'Getting started',
    items: [
      {
        question: 'How do I record my first sale?',
        answer: 'Go to Sales → Add Sale. You can add one or several products to a single sale, set the buying price (what you paid), selling price (what the customer pays), and vendor. TrackWyze calculates your profit automatically.',
      },
      {
        question: 'What\'s the difference between a "sale" and a "supplier sale"?',
        answer: 'A regular sale is a transaction where you sell directly to a customer. Supplier sales (under Suppliers) are for tracking when you sell on behalf of, or supply to, another business.',
      },
      {
        question: 'Do I need to add my inventory before I can sell it?',
        answer: 'No — you can record sales without pre-loading inventory. Adding products to Inventory first lets TrackWyze track stock levels and warn you before you run out (Smart Inventory Predictions).',
      },
    ],
  },
  {
    title: 'Sales, expenses & profit',
    items: [
      {
        question: 'Why does my profit look different from what I expected?',
        answer: 'Profit = selling price − buying price − any taxes, minus delivery fees you paid (delivery charges you billed to the customer are added back). Check Profit Analytics for a full breakdown by product, customer, or vendor.',
      },
      {
        question: 'What\'s the difference between Ad Expenses, Vendor Expenses, and General Expenses?',
        answer: 'Ad Expenses are marketing/advertising spend. Vendor Expenses are payments you\'ve made to a supplier (reducing what you owe them). General Expenses covers everything else — rent, salaries, utilities, etc.',
      },
      {
        question: 'Can I set up expenses that repeat automatically?',
        answer: 'Yes — Recurring Expenses lets you set up something like monthly rent once, and TrackWyze generates the actual expense entry automatically each time it comes due.',
      },
    ],
  },
  {
    title: 'Customers & vendors',
    items: [
      {
        question: 'How do I see a customer\'s full purchase history?',
        answer: 'Go to Customer Timeline and search for their name — it shows every sale, quotation, invoice, and receipt tied to them, newest first.',
      },
      {
        question: 'How do I know how much I owe a vendor?',
        answer: 'Open Vendor Transactions and expand the vendor — it shows unpaid purchases, total expenses (payments you\'ve made to them), and the net amount owed. You can also generate a printable Vendor Statement from there.',
      },
      {
        question: 'What happens if a customer or vendor name is entered slightly differently each time?',
        answer: 'TrackWyze matches by exact name text, so try to use the same spelling consistently — the dropdown/autocomplete on the sale form helps with this by suggesting names you\'ve already used.',
      },
    ],
  },
  {
    title: 'Documents (quotations, invoices, receipts)',
    items: [
      {
        question: 'What\'s the difference between a quotation and an invoice?',
        answer: 'A quotation is a price estimate you send before a sale is confirmed. An invoice is a request for payment for a confirmed sale. A receipt confirms payment has been received. You can convert a quotation into an invoice once the customer accepts.',
      },
      {
        question: 'Can I customize how my documents look?',
        answer: 'Yes — under Documents → Doc Settings you can set your business logo, address, payment instructions, bank details, and footer text for quotations/invoices/receipts.',
      },
      {
        question: 'How do I share an invoice with a customer?',
        answer: 'Open the document and use Print/Save PDF (opens your browser\'s print dialog — choose "Save as PDF") or Share on WhatsApp, which opens WhatsApp with a formatted summary ready to send.',
      },
    ],
  },
  {
    title: 'Team & permissions',
    items: [
      {
        question: 'Can I give my staff access to TrackWyze?',
        answer: 'Yes — under Team, invite a staff member by email and choose which sections they can access (Sales, Suppliers, Expenses, Documents, Customers, Inventory). You can also hide buying prices/profit figures from staff and restrict them to only see records they personally entered.',
      },
      {
        question: 'Can staff delete records?',
        answer: 'No — deleting is always restricted to the account owner, regardless of what other permissions a staff member has.',
      },
    ],
  },
  {
    title: 'Billing & subscription',
    items: [
      {
        question: 'What happens when my free trial ends?',
        answer: 'You\'ll be prompted to choose a paid plan. Your data is never deleted — if you don\'t renew, your account moves to a grace period and eventually a view-only mode, but everything you\'ve recorded stays safe and visible.',
      },
      {
        question: 'How do I pay for my subscription?',
        answer: 'Go to Manage Subscription → Pay Now for instant M-Pesa or card payment, or submit proof of a manual bank/M-Pesa transfer for our team to confirm.',
      },
      {
        question: 'What happens if my subscription lapses?',
        answer: 'You get a grace period (a few days) with full access and a renewal reminder. After that, your account moves to view-only mode — you can see all your existing data, but adding new sales/expenses/etc. is paused until you renew. Renewing restores full access immediately.',
      },
    ],
  },
  {
    title: 'AI Business Assistant',
    items: [
      {
        question: 'What is the AI Business Assistant?',
        answer: 'A chat-based assistant (available on the Business Advisor page, on eligible paid plans) that answers questions about your real business data — "why did my profit decrease?", "which customers should I follow up with?" — grounded in your actual TrackWyze numbers, not generic advice.',
      },
      {
        question: 'Does the AI Assistant see all my data?',
        answer: 'No — only the specific data relevant to your question is sent for that one request. It never has open-ended access to your database.',
      },
    ],
  },
];

const HelpCenter: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredCategories = CATEGORIES.map(category => ({
    ...category,
    items: category.items.filter(
      item =>
        !normalizedQuery ||
        item.question.toLowerCase().includes(normalizedQuery) ||
        item.answer.toLowerCase().includes(normalizedQuery)
    ),
  })).filter(category => category.items.length > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <button
          onClick={() => navigate('/landing')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to TrackWyze
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Help Center</h1>
        <p className="text-gray-500 mb-6">Answers to common questions about using TrackWyze.</p>

        <div className="relative mb-8">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a topic..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {filteredCategories.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500">
            No matching results — try a different search, or reach out on WhatsApp below.
          </div>
        ) : (
          <div className="space-y-8">
            {filteredCategories.map(category => (
              <div key={category.title}>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{category.title}</h2>
                <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                  {category.items.map(item => {
                    const key = `${category.title}:${item.question}`;
                    const isOpen = openKey === key;
                    return (
                      <div key={key}>
                        <button
                          onClick={() => setOpenKey(isOpen ? null : key)}
                          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                        >
                          <span className="font-medium text-gray-800 text-sm">{item.question}</span>
                          <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed animate-fadeIn">
                            {item.answer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <a
          href="https://wa.me/0113476311"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-10 flex items-center justify-center gap-2 px-5 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors"
        >
          <MessageCircle className="w-4 h-4" /> Still stuck? Chat with us on WhatsApp
        </a>
      </div>
    </div>
  );
};

export default HelpCenter;
