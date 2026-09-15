import React, { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, MessageSquare, Plus, History, Trash2, ChevronRight, AlertCircle, Lightbulb, TrendingUp, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, Button, Skeleton, EmptyState } from '../ui';
import {
  sendChatMessage,
  listConversations,
  fetchConversationMessages,
  deleteConversation,
  AssistantRequestError,
  type AssistantMessage,
  type ConversationSummary,
  type StoredMessage,
} from '../../services/aiAssistant/aiAssistantService';

const SUGGESTED_QUESTIONS = [
  'How is my business performing?',
  'Why did my profit decrease this month?',
  'Which customers should I follow up with?',
  'What stock should I reorder?',
  'Give me marketing ideas based on my actual business performance.',
];

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  structured: Omit<AssistantMessage, 'id'> | null;
  pending?: boolean;
  failed?: boolean;
}

function toChatTurn(m: StoredMessage): ChatTurn {
  return { id: m.id, role: m.role, content: m.content, structured: m.structuredResponse };
}

const AnswerSection: React.FC<{ title: string; icon: React.ComponentType<{ className?: string }>; items: string[]; tone: string }> = ({ title, icon: Icon, items, tone }) => {
  if (items.length === 0) return null;
  return (
    <div className="mt-2.5">
      <p className={`text-xs font-semibold flex items-center gap-1 ${tone}`}>
        <Icon className="w-3.5 h-3.5" /> {title}
      </p>
      <ul className="mt-1 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-gray-600 pl-4 relative before:content-['•'] before:absolute before:left-0.5 before:text-gray-300">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};

const AIChatPanel: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listConversations()
      .then(setConversations)
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  const openConversation = async (id: string) => {
    setShowHistory(false);
    setActiveConversationId(id);
    try {
      const messages = await fetchConversationMessages(id);
      setTurns(messages.map(toChatTurn));
    } catch {
      toast.error('Could not load that conversation');
    }
  };

  const startNewChat = () => {
    setShowHistory(false);
    setActiveConversationId(null);
    setTurns([]);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversationId === id) startNewChat();
      toast.success('Conversation deleted');
    } catch {
      toast.error('Could not delete conversation');
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userTurn: ChatTurn = { id: `pending-user-${Date.now()}`, role: 'user', content: trimmed, structured: null };
    const pendingTurn: ChatTurn = { id: `pending-assistant-${Date.now()}`, role: 'assistant', content: '', structured: null, pending: true };
    setTurns(prev => [...prev, userTurn, pendingTurn]);
    setInput('');
    setSending(true);

    try {
      const result = await sendChatMessage(activeConversationId, trimmed);
      setTurns(prev => prev.slice(0, -1).concat({
        id: result.message.id,
        role: 'assistant',
        content: result.message.answer,
        structured: result.message,
      }));

      if (!activeConversationId) {
        setActiveConversationId(result.conversationId);
        setConversations(prev => [{ id: result.conversationId, title: trimmed.slice(0, 80), updatedAt: new Date().toISOString() }, ...prev]);
      } else {
        setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, updatedAt: new Date().toISOString() } : c));
      }
    } catch (err) {
      const message = err instanceof AssistantRequestError ? err.message : 'Something went wrong sending that message.';
      setTurns(prev => prev.slice(0, -1).concat({
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: message,
        structured: null,
        failed: true,
      }));
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const lastAssistantTurn = [...turns].reverse().find(t => t.role === 'assistant' && !t.pending);

  return (
    <Card padding="none" className="flex flex-col overflow-hidden" style={{ height: '560px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-100">
            <Sparkles className="w-4 h-4 text-purple-600" />
          </div>
          <p className="font-semibold text-gray-800 text-sm">Ask TrackWyze</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHistory(v => !v)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Conversation history"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={startNewChat}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="New conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* History dropdown */}
      {showHistory && (
        <div className="border-b border-gray-100 max-h-48 overflow-y-auto flex-shrink-0 animate-slide-up">
          {loadingHistory ? (
            <div className="p-3 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No conversations yet</p>
          ) : (
            conversations.map(c => (
              <button
                key={c.id}
                onClick={() => openConversation(c.id)}
                className={`w-full flex items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${c.id === activeConversationId ? 'bg-purple-50' : ''}`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="truncate text-gray-700">{c.title}</span>
                </span>
                <Trash2
                  className="w-3.5 h-3.5 text-gray-300 hover:text-red-500 flex-shrink-0"
                  onClick={(e) => handleDelete(c.id, e)}
                />
              </button>
            ))
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {turns.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Ask about your business"
            description="Get answers grounded in your real TrackWyze data — sales, profit, customers, inventory, and more."
            className="border-0 shadow-none py-8"
          />
        ) : (
          turns.map(turn => (
            <div key={turn.id} className={turn.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={
                turn.role === 'user'
                  ? 'max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5'
                  : turn.failed
                    ? 'max-w-[90%] bg-red-50 border border-red-100 rounded-2xl rounded-bl-sm px-4 py-3'
                    : 'max-w-[90%] bg-gray-50 rounded-2xl rounded-bl-sm px-4 py-3'
              }>
                {turn.pending ? (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                ) : turn.role === 'user' ? (
                  <p className="text-sm">{turn.content}</p>
                ) : turn.failed ? (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-red-700">{turn.content}</p>
                      <button
                        onClick={() => send(turns[turns.indexOf(turn) - 1]?.content ?? '')}
                        className="mt-1.5 text-xs font-medium text-red-700 hover:text-red-900 underline"
                      >
                        Try again
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-800">{turn.content}</p>
                    {turn.structured && (
                      <>
                        <AnswerSection title="From your data" icon={Target} items={turn.structured.facts} tone="text-gray-500" />
                        <AnswerSection title="Calculated" icon={TrendingUp} items={turn.structured.calculatedInsights} tone="text-blue-500" />
                        <AnswerSection title="Prediction" icon={AlertCircle} items={turn.structured.predictions} tone="text-amber-500" />
                        <AnswerSection title="Recommended" icon={Lightbulb} items={turn.structured.recommendations} tone="text-green-600" />
                        {turn.structured.confidenceNote && (
                          <p className="mt-2.5 text-xs text-gray-400 italic bg-white rounded-lg px-2.5 py-1.5 border border-gray-100">
                            {turn.structured.confidenceNote}
                          </p>
                        )}
                        {turn.structured.actionTab && onNavigate && (
                          <button
                            onClick={() => onNavigate(turn.structured!.actionTab!)}
                            className="group flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 mt-2.5"
                          >
                            View details <ChevronRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => send(q)}
                className="px-3 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-full border border-gray-200 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {lastAssistantTurn?.structured?.followUpQuestions && lastAssistantTurn.structured.followUpQuestions.length > 0 && !sending && (
          <div className="flex flex-wrap gap-2">
            {lastAssistantTurn.structured.followUpQuestions.map(q => (
              <button
                key={q}
                onClick={() => send(q)}
                className="px-3 py-1.5 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-full border border-purple-100 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-3 flex-shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            placeholder="Ask about your business..."
            className="flex-1 px-3.5 py-2 text-sm border border-gray-200 rounded-full focus:ring-2 focus:ring-purple-400 focus:border-transparent disabled:bg-gray-50"
          />
          <Button type="submit" size="sm" disabled={sending || !input.trim()} loading={sending} icon={Send} className="!rounded-full !p-2.5" aria-label="Send">
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>
    </Card>
  );
};

export default AIChatPanel;
