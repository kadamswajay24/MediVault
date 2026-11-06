import { formatIndianNumber } from '../utils/indiaFormat';
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart,
  AlertTriangle,
  Plus,
  ShieldCheck,
  Eye,
  Loader2,
  AlertCircle,
  CalendarDays,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { dashboardAPI, recordAPI } from '../services/api';
import type { DashboardResponse, MedicalRecord } from '../types';
import { UploadModal } from '../components/UploadModal';
import { RecordViewerModal } from '../components/RecordViewerModal';


export const DashboardPage: React.FC = () => {
  const { user, activeDependent } = useAuth();
  const readOnly = activeDependent?.accessLevel === 'read_only';
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [openingRecordId, setOpeningRecordId] = useState<string | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await dashboardAPI.getStats();
      if (res.success) {
        setError(null);
        setData(res);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDashboardData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeDependent, fetchDashboardData]);

  const handleUploadSuccess = () => {
    fetchDashboardData();
  };

  const handleDeleteSuccess = () => {
    fetchDashboardData();
  };

  const handleOpenTimelineRecord = async (recordId: string) => {
    const recentRecord = data?.recentRecords.find((record) => record._id === recordId);
    if (recentRecord) {
      setSelectedRecord(recentRecord);
      return;
    }

    setOpeningRecordId(recordId);
    setTimelineError(null);
    try {
      const response = await recordAPI.getRecordById(recordId);
      if (response.success) {
        setSelectedRecord(response.record);
      } else {
        setTimelineError('Unable to load this record.');
      }
    } catch (err: any) {
      setTimelineError(err.response?.data?.message || 'Unable to load this record.');
    } finally {
      setOpeningRecordId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="dashboard-loader w-8 h-8 animate-spin" />
        <p className="text-sm text-slate-500">Loading your health overview</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="dashboard-error-state bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Unable to load your health overview</h2>
          <p className="text-xs text-slate-500 mt-1">{error}</p>
          <button
            onClick={() => {
              setError(null);
              void fetchDashboardData();
            }}
            className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { stats, healthProfile } = data;
  const prescribedMedications = Array.from(new Set(healthProfile.medications || []));
  const attention = data.attention;
  const upcoming = attention?.upcomingAppointments.filter((appointment) =>
    new Date(`${appointment.appointmentDate}T${appointment.time}:00+05:30`).getTime() >= Date.now()
  ) || [];
  const activeName = activeDependent ? activeDependent.name : healthProfile.fullName || user?.name || 'Patient';

  return (
    <div className="dashboard-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
    <div className="dashboard-hero surface-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="dashboard-hero-pill inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            {activeDependent ? `${activeDependent.relationship} profile` : 'Patient profile'}
          </span>
          <span className="dashboard-mrn text-xs text-slate-400 font-sans">{activeDependent?.mediVaultId || user?.mediVaultId}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {activeName}
        </h1>
        <p className="text-xs text-slate-500 max-w-xl">
          {activeDependent
            ? `Health records and care access for ${activeName}.`
            : 'Health records, prescriptions, and insurance claims.'}
        </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {!readOnly && <button onClick={() => setIsUploadOpen(true)} id="dashboard-upload-cta" className="dashboard-cta-primary button-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold"><Plus className="h-4 w-4" />Upload record</button>}
          <Link to="/records" className="dashboard-cta-secondary inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-semibold">View records<ArrowUpRight className="h-4 w-4" /></Link>
        </div>
      </div>

      <div className="dashboard-shortcuts">
        <Link to="/appointments"><span className="dashboard-shortcut-icon"><CalendarDays /></span><span><strong>Appointments</strong><small>Book or manage visits</small></span><ArrowUpRight className="h-4 w-4" /></Link>
        <Link to="/access-requests"><span className="dashboard-shortcut-icon"><ShieldCheck /></span><span><strong>Record access</strong><small>Review who can view your records</small></span><ArrowUpRight className="h-4 w-4" /></Link>
        <Link to="/profile"><span className="dashboard-shortcut-icon"><Heart /></span><span><strong>Health profile</strong><small>Update allergies, conditions, and contacts</small></span><ArrowUpRight className="h-4 w-4" /></Link>
      </div>

      <section className="dashboard-metrics surface-card" aria-label="Health overview">
        <div className="dashboard-metric dashboard-metric--records">
          <span className="dashboard-metric-label">Health records</span>
          <strong className="dashboard-metric-value">
            {formatIndianNumber(stats.totalRecords)}
          </strong>
          <span className="dashboard-metric-note">Documents in your account</span>
        </div>

        <Link
          to="/claims"
          className="dashboard-metric dashboard-metric--claims"
        >
          <span className="dashboard-metric-label">Insurance claims</span>
          <strong className="dashboard-metric-value">
            {formatIndianNumber(stats.claimsCount || 0)}
          </strong>
          <span className="dashboard-metric-note">Reimbursement and cashless</span>
        </Link>

        <div className="dashboard-metric dashboard-metric--blood-group">
          <span className="dashboard-metric-label">Blood group</span>
          <strong className="dashboard-metric-value">
              {healthProfile.bloodGroup || 'Unknown'}
          </strong>
          <span className="dashboard-metric-note">{healthProfile.gender || 'Not set'}</span>
        </div>

        <div className="dashboard-metric dashboard-metric--contact">
          <span className="dashboard-metric-label">Emergency contact</span>
          {healthProfile.emergencyContact?.name ? (
            <div className="dashboard-metric-contact">
              <p className="dashboard-metric-contact-name">
                {healthProfile.emergencyContact.name} ({healthProfile.emergencyContact.relationship || 'Contact'})
              </p>
              <a
                href={`tel:${healthProfile.emergencyContact.phone}`}
                className="dashboard-metric-link"
              >
                {healthProfile.emergencyContact.phone}
              </a>
            </div>
          ) : (
            <Link to="/profile" className="dashboard-metric-link">
              Add a contact
            </Link>
          )}
        </div>
      </section>

      <div className="surface-card dashboard-section p-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          Records by category
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {Object.entries(stats.categories).map(([category, count]) => (
            <Link
              key={category}
              to={`/records?category=${encodeURIComponent(category)}`}
              className="dashboard-category p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 transition-colors flex items-center justify-between"
            >
              <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{category}</span>
              <span className="text-xs font-bold font-sans text-slate-900 dark:text-white ml-2">{formatIndianNumber(count)}</span>
            </Link>
          ))}
        </div>
      </div>

      <section className="surface-card dashboard-attention p-5 space-y-3" aria-labelledby="attention-title">
        <h2 id="attention-title" className="text-base font-semibold text-slate-900 dark:text-white">Needs your attention</h2>
        {!attention ? <p className="text-sm text-slate-500">Attention updates are unavailable.</p> : <>
          {!readOnly && attention.pendingAccessRequests > 0 && <Link to="/access-requests" className="block rounded-lg border border-amber-200 p-3 text-sm dark:border-amber-800">
            {attention.pendingAccessRequests} access request{attention.pendingAccessRequests === 1 ? '' : 's'} awaiting your decision <span className="font-semibold">Review requests</span>
          </Link>}
          {attention.claimsNeedingInformation > 0 && <Link to="/claims" className="block rounded-lg border border-amber-200 p-3 text-sm dark:border-amber-800">
            {attention.claimsNeedingInformation} claim{attention.claimsNeedingInformation === 1 ? '' : 's'} need more information <span className="font-semibold">View claims</span>
          </Link>}
          {upcoming.map((appointment) => <Link key={appointment._id} to="/appointments" className="block rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
            <span className="font-semibold">{appointment.hospitalName}</span>
            <span className="block mt-1 text-slate-500">{new Date(`${appointment.appointmentDate}T12:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' })} at {appointment.time} IST - {appointment.status === 'confirmed' ? 'Confirmed' : 'Awaiting confirmation'}</span>
          </Link>)}
          {(!attention.pendingAccessRequests || readOnly) && !attention.claimsNeedingInformation && !upcoming.length && <p className="text-sm text-slate-500">You are all caught up. No pending actions or upcoming appointments.</p>}
        </>}
      </section>

      <section className="surface-card dashboard-section space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300">
            Prescriptions
          </h2>
          <Link to="/prescriptions" className="dashboard-link text-xs">
            View all prescriptions
          </Link>
        </div>
        {data.prescriptions.length === 0 && data.prescriptionRecords.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">No prescriptions recorded yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-500">Recent prescription history</h3>
              <p className="text-sm text-slate-500">These prescriptions do not confirm current use. Keep your ongoing medications updated in your profile.</p>
              {data.prescriptions.length === 0 ? (
                <p className="text-xs text-slate-500">No digital prescriptions from your care team.</p>
              ) : data.prescriptions.map((prescription) => (
                <article key={prescription._id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{prescription.title}</h4>
                      <p className="mt-0.5 text-xs text-slate-500">{new Date(prescription.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                    </div>
                    <span className="dashboard-record-type">Digital prescription</span>
                  </div>
                  {prescription.prescriptionItems.length > 0 ? (
                    <ul className="mt-2 space-y-1.5">
                      {prescription.prescriptionItems.map((item, index) => (
                        <li key={`${prescription._id}-${index}`} className="text-xs text-slate-600 dark:text-slate-400">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{item.medicineName}</span>
                          {[item.dosage, item.frequency, item.duration].filter(Boolean).length > 0 && (
                            <span> - {[item.dosage, item.frequency, item.duration].filter(Boolean).join(' - ')}</span>
                          )}
                          {item.instructions && <span className="block text-slate-500">{item.instructions}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">No medicine details recorded.</p>
                  )}
                </article>
              ))}
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-500">Prescription documents</h3>
              {data.prescriptionRecords.length === 0 ? (
                <p className="text-xs text-slate-500">No uploaded prescription documents.</p>
              ) : data.prescriptionRecords.map((record) => (
                <div key={record._id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{record.title}</p>
                    <p className="text-xs text-slate-500">{new Date(record.recordDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedRecord(record)}
                    className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>



      {/* Split Grid: Allergies / Conditions & Recent Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Clinical Highlights */}
        <div className="space-y-4">
          <div className="surface-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Allergies and conditions
              </span>
              <Link to="/profile" className="dashboard-link text-xs">
                Edit
              </Link>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">Allergies</span>
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
                <p className="text-xs text-slate-400">No drug allergies recorded</p>
              )}
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">Conditions</span>
              {healthProfile.medicalConditions && healthProfile.medicalConditions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {healthProfile.medicalConditions.map((c, i) => (
                    <span
                      key={i}
                      className="dashboard-condition"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No chronic conditions listed</p>
              )}
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">Ongoing medications from your profile</span>
              {prescribedMedications.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {prescribedMedications.map((m, i) => (
                    <span
                      key={i}
                      className="dashboard-medication"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No ongoing medications listed in your profile.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Health Record Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="surface-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Health record timeline
              </span>
              <Link to="/records" className="dashboard-link text-xs">
                View all records ({formatIndianNumber(stats.totalRecords)})
              </Link>
            </div>

            {timelineError && (
              <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                {timelineError}
              </p>
            )}

            {data.timeline.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No records are available in your timeline yet.
              </div>
            ) : (
              <ol className="health-record-timeline" aria-label="Recent health records in date order">
                {data.timeline.map((record) => (
                  <li key={record._id} className="health-record-timeline__item">
                    <time
                      className="health-record-timeline__date"
                      dateTime={record.recordDate}
                    >
                      {new Date(record.recordDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </time>
                    <div className="health-record-timeline__content">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {record.title}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          {record.category} <span aria-hidden="true">·</span> {record.fileName}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleOpenTimelineRecord(record._id)}
                        disabled={openingRecordId !== null}
                        aria-label={`View ${record.title}`}
                        className="records-action-button shrink-0"
                      >
                        {openingRecordId === record._id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                        View
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      {/* Record Viewer Modal */}
      {selectedRecord && (
        <RecordViewerModal
          record={selectedRecord}
          allowDelete={!readOnly}
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
