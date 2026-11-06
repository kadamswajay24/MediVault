import React, { useState } from 'react';
import axios from 'axios';
import { AlertCircle, Loader2, Sparkles, X } from 'lucide-react';
import type { MedicalRecord, MedicalRecordSummary } from '../types';
import { recordAPI } from '../services/api';

interface RecordSummaryModalProps {
  record: MedicalRecord | null;
  audience?: 'patient' | 'clinician';
  onClose: () => void;
}

export const RecordSummaryModal: React.FC<RecordSummaryModalProps> = ({
  record,
  audience = 'patient',
  onClose,
}) => {
  const [summary, setSummary] = useState<MedicalRecordSummary | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!record) return null;

  const closeModal = () => {
    setSummary(null);
    setModel(null);
    setError(null);
    onClose();
  };

  const generateSummary = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);
    setModel(null);

    try {
      const response = await recordAPI.getRecordSummary(record._id);
      setSummary(response.summary);
      setModel(response.model);
    } catch (requestError: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data?.message
        : undefined;
      setError(message || 'Unable to generate a local AI summary.');
    } finally {
      setLoading(false);
    }
  };

  const sections: Array<{ title: string; items: string[] }> = summary
    ? [
        { title: 'Key findings', items: summary.keyFindings },
        { title: 'Medicines mentioned', items: summary.medicationMentions },
        { title: 'Dates and values', items: summary.datesAndValues },
        {
          title: audience === 'clinician' ? 'Points to verify' : 'Questions for your doctor',
          items: summary.questionsForDoctor,
        },
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-summary-title"
    >
      <div className="surface-card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 shadow-2xl dark:border-slate-800">
        <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-1 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" />
            <div>
              <h2 id="record-summary-title" className="text-lg font-bold">
                Local AI document summary
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {record.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close summary"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100">
            Text is extracted locally from this PDF or image and processed by the
            configured local Ollama instance. It is not sent to an external AI
            service, and the English summary is not saved. Please verify important
            details with your healthcare professional.
          </div>
          {record.metadata?.identityCheck?.status !== 'matched' && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              {record.metadata?.identityCheck?.status === 'not_checked'
                ? 'No automated identity check was run. Review the original report manually; this check cannot determine whether a document is authentic.'
                : 'Patient details were not confirmed by the automated consistency check. Review the original report manually; this check cannot determine whether a document is authentic.'}
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={generateSummary}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading ? 'Generating locally...' : 'Generate summary'}
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {summary && (
            <div className="space-y-4" aria-live="polite">
              <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="text-sm font-bold">In plain language</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">
                  {summary.summary}
                </p>
              </section>

              {sections.map(
                ({ title, items }) =>
                  items.length > 0 && (
                    <section
                      key={title}
                      className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                    >
                      <h3 className="text-sm font-bold">{title}</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
                        {items.map((item, index) => (
                          <li key={`${title}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  )
              )}
              {model && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Generated locally with {model}.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 p-4 dark:border-slate-800">
          <button
            type="button"
            onClick={closeModal}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
