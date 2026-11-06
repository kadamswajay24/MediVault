import { indiaDateTimeInput, indiaInputToISO } from '../utils/indiaFormat';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Stethoscope,
  Pill,
  Plus,
  Search,
  Loader2,
  Trash2,
  Building,
  Award,
  CalendarDays,
  Eye,
  FileText,
  RefreshCw,
  Pencil,
  Check,
  X,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import {
  CATALOG_SEARCH_MEDICINES,
  MEDICATION_CATALOG,
  getSpecialtyMedications,
} from '../constants/prescriptionMedications';
import {
  findCatalogTextMatches,
  medicineRiskLabels,
  type CatalogSearchMedicine,
} from '../constants/specialtyMedicineCatalog';
import { clinicalAccessAPI, medicalStaffAPI } from '../services/api';
import { RecordViewerModal } from '../components/RecordViewerModal';
import { RecordSummaryModal } from '../components/RecordSummaryModal';
import type {
  MedicalNote,
  MedicalRecord,
  MedicalRecordSummary,
  MedicalStaffClinicalOverview,
  PrescriptionItem,
  User as UserType,
} from '../types';
import type { ClinicalAccessRequest } from '../services/api';


const DOSAGE_OPTIONS = ['1 tab', '1 tablet', '1 capsule', '2 tablets', '5 mL', '10 mL', '1 puff', '1 drop'];
const FREQUENCY_OPTIONS = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Every 4 hours',
  'Every 6 hours',
  'Every 8 hours',
  'Every 12 hours',
  'As needed (PRN)',
  'As directed',
];
const DURATION_OPTIONS = ['1 day', '3 days', '5 days', '7 days', '10 days', '14 days', '30 days', 'Ongoing', 'As directed'];
const INSTRUCTION_OPTIONS = [
  'After meals',
  'Before meals',
  'With food',
  'With water',
  'Take on an empty stomach',
  'At bedtime',
  'Avoid alcohol',
  'As needed',
  'As directed',
];

type PrescriptionDraft = PrescriptionItem & {
  isCustom?: boolean;
  dosageIsCustom?: boolean;
  frequencyIsCustom?: boolean;
  durationIsCustom?: boolean;
  instructionsIsCustom?: boolean;
};

