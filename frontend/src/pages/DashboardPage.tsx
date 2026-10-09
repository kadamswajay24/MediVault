import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Heart,
  AlertTriangle,
  Phone,
  Plus,
  ShieldCheck,
  Eye,
  Loader2,
  FileCheck2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../services/api';
import type { DashboardResponse, MedicalRecord } from '../types';
import { UploadModal } from '../components/UploadModal';
import { RecordViewerModal } from '../components/RecordViewerModal';

export const DashboardPage: React.FC = () => {
  const { user, activeDependent } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await dashboardAPI.getStats();
      if (res.success) {
        setData(res);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [activeDependent]);

  const handleUploadSuccess = () => {
    fetchDashboardData();
  };

  const handleDeleteSuccess = () => {
    fetchDashboardData();
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-sm text-slate-500">Loading patient health vault...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Unable to Load Vault Data</h2>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { stats, healthProfile, recentRecords } = data;
  const activeName = activeDependent ? activeDependent.name : healthProfile.fullName || user?.name || 'Patient';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Patient Header Banner */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              {activeDependent ? `Dependent Vault: ${activeDependent.relationship}` : 'Personal Health Vault'}
            </span>
            <span className="text-xs text-slate-400 font-mono">MRN: MV-{user?.id?.slice(-6).toUpperCase()}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {activeName}
          </h1>
          <p className="text-xs text-slate-500 max-w-xl">
            {activeDependent
              ? `You are managing health records, allergies, and claims on behalf of ${activeName}.`
              : 'Lifelong digital health records, diagnostic panels, prescriptions, and insurance claims.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsUploadOpen(true)}
            id="dashboard-upload-cta"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Upload Document</span>
          </button>

          <Link
            to="/claims"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 transition-all"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-amber-500" />
            <span>File Claim</span>
          </Link>

          <Link
            to="/records"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 transition-all"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>Records Hub</span>
          </Link>
        </div>
      </div>

      {/* Top 4 Key Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Records */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-semibold uppercase tracking-wider">Vault Records</span>
            <FileText className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {stats.totalRecords}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Encrypted diagnostic files</p>
        </div>

        {/* Insurance Claims */}
        <Link
          to="/claims"
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-amber-500/50 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-semibold uppercase tracking-wider">Insurance Claims</span>
            <FileCheck2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {stats.claimsCount || 0}
          </div>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">Reimbursements &amp; cashless</p>
        </Link>

        {/* Blood Group */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-semibold uppercase tracking-wider">Blood Group</span>
            <Heart className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
              {healthProfile.bloodGroup || 'Unknown'}
            </span>
            <span className="text-[10px] text-slate-400">{healthProfile.gender || 'Not set'}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Clinical demographic</p>
        </div>

        {/* Emergency Contact */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-semibold uppercase tracking-wider">Emergency Contact</span>
            <Phone className="w-4 h-4 text-blue-500" />
          </div>
          {healthProfile.emergencyContact?.name ? (
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {healthProfile.emergencyContact.name} ({healthProfile.emergencyContact.relationship || 'Contact'})
              </p>
              <a
                href={`tel:${healthProfile.emergencyContact.phone}`}
                className="text-[11px] font-mono text-emerald-600 hover:underline block mt-0.5"
              >
                {healthProfile.emergencyContact.phone}
              </a>
            </div>
          ) : (
            <Link to="/profile" className="text-xs text-emerald-600 hover:underline block mt-2">
              + Add Contact Info
            </Link>
          )}
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          Records by Clinical Category
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {Object.entries(stats.categories).map(([category, count]) => (
            <Link
              key={category}
              to={`/records?category=${encodeURIComponent(category)}`}
              className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-colors flex items-center justify-between"
            >
              <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{category}</span>
              <span className="text-xs font-bold font-mono text-slate-900 dark:text-white ml-2">{count}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Split Grid: Allergies / Conditions & Recent Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Clinical Highlights */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Allergies &amp; Clinical Alerts
              </span>
              <Link to="/profile" className="text-xs text-emerald-600 hover:underline">
                Edit
              </Link>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">Known Allergies:</span>
              {healthProfile.allergies && healthProfile.allergies.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {healthProfile.allergies.map((a, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-medium"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No drug allergies recorded</p>
              )}
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">Diagnosed Conditions:</span>
              {healthProfile.medicalConditions && healthProfile.medicalConditions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {healthProfile.medicalConditions.map((c, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No chronic conditions listed</p>
              )}
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-500 block mb-1">Active Medications:</span>
              {healthProfile.medications && healthProfile.medications.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {healthProfile.medications.map((m, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No ongoing prescriptions recorded</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Recent Records & Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-500" />
                Recent Diagnostic Documents
              </span>
              <Link to="/records" className="text-xs text-emerald-600 hover:underline">
                View All Records ({stats.totalRecords})
              </Link>
            </div>

            {recentRecords.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 italic">
                No medical records uploaded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentRecords.map((rec) => (
                  <div
                    key={rec._id}
                    className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 rounded-lg px-2 transition-colors"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center font-bold text-[10px] uppercase">
                        {rec.fileType.includes('pdf') ? 'PDF' : 'IMG'}
                      </div>
                      <div className="truncate">
                        <button
                          onClick={() => setSelectedRecord(rec)}
                          className="text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-600 text-left truncate block"
                        >
                          {rec.title}
                        </button>
                        <span className="text-[11px] text-slate-400">
                          {rec.category} • {new Date(rec.recordDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedRecord(rec)}
                      className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Record Viewer Modal */}
      {selectedRecord && (
        <RecordViewerModal
          record={selectedRecord}
          isOpen={true}
          onClose={() => setSelectedRecord(null)}
          onDeleteSuccess={handleDeleteSuccess}
        />
      )}

      {/* Global Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
};
