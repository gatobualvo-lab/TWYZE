import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, LifeBuoy, Mail, MessageCircle, RotateCcw, Send, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { LogoMark } from '../brand/Logo';
import Spinner from '../ui/Spinner';
import { useEntitlements } from '../../contexts/EntitlementsContext';
import { TIER_LABELS } from '../../services/subscription/entitlements';
import { describeRemaining, type Quota } from '../../services/subscription/aiLimits';
import { fetchAiQuota } from '../../services/subscription/aiUsageService';
import { askGuide, GuideError, submitGuideFeedback, type GuideMessage } from '../../services/helpAssistant/helpAssistantService';
import { buildSupportUrl, SUPPORT_WHATSAPP_URL } from '../../services/helpAssistant/supportLink';
import { submitSupportRequest } from '../../services/support/supportRequestService';
import { trackEvent } from '../../lib/analytics';

export { SUPPORT_WHATSAPP_URL };

const STORAGE_KEY = 'trackwyze_guide_chat';
const MAX_KEPT = 20;
const MAX_INPUT = 500;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pages?: string[];
  needsHuman?: boolean;
  isError?: boolean;
  /** The person's thumbs up or down on this answer. */
  rating?: 'up' | 'down';
}

const GENERIC_QUESTIONS = ['How do I record a sale?', 'How do I add my products?', 'What do I get on each plan?'];

/** One or two questions that fit the page the person is looking at. */
const QUESTIONS_BY_PAGE: Record<string, string[]> = {
  dashboard: ['What do the numbers on my dashboard mean?', 'How do I record a sale?'],
  'add-sale': ['How do I send a receipt on WhatsApp?', 'Can I record a sale without internet?'],
  'view-sales': ['How do I edit or find a sale?', 'How do I print a receipt?'],
  inventory: ['How do I add a new category?', 'How do I see which products sell best?'],
  clients: ['How do I add a customer?', 'Is there a limit on customers?'],
  'documents-invoices': ['How do I add a discount to an invoice?', 'How do I send an invoice on WhatsApp?'],
  'documents-quotations': ['How do I turn a quotation into an invoice?', 'How do I add a discount?'],
  'documents-settings': ['How do I add my logo?', 'How do I change my document colours?'],
  'general-expenses': ['How do I record an expense?', 'How do I see my total expenses?'],
  'payment-management': ['How does M-Pesa payment work?', 'What happens if I do not pay?'],
  notifications: ['How do I stop getting emails?', 'How do I turn off email reminders?'],
  team: ['How do I add a staff member?', 'What can staff see?'],
};

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function loadChat(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(m => m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'assistant')).slice(-MAX_KEPT) : [];
  } catch {
    return [];
  }
}

interface FloatingHelpProps {
  /** Goes to a page in the app. */
  onNavigate: (tab: string) => void;
  /** The page the person is on. */
  activeTab: string;
  /** The name of a page the person can open, or nothing if they cannot open it. */
  labelFor: (tab: string) => string | undefined;
  /** Hide the button while something else (the phone menu) is covering the screen. */
  hidden?: boolean;
  isPhone: boolean;
  /** Written into the message to the team, so they know who is asking. */
  userEmail?: string | null;
}

/**
 * The floating "Help" button and its chat. It answers questions about using TrackWyze, opens the right
 * page for the person, and offers the team on WhatsApp. It is separate from the AI Business Advisor,
 * which analyses the business's own numbers; this one never sees them.
 */
