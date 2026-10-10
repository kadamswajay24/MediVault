import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { RecordViewerModal } from '../components/RecordViewerModal';
import { medicalStaffAPI } from '../services/api';
import { RECORD_CATEGORIES } from '../types';
import type { MedicalRecord, MedicalStaffClinicalOverview } from '../types';

const formatDate = (value?: string) => {
  if (!value || Number.isNaN(Date.parse(value))) return 'Not recorded';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || 'Unable to load this patient file.';
  }
  return error instanceof Error ? error.message : 'Unable to load this patient file.';
};

export const PatientClinicalFilePage: React.FC = () => {
  const { patientId = '' } = useParams<{ patientId: string }>();
  const [result, setResult] = useState<{
    patientId: string;
    overview?: MedicalStaffClinicalOverview;
    error?: string;
  } | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const requestSequence = useRef(0);

  const loadPatientFile = useCallback(async () => {
    if (!patientId) return;
    const requestId = ++requestSequence.current;
    try {
      const response = await medicalStaffAPI.getPatientClinicalOverview(patientId);
      if (requestId === requestSequence.current) {
        setResult({ patientId, overview: response });
      }
    } catch (requestError: unknown) {
      if (requestId === requestSequence.current) {
        setResult({ patientId, error: getErrorMessage(requestError) });
      }
    }
  }, [patientId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPatientFile();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      requestSequence.current += 1;
    };
  }, [loadPatientFile]);

  const currentResult = result?.patientId === patientId ? result : null;
  const overview = currentResult?.overview || null;
  const error = currentResult?.error || (!patientId ? 'A patient MediVault ID is required.' : null);
  const loading = Boolean(patientId) && !currentResult;
  const retryLoadPatientFile = () => {
    setResult(null);
    void loadPatientFile();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <p className="text-sm">Loading approved patient file...</p>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link
          to="/medical-staff"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to clinical consultations
        </Link>
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/30">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            Patient file is unavailable
          </h1>
          <p className="mt-2 text-sm text-amber-900 dark:text-amber-200">
            {error || 'The patient file could not be loaded.'}
          </p>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Patient details are shown only while an active, patient-approved access grant is in place.
            Ask the patient to approve or renew your access, then try again.
          </p>
          <button
            type="button"
            onClick={retryLoadPatientFile}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-400 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-100 dark:hover:bg-amber-900/40"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { patient, profile, records, notes } = overview;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/medical-staff"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to clinical consultations
        </Link>
        <button
          type="button"
          onClick={retryLoadPatientFile}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh patient data
        </button>
      </div>

      <header className="surface-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            Patient-approved clinical file
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{patient.name}</h1>
          <p className="mt-1 font-mono text-xs text-slate-500">{patient.mediVaultId}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {patient.email || 'No email recorded'}
            {patient.phone ? ` · ${patient.phone}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <a href="#health-profile" className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            Health profile
          </a>
          <a href="#medical-records" className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            Records ({records.length})
          </a>
          <a href="#clinical-notes" className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            Clinical notes ({notes.length})
          </a>
        </div>
      </header>

      <section id="health-profile" className="scroll-mt-24 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Health profile</h2>
          <p className="text-xs text-slate-500">Personal details and patient-provided health information.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Date of birth', formatDate(profile?.dateOfBirth)],
            ['Gender', profile?.gender || 'Not recorded'],
            ['Blood group', profile?.bloodGroup || 'Not recorded'],
            ['Patient name', profile?.fullName || patient.name],
          ].map(([label, value]) => (
            <div key={label} className="surface-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { label: 'Known allergies', values: profile?.allergies || [] },
            { label: 'Medical conditions', values: profile?.medicalConditions || [] },
            { label: 'Current medications', values: profile?.medications || [] },
          ].map(({ label, values }) => (
            <div key={label} className="surface-card p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{label}</h3>
              {values.length ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {values.map((value, index) => (
                    <li key={`${label}-${index}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {value}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-500">None recorded</p>
              )}
            </div>
          ))}
          <div className="surface-card p-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Emergency contact</h3>
            {profile?.emergencyContact?.name ? (
              <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                <p className="font-medium text-slate-800 dark:text-slate-200">{profile.emergencyContact.name}</p>
                <p>{profile.emergencyContact.relationship || 'Relationship not recorded'}</p>
                <p>{profile.emergencyContact.phone || 'Phone not recorded'}</p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">None recorded</p>
            )}
          </div>
        </div>
      </section>

      <section id="medical-records" className="scroll-mt-24 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Medical records</h2>
          <p className="text-xs text-slate-500">Patient-uploaded reports grouped by record type.</p>
        </div>
        {records.length ? (
          <div className="space-y-4">
            {RECORD_CATEGORIES.map((category) => {
              const categoryRecords = records.filter((record) => record.category === category);
              if (!categoryRecords.length) return null;
              return (
                <div key={category} className="surface-card p-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {category} <span className="text-xs font-normal text-slate-500">({categoryRecords.length})</span>
                  </h3>
                  <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                    {categoryRecords.map((record) => (
                      <article key={record._id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <h4 className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                            <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                            <span className="truncate">{record.title}</span>
                          </h4>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(record.recordDate)} · {record.fileName}
                          </p>
                          {record.description && (
                            <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400">
                              {record.description}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedRecord(record)}
                          className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Review file
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="surface-card p-5 text-sm text-slate-500">No medical records have been added to this patient file.</div>
        )}
      </section>

      <section id="clinical-notes" className="scroll-mt-24 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Clinical notes</h2>
          <p className="text-xs text-slate-500">Consultations, diagnoses, prescriptions, and follow-ups.</p>
        </div>
        {notes.length ? (
          <div className="space-y-3">
            {notes.map((note) => (
              <article key={note._id} className="surface-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                      {note.noteType}
                    </span>
                    <h3 className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{note.title}</h3>
                  </div>
                  <time className="text-xs text-slate-500">{formatDate(note.createdAt)}</time>
                </div>
                {note.diagnosis && (
                  <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                    <span className="font-semibold">Diagnosis:</span> {note.diagnosis}
                  </p>
                )}
                {note.clinicalNotes && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">
                    {note.clinicalNotes}
                  </p>
                )}
                {note.prescriptionItems.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">Prescribed medicines</h4>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      {note.prescriptionItems.map((item, index) => (
                        <li key={`${note._id}-${index}`}>
                          {item.medicineName} — {item.dosage}, {item.frequency}, {item.duration}
                          {item.instructions ? `; ${item.instructions}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {note.followUpDate && (
                  <p className="mt-3 text-xs text-slate-500">Follow-up: {formatDate(note.followUpDate)}</p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="surface-card p-5 text-sm text-slate-500">No clinical notes have been recorded for this patient.</div>
        )}
      </section>

      <RecordViewerModal
        record={selectedRecord}
        allowDelete={false}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
};
