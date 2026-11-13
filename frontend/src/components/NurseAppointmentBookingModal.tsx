import React, { useEffect, useState } from 'react';
import { CalendarPlus, CheckCircle, Clock, Loader2, Search, UserCheck } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { appointmentsAPI } from '../services/api';

interface PatientSummary {
  id: string;
  name: string;
  mediVaultId: string;
  dateOfBirth?: string;
  gender?: string;
}

interface HospitalDoctor {
  id: string;
  name: string;
  specialization: string;
  schedule: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDurationMinutes: number;
  }>;
}

export const NurseAppointmentBookingModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [mediVaultId, setMediVaultId] = useState('');
  const [searchingPatient, setSearchingPatient] = useState(false);
  const [patient, setPatient] = useState<PatientSummary | null>(null);

  const [doctors, setDoctors] = useState<HospitalDoctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [slotResult, setSlotResult] = useState<{ key: string; slots: string[] } | null>(null);
  const [appointmentDate, setAppointmentDate] = useState(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  });
  const [appointmentTime, setAppointmentTime] = useState('10:00');
  const [chiefComplaint, setChiefComplaint] = useState('');

  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const slotRequestKey = `${selectedDoctorId}:${appointmentDate}`;
  const availableSlots = slotResult?.key === slotRequestKey ? slotResult.slots : [];
  const loadingSlots = Boolean(isOpen && selectedDoctorId && appointmentDate && slotResult?.key !== slotRequestKey);

  useEffect(() => {
    if (!isOpen) return;
    const fetchDoctors = async () => {
      try {
        const res = await appointmentsAPI.getHospitals();
        const hospitalName = user?.medicalStaffDetails?.hospitalAffiliation?.trim();
        const affiliatedHospital = res.hospitals.find((hospital) => hospital.name.trim() === hospitalName);
        const docs = affiliatedHospital?.doctors.map((doctor) => ({
          id: doctor.id,
          name: doctor.name,
          specialization: doctor.specialization,
          schedule: doctor.schedule,
        })) || [];
        setDoctors(docs);
        setSelectedDoctorId(docs[0]?.id || '');
        if (!docs.length) {
          setError('No approved physicians with appointment schedules were found at your hospital.');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load doctors list.');
      }
    };
    void fetchDoctors();
  }, [isOpen, user?.medicalStaffDetails?.hospitalAffiliation]);

  useEffect(() => {
    if (!isOpen || !selectedDoctorId || !appointmentDate) return;
    let current = true;
    void appointmentsAPI.getAvailability(selectedDoctorId, appointmentDate)
      .then((response) => {
        if (current) {
          const slots = response.slots
            .filter((slot) => slot.status === 'available' && new Date(`${appointmentDate}T${slot.time}:00+05:30`).getTime() > Date.now())
            .map((slot) => slot.time);
          setSlotResult({ key: slotRequestKey, slots });
          setAppointmentTime(slots[0] || '');
          setError(null);
        }
      })
      .catch((err: any) => {
        if (current) {
          setSlotResult({ key: slotRequestKey, slots: [] });
          setError(err.response?.data?.message || 'Failed to load available appointment slots.');
        }
      });
    return () => {
      current = false;
    };
  }, [appointmentDate, isOpen, selectedDoctorId, slotRequestKey]);

  if (!isOpen) return null;

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediVaultId.trim()) return;
    setSearchingPatient(true);
    setError(null);
    setPatient(null);
    const lookupId = mediVaultId.trim().toUpperCase();
    try {
      const res = await appointmentsAPI.lookupPatientByMediVaultId(lookupId);
      setPatient(res.patient);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Patient not found with this MediVault ID.');
    } finally {
      setSearchingPatient(false);
    }
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient || patient.mediVaultId !== mediVaultId.trim().toUpperCase() ||
      !selectedDoctorId || !availableSlots.includes(appointmentTime)) return;
    setBooking(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await appointmentsAPI.staffBook({
        patientMediVaultId: patient.mediVaultId,
        doctorId: selectedDoctorId,
        appointmentDate,
        time: appointmentTime,
        chiefComplaint,
      });
      setSuccessMsg(res.message);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not schedule appointment.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="surface-card w-full max-w-xl rounded-2xl border border-slate-200 p-6 shadow-2xl dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-teal-50 p-2 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
              <CalendarPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Assisted Patient Booking
              </h2>
              <p className="text-xs text-slate-500">
                Book a doctor consultation on behalf of a patient using their MediVault ID
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle className="h-4 w-4 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Step 1: Lookup Patient */}
        <form onSubmit={handleLookup} className="mt-4">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Step 1: Patient MediVault ID
          </label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              placeholder="e.g. MV-4BDB61AAFAA83B9A"
              value={mediVaultId}
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                setMediVaultId(value);
                if (patient && patient.mediVaultId !== value.trim()) setPatient(null);
              }}
              disabled={searchingPatient || booking}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm uppercase dark:border-slate-700 dark:bg-slate-950"
              required
            />
            <button
              type="submit"
              disabled={searchingPatient || booking || !mediVaultId.trim()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg button-primary px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {searchingPatient ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Verify
            </button>
          </div>
        </form>

        {patient && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/70 p-3 text-xs dark:border-teal-900 dark:bg-teal-950/30">
            <UserCheck className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{patient.name}</p>
              <p className="text-slate-600 dark:text-slate-300">
                ID: {patient.mediVaultId} · Gender: {patient.gender || 'Not specified'} · DOB: {patient.dateOfBirth || 'Not specified'}
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Choose Doctor & Time */}
        {patient && (
          <form onSubmit={handleBook} className="mt-5 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Select Physician
              </label>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                disabled={!doctors.length || booking}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    Dr. {doc.name} {doc.specialization ? `(${doc.specialization})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Appointment Date
                </label>
                <input
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Consultation Time (IST)
                </label>
                <select
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  disabled={loadingSlots || !availableSlots.length || booking}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  required
                >
                  {loadingSlots && <option value="">Loading available slots...</option>}
                  {!loadingSlots && !availableSlots.length && <option value="">No available slots</option>}
                  {availableSlots.map((slot) => <option key={slot} value={slot}>{slot} IST</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Chief Complaint / Presenting Reason (optional)
              </label>
              <textarea
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="e.g. Follow-up after surgery, persistent cough for 4 days"
                rows={2}
                maxLength={500}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={booking || loadingSlots || !availableSlots.includes(appointmentTime)}
                className="inline-flex items-center gap-1.5 rounded-lg button-primary px-4 py-2 text-xs font-semibold disabled:opacity-50"
              >
                {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                Confirm Appointment
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