export default function FloatingHelp({ onNavigate, activeTab, labelFor, hidden = false, isPhone, userEmail }: FloatingHelpProps) {
  const { tier } = useEntitlements();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChat());
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportMessage, setReportMessage] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_KEPT)));
    } catch {
      // private mode: the chat just is not kept
    }
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // How many questions are left on this plan, looked up when the Guide opens.
  useEffect(() => {
    if (!open) return;
    let current = true;
    fetchAiQuota('guide', tier).then(q => { if (current && q) setQuota(q); }).catch(() => {});
    return () => { current = false; };
  }, [open, tier]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, sending, open]);

  const close = useCallback(() => {
    setOpen(false);
    setReporting(false);
  }, []);

  // When the panel closes, keyboard focus goes back to the button that opened it.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) buttonRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  // A phone's menu drawer sits over everything; the Guide steps aside while it is open.
  useEffect(() => {
    if (hidden) setOpen(false);
  }, [hidden]);

  const send = async (text: string) => {
    const question = text.replace(/\s+/g, ' ').trim().slice(0, MAX_INPUT);
    if (!question || sending) return;
    const next: ChatMessage[] = [...messages, { id: newId(), role: 'user', text: question }];
    setMessages(next);
    setInput('');
    setSending(true);
    trackEvent('guide_question_asked', { page: activeTab });

    const history: GuideMessage[] = next.filter(m => !m.isError).slice(-10).map(m => ({ role: m.role, content: m.text }));
    try {
      const answer = await askGuide(history, { tab: activeTab, tier });
      if (answer.quota) setQuota(answer.quota);
      setMessages(prev => [...prev, { id: newId(), role: 'assistant', text: answer.reply, pages: answer.pages, needsHuman: answer.needsHuman }]);
    } catch (error) {
      const message = error instanceof GuideError ? error.message : 'Something went wrong. Please try again, or talk to our team.';
      if (error instanceof GuideError && error.code === 'rate_limited') fetchAiQuota('guide', tier).then(q => q && setQuota(q)).catch(() => {});
      setMessages(prev => [...prev, { id: newId(), role: 'assistant', text: message, needsHuman: true, isError: true }]);
    } finally {
      setSending(false);
    }
  };

  const openPage = (id: string) => {
    onNavigate(id);
    if (isPhone) close();
  };

  /** What the person asked just before the answer at this position. */
  const questionBefore = (index: number) => {
    for (let i = index - 1; i >= 0; i--) if (messages[i].role === 'user') return messages[i].text;
    return '';
  };

  /** The WhatsApp link to the team, already telling them who is asking, on which page, about what. */
  const teamUrl = (index: number) =>
    buildSupportUrl({ email: userEmail, plan: TIER_LABELS[tier], page: labelFor(activeTab) ?? activeTab, question: questionBefore(index) });

  const rate = async (id: string, rating: 'up' | 'down') => {
    const index = messages.findIndex(m => m.id === id);
    const answer = messages[index];
    if (!answer || answer.rating) return;
    const setRating = (value?: 'up' | 'down') => setMessages(prev => prev.map(m => (m.id === id ? { ...m, rating: value } : m)));
    setRating(rating);
    trackEvent('guide_feedback', { page: activeTab, rating });
    try {
      await submitGuideFeedback({ rating, question: questionBefore(index), answer: answer.text, page: activeTab, tier });
    } catch {
      setRating(undefined);
      toast.error("Couldn't save your feedback. Please try again.");
    }
  };

  const startOver = () => {
    setMessages([]);
    setInput('');
    inputRef.current?.focus();
  };

  const openReport = (prefill: string) => {
    setReportMessage(prefill);
    setReportSent(false);
    setReporting(true);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = reportMessage.trim();
    if (!message || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      await submitSupportRequest({ message, page: labelFor(activeTab) ?? activeTab });
      trackEvent('support_request_submitted', { page: activeTab });
      setReportSent(true);
      setReportMessage('');
    } catch {
      toast.error("Couldn't send your report. Please try WhatsApp instead.");
    } finally {
      setReportSubmitting(false);
    }
  };

  if (hidden) return null;

  const suggestions = QUESTIONS_BY_PAGE[activeTab] ?? GENERIC_QUESTIONS;
  const advisorLabel = labelFor('advisor');

  const fabBottom = isPhone ? 'calc(env(safe-area-inset-bottom, 0px) + 84px)' : '24px';

  return (
    <>
      {!open && (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => { setOpen(true); trackEvent('guide_opened', { page: activeTab }); }}
          aria-label="Open the TrackWyze Guide: ask how to use the app"
          style={{ bottom: fabBottom }}
          className="fixed right-4 z-[45] print:hidden flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 h-14 text-white shadow-xl shadow-blue-900/25 hover:shadow-glow active:scale-95 transition-all"
        >
          <LifeBuoy className="w-6 h-6" aria-hidden="true" />
          <span className="hidden sm:inline text-sm font-bold">Help</span>
        </button>
      )}

      {open && (
        <>
          {isPhone && <div className="fixed inset-0 z-[46] bg-black/40 animate-fade-in print:hidden" onClick={close} aria-hidden="true" />}
          <section
            role="dialog"
            aria-label="TrackWyze Guide"
            aria-modal={isPhone ? true : undefined}
            className={`fixed z-[47] print:hidden flex flex-col bg-white shadow-2xl border border-gray-200 animate-scale-in ${
              isPhone
                ? 'inset-x-0 bottom-0 h-[85dvh] rounded-t-2xl'
                : 'right-6 bottom-6 w-[380px] h-[560px] max-h-[calc(100dvh-3rem)] rounded-2xl'
            }`}
            style={isPhone ? { paddingBottom: 'env(safe-area-inset-bottom, 0px)' } : undefined}
          >
            <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white rounded-t-2xl">
              <LogoMark variant="navy" className="w-9 h-9 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-base font-bold text-gray-900 leading-tight">
                  TrackWyze Guide <span className="ml-1 align-middle rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-800">AI</span>
                </h2>
                <p className="text-xs text-gray-500 truncate">AI assistant: ask how to use the app</p>
              </div>
              <button type="button" onClick={startOver} aria-label="Start a new chat" title="Start a new chat" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={close} aria-label="Close the Guide" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </header>

            {reporting ? (
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {reportSent ? (
                  <div className="rounded-2xl bg-green-50 border border-green-200 px-4 py-4 text-sm text-green-800">
                    <p className="font-semibold mb-1">Thanks — we've got it.</p>
                    <p>We'll get back to you by email. If it's urgent, you can also reach us on WhatsApp.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <a
                        href={SUPPORT_WHATSAPP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                      >
                        <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> WhatsApp us too
                      </a>
                      <button
                        type="button"
                        onClick={() => { setReporting(false); setReportSent(false); }}
                        className="text-xs font-semibold text-gray-600 hover:text-gray-800 underline"
                      >
                        Back to chat
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReport} className="space-y-3">
                    <div>
                      <label htmlFor="report-message" className="block text-sm font-semibold text-gray-800 mb-1">Report a problem</label>
                      <p className="text-xs text-gray-500 mb-2">Tell us what's wrong. We'll reply by email, usually within a day.</p>
                      <textarea
                        id="report-message"
                        rows={5}
                        autoFocus
                        value={reportMessage}
                        maxLength={1000}
                        onChange={(e) => setReportMessage(e.target.value)}
                        placeholder="What happened? What did you expect instead?"
                        className="w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={reportSubmitting || !reportMessage.trim()}
                      className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                    >
                      {reportSubmitting ? <Spinner className="w-4 h-4" tone="light" /> : <Send className="w-4 h-4" aria-hidden="true" />}
                      {reportSubmitting ? 'Sending…' : 'Send report'}
                    </button>
                    <div className="flex items-center justify-between">
                      <button type="button" onClick={() => setReporting(false)} className="text-xs text-gray-500 hover:text-gray-700">
                        Back to chat
                      </button>
                      <a
                        href={SUPPORT_WHATSAPP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-800"
                      >
                        <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> Or WhatsApp us
                      </a>
                    </div>
                  </form>
                )}
              </div>
            ) : (
            <>
            <div ref={logRef} role="log" aria-live="polite" className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3 text-sm text-gray-800">
                <p>Hi! I'm the TrackWyze Guide. I can show you how to use the app, find the right page, and explain plans and payments.</p>
                <p className="mt-2 text-gray-600">
                  I can't see your sales or stock. For questions about how your business is doing,{' '}
                  {advisorLabel ? (
                    <button type="button" onClick={() => openPage('advisor')} className="font-semibold text-blue-700 underline">ask the Business Advisor</button>
                  ) : (
                    'the Business Advisor (Business plan) can help'
                  )}
                  .
                </p>
                <p className="mt-2 text-xs text-gray-500">I'm an AI, so I can make mistakes. For payments or account problems, please talk to our team.</p>
              </div>

              {messages.length === 0 && (
                <div className="flex flex-wrap gap-2" aria-label="Suggested questions">
                  {suggestions.map(q => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => send(q)}
                      disabled={sending}
                      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-left text-xs font-medium text-blue-800 hover:bg-blue-100"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((m, index) =>
                m.role === 'user' ? (
                  <div key={m.id} className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-sm text-white whitespace-pre-wrap break-words">{m.text}</p>
                  </div>
                ) : (
                  <div key={m.id} className="flex flex-col items-start gap-2">
                    <p className={`max-w-[90%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm whitespace-pre-wrap break-words ${m.isError ? 'bg-red-50 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                      {m.text}
                    </p>
                    {(m.pages ?? []).map(id => {
                      const label = labelFor(id);
                      if (!label) return null;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => openPage(id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          Open {label} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      );
                    })}
                    {(m.needsHuman || m.rating === 'down') && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openReport(questionBefore(index))}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          <Mail className="w-3.5 h-3.5" aria-hidden="true" /> Report a problem
                        </button>
                        <a
                          href={teamUrl(index)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-white px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50"
                        >
                          <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> WhatsApp
                        </a>
                      </div>
                    )}
                    {!m.isError && (
                      <div className="flex items-center gap-1 text-xs text-gray-500" role="group" aria-label="Rate this answer">
                        {m.rating ? (
                          <span role="status">{m.rating === 'up' ? 'Thanks for the feedback.' : 'Sorry about that. Our team can help.'}</span>
                        ) : (
                          <>
                            <span className="mr-1">Was this helpful?</span>
                            <button type="button" onClick={() => rate(m.id, 'up')} aria-label="Yes, this was helpful" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg p-2 hover:bg-gray-100 hover:text-green-700">
                              <ThumbsUp className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button type="button" onClick={() => rate(m.id, 'down')} aria-label="No, this was not helpful" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg p-2 hover:bg-gray-100 hover:text-red-700">
                              <ThumbsDown className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              )}

              {sending && (
                <div className="flex items-center gap-2 text-sm text-gray-500" role="status">
                  <Spinner className="w-4 h-4" tone="brand" /> Thinking…
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="border-t border-gray-100 px-3 pt-3 pb-2"
            >
              <div className="flex items-end gap-2">
                <label htmlFor="guide-input" className="sr-only">Ask the Guide a question</label>
                <textarea
                  id="guide-input"
                  ref={inputRef}
                  rows={1}
                  value={input}
                  maxLength={MAX_INPUT}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder="Ask how to do something…"
                  className="flex-1 resize-none rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 max-h-28"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  aria-label="Send"
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
              {quota && (
                <p className={`mt-2 text-xs font-medium ${quota.remaining === 0 ? 'text-amber-700' : 'text-gray-600'}`} role="status">
                  {describeRemaining(quota)}
                  {quota.remaining <= 2 && tier !== 'business' && (
                    <>
                      {' · '}
                      <button type="button" onClick={() => openPage('payment-management')} className="font-semibold text-blue-700 underline">See plans</button>
                    </>
                  )}
                </p>
              )}
              <p className="mt-2 text-[11px] leading-snug text-gray-500">
                AI can make mistakes. Never share your password or M-Pesa PIN.{' '}
                <button type="button" onClick={() => openReport(questionBefore(messages.length))} className="font-semibold text-blue-700 underline">Report a problem</button>
                {' '}or{' '}
                <a href={teamUrl(messages.length)} target="_blank" rel="noopener noreferrer" className="font-semibold text-green-700 underline">WhatsApp us</a>
              </p>
            </form>
            </>
            )}
          </section>
        </>
      )}
    </>
  );
}
