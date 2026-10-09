import React, { useState, useEffect } from 'react';
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
  X,
} from 'lucide-react';
import { RECORD_CATEGORIES } from '../types';
import type { MedicalRecord } from '../types';
import { recordAPI } from '../services/api';
import { UploadModal } from '../components/UploadModal';
import { RecordViewerModal } from '../components/RecordViewerModal';

export const RecordsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'All';

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [sortBy, setSortBy] = useState<string>('newest');

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await recordAPI.getRecords({
        category: selectedCategory === 'All' ? undefined : selectedCategory,
        search: searchQuery || undefined,
        sort: sortBy,
      });
      if (res.success) {
        setRecords(res.records);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load medical records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedCategory, sortBy]);

  // Debounced live search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecords();
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
        return 'bg-slate-100 dark:bg-slate-700/30 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700/50';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in duration-300">
      {/* Page Title & Top CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Medical Records
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Browse, preview, and download your clinical documents with strict privacy isolation.
          </p>
        </div>

        <button
          onClick={() => setIsUploadOpen(true)}
          id="records-page-upload-btn"
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 hover:from-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Upload New Record</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white/85 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 space-y-4 backdrop-blur-md shadow-sm transition-colors duration-200">
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
              placeholder="Search documents by title or clinical notes..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort Control */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Sort:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              id="records-sort-select"
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title">Title (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
          <button
            onClick={() => handleCategorySelect('All')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === 'All'
                ? 'bg-teal-600 dark:bg-teal-500 text-white dark:text-slate-950 shadow-md shadow-teal-500/20'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-slate-800'
            }`}
          >
            All Categories
          </button>
          {RECORD_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategorySelect(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all ${
                selectedCategory === cat
                  ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-500/60 shadow-sm'
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
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Records Content */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading your records...</p>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white/85 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-12 text-center backdrop-blur-md shadow-sm transition-colors duration-200">
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
              onClick={() => setIsUploadOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 dark:bg-teal-500/10 text-white dark:text-teal-300 hover:bg-teal-700 dark:hover:bg-teal-500/20"
            >
              Upload Document
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {records.map((record) => {
            return (
              <div
                key={record._id}
                className="glass-panel glass-panel-hover rounded-2xl p-5 flex flex-col justify-between space-y-4 group transition-colors duration-200"
              >
                <div>
                  {/* Card Header: Category & Date */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${getCategoryColor(
                        record.category
                      )}`}
                    >
                      {record.category}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      {new Date(record.recordDate).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-teal-600 dark:group-hover:text-teal-300 transition-colors">
                    {record.title}
                  </h3>

                  {/* Description preview */}
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                    {record.description || 'No clinical remarks recorded for this file.'}
                  </p>
                </div>

                {/* File spec & Action buttons */}
                <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    {(record.fileSize / (1024 * 1024)).toFixed(2)} MB • {record.fileType.split('/')[1]?.toUpperCase()}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSelectedRecord(record)}
                      id={`record-view-btn-${record._id}`}
                      title="View & Preview"
                      className="p-2 rounded-xl text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-500/20 hover:text-teal-600 dark:hover:text-teal-300 border border-slate-200 dark:border-slate-700/70 transition-all"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <a
                      href={recordAPI.downloadRecordUrl(record._id)}
                      download={record.fileName}
                      id={`record-download-btn-${record._id}`}
                      title="Download"
                      className="p-2 rounded-xl text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-500/20 hover:text-teal-600 dark:hover:text-teal-300 border border-slate-200 dark:border-slate-700/70 transition-all"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      <RecordViewerModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onDeleteSuccess={handleDeleteSuccess}
      />
    </div>
  );
};
