import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  X,
  Download,
  Trash2,
  Calendar,
  FileText,
  Maximize2,
} from 'lucide-react';
import type { MedicalRecord } from '../types';
import { recordAPI } from '../services/api';
import { formatFileSize } from '../utils/formatFileSize';

interface RecordViewerModalProps {
  record: MedicalRecord | null;
  isOpen?: boolean;
  allowDelete?: boolean;
  onClose: () => void;
  onDeleteSuccess?: (recordId: string) => void;
}

export const RecordViewerModal: React.FC<RecordViewerModalProps> = ({
  record,
  isOpen = true,
  allowDelete = true,
  onClose,
  onDeleteSuccess,
}) => {
  const location = useLocation();
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ recordId: string; url: string } | null>(null);
  const [previewError, setPreviewError] = useState<{ recordId: string; message: string } | null>(null);
  const [imageExpanded, setImageExpanded] = useState(false);
  const recordId = record?._id;

  useEffect(() => {
    if (!recordId || !isOpen) return;

    let active = true;
    let objectUrl: string | null = null;
    let accessTimer: number | null = null;
    let checkingAccess = false;

    const clearPreview = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      setPreview(null);
      setPreviewError({
        recordId,
        message:
          'Access could not be confirmed, so this preview was cleared. Reopen the record if you still have access.',
      });
    };

    const checkAccess = async () => {
      if (checkingAccess) return;
      checkingAccess = true;
      try {
        await recordAPI.checkRecordAccess(recordId);
      } catch {
        if (!active) return;
        if (accessTimer !== null) window.clearInterval(accessTimer);
        accessTimer = null;
        clearPreview();
      } finally {
        checkingAccess = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkAccess();
    };

    recordAPI
      .getRecordFile(recordId)
      .then((file) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(file);
        setPreview({ recordId, url: objectUrl });
        accessTimer = window.setInterval(checkAccess, 10_000);
        document.addEventListener('visibilitychange', handleVisibilityChange);
      })
      .catch((requestError: any) => {
        if (active) {
          setPreviewError({
            recordId,
            message: requestError.response?.data?.message || 'Unable to load this protected record.',
          });
        }
      });

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (accessTimer !== null) window.clearInterval(accessTimer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [recordId, isOpen]);

  if (!record || !isOpen) return null;

  const previewUrl = preview?.recordId === record._id ? preview.url : null;
  const shownError =
    error || (previewError?.recordId === record._id ? previewError.message : null);
  const isImage = record.fileType.startsWith('image/');
  const isPdf = record.fileType === 'application/pdf';

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      const response = await recordAPI.deleteRecord(record._id);
      if (response.success) {
        onDeleteSuccess?.(record._id);
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete record.');
      setDeleting(false);
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Laboratory Report':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'Prescription':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'Vaccination':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'Medical History':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'Medication':
        return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
      default:
        return 'bg-slate-200 dark:bg-slate-700/30 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700/50';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl max-w-6xl w-full p-4 sm:p-6 shadow-2xl relative max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-1 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${getCategoryColor(
                  record.category
                )}`}
              >
                {record.category}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(record.recordDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{record.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {shownError && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-300 text-sm">
            {shownError}
          </div>
        )}

        {/* Content Body */}
        <div className="py-4 space-y-4 overflow-y-auto flex-1">
          {record.metadata?.identityCheck && (
            <div
              role="status"
              className={`rounded-xl border p-3 text-sm ${
                record.metadata.identityCheck.status === 'matched'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200'
                  : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200'
              }`}
            >
              <p className="font-semibold">
                {record.metadata.identityCheck.status === 'matched'
                  ? 'Patient details appear to match'
                  : record.metadata.identityCheck.status === 'needs_review'
                    ? 'Patient identity needs review'
                    : record.metadata.identityCheck.status === 'not_checked'
                      ? 'Automated identity check not run'
                    : 'Patient identity could not be verified'}
              </p>
              <p className="mt-1 text-xs">{record.metadata.identityCheck.message}</p>
              <p className="mt-1 text-xs">
                OCR matching is not proof that a document is authentic.
              </p>
            </div>
          )}

          {/* Document Preview Box */}
          <div className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 flex flex-col items-center justify-center ${isPdf ? 'min-h-[55vh]' : 'min-h-[220px]'}`}>
            {isImage ? (
              previewUrl ? (
                <div className="space-y-3 w-full flex flex-col items-center">
                  <img
                    src={previewUrl}
                    alt={record.title}
                    className={`${imageExpanded ? 'max-h-[70vh]' : 'max-h-72'} max-w-full rounded-lg object-contain border border-slate-200 dark:border-slate-800 shadow-md`}
                  />
                  <button
                    type="button"
                    onClick={() => setImageExpanded((expanded) => !expanded)}
                    className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    {imageExpanded ? 'Fit image to preview' : 'Enlarge image'}
                  </button>
                </div>
              ) : <LoaderPreview />
            ) : isPdf ? (
              <div className="flex h-[65vh] min-h-[360px] w-full flex-col gap-2">
                <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-500 dark:text-rose-400 flex items-center justify-center mx-auto">
                  <FileText className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{record.fileName}</p>
                  <p className="text-xs text-slate-500">
                    PDF Document • {formatFileSize(record.fileSize)}
                  </p>
                </div>
                {previewUrl ? (
                  <iframe
                    src={previewUrl}
                    title={`Preview of ${record.fileName}`}
                    className="min-h-0 w-full flex-1 rounded-lg bg-white"
                  />
                ) : <LoaderPreview />}
              </div>
            ) : (
              <div className="text-center space-y-2 py-6">
                <FileText className="w-10 h-10 text-teal-500 dark:text-teal-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{record.fileName}</p>
                <p className="text-xs text-slate-500">{formatFileSize(record.fileSize)}</p>
              </div>
            )}
          </div>

          {/* Description */}
          {record.description && (
            <div className="space-y-1 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Clinical Details / Notes
              </span>
              <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{record.description}</p>
            </div>
          )}

          {/* Metadata Specs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800/60 font-sans">
            <div>
              <span className="text-slate-500 block">File Name:</span>
              <span className="text-slate-800 dark:text-slate-200 truncate block font-medium">{record.fileName}</span>
            </div>
            <div>
              <span className="text-slate-500 block">File Size:</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium">
                {formatFileSize(record.fileSize)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">MIME Type:</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium">{record.fileType}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {allowDelete && (confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-500 dark:text-rose-400 font-medium">Are you sure?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  id="confirm-delete-btn"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all"
                >
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                id="viewer-delete-btn"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Record
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              to={`/records/${record._id}/view`}
              state={{ from: location.pathname }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Full-page viewer
            </Link>
            <a
              href={previewUrl || '#'}
              download={record.fileName}
              aria-disabled={!previewUrl}
              id="viewer-download-btn"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-500/20 border border-teal-200 dark:border-teal-500/30 transition-all shadow-sm ${!previewUrl ? 'pointer-events-none opacity-50' : ''}`}
            >
              <Download className="w-3.5 h-3.5" />
              Download Document
            </a>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoaderPreview: React.FC = () => (
  <p className="text-xs text-slate-500">Loading secure document preview...</p>
);
