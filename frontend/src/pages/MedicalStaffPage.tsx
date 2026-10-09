import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  Pill,
  Plus,
  Search,
  Loader2,
  Trash2,
  Building,
  Award,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { medicalStaffAPI, adminAPI } from '../services/api';
import type { MedicalNote, PrescriptionItem, User as UserType } from '../types';

export const MedicalStaffPage: React.FC = () => {
  const { user } = useAuth();
  const isDoctor = user?.role === 'medical_staff' || user?.role === 'admin';

  const [notes, setNotes] = useState<MedicalNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Patient Lookup State (For Doctor)
  const [patientSearch, setPatientSearch] = useState('');
  const [matchedPatients, setMatchedPatients] = useState<UserType[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<UserType | null>(null);
  const [patientOverview, setPatientOverview] = useState<any | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // New Note Modal
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteType, setNoteType] = useState<MedicalNote['noteType']>('Prescription');
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [prescriptionRows, setPrescriptionRows] = useState<PrescriptionItem[]>([
    { medicineName: '', dosage: '1 tab', frequency: 'Twice daily', duration: '5 days', instructions: 'After meals' },
  ]);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const fetchDoctorData = async () => {
    try {
      setLoading(true);
      if (isDoctor) {
        const res = await medicalStaffAPI.getDoctorConsultations();
        if (res.success) setNotes(res.notes);
      } else if (user?.id) {
        // Patient viewing doctor prescriptions issued to them
        const res = await medicalStaffAPI.getPatientNotes(user.id);
        if (res.success) setNotes(res.notes);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctorData();
  }, [user]);

  // Patient search for doctor
  const handleSearchPatient = async (query: string) => {
    setPatientSearch(query);
    if (!query.trim()) {
      setMatchedPatients([]);
      return;
    }

    try {
      const res = await adminAPI.getUsers({ role: 'patient', search: query.trim() });
      if (res.success) {
        setMatchedPatients(res.users);
      }
    } catch {
      // Fallback
    }
  };

  const handleSelectPatient = async (p: UserType) => {
    setSelectedPatient(p);
    setMatchedPatients([]);
    setPatientSearch(p.name);
    setOverviewLoading(true);

    try {
      const res = await medicalStaffAPI.getPatientClinicalOverview(p.id);
      if (res.success) {
        setPatientOverview(res);
      }
    } catch {
      setPatientOverview(null);
    } finally {
      setOverviewLoading(false);
    }
  };

  const handleAddPrescriptionRow = () => {
    setPrescriptionRows((prev) => [
      ...prev,
      { medicineName: '', dosage: '1 tab', frequency: 'Once daily', duration: '7 days', instructions: '' },
    ]);
  };

  const handleRemovePrescriptionRow = (index: number) => {
    setPrescriptionRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdatePrescriptionRow = (index: number, field: keyof PrescriptionItem, val: string) => {
    setPrescriptionRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: val } : row))
    );
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      setNoteError('Please search and select a patient first.');
      return;
    }
    if (!noteTitle.trim()) {
      setNoteError('Title is required.');
      return;
    }

    setSubmittingNote(true);
    setNoteError(null);

    try {
      const validPrescriptions = prescriptionRows.filter((r) => r.medicineName.trim().length > 0);
      const res = await medicalStaffAPI.addClinicalNote({
        patientId: selectedPatient.id,
        noteType,
        title: noteTitle.trim(),
        diagnosis: diagnosis.trim(),
        prescriptionItems: validPrescriptions,
        clinicalNotes: clinicalNotes.trim(),
        followUpDate: followUpDate || undefined,
      });

      if (res.success) {
        setIsNoteModalOpen(false);
        setNoteTitle('');
        setDiagnosis('');
        setClinicalNotes('');
        setPrescriptionRows([
          { medicineName: '', dosage: '1 tab', frequency: 'Twice daily', duration: '5 days', instructions: 'After meals' },
        ]);
        fetchDoctorData();
        // Refresh overview if open
        handleSelectPatient(selectedPatient);
      }
    } catch (err: any) {
      setNoteError(err.response?.data?.message || 'Failed to issue clinical note.');
    } finally {
      setSubmittingNote(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {isDoctor ? 'Clinical Consultations & Prescriptions' : 'My Clinical Prescriptions'}
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium">
              Medical Provider Hub
            </span>
          </div>
          {isDoctor && user?.medicalStaffDetails && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1 font-mono">
                <Award className="w-3.5 h-3.5 text-blue-500" />
                License: {user.medicalStaffDetails.licenseNumber || 'Verified Medical Officer'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                {user.medicalStaffDetails.hospitalAffiliation || 'Primary Clinical Care'}
              </span>
              {user.medicalStaffDetails.specialization && (
                <>
                  <span>•</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {user.medicalStaffDetails.specialization}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {isDoctor && (
          <button
            onClick={() => {
              setIsNoteModalOpen(true);
              setNoteError(null);
            }}
            disabled={!selectedPatient}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 shadow-sm transition-all disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Issue Digital Rx / Note
          </button>
        )}
      </div>

      {/* Doctor Patient Lookup Bar */}
      {isDoctor && (
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Select Patient for Clinical Consultation
          </label>
          <div className="relative max-w-xl">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={patientSearch}
              onChange={(e) => handleSearchPatient(e.target.value)}
              placeholder="Search patient by full name or email address..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
            />

            {/* Dropdown suggestions */}
            {matchedPatients.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {matchedPatients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPatient(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{p.name}</span>
                      <span className="text-slate-400 ml-2 font-mono">{p.email}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600">
                      Select
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Patient Clinical Overview Card */}
          {selectedPatient && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 animate-in fade-in">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                    {selectedPatient.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {selectedPatient.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">{selectedPatient.email}</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsNoteModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500"
                >
                  Create Prescription
                </button>
              </div>

              {overviewLoading ? (
                <div className="py-6 flex items-center justify-center text-xs text-slate-500 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  Loading patient medical profile...
                </div>
              ) : patientOverview ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Clinical Profile</span>
                    <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                      Blood Group: {patientOverview.profile?.bloodGroup || 'Unknown'}
                    </p>
                    <p className="text-slate-500">Gender: {patientOverview.profile?.gender || 'Not specified'}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-200">
                    <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">
                      Known Allergies
                    </span>
                    <p className="mt-1 font-semibold">
                      {patientOverview.profile?.allergies?.length > 0
                        ? patientOverview.profile.allergies.join(', ')
                        : 'No known drug allergies'}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Diagnostic Records</span>
                    <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                      {patientOverview.records?.length || 0} Records in Vault
                    </p>
                    <p className="text-slate-500">
                      {patientOverview.notes?.length || 0} Clinical Consultations
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Consultations & Prescriptions List */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-blue-500" />
          {isDoctor ? 'Recent Consultations Issued' : 'Verified Prescriptions Issued to You'}
        </h2>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-500 text-sm">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
            Loading clinical notes...
          </div>
        ) : notes.length === 0 ? (
          <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center text-slate-500 text-xs">
            No clinical consultation notes found.
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <div
                key={note._id}
                className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {note.title}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                        {note.noteType}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Issued on {new Date(note.createdAt).toLocaleDateString()}
                      {typeof note.doctor === 'object' && note.doctor?.name && (
                        <span> • Attending: Dr. {note.doctor.name}</span>
                      )}
                    </p>
                  </div>

                  {note.diagnosis && (
                    <span className="text-xs font-mono px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      Dx: {note.diagnosis}
                    </span>
                  )}
                </div>

                {/* Prescription Line Items Table */}
                {note.prescriptionItems && note.prescriptionItems.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 uppercase text-[10px] font-bold">
                        <tr>
                          <th className="px-3 py-2">Medication</th>
                          <th className="px-3 py-2">Dosage</th>
                          <th className="px-3 py-2">Frequency</th>
                          <th className="px-3 py-2">Duration</th>
                          <th className="px-3 py-2">Instructions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {note.prescriptionItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="px-3 py-2 font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <Pill className="w-3.5 h-3.5 text-blue-500" />
                              {item.medicineName}
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{item.dosage}</td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{item.frequency}</td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{item.duration}</td>
                            <td className="px-3 py-2 text-slate-500 italic">{item.instructions || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {note.clinicalNotes && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-lg">
                    {note.clinicalNotes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Doctor Issue Prescription Modal */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Issue Digital Prescription &amp; Clinical Note
                </h3>
                <p className="text-xs text-slate-500">
                  Patient: {selectedPatient?.name} ({selectedPatient?.email})
                </p>
              </div>
              <button
                onClick={() => setIsNoteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {noteError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-600 dark:text-rose-400 text-xs">
                {noteError}
              </div>
            )}

            <form onSubmit={handleSaveNote} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Note Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="e.g. Follow-Up Consultation & Plan"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Clinical Diagnosis (ICD)
                  </label>
                  <input
                    type="text"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="e.g. Hypertension stage 1"
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Note Type
                  </label>
                  <select
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value as MedicalNote['noteType'])}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="Consultation">Consultation</option>
                    <option value="Prescription">Prescription</option>
                    <option value="Diagnosis">Diagnosis</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Lab Review">Lab Review</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Prescription Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Prescribed Medications ({prescriptionRows.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddPrescriptionRow}
                    className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Medication
                  </button>
                </div>

                <div className="space-y-2">
                  {prescriptionRows.map((row, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-5 gap-2 items-center text-xs"
                    >
                      <input
                        type="text"
                        placeholder="Drug / Medicine Name"
                        value={row.medicineName}
                        onChange={(e) => handleUpdatePrescriptionRow(idx, 'medicineName', e.target.value)}
                        className="sm:col-span-2 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      />
                      <input
                        type="text"
                        placeholder="Dosage (e.g. 500mg)"
                        value={row.dosage}
                        onChange={(e) => handleUpdatePrescriptionRow(idx, 'dosage', e.target.value)}
                        className="px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      />
                      <input
                        type="text"
                        placeholder="Freq (e.g. 2x daily)"
                        value={row.frequency}
                        onChange={(e) => handleUpdatePrescriptionRow(idx, 'frequency', e.target.value)}
                        className="px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="Duration"
                          value={row.duration}
                          onChange={(e) => handleUpdatePrescriptionRow(idx, 'duration', e.target.value)}
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                        />
                        {prescriptionRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePrescriptionRow(idx)}
                            className="p-1 text-slate-400 hover:text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Clinical Advice &amp; Instructions
                </label>
                <textarea
                  rows={3}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Lifestyle modifications, dietary restrictions..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNote}
                  className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {submittingNote && <Loader2 className="w-4 h-4 animate-spin" />}
                  Sign &amp; Issue Prescription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
