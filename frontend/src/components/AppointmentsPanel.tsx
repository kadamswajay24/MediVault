import { indiaDateInput, indiaTimeInput } from '../utils/indiaFormat';
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { CalendarDays, Check, Clock3, Loader2, MapPin, X } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import {
  appointmentsAPI,
  type AppointmentEntry,
  type AppointmentScheduleDay,
} from '../services/api';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getLocalDate = indiaDateInput;
const getLocalTime = indiaTimeInput;

const getError = (error: unknown, fallback: string) =>
  axios.isAxiosError<{ message?: string }>(error)
    ? error.response?.data?.message || fallback
    : fallback;

const formatDate = (date: string) => new Date(`${date}T00:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' });
const formatTime = (time: string) => new Date(`2000-01-01T${time}:00+05:30`).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }) + ' IST';

type ScheduleFormDay = AppointmentScheduleDay & { enabled: boolean };
type StaffAppointmentsTab = 'upcoming' | 'approvals' | 'schedule' | 'recent';

const emptySchedule = (): ScheduleFormDay[] =>
  DAY_NAMES.map((_, dayOfWeek) => ({
    dayOfWeek,
    startTime: '09:00',
    endTime: '17:00',
    slotDurationMinutes: 30,
    enabled: false,
  }));

const getAppointmentStatus = (status: AppointmentEntry['status']) => {
  if (status === 'confirmed') return 'Confirmed';
  if (status === 'pending') return 'Awaiting staff approval';
  if (status === 'declined') return 'Declined';
  return 'Cancelled';
};

export const AppointmentsPanel: React.FC = () => {
  const { user, activeDependent } = useAuth();
  const isStaff = user?.role === 'medical_staff';
  const canBook = !activeDependent || activeDependent.accessLevel === 'full';

  const [hospitals, setHospitals] = useState<{ name: string; doctors: {
    id: string;
    name: string;
    specialization: string;
    schedule: AppointmentScheduleDay[];
  }[]; nurses: { id: string; name: string }[] }[]>([]);
  const [hospitalName, setHospitalName] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [nurseId, setNurseId] = useState('');
  const [nursingAccessConsent, setNursingAccessConsent] = useState(false);
  const [professionalProfile, setProfessionalProfile] = useState<{
    name: string;
    professionalType: 'physician' | 'nurse';
    specialization?: string;
    hospitalName: string;
  } | null>(null);
  const [appointmentDate, setAppointmentDate] = useState(getLocalDate);
  const [availability, setAvailability] = useState<Awaited<ReturnType<typeof appointmentsAPI.getAvailability>> | null>(null);
  const [availabilityRequestKey, setAvailabilityRequestKey] = useState('');
  const [appointments, setAppointments] = useState<AppointmentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [bookingTime, setBookingTime] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [suggestedSlots, setSuggestedSlots] = useState<string[]>([]);

  const [schedule, setSchedule] = useState<ScheduleFormDay[]>(emptySchedule);
  const [availableManagers, setAvailableManagers] = useState<{ id: string; name: string; medicalStaffDetails?: { specialization?: string } }[]>([]);
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [requests, setRequests] = useState<AppointmentEntry[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<AppointmentEntry[]>([]);
  const [recentAppointments, setRecentAppointments] = useState<AppointmentEntry[]>([]);
  const [staffTab, setStaffTab] = useState<StaffAppointmentsTab>('upcoming');
  const [busyRequest, setBusyRequest] = useState('');

  const [cancelId, setCancelId] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [revokingNursingAccess, setRevokingNursingAccess] = useState('');
  const [nurseAssignments, setNurseAssignments] = useState<Record<string, string>>({});
  const [nurseAssignmentConsent, setNurseAssignmentConsent] = useState<Record<string, boolean>>({});
  const [assigningNurse, setAssigningNurse] = useState('');
  const assignExistingNurse = async (appointmentId: string) => {
    const nurseId = nurseAssignments[appointmentId];
    if (!nurseId || !nurseAssignmentConsent[appointmentId]) return;
    setAssigningNurse(appointmentId); setError(null); setMessage(null);
    try {
      const response = await appointmentsAPI.assignNurse(appointmentId, nurseId);
      setMessage(response.message); setNurseAssignmentConsent(current => ({ ...current, [appointmentId]: false }));
      await refreshAppointments();
    } catch (failure) { setError(getError(failure, 'Unable to assign this nurse.')); }
    finally { setAssigningNurse(''); }
  };
  const revokeNursingAccess = async (appointmentId: string) => {
    setRevokingNursingAccess(appointmentId); setError(null); setMessage(null);
    try {
      const response = await appointmentsAPI.revokeNursingAccess(appointmentId);
      setMessage(response.message); await refreshAppointments();
    } catch (failure) { setError(getError(failure, 'Unable to revoke nursing access.')); }
    finally { setRevokingNursingAccess(''); }
  };
  const cancelBooking = async () => {
    if (!cancelId || cancelling) return;
    setCancelling(true); setError(null); setMessage(null);
    try {
      const response = await appointmentsAPI.cancel(cancelId);
      setMessage(response.message); setCancelId('');
      await refreshAppointments();
      if (doctorId && appointmentDate) setAvailability(await appointmentsAPI.getAvailability(doctorId, appointmentDate));
    } catch (failure) { setError(getError(failure, 'Unable to cancel or refresh the appointment.')); }
    finally { setCancelling(false); }
  };

  const refreshAppointments = useCallback(async () => {
    const response = await appointmentsAPI.getMine();
    setAppointments(response.appointments);
  }, []);

  const refreshStaffData = useCallback(async () => {
    const [scheduleResponse, requestsResponse, calendarResponse] = await Promise.all([
      appointmentsAPI.getMySchedule(),
      appointmentsAPI.getMyRequests(),
      appointmentsAPI.getMyStaffAppointments(getLocalDate(), getLocalTime()),
    ]);
    const configuredDays = new Map(
      scheduleResponse.schedule.map((entry) => [entry.dayOfWeek, entry])
    );
    setAvailableManagers(scheduleResponse.availableManagers);
    setManagerIds(scheduleResponse.managerIds);
    setSchedule(emptySchedule().map((day) => {
      const configured = configuredDays.get(day.dayOfWeek);
      return configured ? { ...configured, enabled: true } : day;
    }));
    setRequests(requestsResponse.appointments);
    setUpcomingAppointments(calendarResponse.upcoming);
    setRecentAppointments(calendarResponse.recent);
  }, []);

  useEffect(() => {
    let current = true;
    const load = async () => {
      try {
        setError(null);
        if (isStaff) {
          await refreshStaffData();
        } else {
          const [hospitalResponse, appointmentResponse] = await Promise.all([
            appointmentsAPI.getHospitals(),
            appointmentsAPI.getMine(),
          ]);
          if (!current) return;
          setHospitals(hospitalResponse.hospitals);
          setAppointments(appointmentResponse.appointments);
          if (hospitalResponse.hospitals.length) {
            setHospitalName(hospitalResponse.hospitals[0].name);
            setDoctorId(hospitalResponse.hospitals[0].doctors[0]?.id || '');
          }
        }
      } catch (loadError) {
        if (current) setError(getError(loadError, 'Unable to load appointments.'));
      } finally {
        if (current) setLoading(false);
      }
    };
    void load();
    return () => {
      current = false;
    };
  }, [activeDependent?.mediVaultId, isStaff, refreshStaffData]);

  const selectedHospital = hospitals.find((hospital) => hospital.name === hospitalName);
  const selectedDoctor = selectedHospital?.doctors.find((doctor) => doctor.id === doctorId);
  const selectedNurse = selectedHospital?.nurses.find((nurse) => nurse.id === nurseId);

  useEffect(() => {
    if (isStaff || !doctorId || !appointmentDate) {
      return;
    }
    let current = true;
    const requestKey = `${doctorId}:${appointmentDate}`;
    void appointmentsAPI.getAvailability(doctorId, appointmentDate)
      .then((response) => {
        if (current) {
          setAvailability(response);
          setAvailabilityRequestKey(requestKey);
        }
      })
      .catch((loadError: unknown) => {
        if (current) {
          setError(getError(loadError, 'Unable to load appointment availability.'));
          setAvailabilityRequestKey(requestKey);
        }
      });
    return () => {
      current = false;
    };
  }, [appointmentDate, doctorId, isStaff]);

  const bookAppointment = async (time: string, requestApproval = false) => {
    if (!doctorId || !availability?.schedule) return;
    if (nurseId && !nursingAccessConsent) {
      setError('Approve the limited nursing access or remove the nurse from this appointment.');
      return;
    }
    const selectedMinutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
    const startMinutes =
      Number(availability.schedule.startTime.slice(0, 2)) * 60 +
      Number(availability.schedule.startTime.slice(3, 5));
    if (
      !time ||
      selectedMinutes < startMinutes ||
      selectedMinutes + availability.schedule.slotDurationMinutes >
        Number(availability.schedule.endTime.slice(0, 2)) * 60 +
          Number(availability.schedule.endTime.slice(3, 5))
    ) {
      setError("Choose a time within the doctor's configured working hours.");
      return;
    }
    if (
      requestApproval &&
      (selectedMinutes - startMinutes) % availability.schedule.slotDurationMinutes === 0
    ) {
      setError('Choose an available listed slot above, or request a time between the listed slots.');
      return;
    }

    setBooking(true);
    setError(null);
    setMessage(null);
    setSuggestedSlots([]);
    try {
      const response = await appointmentsAPI.book({
        doctorId,
        appointmentDate,
        time,
        timeZoneOffsetMinutes: 330,
        ...(nurseId ? { nurseId, nursingAccessConsent } : {}),
      });
      setMessage(response.message);
      setCustomTime('');
      setBookingTime('');
      await refreshAppointments();
      const freshAvailability = await appointmentsAPI.getAvailability(doctorId, appointmentDate);
      setAvailability(freshAvailability);
    } catch (bookingError) {
      if (axios.isAxiosError<{ message?: string; alternatives?: string[] }>(bookingError)) {
        setError(bookingError.response?.data?.message || 'Unable to book this appointment.');
        setSuggestedSlots(bookingError.response?.data?.alternatives || []);
      } else {
        setError('Unable to book this appointment.');
      }
    } finally {
      setBooking(false);
    }
  };

  const saveSchedule = async () => {
    setSavingSchedule(true);
    setError(null);
    setMessage(null);
    try {
      const response = await appointmentsAPI.updateMySchedule(
        schedule.filter((day) => day.enabled).map(({ enabled: _enabled, ...day }) => day),
        managerIds
      );
      setSchedule(emptySchedule().map((day) => {
        const saved = response.schedule.find((entry) => entry.dayOfWeek === day.dayOfWeek);
        return saved ? { ...saved, enabled: true } : day;
      }));
      setMessage(response.message);
    } catch (saveError) {
      setError(getError(saveError, 'Unable to save working hours.'));
    } finally {
      setSavingSchedule(false);
    }
  };

  const decideRequest = async (requestId: string, decision: 'confirmed' | 'declined') => {
    setBusyRequest(requestId);
    setError(null);
    setMessage(null);
    try {
      const response = await appointmentsAPI.decide(requestId, decision);
      setMessage(response.message);
      await refreshStaffData();
    } catch (decisionError) {
      setError(getError(decisionError, 'Unable to update this appointment request.'));
    } finally {
      setBusyRequest('');
    }
  };

  if (loading) {
    return (
      <section className="surface-card flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading appointments...
      </section>
    );
  }

  const availableSlots = availability?.slots.filter((slot) => slot.status === 'available') || [];
  const offeredTimes = new Set(availability?.slots.map((slot) => slot.time) || []);
  const availabilityLoading = Boolean(
    doctorId && availabilityRequestKey !== `${doctorId}:${appointmentDate}`
  );

  return (
    <section className="surface-card space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            {isStaff ? <Clock3 className="h-5 w-5 text-emerald-500" /> : <CalendarDays className="h-5 w-5 text-emerald-500" />}
            {isStaff ? 'Appointment management' : 'Book a hospital appointment'}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {isStaff
              ? 'Configure your working hours and review appointment requests.'
              : activeDependent
                ? `Booking for ${activeDependent.name}.`
                : 'Choose a hospital, doctor, date, and an available appointment time.'}
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          {message}
        </div>
      )}
      {!isStaff && activeDependent?.accessLevel === 'read_only' && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          This caregiver authorization is read-only, so you can view the patient's appointments but cannot make bookings.
        </p>
      )}

      {isStaff ? (
        <>
          <div role="tablist" aria-label="Appointment management views" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
            {([
              ['upcoming', `Upcoming (${upcomingAppointments.length})`],
              ['approvals', `Approvals (${requests.length})`],
              ['schedule', 'Working hours'],
              ['recent', `Recent past (${recentAppointments.length})`],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={staffTab === tab}
                onClick={() => setStaffTab(tab)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  staffTab === tab
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {staffTab === 'schedule' && <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Weekly working hours</h3>
              <p className="text-xs text-slate-500">Patients can book available listed slots. Requests between slots need your approval.</p>
            </div>
            {availableManagers.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-900 dark:text-white">
                  Staff who can manage your appointment requests
                </legend>
                <p className="text-xs text-slate-500">Selected staff at your hospital can approve or decline requests for your schedule.</p>
                <div className="flex flex-wrap gap-3">
                  {availableManagers.map((manager) => (
                    <label key={manager.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 dark:border-slate-800 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={managerIds.includes(manager.id)}
                        onChange={(event) => setManagerIds((current) =>
                          event.target.checked
                            ? [...current, manager.id]
                            : current.filter((id) => id !== manager.id)
                        )}
                      />
                      {manager.name}
                      {manager.medicalStaffDetails?.specialization && ` - ${manager.medicalStaffDetails.specialization}`}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="space-y-2">
              {schedule.map((day) => (
                <div key={day.dayOfWeek} className="grid grid-cols-1 items-center gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800 sm:grid-cols-[minmax(100px,1fr)_1fr_1fr_1fr]">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={day.enabled}
                      onChange={(event) => setSchedule((current) => current.map((item) =>
                        item.dayOfWeek === day.dayOfWeek
                          ? { ...item, enabled: event.target.checked }
                          : item
                      ))}
                      aria-label={`${DAY_NAMES[day.dayOfWeek]} working day`}
                    />
                    {DAY_NAMES[day.dayOfWeek]}
                  </label>
                  <label className="text-xs text-slate-500">
                    Start
                    <input
                      type="time"
                      step={900}
                      value={day.startTime}
                      disabled={!day.enabled}
                      onChange={(event) => setSchedule((current) => current.map((item) =>
                        item.dayOfWeek === day.dayOfWeek ? { ...item, startTime: event.target.value } : item
                      ))}
                      className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    End
                    <input
                      type="time"
                      step={900}
                      value={day.endTime}
                      disabled={!day.enabled}
                      onChange={(event) => setSchedule((current) => current.map((item) =>
                        item.dayOfWeek === day.dayOfWeek ? { ...item, endTime: event.target.value } : item
                      ))}
                      className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Appointment length
                    <select
                      value={day.slotDurationMinutes}
                      disabled={!day.enabled}
                      onChange={(event) => setSchedule((current) => current.map((item) =>
                        item.dayOfWeek === day.dayOfWeek
                          ? { ...item, slotDurationMinutes: Number(event.target.value) as ScheduleFormDay['slotDurationMinutes'] }
                          : item
                      ))}
                      className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    >
                      {[15, 30, 45, 60].map((duration) => (
                        <option key={duration} value={duration}>{duration} minutes</option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void saveSchedule()}
              disabled={savingSchedule}
              className="button-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {savingSchedule && <Loader2 className="h-4 w-4 animate-spin" />}
              Save working hours
            </button>
          </div>}

          {staffTab === 'approvals' && <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Requests awaiting your approval ({requests.length})
            </h3>
            {requests.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700">
                No appointment requests need review.
              </p>
            ) : requests.map((request) => (
              <div key={request._id} className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {typeof request.patient === 'object' ? request.patient.name : 'Patient'}
                  </p>
                  {typeof request.doctor === 'object' && request.doctor.id !== user?.id && (
                    <p className="text-xs text-slate-500">For Dr. {request.doctor.name}</p>
                  )}
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {request.hospitalName} - {formatDate(request.appointmentDate)} at {formatTime(request.time)}
                  </p>
                  <p className="text-xs text-slate-500">{request.durationMinutes}-minute appointment request</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void decideRequest(request._id, 'confirmed')}
                    disabled={busyRequest === request._id}
                    className="button-primary inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    {busyRequest === request._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void decideRequest(request._id, 'declined')}
                    disabled={busyRequest === request._id}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <X className="h-3.5 w-3.5" />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>}

          {(staffTab === 'upcoming' || staffTab === 'recent') && (() => {
            const entries = staffTab === 'upcoming' ? upcomingAppointments : recentAppointments;
            return (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {staffTab === 'upcoming' ? 'Upcoming appointments' : 'Recent past appointments'}
                </h3>
                {entries.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700">
                    {staffTab === 'upcoming' ? 'No upcoming confirmed appointments.' : 'No past appointments to show.'}
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {entries.map((appointment) => (
                      <div key={appointment._id} className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {typeof appointment.patient === 'object' ? appointment.patient.name : 'Patient'}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{appointment.hospitalName}</p>
                          <p className="text-xs text-slate-500">
                            {formatDate(appointment.appointmentDate)} at {formatTime(appointment.time)}
                            {' · '}{appointment.durationMinutes} minutes
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {(() => {
                            if (typeof appointment.patient !== 'object' || !appointment.patient.mediVaultId || appointment.status !== 'confirmed') return null;

                            // Calculate doctor's access window: 30m before start to 30m after end
                            let startsTime = appointment.startsAt ? new Date(appointment.startsAt).getTime() : NaN;
                            if (Number.isNaN(startsTime)) {
                              startsTime = new Date(`${appointment.appointmentDate}T${appointment.time}:00+05:30`).getTime();
                            }
                            const durationMs = (appointment.durationMinutes || 30) * 60_000;
                            const endsTime = appointment.endsAt ? new Date(appointment.endsAt).getTime() : startsTime + durationMs;
                            const opensAt = startsTime - 30 * 60_000;
                            const closesAt = endsTime + 30 * 60_000;
                            const now = Date.now();
                            const isOpen = now >= opensAt && now < closesAt;

                            if (isOpen) {
                              return (
                                <Link
                                  to={`/medical-staff/patients/${appointment.patient.mediVaultId}`}
                                  className="rounded-lg border border-teal-500/30 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100 dark:border-teal-700/50 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-900/60"
                                >
                                  Open Clinical File
                                </Link>
                              );
                            }

                            return (
                              <span
                                title="File access opens 30 minutes before the appointment starts"
                                className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500"
                              >
                                File Access (Opens 30m prior)
                              </span>
                            );
                          })()}
                          <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                            appointment.status === 'confirmed'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : appointment.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {getAppointmentStatus(appointment.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </>
      ) : (
        <>
          {hospitals.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
              No hospital doctors are listed yet. Medical staff need to add their hospital affiliation and working hours before appointments can be booked.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Hospital
                <select
                  value={hospitalName}
                  onChange={(event) => {
                    const nextHospital = hospitals.find((hospital) => hospital.name === event.target.value);
                    setHospitalName(event.target.value);
                    setDoctorId(nextHospital?.doctors[0]?.id || '');
                    setNurseId('');
                    setNursingAccessConsent(false);
                    setAvailability(null);
                    setAvailabilityRequestKey('');
                    setBookingTime('');
                    setSuggestedSlots([]);
                    setError(null);
                  }}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  {hospitals.map((hospital) => <option key={hospital.name} value={hospital.name}>{hospital.name}</option>)}
                </select>
              </label>
              <div>
                <div className="flex min-h-[1rem] items-center justify-between gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                  <label htmlFor="appointment-doctor-select">Doctor</label>
                  {selectedDoctor && (
                    <button
                      type="button"
                      onClick={() =>
                        setProfessionalProfile({
                          name: selectedDoctor.name,
                          professionalType: 'physician',
                          specialization: selectedDoctor.specialization,
                          hospitalName: selectedHospital?.name || hospitalName,
                        })
                      }
                      className="font-semibold text-teal-700 underline dark:text-teal-300"
                    >
                      View profile
                    </button>
                  )}
                </div>
                <select
                  id="appointment-doctor-select"
                  value={doctorId}
                  onChange={(event) => {
                    setDoctorId(event.target.value);
                    setAvailability(null);
                    setAvailabilityRequestKey('');
                    setBookingTime('');
                    setSuggestedSlots([]);
                    setError(null);
                  }}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  {selectedHospital?.doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}{doctor.specialization ? ` - ${doctor.specialization}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Date
                <input
                  type="date"
                  min={getLocalDate()}
                  value={appointmentDate}
                  onChange={(event) => {
                    setAppointmentDate(event.target.value);
                    setAvailability(null);
                    setAvailabilityRequestKey('');
                    setBookingTime('');
                    setSuggestedSlots([]);
                    setError(null);
                  }}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>
            </div>
          )}

          {selectedHospital?.nurses.length ? <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <label className="block max-w-md text-xs font-medium text-slate-600 dark:text-slate-400">
              Assign a nurse (optional)
              <select value={nurseId} onChange={event => { setNurseId(event.target.value); setNursingAccessConsent(false); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="">No nurse assigned</option>
                {selectedHospital.nurses.map(nurse => <option key={nurse.id} value={nurse.id}>{nurse.name}</option>)}
              </select>
            </label>
            {nurseId && <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={nursingAccessConsent} onChange={event => setNursingAccessConsent(event.target.checked)} className="mt-1" />
              <span>I approve this nurse’s time-limited access to my allergies, conditions, current medications, emergency contact, and nursing notes for this appointment. Access starts 30 minutes before the confirmed appointment and ends 30 minutes after it. I can revoke it from my appointment list.</span>
            </label>}
            {selectedNurse && (
              <button
                type="button"
                onClick={() =>
                  setProfessionalProfile({
                    name: selectedNurse.name,
                    professionalType: 'nurse',
                    hospitalName: selectedHospital?.name || hospitalName,
                  })
                }
                className="text-xs font-semibold text-teal-700 underline dark:text-teal-300"
              >
                View nurse profile
              </button>
            )}
          </div> : null}

          {selectedDoctor && !selectedDoctor.schedule.length && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {selectedDoctor.name} has not configured working hours yet.
            </p>
          )}
          {doctorId && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Clock3 className="h-4 w-4 text-emerald-500" />
                Available appointment times
                {availability?.schedule && (
                  <span className="font-normal text-slate-500">
                    ({formatTime(availability.schedule.startTime)}-{formatTime(availability.schedule.endTime)})
                  </span>
                )}
              </h3>
              {availabilityLoading ? (
                <div className="flex items-center gap-2 py-3 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking availability...
                </div>
              ) : !availability?.schedule ? (
                <p className="text-sm text-slate-500">
                  {DAY_NAMES[new Date(`${appointmentDate}T00:00:00`).getDay()]} is not a configured working day for this doctor.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {availability.slots.map((slot) => (
                      <button
                        type="button"
                        key={slot.time}
                        disabled={slot.status === 'booked'}
                        onClick={() => setBookingTime(slot.time)}
                        className={`rounded-lg border px-3 py-2 text-sm ${
                          slot.status === 'booked'
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through dark:border-slate-800 dark:bg-slate-900'
                            : bookingTime === slot.time
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : 'border-slate-300 text-slate-700 hover:border-emerald-500 dark:border-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {formatTime(slot.time)}{slot.status === 'booked' ? ' - Booked' : ''}
                      </button>
                    ))}
                  </div>
                  {availableSlots.length === 0 && (
                    <p className="text-sm text-slate-500">No listed slots are available. Choose another date or request an open time from the doctor.</p>
                  )}
                  {bookingTime && (
                    <button
                      type="button"
                      onClick={() => void bookAppointment(bookingTime)}
                      disabled={booking || !canBook || Boolean(nurseId && !nursingAccessConsent)}
                      className="button-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                    >
                      {booking && <Loader2 className="h-4 w-4 animate-spin" />}
                      Book {formatTime(bookingTime)}
                    </button>
                  )}
                  <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 dark:border-slate-800 sm:flex-row sm:items-end">
                    <label className="max-w-xs text-xs font-medium text-slate-600 dark:text-slate-400">
                      Need a different time during working hours? Request doctor approval
                      <input
                        type="time"
                        step={900}
                        min={availability.schedule.startTime}
                        max={availability.schedule.endTime}
                        value={customTime}
                        onChange={(event) => setCustomTime(event.target.value)}
                        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void bookAppointment(customTime, true)}
                      disabled={!canBook || !customTime || booking || offeredTimes.has(customTime) || Boolean(nurseId && !nursingAccessConsent)}
                      className="rounded-lg border border-emerald-600 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                    >
                      Request approval
                    </button>
                  </div>
                  {suggestedSlots.length > 0 && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300">
                        <MapPin className="h-4 w-4" /> Try an available alternative
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {suggestedSlots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => {
                              setBookingTime(slot);
                              setSuggestedSlots([]);
                            }}
                            className="rounded-md border border-amber-400 px-2.5 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300"
                          >
                            {formatTime(slot)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Your appointments</h3>
            {appointments.length === 0 ? (
              <p className="text-sm text-slate-500">No appointments booked yet.</p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {appointments.map((appointment) => (
                  <div key={appointment._id} className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {typeof appointment.doctor === 'object' ? appointment.doctor.name : 'Doctor'}
                      </p>
                      <p className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                        <MapPin className="h-3.5 w-3.5" /> {appointment.hospitalName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(appointment.appointmentDate)} at {formatTime(appointment.time)}
                      </p>
                      {appointment.assignedNurse && <p className="text-xs text-slate-500">Nurse: {typeof appointment.assignedNurse === 'object' ? appointment.assignedNurse.name : 'Assigned'}</p>}
                      {appointment.nursingAccessConsent && <p className="text-xs text-slate-500">Nursing access to limited profile basics and appointment notes: {appointment.nursingAccessRevokedAt ? 'revoked' : `opens ${appointment.nursingAccessOpensAt ? new Date(appointment.nursingAccessOpensAt).toLocaleString() : 'before appointment'}`}</p>}
                    </div>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                      appointment.status === 'confirmed'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : appointment.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {getAppointmentStatus(appointment.status)}
                    </span>
                    {canBook && ['confirmed', 'pending'].includes(appointment.status) && (!appointment.assignedNurse || appointment.nursingAccessRevokedAt) && new Date(`${appointment.appointmentDate}T${appointment.time}:00+05:30`).getTime() > Date.now() && (hospitals.find(hospital => hospital.name === appointment.hospitalName)?.nurses.length || 0) > 0 && <div className="w-full space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                      <label className="block text-xs">Assign a nurse to this appointment<select value={nurseAssignments[appointment._id] || ''} onChange={event => { setNurseAssignments(current => ({ ...current, [appointment._id]: event.target.value })); setNurseAssignmentConsent(current => ({ ...current, [appointment._id]: false })); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="">Choose a hospital nurse</option>{hospitals.find(hospital => hospital.name === appointment.hospitalName)?.nurses.map(nurse => <option key={nurse.id} value={nurse.id}>{nurse.name}</option>)}</select></label>
                      {nurseAssignments[appointment._id] && <><label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={Boolean(nurseAssignmentConsent[appointment._id])} onChange={event => setNurseAssignmentConsent(current => ({ ...current, [appointment._id]: event.target.checked }))} className="mt-0.5" /><span>I approve the selected nurse’s access to allergies, conditions, current medications, emergency contact, and nursing notes from 30 minutes before the confirmed visit until 30 minutes after it ends.</span></label><button type="button" disabled={assigningNurse === appointment._id || !nurseAssignmentConsent[appointment._id]} onClick={() => void assignExistingNurse(appointment._id)} className="button-primary rounded-lg px-3 py-2 text-xs disabled:opacity-50">{assigningNurse === appointment._id ? 'Saving…' : 'Assign nurse and approve access'}</button></>}
                    </div>}
                    {canBook && appointment.nursingAccessConsent && !appointment.nursingAccessRevokedAt && ['confirmed', 'pending'].includes(appointment.status) && <button type="button" disabled={revokingNursingAccess === appointment._id} onClick={() => void revokeNursingAccess(appointment._id)} className="rounded border border-amber-300 px-3 py-2 text-xs text-amber-800 disabled:opacity-50 dark:text-amber-300">{revokingNursingAccess === appointment._id ? 'Revoking…' : 'Revoke nurse access'}</button>}
                    {canBook && ['confirmed', 'pending'].includes(appointment.status) && new Date(`${appointment.appointmentDate}T${appointment.time}:00+05:30`).getTime() > Date.now() && (
                      <div className="text-sm">
                        {cancelId === appointment._id ? <div className="space-y-2">
                          <p>Cancel this appointment and release the slot?</p>
                          <button type="button" disabled={cancelling} onClick={() => void cancelBooking()} className="rounded border border-rose-300 px-3 py-2 text-rose-700 dark:text-rose-300">{cancelling ? 'Cancelling...' : 'Confirm cancellation'}</button>
                          <button type="button" disabled={cancelling} onClick={() => setCancelId('')} className="ml-2 px-3 py-2">Keep appointment</button>
                        </div> : <button type="button" disabled={cancelling} onClick={() => setCancelId(appointment._id)} className="rounded border border-slate-300 px-3 py-2 dark:border-slate-700">Cancel appointment</button>}
                      </div>
                    )}

                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {professionalProfile && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setProfessionalProfile(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="professional-profile-title" className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">{professionalProfile.professionalType === 'physician' ? 'Physician' : 'Nurse'}</p><h2 id="professional-profile-title" className="mt-1 text-lg font-semibold">{professionalProfile.name}</h2></div><button type="button" aria-label="Close profile" onClick={() => setProfessionalProfile(null)} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button></div>
          <dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-slate-500">Specialty / scope</dt><dd>{professionalProfile.specialization || (professionalProfile.professionalType === 'nurse' ? 'Nursing' : 'Not listed')}</dd></div><div><dt className="text-xs text-slate-500">Hospital</dt><dd>{professionalProfile.hospitalName}</dd></div><div><dt className="text-xs text-slate-500">MediVault status</dt><dd>Approved professional account</dd></div></dl>
          <button type="button" onClick={() => setProfessionalProfile(null)} className="button-primary mt-5 rounded-lg px-4 py-2 text-sm">Close</button>
        </section>
      </div>}
    </section>
  );
};
