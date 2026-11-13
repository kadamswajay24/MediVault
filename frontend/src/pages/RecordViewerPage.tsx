import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { recordAPI } from '../services/api';
import type { MedicalRecord } from '../types';
import { formatFileSize } from '../utils/formatFileSize';

const ACCESS_RECHECK_INTERVAL_MS = 10_000;

type ViewerState =
  | { key: string; status: 'ready'; record: MedicalRecord; previewUrl?: string; accessError?: string }
  | { key: string; status: 'error'; message: string };

const getRequestErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

export const RecordViewerPage: React.FC = () => {
  const { recordId = '' } = useParams<{ recordId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [viewerState, setViewerState] = useState<ViewerState | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const requestKey = `${recordId}:${retryCount}`;
  const currentState = viewerState?.key === requestKey ? viewerState : null;

  const returnTo =
    typeof location.state?.from === 'string' &&
    location.state.from.startsWith('/') &&
    !location.state.from.startsWith('//')
      ? location.state.from
      : '/records';

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    let accessTimer: number | null = null;
    let checkingAccess = false;

    const clearPreview = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    const recheckAccess = async () => {
      if (checkingAccess) return;
      checkingAccess = true;
      try {
        await recordAPI.checkRecordAccess(recordId);
      } catch {
        if (!active) return;
        if (accessTimer !== null) window.clearInterval(accessTimer);
        accessTimer = null;
        clearPreview();
        setViewerState((previous) =>
          previous?.key === requestKey && previous.status === 'ready'
            ? {
                ...previous,
                previewUrl: undefined,
                accessError:
                  'Access could not be confirmed, so this preview was cleared. Return to your records and reopen it if you still have access.',
              }
            : previous
        );
      } finally {
        checkingAccess = false;
      }
    };

    const loadRecord = async () => {
      try {
        const response = await recordAPI.getRecordById(recordId);
        if (!active) return;

        const isSupported =
          response.record.fileType === 'application/pdf' ||
          response.record.fileType.startsWith('image/');
        if (!isSupported) {
          setViewerState({
            key: requestKey,
            status: 'ready',
            record: response.record,
          });
          return;
        }

        const file = await recordAPI.getRecordFile(recordId);
        if (!active) return;
        const previewFile =
          file.type === response.record.fileType
            ? file
            : new Blob([file], { type: response.record.fileType });
        objectUrl = URL.createObjectURL(previewFile);
        setViewerState({
          key: requestKey,
          status: 'ready',
          record: response.record,
          previewUrl: objectUrl,
        });
        accessTimer = window.setInterval(
          () => void recheckAccess(),
          ACCESS_RECHECK_INTERVAL_MS
        );
        document.addEventListener('visibilitychange', handleVisibilityChange);
      } catch (requestError: unknown) {
        if (active) {
          setViewerState({
            key: requestKey,
            status: 'error',
            message: getRequestErrorMessage(
              requestError,
              'Unable to load this protected record.'
            ),
          });
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void recheckAccess();
    };

    void loadRecord();

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (accessTimer !== null) window.clearInterval(accessTimer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [recordId, requestKey]);

  const loading = !currentState;
  const error =
    currentState?.status === 'error'
      ? currentState.message
      : currentState?.status === 'ready'
        ? currentState.accessError || null
        : null;
  const record =
    currentState?.status === 'ready' ? currentState.record : null;
  const previewUrl =
    currentState?.status === 'ready' ? currentState.previewUrl || null : null;
  const isPdf = record?.fileType === 'application/pdf';
  const isImage = record?.fileType.startsWith('image/');

  const handleBack = () => navigate(returnTo, { replace: true });

  return (
    <main className="flex h-screen min-h-[480px] flex-col overflow-hidden bg-slate-950 text-white">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-900 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold sm:text-base">
              {record?.title || 'Medical record'}
            </h1>
            <p className="truncate text-xs text-slate-400">
              {record?.fileName || 'Protected document preview'}
            </p>
          </div>
        </div>
        {record && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <FileText className="h-4 w-4" />
            <span>{formatFileSize(record.fileSize)}</span>
          </div>
        )}
      </header>

      <section className="flex min-h-0 flex-1 flex-col p-3 sm:p-5">
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-emerald-900/70 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-100">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This protected preview stays inside MediVault and access is checked
            every 10 seconds. Copies already saved or captured cannot be
            recalled.
          </p>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-slate-300">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <p className="text-sm">Loading protected document...</p>
            </div>
          ) : error ? (
            <div role="alert" className="mx-auto max-w-xl px-6 text-center">
              <FileText className="mx-auto h-10 w-10 text-amber-400" />
              <h2 className="mt-3 text-base font-semibold">Preview unavailable</h2>
              <p className="mt-2 text-sm text-slate-300">{error}</p>
              <div className="mt-5 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setRetryCount((count) => count + 1)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={handleBack}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                >
                  Back to records
                </button>
              </div>
            </div>
          ) : record && isPdf && previewUrl ? (
            <iframe
              src={previewUrl}
              title={`Preview of ${record.fileName}`}
              className="h-full min-h-0 w-full bg-white"
            />
          ) : record && isImage && previewUrl ? (
            <img
              src={previewUrl}
              alt={record.title}
              className="max-h-full max-w-full object-contain"
            />
          ) : record ? (
            <div className="px-6 text-center">
              <FileText className="mx-auto h-10 w-10 text-slate-500" />
              <h2 className="mt-3 text-base font-semibold">Preview not supported</h2>
              <p className="mt-2 text-sm text-slate-400">
                This file type ({record.fileType}) cannot be displayed in the
                viewer.
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
};