export const MedicalStaffPage: React.FC = () => {
  const { user } = useAuth();
  const isDoctor = user?.role === 'medical_staff';
  const medicationOptions = getSpecialtyMedications(user?.medicalStaffDetails?.specialization);

  const [notes, setNotes] = useState<MedicalNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Patient Lookup State (For Doctor)
  const [patientSearch, setPatientSearch] = useState('');
  const [matchedPatients, setMatchedPatients] = useState<UserType[]>([]);
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);
  const [patientSearchAttempted, setPatientSearchAttempted] = useState(false);
  const [approvedPatients, setApprovedPatients] = useState<UserType[]>([]);
  const [approvedPatientsLoading, setApprovedPatientsLoading] = useState(true);
  const [approvedPatientsError, setApprovedPatientsError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<UserType | null>(null);
  const [patientOverview, setPatientOverview] = useState<MedicalStaffClinicalOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [summaryRecord, setSummaryRecord] = useState<MedicalRecord | null>(null);
  const [doctorSummary, setDoctorSummary] = useState<MedicalRecordSummary | null>(null);
  const [doctorSummaryModel, setDoctorSummaryModel] = useState<string | null>(null);
  const [doctorSummaryLoading, setDoctorSummaryLoading] = useState(false);
  const [doctorSummaryError, setDoctorSummaryError] = useState<string | null>(null);
  const [requestReason, setRequestReason] = useState('');
  const [requestReasonDetails, setRequestReasonDetails] = useState('');
  const [requestedUntil, setRequestedUntil] = useState(() => {
    const date = new Date(Date.now() + 8 * 60 * 60 * 1000);
    return indiaDateTimeInput(date);
  });
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [accessRequestMessage, setAccessRequestMessage] = useState<string | null>(null);
  const [patientSearchError, setPatientSearchError] = useState<string | null>(null);
  const selectedPatientRef = useRef<UserType | null>(null);
  const overviewRequestsInProgress = useRef(new Set<string>());
  const patientSearchRequestId = useRef(0);
  const doctorSummaryRequestId = useRef(0);

  // New Note Modal
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<MedicalNote | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteType, setNoteType] = useState<MedicalNote['noteType']>('Prescription');
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [prescriptionRows, setPrescriptionRows] = useState<PrescriptionDraft[]>([
    { medicineName: '', dosage: '', frequency: '', duration: '', instructions: '', isCustom: false },
  ]);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [catalogSearchResults, setCatalogSearchResults] = useState<CatalogSearchMedicine[]>([]);
  const [catalogSearchMessage, setCatalogSearchMessage] = useState<string | null>(null);
  const [catalogSearchError, setCatalogSearchError] = useState<string | null>(null);
  const [catalogSearchLoading, setCatalogSearchLoading] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteActionMessage, setNoteActionMessage] = useState<string | null>(null);
  const [noteActionBusyId, setNoteActionBusyId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const specialtyMedicineNames = new Set(medicationOptions.medicines);
  const crossCatalogOptions = [...new Map(
    [
      ...catalogSearchResults,
      ...prescriptionRows.flatMap((row) => {
        if (row.isCustom || !row.medicineName || specialtyMedicineNames.has(row.medicineName)) {
          return [];
        }
        const selected = CATALOG_SEARCH_MEDICINES.find(
          (medicine) => medicine.name === row.medicineName
        );
        return selected ? [selected] : [];
      }),
    ].map((medicine) => [medicine.id, medicine])
  ).values()];

  const fetchDoctorData = useCallback(async () => {
    try {
      if (isDoctor) {
        const res = await medicalStaffAPI.getDoctorConsultations();
        if (res.success) setNotes(res.notes);
      } else if (user?.id) {
        // Patient viewing doctor prescriptions issued to them
        const res = await medicalStaffAPI.getPatientNotes(user.mediVaultId);
        if (res.success) setNotes(res.notes);
      }
    } catch (err: any) {
      setNoteError(err.response?.data?.message || 'Unable to load clinical consultations.');
    } finally {
      setLoading(false);
    }
  }, [isDoctor, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDoctorData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchDoctorData]);

  useEffect(() => {
    if (isDoctor) return;

    const timer = window.setInterval(() => {
      void fetchDoctorData();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [fetchDoctorData, isDoctor]);

  useEffect(() => {
    if (!isDoctor) return;

    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [isDoctor]);

  const loadApprovedPatients = useCallback(async (showLoading = false) => {
    if (showLoading) setApprovedPatientsLoading(true);

    try {
      const response = await clinicalAccessAPI.getRequests();
      setApprovedPatientsError(null);
      const now = Date.now();
      const activeGrants: ClinicalAccessRequest[] = response.requests
        .filter((request) =>
          request.status === 'approved' &&
          !request.isExpired &&
          request.expiresAt &&
          new Date(request.expiresAt).getTime() > now
        )
        .sort((left, right) =>
          new Date(right.expiresAt!).getTime() - new Date(left.expiresAt!).getTime()
        );
      const patientsById = new Map<string, UserType>();
      activeGrants.forEach((request) =>
        patientsById.set(request.patient.mediVaultId, request.patient)
      );
      setApprovedPatients(Array.from(patientsById.values()));
    } catch (err: any) {
      setApprovedPatientsError(err.response?.data?.message || 'Unable to load approved patients.');
    } finally {
      setApprovedPatientsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isDoctor) return;

    const initialLoadTimer = window.setTimeout(() => {
      void loadApprovedPatients();
    }, 0);
    const timer = window.setInterval(() => {
      void loadApprovedPatients();
    }, 30_000);
    const refreshOnFocus = () => {
      void loadApprovedPatients();
    };
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      window.clearTimeout(initialLoadTimer);
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [isDoctor, loadApprovedPatients]);

  useEffect(() => {
    const query = patientSearch.trim().toUpperCase();

    if (!/^MV-[A-F0-9]{16}$/.test(query)) {
      return;
    }

    const requestId = patientSearchRequestId.current;
    let isCurrent = true;
    const timer = window.setTimeout(async () => {
      try {
        const response = await medicalStaffAPI.searchPatients(query);
        if (!isCurrent || requestId !== patientSearchRequestId.current) return;
        if (response.success) setMatchedPatients(response.patients);
        setPatientSearchAttempted(true);
      } catch (err: any) {
        if (isCurrent && requestId === patientSearchRequestId.current) {
          setPatientSearchError(err.response?.data?.message || 'Unable to search patients.');
        }
      } finally {
        if (isCurrent && requestId === patientSearchRequestId.current) {
          setPatientSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [patientSearch]);

  const loadPatientOverview = useCallback(async (patient: UserType, showLoading = false) => {
    if (overviewRequestsInProgress.current.has(patient.mediVaultId)) return;
    overviewRequestsInProgress.current.add(patient.mediVaultId);
    if (showLoading) setOverviewLoading(true);

    try {
      const res = await medicalStaffAPI.getPatientClinicalOverview(patient.mediVaultId);
      if (selectedPatientRef.current?.mediVaultId === patient.mediVaultId && res.success) {
        setPatientOverview(res);
        setAccessRequestMessage(null);
      }
    } catch (err: any) {
      if (selectedPatientRef.current?.mediVaultId !== patient.mediVaultId) return;
      setPatientOverview(null);
      if (err.response?.status !== 403) {
        setAccessRequestMessage(err.response?.data?.message || 'Unable to load patient overview.');
      }
    } finally {
      overviewRequestsInProgress.current.delete(patient.mediVaultId);
      if (showLoading && selectedPatientRef.current?.mediVaultId === patient.mediVaultId) {
        setOverviewLoading(false);
      }
    }
  }, []);

  const handleSelectPatient = async (p: UserType) => {
    patientSearchRequestId.current += 1;
    selectedPatientRef.current = p;
    setSelectedPatient(p);
    setRequestReason('');
    setRequestReasonDetails('');
    setPatientSearch('');
    setMatchedPatients([]);
    setPatientSearchLoading(false);
    setPatientSearchAttempted(false);
    setPatientSearchError(null);
    setPatientOverview(null);
    setDoctorSummary(null);
    setDoctorSummaryModel(null);
    setDoctorSummaryError(null);
    doctorSummaryRequestId.current += 1;
    setOverviewLoading(true);
    setAccessRequestMessage(null);
    await loadPatientOverview(p, true);
  };

  const handleGenerateDoctorSummary = async () => {
    if (!selectedPatient) return;
    const patientMediVaultId = selectedPatient.mediVaultId;
    const requestId = ++doctorSummaryRequestId.current;
    setDoctorSummaryLoading(true);
    setDoctorSummaryError(null);
    setDoctorSummary(null);
    setDoctorSummaryModel(null);
    try {
      const response = await medicalStaffAPI.getPatientAiSummary(
        patientMediVaultId
      );
      if (requestId !== doctorSummaryRequestId.current) return;
      setDoctorSummary(response.summary);
      setDoctorSummaryModel(response.model);
    } catch (err: any) {
      if (requestId !== doctorSummaryRequestId.current) return;
      setDoctorSummaryError(
        err.response?.data?.message || 'Unable to generate the local AI overview.'
      );
    } finally {
      if (requestId === doctorSummaryRequestId.current) {
        setDoctorSummaryLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!selectedPatient || patientOverview || overviewLoading) return;

    const timer = window.setInterval(() => {
      void loadPatientOverview(selectedPatient);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [selectedPatient, patientOverview, overviewLoading, loadPatientOverview]);

  const handleRequestAccess = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !selectedPatient ||
      !requestReason ||
      (requestReason === 'Other' && requestReasonDetails.trim().length < 5)
    ) return;

    setRequestingAccess(true);
    setAccessRequestMessage(null);
    try {
      const response = await clinicalAccessAPI.createRequest({
        patientMediVaultId: selectedPatient.mediVaultId,
        reason: requestReason,
        ...(requestReason === 'Other'
          ? { reasonDetails: requestReasonDetails.trim() }
          : {}),
        requestedUntil: indiaInputToISO(requestedUntil),
      });
      setAccessRequestMessage(response.message);
      setRequestReason('');
      setRequestReasonDetails('');
    } catch (err: any) {
      setAccessRequestMessage(err.response?.data?.message || 'Unable to request patient access.');
    } finally {
      setRequestingAccess(false);
    }
  };

  const handleAddPrescriptionRow = () => {
    setPrescriptionRows((prev) => [
      ...prev,
      { medicineName: '', dosage: '', frequency: '', duration: '', instructions: '', isCustom: false },
    ]);
  };

  const handleRemovePrescriptionRow = (index: number) => {
    setPrescriptionRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCatalogSearch = async () => {
    const query = catalogSearchQuery.trim();
    if (query.length < 2) {
      setCatalogSearchError('Enter at least 2 characters to search the catalog.');
      setCatalogSearchMessage(null);
      return;
    }

    setCatalogSearchLoading(true);
    setCatalogSearchError(null);
    setCatalogSearchMessage(null);
    setCatalogSearchResults([]);
    try {
      const response = await medicalStaffAPI.searchMedicineCatalog(
        query,
        CATALOG_SEARCH_MEDICINES
      );
      const catalogById = new Map(
        CATALOG_SEARCH_MEDICINES.map((medicine) => [medicine.id, medicine])
      );
      const results = response.matches
        .map((id) => catalogById.get(id))
        .filter((medicine): medicine is CatalogSearchMedicine => Boolean(medicine));
      setCatalogSearchResults(results);
      setCatalogSearchMessage(
        results.length
          ? `${results.length} catalog match${results.length === 1 ? '' : 'es'} found. Matches are based on search terms only.`
          : 'No catalog entries matched that search phrase.'
      );
    } catch (error: unknown) {
      const fallbackIds = findCatalogTextMatches(CATALOG_SEARCH_MEDICINES, query);
      const catalogById = new Map(
        CATALOG_SEARCH_MEDICINES.map((medicine) => [medicine.id, medicine])
      );
      const fallbackResults = fallbackIds
        .map((id) => catalogById.get(id))
        .filter((medicine): medicine is CatalogSearchMedicine => Boolean(medicine));
      const aiErrorMessage =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
        'The local AI search service could not be reached.';
      setCatalogSearchResults(fallbackResults);
      if (fallbackResults.length) {
        setCatalogSearchMessage(
          `Local keyword matches shown because AI matching failed: ${aiErrorMessage} These are search results, not recommendations.`
        );
      } else {
        setCatalogSearchError(
          `AI catalog search failed: ${aiErrorMessage} No keyword matches were found; check the local Ollama service or try catalog terms.`
        );
      }
    } finally {
      setCatalogSearchLoading(false);
    }
  };

  const handleUpdatePrescriptionRow = (index: number, field: keyof PrescriptionItem, val: string) => {
    setPrescriptionRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: val } : row))
    );
  };

  const handlePrescriptionOptionChange = (
    index: number,
    field: 'dosage' | 'frequency' | 'duration' | 'instructions',
    customField: 'dosageIsCustom' | 'frequencyIsCustom' | 'durationIsCustom' | 'instructionsIsCustom',
    value: string
  ) => {
    const isCustom = value === 'other';
    setPrescriptionRows((rows) => rows.map((row, rowIndex) => rowIndex === index
      ? { ...row, [field]: isCustom ? '' : value, [customField]: isCustom }
      : row));
  };

  const openNewNote = () => {
    setEditingNote(null);
    setNoteTitle('');
    setNoteType('Prescription');
    setDiagnosis('');
    setClinicalNotes('');
    setFollowUpDate('');
    setPrescriptionRows([
      { medicineName: '', dosage: '', frequency: '', duration: '', instructions: '', isCustom: false },
    ]);
    setCatalogSearchQuery('');
    setCatalogSearchResults([]);
    setCatalogSearchMessage(null);
    setCatalogSearchError(null);
    setNoteError(null);
    setIsNoteModalOpen(true);
  };

  const openEditNote = (note: MedicalNote) => {
    const patient = typeof note.patient === 'object' ? note.patient : selectedPatient;
    if (!patient) {
      setNoteActionMessage('Unable to edit this note because its patient details are unavailable.');
      return;
    }
    setSelectedPatient(patient);
    selectedPatientRef.current = patient;
    setRequestReason('');
    setRequestReasonDetails('');
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteType(note.noteType);
    setDiagnosis(note.diagnosis || '');
    setClinicalNotes(note.clinicalNotes || '');
    setFollowUpDate(note.followUpDate?.slice(0, 10) || '');
    setPrescriptionRows(note.prescriptionItems.length
      ? note.prescriptionItems.map((item) => ({
          ...item,
          isCustom: !medicationOptions.medicines.includes(item.medicineName) &&
            !CATALOG_SEARCH_MEDICINES.some((medicine) => medicine.name === item.medicineName),
          dosageIsCustom: Boolean(item.dosage) && !DOSAGE_OPTIONS.includes(item.dosage),
          frequencyIsCustom: Boolean(item.frequency) && !FREQUENCY_OPTIONS.includes(item.frequency),
          durationIsCustom: Boolean(item.duration) && !DURATION_OPTIONS.includes(item.duration),
          instructionsIsCustom: Boolean(item.instructions) && !INSTRUCTION_OPTIONS.includes(item.instructions || ''),
        }))
      : [{ medicineName: '', dosage: '', frequency: '', duration: '', instructions: '', isCustom: false }]
    );
    setCatalogSearchQuery('');
    setCatalogSearchResults([]);
    setCatalogSearchMessage(null);
    setCatalogSearchError(null);
    setNoteError(null);
    setIsNoteModalOpen(true);
  };

  const closeNoteModal = () => {
    setIsNoteModalOpen(false);
    setEditingNote(null);
    setNoteError(null);
    setCatalogSearchQuery('');
    setCatalogSearchResults([]);
    setCatalogSearchMessage(null);
    setCatalogSearchError(null);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote && !selectedPatient) {
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
      const validPrescriptions = prescriptionRows
        .filter((row) => row.medicineName.trim().length > 0)
        .map((row) => ({
          medicineName: row.medicineName,
          dosage: row.dosage,
          frequency: row.frequency,
          duration: row.duration,
          instructions: row.instructions,
        }));
      const noteData = {
        noteType,
        title: noteTitle.trim(),
        diagnosis: diagnosis.trim(),
        prescriptionItems: validPrescriptions,
        clinicalNotes: clinicalNotes.trim(),
        followUpDate: followUpDate || undefined,
      };
      const res = editingNote
        ? await medicalStaffAPI.updateClinicalNote(editingNote._id, noteData)
        : await medicalStaffAPI.addClinicalNote({
            patientMediVaultId: selectedPatient!.mediVaultId,
            ...noteData,
          });

      if (res.success) {
        setIsNoteModalOpen(false);
        setEditingNote(null);
        setNoteTitle('');
        setDiagnosis('');
        setClinicalNotes('');
        setPrescriptionRows([
          { medicineName: '', dosage: '', frequency: '', duration: '', instructions: '', isCustom: false },
        ]);
        fetchDoctorData();
        // Refresh overview if open
        if (selectedPatient) await loadPatientOverview(selectedPatient, true);
      }
    } catch (err: any) {
      setNoteError(err.response?.data?.message || 'Failed to issue clinical note.');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleRequestNoteDeletion = async (note: MedicalNote) => {
    const reason = window.prompt('Why should this prescription or note be removed? The patient must approve the request.');
    if (!reason?.trim()) return;
    if (reason.trim().length < 5 || reason.trim().length > 500) {
      setNoteActionMessage('Enter a deletion reason between 5 and 500 characters.');
      return;
    }

    setNoteActionBusyId(note._id);
    setNoteActionMessage(null);
    try {
      const response = await medicalStaffAPI.requestNoteDeletion(note._id, reason.trim());
      setNoteActionMessage(response.message);
      await fetchDoctorData();
    } catch (err: any) {
      setNoteActionMessage(err.response?.data?.message || 'Unable to request note deletion.');
    } finally {
      setNoteActionBusyId(null);
    }
  };

  const handleNoteDeletionDecision = async (note: MedicalNote, decision: 'approved' | 'denied') => {
    setNoteActionBusyId(note._id);
    setNoteActionMessage(null);
    try {
      const response = await medicalStaffAPI.decideNoteDeletion(note._id, decision);
      setNoteActionMessage(response.message);
      await fetchDoctorData();
    } catch (err: any) {
      setNoteActionMessage(err.response?.data?.message || 'Unable to record your decision.');
    } finally {
      setNoteActionBusyId(null);
    }
  };

  return (
    <div className="clinical-workspace max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {isDoctor ? 'Clinical Consultations & Prescriptions' : 'My Clinical Prescriptions'}
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium">
              {isDoctor ? 'Medical Provider Hub' : 'Patient Vault'}
            </span>
          </div>
          {isDoctor && user?.mediVaultId && (
          <p className="mt-2 text-sm text-slate-500">
            Your MediVault ID: <span className="font-semibold text-slate-700 dark:text-slate-300">{user.mediVaultId}</span>
          </p>
          )}
          {isDoctor && user?.medicalStaffDetails && (
            <div className="clinical-credentials flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 mt-2">
              <span className="inline-flex items-center gap-2">
                <Award className="w-3.5 h-3.5 text-blue-500" />
                License: {user.medicalStaffDetails.licenseNumber || 'Verified Medical Officer'}
              </span>

              <span className="inline-flex items-center gap-2">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                {user.medicalStaffDetails.hospitalAffiliation || 'Primary Clinical Care'}
              </span>
              {user.medicalStaffDetails.specialization && (
                <>

                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {user.medicalStaffDetails.specialization}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {!isDoctor && (
          <button
            type="button"
            onClick={() => void fetchDoctorData()}
            title="Refresh prescriptions"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        )}
        {isDoctor && (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={openNewNote}
              disabled={!selectedPatient || !patientOverview}
              title="Creates a prescription or clinical note on the selected patient's record"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold button-primary shadow-sm transition-all disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Issue Digital Rx / Note
            </button>
            {!selectedPatient && (
              <p className="text-xs text-slate-500">Select an approved patient below to enable.</p>
            )}
            {selectedPatient && !patientOverview && (
              <p className="text-xs text-slate-500">
                {overviewLoading ? 'Loading patient records...' : 'An active patient-approved access grant is required.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Doctor Patient Lookup Bar */}
      {isDoctor && (
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Select Patient for Clinical Consultation
          </label>
          <div className="max-w-xl">
            <div className="mb-1 flex items-center justify-between gap-2">
              <label htmlFor="approved-patient" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Approved patients
              </label>
              <button
                type="button"
                onClick={() => void loadApprovedPatients(true)}
                disabled={approvedPatientsLoading}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 disabled:opacity-50 dark:text-blue-300"
              >
                <RefreshCw className={`h-3 w-3 ${approvedPatientsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            <select
              id="approved-patient"
              value={approvedPatients.some(
                (patient) => patient.mediVaultId === selectedPatient?.mediVaultId
              )
                ? selectedPatient?.mediVaultId
                : ''}
              onChange={(event) => {
                const patient = approvedPatients.find(
                  (item) => item.mediVaultId === event.target.value
                );
                if (patient) void handleSelectPatient(patient);
              }}
              disabled={approvedPatientsLoading || approvedPatients.length === 0}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <option value="">
                {approvedPatientsLoading
                  ? 'Loading approved patients...'
                  : approvedPatientsError
                    ? 'Could not load approved patients'
                    : approvedPatients.length
                      ? 'Choose an approved patient'
                      : 'No active approved patients'}
              </option>
              {approvedPatients.map((patient) => (
                <option key={patient.mediVaultId} value={patient.mediVaultId}>
                  {patient.name} - ID ending {patient.mediVaultId.slice(-4)}
                </option>
              ))}
            </select>
            {approvedPatientsError && (
              <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                {approvedPatientsError}
              </p>
            )}
          </div>
          <div className="relative max-w-xl">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={patientSearch}
              onChange={(event) => {
                const query = event.target.value.toUpperCase();
                patientSearchRequestId.current += 1;
                setPatientSearch(query);
                setMatchedPatients([]);
                setPatientSearchError(null);
                setPatientSearchAttempted(false);
                setPatientSearchLoading(/^MV-[A-F0-9]{16}$/.test(query.trim()));
              }}
              maxLength={19}
              autoComplete="off"
              placeholder="Enter the patient's MediVault ID (e.g. MV-1A2B3C4D5E6F7A8B)..."
              aria-label="Search patient by MediVault ID"
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
            />

            {/* Dropdown suggestions */}
            {matchedPatients.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {matchedPatients.map((p) => (
                  <button
                    key={p.mediVaultId}
                    type="button"
                    onClick={() => handleSelectPatient(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{p.name}</span>
                      <span className="text-slate-500 ml-2 font-sans">{p.mediVaultId}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600">
                      Select
                    </span>
                  </button>
                ))}
              </div>
            )}
            {patientSearch.trim() && !/^MV-[A-F0-9]{16}$/.test(patientSearch.trim()) && (
              <p className="mt-1 text-xs text-slate-500">
                Enter the complete 19-character MediVault ID to search.
              </p>
            )}
            {patientSearchLoading && (
              <p role="status" className="mt-1 text-xs text-slate-500">
                Searching for patient...
              </p>
            )}
            {patientSearchAttempted && !patientSearchLoading && matchedPatients.length === 0 && !patientSearchError && (
              <p className="mt-1 text-xs text-slate-500">
                No active patient account found for this MediVault ID.
              </p>
            )}
          </div>
          {patientSearchError && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{patientSearchError}</p>
          )}

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
                    <p className="text-xs text-slate-500 font-sans">MediVault ID: {selectedPatient.mediVaultId}</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsNoteModalOpen(true)}
                  disabled={!patientOverview}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold button-primary"
                >
                  Create Prescription
                </button>
                <button
                  type="button"
                  onClick={() => void loadPatientOverview(selectedPatient, true)}
                  disabled={overviewLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${overviewLoading ? 'animate-spin' : ''}`} />
                  Refresh records
                </button>
                {patientOverview && (
                  <Link
                    to={`/medical-staff/patients/${encodeURIComponent(selectedPatient.mediVaultId)}`}
                    className="inline-flex items-center rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    Open patient file
                  </Link>
                )}
                {patientOverview && (
                  <button
                    type="button"
                    onClick={() => void handleGenerateDoctorSummary()}
                    disabled={doctorSummaryLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 px-3.5 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-700 dark:text-violet-200 dark:hover:bg-violet-950/30"
                  >
                    {doctorSummaryLoading
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Sparkles className="h-3.5 w-3.5" />}
                    {doctorSummaryLoading ? 'Summarizing...' : 'AI clinical overview'}
                  </button>
                )}
              </div>

              {overviewLoading ? (
                <div className="py-6 flex items-center justify-center text-xs text-slate-500 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  Loading patient medical profile...
                </div>
              ) : patientOverview ? (
                <>
                {doctorSummaryError && (
                  <p
                    role="alert"
                    className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
                  >
                    {doctorSummaryError}
                  </p>
                )}
                {doctorSummary && (
                  <section className="mb-4 rounded-xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-500/20 dark:bg-violet-500/5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                        AI clinical overview
                      </h4>
                      <span className="ml-auto text-[10px] text-slate-500">
                        {doctorSummaryModel || 'Local model'} · not saved
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                      {doctorSummary.summary}
                    </p>
                    {[
                      { title: 'Key findings', items: doctorSummary.keyFindings },
                      { title: 'Medicines mentioned', items: doctorSummary.medicationMentions },
                      { title: 'Dates and values', items: doctorSummary.datesAndValues },
                      { title: 'Points to verify', items: doctorSummary.questionsForDoctor },
                    ].map(({ title, items }) => items.length > 0 && (
                      <div key={title} className="mt-3">
                        <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-100">{title}</h5>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-700 dark:text-slate-300">
                          {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
                        </ul>
                      </div>
                    ))}
                    <p className="mt-3 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
                      AI-generated from records covered by your active patient-approved grant. Verify findings in the original records; this is not a diagnosis or treatment recommendation.
                    </p>
                  </section>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Clinical Profile</span>
                    <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                      Blood Group: {patientOverview.profile?.bloodGroup || 'Unknown'}
                    </p>
                    <p className="text-slate-500">Gender: {patientOverview.profile?.gender || 'Not specified'}</p>
                    {patientOverview.profile?.dateOfBirth && (
                      <p className="text-slate-500">Date of birth: {patientOverview.profile.dateOfBirth}</p>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-200">
                    <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">
                      Known Allergies
                    </span>
                    <p className="mt-1 font-semibold">
                      {patientOverview.profile?.allergies?.length
                        ? patientOverview.profile?.allergies.join(', ')
                        : 'Not recorded'}
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
                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Health summary</h4>
                    <div className="mt-3 space-y-3 text-xs">
                      {[
                        { label: 'Conditions', values: patientOverview.profile?.medicalConditions || [] },
                        { label: 'Current medications', values: patientOverview.profile?.medications || [] },
                      ].map(({ label, values }) => (
                        <div key={label}>
                          <p className="mb-1 font-medium text-slate-600 dark:text-slate-400">{label}</p>
                          {values.length ? (
                            <div className="flex flex-wrap gap-1.5">
                              {values.map((value, index) => (
                                <span key={`${label}-${index}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                  {value}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-500">None recorded</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Recent clinical notes</h4>
                    {patientOverview.notes.length ? (
                      <div className="mt-3 space-y-3">
                        {patientOverview.notes.slice(0, 5).map((note) => (
                          <article key={note._id} className="border-l-2 border-blue-300 pl-3 text-xs dark:border-blue-700">
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <p className="font-semibold text-slate-800 dark:text-slate-200">{note.title}</p>
                              <time className="text-slate-500">{new Date(note.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' })}</time>
                            </div>
                            {note.diagnosis && <p className="mt-1 text-slate-600 dark:text-slate-400">Diagnosis: {note.diagnosis}</p>}
                            {note.clinicalNotes && <p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-400">{note.clinicalNotes}</p>}
                            {note.prescriptionItems.length > 0 && (
                              <p className="mt-1 text-slate-600 dark:text-slate-400">
                                Medicines: {note.prescriptionItems.map((item) => `${item.medicineName} (${item.dosage}, ${item.frequency})`).join('; ')}
                              </p>
                            )}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-slate-500">No previous clinical notes are available.</p>
                    )}
                  </section>
                </div>

                <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Patient reports</h4>
                      <p className="mt-0.5 text-xs text-slate-500">Report details and patient-provided notes are shown below. Open a report to review its original file.</p>
                    </div>
                    <span className="text-xs text-slate-500">{patientOverview.records.length} total</span>
                  </div>
                  {patientOverview.records.length ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {patientOverview.records.map((record) => {
                        const extractedText = record.metadata?.ocrExtractedText?.trim();
                        const textPreview = extractedText
                          ? extractedText.replace(/\s+/g, ' ').slice(0, 360)
                          : '';
                        return (
                          <article key={record._id} className="py-3 first:pt-0 last:pb-0">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                                  <h5 className="font-semibold text-sm text-slate-900 dark:text-white">{record.title}</h5>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{record.category}</span>
                                  {record.metadata?.identityCheck && (
                                    <span
                                      title={record.metadata.identityCheck.message}
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                        record.metadata.identityCheck.status === 'matched'
                                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
                                          : 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'
                                      }`}
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
                                </div>
                                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  {new Date(record.recordDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' })} · {record.fileName}
                                </p>
                                {record.description && (
                                  <p className="mt-2 text-xs leading-5 text-slate-700 dark:text-slate-300">
                                    <span className="font-medium">Patient note: </span>{record.description}
                                  </p>
                                )}
                                {textPreview && (
                                  <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-400">
                                    <span className="font-medium">Text from report: </span>
                                    {textPreview}{extractedText && extractedText.length > 360 ? '…' : ''}
                                  </p>
                                )}
                                {!record.description && !textPreview && (
                                  <p className="mt-2 text-xs text-slate-500">No summary is available; open the report to review its contents.</p>
                                )}
                              </div>
                              <div className="flex shrink-0 flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSummaryRecord(record)}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-300 px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-200 dark:hover:bg-violet-950/30"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  AI summary
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedRecord(record)}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Open report
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="py-5 text-center text-xs text-slate-500">No reports have been added to this patient’s vault.</p>
                  )}
                </section>
                </>
              ) : (
                <form
                  onSubmit={handleRequestAccess}
                  className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/20"
                >
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Request patient-specific access
                    </h4>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      The patient, their authorized full-access proxy, or an administrator must approve your request. Access ends at the approved time.
                    </p>
                  </div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Clinical purpose
                    <select
                      value={requestReason}
                      onChange={(event) => {
                        setRequestReason(event.target.value);
                        setRequestReasonDetails('');
                      }}
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    >
                      <option value="" disabled>Select a reason for access</option>
                      <option value="Continuity of care">Continuity of care</option>
                      <option value="Reviewing test results">Reviewing test results</option>
                      <option value="Diagnosis or treatment planning">Diagnosis or treatment planning</option>
                      <option value="Medication or prescription review">Medication or prescription review</option>
                      <option value="Follow-up care">Follow-up care</option>
                      <option value="Emergency or urgent care">Emergency or urgent care</option>
                      <option value="Second opinion">Second opinion</option>
                      <option value="Other">Other (please specify)</option>
                    </select>
                  </label>
                  {requestReason === 'Other' && (
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Please specify
                      <textarea
                        value={requestReasonDetails}
                        onChange={(event) => setRequestReasonDetails(event.target.value)}
                        required
                        minLength={5}
                        maxLength={500}
                        rows={2}
                        placeholder="Briefly explain why you need access."
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                      />
                    </label>
                  )}
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Requested access end (IST)
                    <input
                      type="datetime-local"
                      aria-label="Access end time in India Standard Time"
                      value={requestedUntil}
                      onChange={(event) => setRequestedUntil(event.target.value)}
                      required
                      className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    />
                  </label>
                  {accessRequestMessage && (
                    <div className="space-y-1">
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">{accessRequestMessage}</p>
                      <p className="text-xs text-slate-500">This page checks for approval automatically. You can also use “Refresh records” above.</p>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={
                      requestingAccess ||
                      !requestReason ||
                      (requestReason === 'Other' && requestReasonDetails.trim().length < 5)
                    }
                    className="rounded-lg button-primary px-3.5 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    {requestingAccess ? 'Sending request...' : 'Send access request'}
                  </button>
                </form>
              )}
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

        {noteActionMessage && (
          <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            {noteActionMessage}
          </p>
        )}

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
                      {!isDoctor && note.noteType === 'Prescription' &&
                        typeof note.doctor === 'object' && note.doctor?.name && (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                            Prescribed by Dr. {note.doctor.name}
                          </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Issued on {new Date(note.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                  </div>

                  {note.diagnosis && (
                    <span className="text-xs font-sans px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      Dx: {note.diagnosis}
                    </span>
                  )}
                </div>

                {note.deletedAt && isDoctor && (
                  <p className="text-xs text-rose-700 dark:text-rose-300">Patient-approved removal completed. This record is retained for audit.</p>
                )}
                {note.deletionRequest?.status === 'pending' && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="font-semibold">Deletion request awaiting patient approval</p>
                    {note.deletionRequest.reason && <p className="mt-1">Reason: {note.deletionRequest.reason}</p>}
                    {!isDoctor && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleNoteDeletionDecision(note, 'approved')}
                          disabled={noteActionBusyId === note._id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-2 font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve deletion
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleNoteDeletionDecision(note, 'denied')}
                          disabled={noteActionBusyId === note._id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <X className="h-3.5 w-3.5" /> Keep prescription
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {isDoctor && !note.deletedAt && note.deletionRequest?.status !== 'pending' && (
                  <div className="flex flex-wrap items-center gap-2">
                    {currentTime < new Date(note.createdAt).getTime() + 60 * 60 * 1000 && (
                      <button
                        type="button"
                        onClick={() => openEditNote(note)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit ({Math.ceil((new Date(note.createdAt).getTime() + 60 * 60 * 1000 - currentTime) / 60_000)} min left)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleRequestNoteDeletion(note)}
                      disabled={noteActionBusyId === note._id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Request deletion
                    </button>
                  </div>
                )}
                {isDoctor && note.deletionRequest?.status === 'denied' && (
                  <p className="text-xs text-slate-500">The patient declined the deletion request. The note remains in the record.</p>
                )}

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
                  {editingNote ? 'Edit Prescription & Clinical Note' : 'Issue Digital Prescription & Clinical Note'}
                </h3>
                <p className="text-xs text-slate-500">
                  Patient: {selectedPatient?.name}
                </p>
              </div>
              <button
                onClick={closeNoteModal}
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
              <details open className="group rounded-lg border border-slate-200 dark:border-slate-800">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Prescribed Medications ({prescriptionRows.length})
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-2 border-t border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddPrescriptionRow}
                      className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Medication
                    </button>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
                    <p className="font-semibold text-emerald-800 dark:text-emerald-200">{medicationOptions.specialty}</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      {!medicationOptions.hasSuggestions
                        ? 'No default medicine list is configured for this specialty. Search the full catalog by name or keyword, or enter a medicine manually.'
                        : 'Search-only reference examples from the specialty catalog—not recommendations. Verify clinical suitability, local guidance, allergies, interactions, formulation, and dose before prescribing.'}
                    </p>
                  </div>
                  <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <label htmlFor="medicine-catalog-search" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Search the full catalog
                      <span className="mt-0.5 block font-normal text-slate-500">
                        Search terms only; results are not recommendations for this specialty.
                      </span>
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        id="medicine-catalog-search"
                        type="search"
                        maxLength={160}
                        value={catalogSearchQuery}
                        onChange={(event) => setCatalogSearchQuery(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void handleCatalogSearch();
                          }
                        }}
                        placeholder="Medicine, class, dosage form, or keyword"
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => void handleCatalogSearch()}
                        disabled={catalogSearchLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {catalogSearchLoading
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Sparkles className="h-4 w-4" />}
                        {catalogSearchLoading ? 'Searching...' : 'AI catalog search'}
                      </button>
                    </div>
                    {catalogSearchError && (
                      <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
                        {catalogSearchError}
                      </p>
                    )}
                    {catalogSearchMessage && (
                      <p role="status" className="text-xs text-slate-600 dark:text-slate-400">
                        {catalogSearchMessage}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Shared general entries and specialty search references are not recommendations. Catalog entries require prescriber validation; confirm the review flags, clinical suitability, allergies, interactions, local policy, formulation, and strength.
                  </p>

                  <div className="space-y-2">
                  {prescriptionRows.map((row, idx) => (
                    <div
                      key={idx}
                      className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div className="space-y-1.5">
                        <select
                          value={row.isCustom ? 'custom' : row.medicineName}
                          onChange={(event) => {
                            const isCustom = event.target.value === 'custom';
                            const medicineName = [
                              ...medicationOptions.medicines,
                              ...crossCatalogOptions.map((medicine) => medicine.name),
                            ].find((name) => name === event.target.value);
                            setPrescriptionRows((current) =>
                              current.map((item, rowIndex) => rowIndex === idx
                                ? { ...item, isCustom, medicineName: isCustom ? '' : medicineName || '' }
                                : item)
                            );
                          }}
                          aria-label={`Medication for prescription row ${idx + 1}`}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                        >
                          <option value="">Select medication...</option>
                          {medicationOptions.medicines.length > 0 && (
                            <optgroup label={medicationOptions.listLabel}>
                              {medicationOptions.medicines.map((name) => {
                                const riskFlag = medicationOptions.medicineReferences[name].riskFlag;
                                const riskLabel = medicineRiskLabels[riskFlag];
                                return (
                                  <option key={name} value={name}>
                                    {riskLabel ? `${name} — ${riskLabel}` : name}
                                  </option>
                                );
                              })}
                            </optgroup>
                          )}
                          {crossCatalogOptions.length > 0 && (
                            <optgroup label="Full catalog · search matches only">
                              {crossCatalogOptions
                                .filter((medicine) => !medicationOptions.medicines.includes(medicine.name))
                                .map((medicine) => {
                                  const riskLabel = medicineRiskLabels[medicine.riskFlag];
                                  return (
                                    <option key={medicine.id} value={medicine.name}>
                                      {riskLabel
                                        ? `${medicine.name} — ${riskLabel}`
                                        : medicine.name}
                                    </option>
                                  );
                                })}
                            </optgroup>
                          )}
                          <option value="custom">Other - enter manually</option>
                        </select>
                        {row.isCustom ? (
                          <input
                            type="text"
                            placeholder="Enter medicine name, formulation and strength"
                            aria-label={`Custom medicine for prescription row ${idx + 1}`}
                            value={row.medicineName}
                            onChange={(event) => handleUpdatePrescriptionRow(idx, 'medicineName', event.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                          />
                        ) : (
                          <>
                            {(medicationOptions.medicineReferences[row.medicineName] ||
                              crossCatalogOptions.find((medicine) => medicine.name === row.medicineName)) && (
                              <div className="space-y-0.5 text-[10px] text-slate-500">
                                <p><span className="font-semibold">Reference class:</span> {(medicationOptions.medicineReferences[row.medicineName] || crossCatalogOptions.find((medicine) => medicine.name === row.medicineName))?.therapeuticClass}</p>
                                <p><span className="font-semibold">Search forms only:</span> {(medicationOptions.medicineReferences[row.medicineName] || crossCatalogOptions.find((medicine) => medicine.name === row.medicineName))?.dosageForms.join(', ') || 'Not listed'}</p>
                                {(medicationOptions.medicineReferences[row.medicineName] || crossCatalogOptions.find((medicine) => medicine.name === row.medicineName))?.clinicalReviewFlags.map((flag) => (
                                  <p key={flag} className="font-semibold text-amber-700 dark:text-amber-400">
                                    Review: {flag.toLowerCase().replace(/_/g, ' ')}
                                  </p>
                                ))}
                                {medicineRiskLabels[(medicationOptions.medicineReferences[row.medicineName] || crossCatalogOptions.find((medicine) => medicine.name === row.medicineName))?.riskFlag || 'standard'] && (
                                  <p className="font-semibold text-amber-700 dark:text-amber-400">
                                    {medicineRiskLabels[(medicationOptions.medicineReferences[row.medicineName] || crossCatalogOptions.find((medicine) => medicine.name === row.medicineName))?.riskFlag || 'standard']}. Follow applicable specialist controls and local policy.
                                  </p>
                                )}
                              </div>
                            )}
                            {MEDICATION_CATALOG
                              .filter((medication) => medication.name === row.medicineName)
                              .map((medication) => (
                                <div key={medication.name} className="space-y-0.5 text-[10px] text-slate-500">
                                  <p><span className="font-semibold">Active ingredient:</span> {medication.ingredient}</p>
                                  <p><span className="font-semibold">Common use:</span> {medication.use}</p>
                                  <p className="text-amber-700 dark:text-amber-400"><span className="font-semibold">Check:</span> {medication.caution}</p>
                                </div>
                              ))}
                          </>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="space-y-1">
                          <select
                            aria-label={`Dosage for medication ${idx + 1}`}
                            value={row.dosageIsCustom ? 'other' : row.dosage}
                            onChange={(event) => handlePrescriptionOptionChange(idx, 'dosage', 'dosageIsCustom', event.target.value)}
                            className="w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                          >
                            <option value="">Select dosage...</option>
                            {DOSAGE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                            <option value="other">Other...</option>
                          </select>
                          {row.dosageIsCustom && (
                            <input
                              type="text"
                              aria-label={`Custom dosage for medication ${idx + 1}`}
                              placeholder="Enter dosage"
                              value={row.dosage}
                              onChange={(event) => handleUpdatePrescriptionRow(idx, 'dosage', event.target.value)}
                              className="w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                            />
                          )}
                        </div>
                        <div className="space-y-1">
                          <select
                            aria-label={`Frequency for medication ${idx + 1}`}
                            value={row.frequencyIsCustom ? 'other' : row.frequency}
                            onChange={(event) => handlePrescriptionOptionChange(idx, 'frequency', 'frequencyIsCustom', event.target.value)}
                            className="w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                          >
                            <option value="">Select frequency...</option>
                            {FREQUENCY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                            <option value="other">Other...</option>
                          </select>
                          {row.frequencyIsCustom && (
                            <input
                              type="text"
                              aria-label={`Custom frequency for medication ${idx + 1}`}
                              placeholder="Enter frequency"
                              value={row.frequency}
                              onChange={(event) => handleUpdatePrescriptionRow(idx, 'frequency', event.target.value)}
                              className="w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                            />
                          )}
                        </div>
                        <div className="flex min-w-0 items-start gap-1">
                          <div className="min-w-0 flex-1 space-y-1">
                            <select
                              aria-label={`Duration for medication ${idx + 1}`}
                              value={row.durationIsCustom ? 'other' : row.duration}
                              onChange={(event) => handlePrescriptionOptionChange(idx, 'duration', 'durationIsCustom', event.target.value)}
                              className="w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                            >
                              <option value="">Select duration...</option>
                              {DURATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                              <option value="other">Other...</option>
                            </select>
                            {row.durationIsCustom && (
                              <input
                                type="text"
                                aria-label={`Custom duration for medication ${idx + 1}`}
                                placeholder="Enter duration"
                                value={row.duration}
                                onChange={(event) => handleUpdatePrescriptionRow(idx, 'duration', event.target.value)}
                                className="w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                              />
                            )}
                          </div>
                          {prescriptionRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePrescriptionRow(idx)}
                              aria-label={`Remove medication ${idx + 1}`}
                              className="shrink-0 p-1 text-slate-400 hover:text-rose-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor={`prescription-instructions-${idx}`} className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          Instructions
                        </label>
                        <select
                          id={`prescription-instructions-${idx}`}
                          value={row.instructionsIsCustom ? 'other' : row.instructions || ''}
                          onChange={(event) => handlePrescriptionOptionChange(idx, 'instructions', 'instructionsIsCustom', event.target.value)}
                          className="w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                        >
                          <option value="">No additional instructions</option>
                          {INSTRUCTION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                          <option value="other">Other...</option>
                        </select>
                        {row.instructionsIsCustom && (
                          <input
                            type="text"
                            aria-label={`Custom instructions for medication ${idx + 1}`}
                            placeholder="Enter instructions"
                            value={row.instructions || ''}
                            onChange={(event) => handleUpdatePrescriptionRow(idx, 'instructions', event.target.value)}
                            className="w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              </details>

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
                  onClick={closeNoteModal}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNote}
                  className="px-4 py-2 text-sm font-semibold button-primary rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {submittingNote && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingNote ? 'Save changes' : 'Sign & Issue Prescription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedRecord && (
        <RecordViewerModal
          record={selectedRecord}
          allowDelete={false}
          onClose={() => setSelectedRecord(null)}
        />
      )}
      <RecordSummaryModal
        record={summaryRecord}
        audience="clinician"
        onClose={() => setSummaryRecord(null)}
      />
    </div>
  );
};
