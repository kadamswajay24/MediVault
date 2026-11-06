import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileText,
  Search,
  Plus,
  Download,
  Eye,
  Calendar,
  AlertCircle,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { RECORD_CATEGORIES } from '../types';
import type { MedicalRecord } from '../types';
import { useAuth } from '../context/useAuth';
import { recordAPI } from '../services/api';
import { UploadModal } from '../components/UploadModal';
import { RecordViewerModal } from '../components/RecordViewerModal';
import { RecordSummaryModal } from '../components/RecordSummaryModal';
import { formatFileSize } from '../utils/formatFileSize';

export const RecordsPage: React.FC = () => {
  const { user, activeDependent } = useAuth();
  // A patient switch remounts the workspace, clearing records and open dialogs.
  return <RecordsWorkspace key={`${user?.id || ''}:${activeDependent?.mediVaultId || ''}`} />;
};

const RecordsWorkspace: React.FC = () => {
  const { activeDependent } = useAuth();
  const readOnly = activeDependent?.accessLevel === 'read_only';
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'All';

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingRecordId, setDownloadingRecordId] = useState<string | null>(null);
  const [summaryRecord, setSummaryRecord] = useState<MedicalRecord | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [sortBy, setSortBy] = useState<string>('newest');

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const requestVersion = useRef(0);
  const pendingRequest = useRef<AbortController | null>(null);
  const patientContext = activeDependent?.mediVaultId || '';

  const fetchRecords = useCallback(async () => {
    const version = ++requestVersion.current;
    pendingRequest.current?.abort();
    const controller = new AbortController();
    pendingRequest.current = controller;
    try {
      setError(null);
      setLoading(true);
      const res = await recordAPI.getRecords({
        category: selectedCategory === 'All' ? undefined : selectedCategory,
        search: searchQuery || undefined,
        sort: sortBy,
      }, controller.signal);
      if (res.success && version === requestVersion.current) {
        setRecords(res.records);
      }
    } catch (err: any) {
      if (controller.signal.aborted || version !== requestVersion.current) return;
      setError(err.response?.data?.message || 'Failed to load medical records.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [searchQuery, selectedCategory, sortBy]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecords();
    }, 350);
    return () => {
      clearTimeout(timer);
      requestVersion.current += 1;
      pendingRequest.current?.abort();
    };
  }, [fetchRecords, patientContext]);

  const handleCategorySelect = (cat: string) => {
    setSelectedCategory(cat);
    if (cat === 'All') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', cat);
    }
    setSearchParams(searchParams);
  };

  const handleUploadSuccess = () => {
    fetchRecords();
  };

  const handleDeleteSuccess = (recordId: string) => {
    setRecords((prev) => prev.filter((r) => r._id !== recordId));
  };

  const handleDownload = async (record: MedicalRecord) => {
    setDownloadingRecordId(record._id);
    setError(null);
    try {
      const file = await recordAPI.getRecordFile(record._id);
      const objectUrl = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = record.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to securely download this record.');
    } finally {
      setDownloadingRecordId(null);
    }
  };

  return (
    <div className="records-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Title & Top CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
            Medical records
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Find and review your reports, prescriptions, and other health documents.
          </p>
        </div>

        <button
          disabled={readOnly}
          title={readOnly ? "Your caregiver access allows viewing only" : undefined}
          onClick={() => setIsUploadOpen(true)}
          id="records-page-upload-btn"
          className="button-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Upload record</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="records-filters surface-card p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="records-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search records"
              aria-label="Search medical records"
              className="w-full pl-10 pr-9 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#914B54]/20 focus:border-[#914B54]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear record search"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort Control */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Sort
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              id="records-sort-select"
              className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#914B54]/20 focus:border-[#914B54]"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
          <button
            onClick={() => handleCategorySelect('All')}
            aria-pressed={selectedCategory === 'All'}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === 'All'
              ? 'records-filter--active'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-slate-800'
            }`}
          >
            All Categories
          </button>
          {RECORD_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategorySelect(cat)}
              aria-pressed={selectedCategory === cat}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap border transition-colors ${
                selectedCategory === cat
                  ? 'records-filter--active'
                  : 'bg-slate-50/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div role="alert" className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Records Content */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-[#914B54] animate-spin" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading your records...</p>
        </div>
      ) : records.length === 0 && !error ? (
        <div className="surface-card p-10 text-center">
          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No records found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'All'
              ? 'No documents match your current filter criteria. Try clearing search or category filter.'
              : 'You haven’t uploaded any medical records yet. Keep your prescriptions and test results safe here.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            {(searchQuery || selectedCategory !== 'All') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Clear Filters
              </button>
            )}
            <button
              disabled={readOnly}
              title={readOnly ? 'Your caregiver access allows viewing only' : undefined}
              onClick={() => setIsUploadOpen(true)}
              className="button-primary px-4 py-2 text-xs font-semibold"
            >
              Upload record
            </button>
          </div>
        </div>
      ) : records.length > 0 ? (
        <>
        <div className="records-mobile-list">
          {records.map(record => <article key={record._id} className="surface-card record-mobile-card">
            <div className="flex items-start gap-3"><span className="dashboard-shortcut-icon"><FileText /></span><div className="min-w-0"><h2 className="break-words">{record.title}</h2><p className="mt-1 text-sm text-slate-500">{new Date(record.recordDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' })}</p></div></div>
            <span className="records-category-badge rounded-md border px-2 py-1 text-xs">{record.category}</span>
            <div className="flex flex-wrap gap-2"><button className="button-primary px-4 py-2 text-sm" onClick={() => setSelectedRecord(record)}>View record</button><button className="records-action-button" disabled={downloadingRecordId === record._id} onClick={() => handleDownload(record)}>{downloadingRecordId === record._id ? 'Downloading...' : 'Download'}</button><button className="records-action-button" onClick={() => setSummaryRecord(record)}>AI summary</button></div>
          </article>)}
        </div>
        <div className="records-table-wrap surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="records-table w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">Medical records and available actions</caption>
              <thead>
                <tr>
                  <th scope="col">Record</th>
                  <th scope="col">Type</th>
                  <th scope="col">Record date</th>
                  <th scope="col">File</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
          {records.map((record) => {
            return (
              <tr key={record._id}>
                <td>
                  <div className="records-table__title">{record.title}</div>
                  <p className="records-table__description">
                    {record.description || 'No description provided.'}
                  </p>
                  {record.metadata?.identityCheck && (
                    <span
                      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        record.metadata.identityCheck.status === 'matched'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'
                      }`}
                      title={record.metadata.identityCheck.message}
                    >
                      {record.metadata.identityCheck.status === 'matched'
                        ? 'Patient details appear to match'
                        : record.metadata.identityCheck.status === 'needs_review'
                          ? 'Identity needs review'
                          : record.metadata.identityCheck.status === 'not_checked'
                            ? 'Identity check not run'
                          : 'Identity not verified'}
                    </span>
                  )}
                </td>
                <td>
                    <span
                      className="records-category-badge text-[11px] px-2 py-1 rounded font-semibold border"
                    >
                      {record.category}
                    </span>
                </td>
                <td>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                    <Calendar className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    {new Date(record.recordDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                </td>
                <td>
                  <span className="records-table__file-name" title={record.fileName}>
                    {record.fileName}
                  </span>
                  <span className="records-table__file-meta">
                    {formatFileSize(record.fileSize)}
                    {record.fileType.split('/')[1] &&
                      ` · ${record.fileType.split('/')[1].toUpperCase()}`}
                  </span>
                </td>
                <td>
                  <div className="records-table__actions">
                    <button
                      onClick={() => setSelectedRecord(record)}
                      id={`record-view-btn-${record._id}`}
                      className="records-action-button"
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(record)}
                      disabled={downloadingRecordId === record._id}
                      id={`record-download-btn-${record._id}`}
                      className="records-action-button"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => setSummaryRecord(record)}
                      aria-label={`Summarize ${record.title} with AI`}
                      className="records-action-button disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      AI summary
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
              </tbody>
            </table>
          </div>
        </div>
      </>) : null}

      {/* Modals */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      <RecordViewerModal
        record={selectedRecord}
        allowDelete={!readOnly}
        onClose={() => setSelectedRecord(null)}
        onDeleteSuccess={handleDeleteSuccess}
      />

      {summaryRecord && (
        <RecordSummaryModal
          record={summaryRecord}
          onClose={() => setSummaryRecord(null)}
        />
      )}
    </div>
  );
};
