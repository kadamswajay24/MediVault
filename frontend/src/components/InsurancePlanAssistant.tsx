import { useAiProvider } from '../hooks/useAiProvider';
import React, { useState } from 'react';
import { Bot, Loader2, Send, Sparkles } from 'lucide-react';
import { insuranceAPI } from '../services/api';
import type {
  InsurancePlanAssistantDraft,
  InsurancePlanAssistantMessage,
} from '../types';

interface InsurancePlanAssistantProps {
  onUseDraft: (draft: InsurancePlanAssistantDraft) => void;
}

const initialMessages: InsurancePlanAssistantMessage[] = [
  {
    role: 'assistant',
    content:
      'Tell me the kind of plan you want to create. I can help organize the plan name, description, example cover, monthly premium, and benefits you provide.',
  },
];

const getErrorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
  'Unable to reach the plan assistant. Please try again.';

export const InsurancePlanAssistant: React.FC<InsurancePlanAssistantProps> = ({
  onUseDraft,
}) => {
  const ai = useAiProvider();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState<InsurancePlanAssistantDraft | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || loading || !ai.ready) return;

    const conversation = [...messages, { role: 'user' as const, content }].slice(-12);
    setMessages(conversation);
    setInput('');
    setLoading(true);
    setError(null);
    try {
      const response = await insuranceAPI.chatWithPlanAssistant(conversation);
      setMessages((current) => [...current, { role: 'assistant', content: response.reply }]);
      setDraft(response.plan);
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const hasDraft = Boolean(
    draft &&
      (draft.name ||
        draft.description ||
        draft.coverageAmount !== null ||
        draft.monthlyPremium !== null ||
        draft.highlights.length)
  );

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">AI plan assistant</h4>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Describe your plan and I’ll help shape an editable draft.
          </p>
        </div>
      </div>

      <div
        className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-lg bg-white/80 p-3 dark:bg-slate-900/70"
        aria-live="polite"
        aria-label="Plan assistant conversation"
      >
        {messages.map((message, index) => (
          <div
            key={`${index}-${message.role}`}
            className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <Bot className="mt-1 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            )}
            <p
              className={`max-w-[88%] whitespace-pre-wrap rounded-lg px-3 py-2 text-xs leading-relaxed ${
                message.role === 'user'
                  ? 'bg-slate-800 text-white dark:bg-slate-700'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {message.content}
            </p>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-500" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Working on your draft...
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}

      {hasDraft && draft && (
        <button
          type="button"
          onClick={() => onUseDraft(draft)}
          className="mt-3 w-full rounded-lg border border-emerald-700 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
        >
          Use draft in plan form
        </button>
      )}

      <div className="mt-3 flex gap-2">
        <label htmlFor="plan-assistant-message" className="sr-only">
          Message the AI plan assistant
        </label>
        <input
          id="plan-assistant-message"
          value={input}
          maxLength={1200}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void sendMessage();
            }
          }}
          placeholder="Describe the plan you have in mind..."
          disabled={loading}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        <button
          type="button"
          onClick={() => void sendMessage()}
          disabled={loading || !input.trim() || !ai.ready}
          aria-label="Send message"
          className="inline-flex items-center justify-center rounded-lg bg-emerald-700 px-3 text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        {ai.disclosure('Your plan drafting conversation')} Verify all details; this is a demonstration draft,
        not a policy offer or compliance advice.
      </p>
    </section>
  );
};
