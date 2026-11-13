import Appointment from '../models/Appointment.js';
import ProxyDelegation from '../models/ProxyDelegation.js';
import User from '../models/User.js';
import { createAuditLog } from '../services/auditService.js';

const activeStaffFilter = {
  role: 'medical_staff',
  isActive: true,
  approvalStatus: 'approved',
  'medicalStaffDetails.hospital': { $type: 'objectId' },
  'medicalStaffDetails.hospitalAffiliation': { $type: 'string', $regex: /\S/ },
};
const activePhysicianFilter = {
  ...activeStaffFilter,
  $or: [
    { 'medicalStaffDetails.professionalType': 'physician' },
    { 'medicalStaffDetails.professionalType': { $in: ['', null] }, 'medicalStaffDetails.specialization': { $not: /^Nursing$/i } },
  ],
};

const isValidDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const isValidTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const toMinutes = (value) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};
const toTime = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const getScheduleForDate = (doctor, date) => {
  const dayOfWeek = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return doctor.medicalStaffDetails?.appointmentSchedule?.find(
    (entry) => entry.dayOfWeek === dayOfWeek
  );
};

const getOverlappingAppointments = async (doctorId, date, startTime, durationMinutes) => {
  const requestedStart = toMinutes(startTime);
  const requestedEnd = requestedStart + durationMinutes;
  const appointments = await Appointment.find({
    doctor: doctorId,
    appointmentDate: date,
    slotReserved: true,
    status: { $in: ['confirmed', 'pending'] },
  }).select('time durationMinutes');

  return appointments.filter((appointment) => {
    const bookedStart = toMinutes(appointment.time);
    const bookedEnd = bookedStart + appointment.durationMinutes;
    return requestedStart < bookedEnd && bookedStart < requestedEnd;
  });
};

const getAvailability = async (doctor, date) => {
  const schedule = getScheduleForDate(doctor, date);
  if (!schedule) return { schedule: null, slots: [], alternatives: [] };

  const slotDurationMinutes = schedule.slotDurationMinutes;
  const start = toMinutes(schedule.startTime);
  const end = toMinutes(schedule.endTime);
  const appointments = await Appointment.find({
    doctor: doctor._id,
    appointmentDate: date,
    slotReserved: true,
    status: { $in: ['confirmed', 'pending'] },
  }).select('time durationMinutes');
  const slots = [];
  for (let time = start; time + slotDurationMinutes <= end; time += slotDurationMinutes) {
    const timeText = toTime(time);
    const slotStart = toMinutes(timeText);
    const overlapping = appointments.some((appointment) => {
      const bookedStart = toMinutes(appointment.time);
      const bookedEnd = bookedStart + appointment.durationMinutes;
      return slotStart < bookedEnd && bookedStart < slotStart + slotDurationMinutes;
    });
    slots.push({
      time: timeText,
      status: overlapping ? 'booked' : 'available',
    });
  }
  return {
    schedule,
    slots,
    alternatives: slots.filter((slot) => slot.status === 'available').map((slot) => slot.time),
  };
};

export const getHospitalsAndDoctors = async (req, res, next) => {
  try {
    const staff = await User.find(activeStaffFilter)
      .select('name medicalStaffDetails')
      .sort({ 'medicalStaffDetails.hospitalAffiliation': 1, name: 1 });
    const nurses = await User.find({
      ...activeStaffFilter,
      $or: [
        { 'medicalStaffDetails.professionalType': 'nurse' },
        { 'medicalStaffDetails.professionalType': { $in: ['', null] }, 'medicalStaffDetails.specialization': /^Nursing$/i },
      ],
    })
      .select('name medicalStaffDetails.hospitalAffiliation medicalStaffDetails.professionalType medicalStaffDetails.specialization')
      .sort({ name: 1 });
    const hospitals = new Map();

    staff.forEach((doctor) => {
      const hospitalName = doctor.medicalStaffDetails.hospitalAffiliation.trim();
      const key = hospitalName.toLocaleLowerCase();
      if (!hospitals.has(key)) hospitals.set(key, { name: hospitalName, doctors: [], nurses: [] });
      const professionalType = doctor.medicalStaffDetails.professionalType;
      if (professionalType ? professionalType !== 'physician' : doctor.medicalStaffDetails.specialization?.toLowerCase() === 'nursing') return;
      hospitals.get(key).doctors.push({
        id: doctor._id,
        name: doctor.name,
        professionalType: 'physician',
        specialization: doctor.medicalStaffDetails.specialization,
        hospitalName,
        schedule: doctor.medicalStaffDetails.appointmentSchedule || [],
      });
    });

    nurses.forEach((nurse) => {
      const hospitalName = nurse.medicalStaffDetails.hospitalAffiliation.trim();
      const key = hospitalName.toLocaleLowerCase();
      if (!hospitals.has(key)) hospitals.set(key, { name: hospitalName, doctors: [], nurses: [] });
      hospitals.get(key).nurses.push({
        id: nurse._id,
        name: nurse.name,
        professionalType: 'nurse',
        specialization: nurse.medicalStaffDetails.specialization || 'Nursing',
        hospitalName,
      });
    });

    return res.status(200).json({ success: true, hospitals: [...hospitals.values()].filter((hospital) => hospital.doctors.length > 0) });
  } catch (error) {
    return next(error);
  }
};

export const getDoctorAvailability = async (req, res, next) => {
  try {
    const { doctorId, date } = req.query;
    if (typeof doctorId !== 'string' || !/^[a-f\d]{24}$/i.test(doctorId) || !isValidDate(date)) {
      return res.status(400).json({ success: false, message: 'Choose a valid doctor and date.' });
    }

    const doctor = await User.findOne({ _id: doctorId, ...activeStaffFilter })
      .select('name medicalStaffDetails');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found.' });

    const availability = await getAvailability(doctor, date);
    return res.status(200).json({
      success: true,
      doctor: { id: doctor._id, name: doctor.name },
      date,
      ...availability,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyAppointments = async (req, res, next) => {
  try {
    const appointments = await Appointment.find({ patient: req.effectivePatientId })
      .select('-assignedApprovers -reservedBlocks -slotReserved')
      .populate('doctor', 'name medicalStaffDetails.hospitalAffiliation medicalStaffDetails.specialization')
      .populate('assignedNurse', 'name')
      .sort({ appointmentDate: 1, time: 1 })
      .limit(100);
    return res.status(200).json({ success: true, appointments });
  } catch (error) {
    return next(error);
  }
};

export const createAppointment = async (req, res, next) => {
  try {
    if (req.proxyDelegation?.accessLevel === 'read_only') return res.status(403).json({ success: false, message: 'Full caregiver access is required to book an appointment or approve nursing access.' });
    const { doctorId, appointmentDate, time, nurseId = '', nursingAccessConsent = false } = req.body;
    // Hospital schedules are always interpreted in India Standard Time.
    const timeZoneOffsetMinutes = 330;
    if (
      typeof doctorId !== 'string' ||
      !/^[a-f\d]{24}$/i.test(doctorId) ||
      !isValidDate(appointmentDate) ||
      !isValidTime(time) ||
      toMinutes(time) % 15 !== 0 ||
      !Number.isInteger(timeZoneOffsetMinutes) ||
      Math.abs(timeZoneOffsetMinutes) > 840
    ) {
      return res.status(400).json({
        success: false,
        message: 'Choose a valid doctor, appointment date, and time.',
      });
    }

    const requestedAt = Date.UTC(
      Number(appointmentDate.slice(0, 4)),
      Number(appointmentDate.slice(5, 7)) - 1,
      Number(appointmentDate.slice(8, 10)),
      Math.floor(toMinutes(time) / 60),
      toMinutes(time) % 60
    ) - timeZoneOffsetMinutes * 60_000;
    if (requestedAt <= Date.now()) {
      return res.status(400).json({ success: false, message: 'Choose a future appointment time.' });
    }

    const doctor = await User.findOne({ _id: doctorId, ...activeStaffFilter })
      .select('name medicalStaffDetails');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found.' });
    if (doctor.medicalStaffDetails?.professionalType
      ? doctor.medicalStaffDetails.professionalType !== 'physician'
      : doctor.medicalStaffDetails?.specialization?.toLowerCase() === 'nursing') {
      return res.status(400).json({ success: false, message: 'Choose a physician for this appointment.' });
    }
    if (nurseId && (typeof nurseId !== 'string' || !/^[a-f\d]{24}$/i.test(nurseId) || nursingAccessConsent !== true)) {
      return res.status(400).json({ success: false, message: 'Choose a nurse and explicitly approve the limited appointment access.' });
    }
    let assignedNurse = null;
    if (nurseId) {
      assignedNurse = await User.findOne({
        _id: nurseId,
        ...activeStaffFilter,
        'medicalStaffDetails.hospitalAffiliation': doctor.medicalStaffDetails.hospitalAffiliation,
        $or: [
          { 'medicalStaffDetails.professionalType': 'nurse' },
          { 'medicalStaffDetails.professionalType': { $in: ['', null] }, 'medicalStaffDetails.specialization': /^Nursing$/i },
        ],
      }).select('_id');
      if (!assignedNurse) return res.status(400).json({ success: false, message: 'Choose an approved nurse affiliated with this hospital.' });
    }

    const schedule = getScheduleForDate(doctor, appointmentDate);
    if (!schedule) {
      return res.status(400).json({
        success: false,
        message: 'This doctor has not configured working hours for the selected day.',
      });
    }

    const start = toMinutes(schedule.startTime);
    const end = toMinutes(schedule.endTime);
    const requestedStart = toMinutes(time);
    const durationMinutes = schedule.slotDurationMinutes;
    if (requestedStart < start || requestedStart + durationMinutes > end) {
      return res.status(400).json({
        success: false,
        message: `Choose a time during the doctor's working hours (${schedule.startTime}–${schedule.endTime}).`,
      });
    }

    const existing = await getOverlappingAppointments(
      doctor._id,
      appointmentDate,
      time,
      durationMinutes
    );
    if (existing.length) {
      const availability = await getAvailability(doctor, appointmentDate);
      return res.status(409).json({
        success: false,
        message: 'That time is already booked. Choose one of the available alternative slots.',
        alternatives: availability.alternatives,
      });
    }

    const offsetFromShift = requestedStart - start;
    const isListedSlot = offsetFromShift % durationMinutes === 0;
    const blocks = [];
    for (let block = requestedStart; block < requestedStart + durationMinutes; block += 15) {
      blocks.push(toTime(block));
    }

    try {
      const appointment = await Appointment.create({
        patient: req.effectivePatientId,
        doctor: doctor._id,
        assignedNurse: assignedNurse?._id || null,
        nursingAccessConsent: Boolean(assignedNurse && nursingAccessConsent),
        startsAt: new Date(requestedAt),
        endsAt: new Date(requestedAt + durationMinutes * 60_000),
        nursingAccessOpensAt: assignedNurse && nursingAccessConsent ? new Date(requestedAt - 30 * 60_000) : undefined,
        nursingAccessClosesAt: assignedNurse && nursingAccessConsent ? new Date(requestedAt + (durationMinutes + 30) * 60_000) : undefined,
        hospitalName: doctor.medicalStaffDetails.hospitalAffiliation.trim(),
        appointmentDate,
        time,
        durationMinutes,
        reservedBlocks: blocks,
        assignedApprovers: doctor.medicalStaffDetails.appointmentManagers || [],
        status: isListedSlot ? 'confirmed' : 'pending',
      });
      await appointment.populate([
        {
          path: 'doctor',
          select: 'name medicalStaffDetails.hospitalAffiliation medicalStaffDetails.specialization',
        },
        { path: 'patient', select: 'name mediVaultId' },
        { path: 'assignedNurse', select: 'name' },
      ]);
      await createAuditLog({
        userId: req.effectivePatientId,
        performedBy: req.user._id,
        action: 'APPOINTMENT_BOOKED',
        details: `${isListedSlot ? 'Booked' : 'Requested'} an appointment with ${doctor.name} at ${doctor.medicalStaffDetails.hospitalAffiliation} for ${appointmentDate} ${time}.`,
        resourceId: appointment._id,
        resourceType: 'Appointment',
        req,
      });
      return res.status(201).json({
        success: true,
        message: isListedSlot
          ? 'Your appointment is confirmed.'
          : 'Your appointment request was sent to the doctor for approval.',
        appointment,
      });
    } catch (error) {
      if (error.code === 11000) {
        const availability = await getAvailability(doctor, appointmentDate);
        return res.status(409).json({
          success: false,
          message: 'That time was just booked. Choose one of the available alternative slots.',
          alternatives: availability.alternatives,
        });
      }
      throw error;
    }
  } catch (error) {
    return next(error);
  }
};

export const getMySchedule = async (req, res, next) => {
  try {
    const hospitalName = req.user.medicalStaffDetails.hospitalAffiliation;
    const managers = hospitalName
      ? await User.find({
          ...activePhysicianFilter,
          _id: { $ne: req.user._id },
          'medicalStaffDetails.hospitalAffiliation': hospitalName,
        }).select('name medicalStaffDetails.specialization')
      : [];
    return res.status(200).json({
      success: true,
      schedule: req.user.medicalStaffDetails.appointmentSchedule || [],
      managerIds: (req.user.medicalStaffDetails.appointmentManagers || []).map((id) => id.toString()),
      availableManagers: managers.map((manager) => ({
        id: manager._id,
        name: manager.name,
        medicalStaffDetails: manager.medicalStaffDetails,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

export const updateMySchedule = async (req, res, next) => {
  try {
    const { schedule, managerIds = [] } = req.body;
    if (!Array.isArray(schedule) || !Array.isArray(managerIds)) {
      return res.status(400).json({ success: false, message: 'A weekly schedule and staff approvers are required.' });
    }
    const days = new Set();
    for (const entry of schedule) {
      if (
        !entry ||
        !Number.isInteger(entry.dayOfWeek) ||
        entry.dayOfWeek < 0 ||
        entry.dayOfWeek > 6 ||
        days.has(entry.dayOfWeek) ||
        !isValidTime(entry.startTime) ||
        !isValidTime(entry.endTime) ||
        toMinutes(entry.startTime) % 15 !== 0 ||
        toMinutes(entry.endTime) % 15 !== 0 ||
        toMinutes(entry.startTime) >= toMinutes(entry.endTime) ||
        ![15, 30, 45, 60].includes(entry.slotDurationMinutes)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Schedule entries must have unique weekdays, valid working hours, and a 15, 30, 45, or 60 minute slot length.',
        });
      }
      days.add(entry.dayOfWeek);
    }

    const uniqueManagerIds = [...new Set(managerIds.map((id) => String(id)))];
    if (
      uniqueManagerIds.some((id) => !/^[a-f\d]{24}$/i.test(id)) ||
      uniqueManagerIds.includes(req.user._id.toString())
    ) {
      return res.status(400).json({ success: false, message: 'Choose valid staff members to manage appointment requests.' });
    }
    const availableManagerCount = uniqueManagerIds.length
      ? await User.countDocuments({
          ...activePhysicianFilter,
          _id: { $in: uniqueManagerIds },
          'medicalStaffDetails.hospitalAffiliation': req.user.medicalStaffDetails.hospitalAffiliation,
        })
      : 0;
    if (availableManagerCount !== uniqueManagerIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Appointment approvers must be active medical staff at your hospital.',
      });
    }

    req.user.medicalStaffDetails.appointmentSchedule = schedule;
    req.user.medicalStaffDetails.appointmentManagers = uniqueManagerIds;
    await req.user.save();
    return res.status(200).json({
      success: true,
      message: 'Your appointment working hours have been saved.',
      schedule: req.user.medicalStaffDetails.appointmentSchedule,
      managerIds: req.user.medicalStaffDetails.appointmentManagers.map((id) => id.toString()),
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyPendingAppointments = async (req, res, next) => {
  try {
    const appointments = await Appointment.find({
      status: 'pending',
      $or: [{ doctor: req.user._id }, { assignedApprovers: req.user._id }],
    })
      .select('-reservedBlocks -slotReserved')
      .populate('patient', 'name mediVaultId')
      .populate('doctor', 'name medicalStaffDetails.hospitalAffiliation medicalStaffDetails.specialization')
      .sort({ appointmentDate: 1, time: 1 });
    return res.status(200).json({ success: true, appointments });
  } catch (error) {
    return next(error);
  }
};

export const getMyStaffAppointments = async (req, res, next) => {
  try {
    const { date, time } = req.query;
    if (!isValidDate(date) || !isValidTime(time)) {
      return res.status(400).json({ success: false, message: 'Choose a valid date and time.' });
    }

    const [upcoming, recent] = await Promise.all([
      Appointment.find({
        doctor: req.user._id,
        $or: [
          { appointmentDate: { $gt: date } },
          { appointmentDate: date, time: { $gte: time } },
        ],
        status: 'confirmed',
      })
        .select('-assignedApprovers -reservedBlocks -slotReserved')
        .populate('patient', 'name mediVaultId')
        .sort({ appointmentDate: 1, time: 1 })
        .limit(100),
      Appointment.find({
        doctor: req.user._id,
        $or: [
          { appointmentDate: { $lt: date } },
          { appointmentDate: date, time: { $lt: time } },
        ],
      })
        .select('-assignedApprovers -reservedBlocks -slotReserved')
        .populate('patient', 'name mediVaultId')
        .sort({ appointmentDate: -1, time: -1 })
        .limit(50),
    ]);

    return res.status(200).json({ success: true, upcoming, recent });
  } catch (error) {
    return next(error);
  }
};

export const decideAppointment = async (req, res, next) => {
  try {
    const { decision } = req.body;
    if (!['confirmed', 'declined'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Choose approve or decline.' });
    }

    const update = {
      status: decision,
      decisionBy: req.user._id,
      decidedAt: new Date(),
      ...(decision === 'declined' ? { slotReserved: false } : {}),
    };
    const appointment = await Appointment.findOneAndUpdate(
      {
        _id: req.params.id,
        status: 'pending',
        $or: [{ doctor: req.user._id }, { assignedApprovers: req.user._id }],
      },
      update,
      { new: true, runValidators: true }
    ).populate([
      { path: 'patient', select: 'name mediVaultId' },
      {
        path: 'doctor',
        select: 'name medicalStaffDetails.hospitalAffiliation medicalStaffDetails.specialization',
      },
    ]);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Pending appointment request not found for your account.',
      });
    }

    await createAuditLog({
      userId: appointment.patient._id,
      performedBy: req.user._id,
      action: 'APPOINTMENT_REVIEWED',
      details: `${req.user.name} ${decision} an appointment request for ${appointment.appointmentDate} ${appointment.time}.`,
      resourceId: appointment._id,
      resourceType: 'Appointment',
      req,
    });
    return res.status(200).json({
      success: true,
      message: decision === 'confirmed' ? 'Appointment request approved.' : 'Appointment request declined.',
      appointment,
    });
  } catch (error) {
    return next(error);
  }
};

export const cancelAppointment = async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid appointment ID.' });
    if (req.proxyDelegation?.accessLevel === 'read_only') return res.status(403).json({ success: false, message: 'Full caregiver access is required.' });
    const now = new Date();
    const date = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const time = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const appointment = await Appointment.findOneAndUpdate({
      _id: req.params.id, patient: req.effectivePatientId,
      status: { $in: ['pending', 'confirmed'] },
      $or: [{ appointmentDate: { $gt: date } }, { appointmentDate: date, time: { $gt: time } }],
    }, { $set: { status: 'cancelled', slotReserved: false, cancelledAt: now, cancelledBy: req.user._id } }, { new: true, runValidators: true });
    if (!appointment) return res.status(409).json({ success: false, message: 'This appointment is unavailable for cancellation. Refresh your appointments.' });
    await createAuditLog({ userId: req.effectivePatientId, performedBy: req.user._id, action: 'APPOINTMENT_CANCELLED', details: `Appointment at ${appointment.hospitalName} on ${appointment.appointmentDate} at ${appointment.time} was cancelled.`, resourceId: appointment._id, resourceType: 'Appointment', req });
    return res.json({ success: true, message: 'Appointment cancelled. The slot is available again.' });
  } catch (error) { next(error); }
};

export const revokeAppointmentNursingAccess = async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid appointment ID.' });
    if (req.proxyDelegation?.accessLevel === 'read_only') return res.status(403).json({ success: false, message: 'Full caregiver access is required.' });
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, patient: req.effectivePatientId, nursingAccessConsent: true, nursingAccessRevokedAt: null },
      { $set: { nursingAccessRevokedAt: new Date() } },
      { new: true }
    );
    if (!appointment) return res.status(404).json({ success: false, message: 'Active appointment nursing access was not found.' });
    await createAuditLog({ userId: req.effectivePatientId, performedBy: req.user._id, action: 'ACCESS_REVOKED', details: 'Patient revoked appointment-scoped nursing access', resourceId: appointment._id, resourceType: 'Appointment', req });
    return res.json({ success: true, message: 'Nursing access for this appointment has been revoked.' });
  } catch (error) { return next(error); }
};

export const assignAppointmentNurse = async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid appointment ID.' });
    if (req.proxyDelegation?.accessLevel === 'read_only') return res.status(403).json({ success: false, message: 'Full caregiver access is required.' });
    const { nurseId, nursingAccessConsent } = req.body || {};
    if (typeof nurseId !== 'string' || !/^[a-f\d]{24}$/i.test(nurseId) || nursingAccessConsent !== true) {
      return res.status(400).json({ success: false, message: 'Choose a nurse and explicitly approve the limited appointment access.' });
    }
    const appointment = await Appointment.findOne({ _id: req.params.id, patient: req.effectivePatientId, status: { $in: ['confirmed', 'pending'] } });
    if (!appointment) return res.status(404).json({ success: false, message: 'Upcoming appointment was not found.' });
    const startsAt = appointment.startsAt || new Date(Date.UTC(
      Number(appointment.appointmentDate.slice(0, 4)),
      Number(appointment.appointmentDate.slice(5, 7)) - 1,
      Number(appointment.appointmentDate.slice(8, 10)),
      Math.floor(toMinutes(appointment.time) / 60),
      toMinutes(appointment.time) % 60
    ) - 330 * 60_000);
    if (startsAt <= new Date()) return res.status(409).json({ success: false, message: 'Nurse access can only be added before the appointment starts.' });
    const nurse = await User.findOne({
      _id: nurseId,
      ...activeStaffFilter,
      'medicalStaffDetails.hospitalAffiliation': appointment.hospitalName,
      $or: [
        { 'medicalStaffDetails.professionalType': 'nurse' },
        { 'medicalStaffDetails.professionalType': { $in: ['', null] }, 'medicalStaffDetails.specialization': /^Nursing$/i },
      ],
    }).select('_id');
    if (!nurse) return res.status(400).json({ success: false, message: 'Choose an approved nurse affiliated with this hospital.' });
    const endsAt = appointment.endsAt || new Date(startsAt.getTime() + appointment.durationMinutes * 60_000);
    appointment.assignedNurse = nurse._id;
    appointment.nursingAccessConsent = true;
    appointment.startsAt = startsAt;
    appointment.endsAt = endsAt;
    appointment.nursingAccessOpensAt = new Date(startsAt.getTime() - 30 * 60_000);
    appointment.nursingAccessClosesAt = new Date(endsAt.getTime() + 30 * 60_000);
    appointment.nursingAccessRevokedAt = null;
    await appointment.save();
    await createAuditLog({ userId: req.effectivePatientId, performedBy: req.user._id, action: 'ACCESS_REQUESTED', details: 'Patient approved time-limited nursing access for an appointment', resourceId: appointment._id, resourceType: 'Appointment', req });
    await appointment.populate('assignedNurse', 'name');
    return res.json({ success: true, message: 'Nurse assigned and appointment-scoped access approved.', appointment });
  } catch (error) { return next(error); }
};

export const lookupPatientByMediVaultId = async (req, res, next) => {
  try {
    const rawId = typeof req.query?.mediVaultId === 'string' ? req.query.mediVaultId.trim().toUpperCase() : '';
    if (!rawId || !/^MV-[A-F0-9]{16}$/i.test(rawId)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid MediVault ID (e.g. MV-4BDB61AAFAA83B9A).' });
    }

    const patient = await User.findOne({ mediVaultId: rawId, role: 'patient' })
      .select('_id name mediVaultId email dateOfBirth gender')
      .lean();

    if (!patient) {
      return res.status(404).json({ success: false, message: 'No patient found with this MediVault ID.' });
    }

    return res.json({
      success: true,
      patient: {
        id: patient._id,
        name: patient.name,
        mediVaultId: patient.mediVaultId,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const staffBookAppointment = async (req, res, next) => {
  try {
    const {
      patientMediVaultId,
      doctorId,
      appointmentDate,
      time,
      chiefComplaint = '',
    } = req.body || {};

    const rawId = typeof patientMediVaultId === 'string' ? patientMediVaultId.trim().toUpperCase() : '';
    if (!rawId || !/^MV-[A-F0-9]{16}$/i.test(rawId)) {
      return res.status(400).json({ success: false, message: 'Enter a valid MediVault ID (e.g. MV-4BDB61AAFAA83B9A).' });
    }

    if (
      typeof doctorId !== 'string' ||
      !/^[a-f\d]{24}$/i.test(doctorId) ||
      !isValidDate(appointmentDate) ||
      !isValidTime(time) ||
      toMinutes(time) % 15 !== 0
    ) {
      return res.status(400).json({ success: false, message: 'Choose a valid doctor, appointment date, and time.' });
    }

    const patient = await User.findOne({ mediVaultId: rawId, role: 'patient' }).select('_id name');
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found for this MediVault ID.' });
    }

    const staffHospital = req.user.medicalStaffDetails?.hospitalAffiliation?.trim();
    if (!staffHospital) {
      return res.status(400).json({ success: false, message: 'Staff member must have an affiliated hospital.' });
    }

    const doctor = await User.findOne({
      _id: doctorId,
      ...activeStaffFilter,
      'medicalStaffDetails.hospitalAffiliation': staffHospital,
    }).select('name medicalStaffDetails');

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found at your hospital.' });
    }

    const professionalType = doctor.medicalStaffDetails?.professionalType;
    if (professionalType ? professionalType !== 'physician' : doctor.medicalStaffDetails?.specialization?.toLowerCase() === 'nursing') {
      return res.status(400).json({ success: false, message: 'Please select a physician for this consultation.' });
    }

    const timeZoneOffsetMinutes = 330; // IST
    const requestedAt = Date.UTC(
      Number(appointmentDate.slice(0, 4)),
      Number(appointmentDate.slice(5, 7)) - 1,
      Number(appointmentDate.slice(8, 10)),
      Math.floor(toMinutes(time) / 60),
      toMinutes(time) % 60
    ) - timeZoneOffsetMinutes * 60_000;

    if (requestedAt <= Date.now()) {
      return res.status(400).json({ success: false, message: 'Choose a future appointment time.' });
    }

    const schedule = getScheduleForDate(doctor, appointmentDate);
    const requestedStart = toMinutes(time);
    if (!schedule) {
      return res.status(400).json({ success: false, message: 'This physician has not configured working hours for the selected day.' });
    }
    const slotDuration = schedule.slotDurationMinutes;
    const scheduleStart = toMinutes(schedule.startTime);
    const scheduleEnd = toMinutes(schedule.endTime);
    if (
      requestedStart < scheduleStart ||
      requestedStart + slotDuration > scheduleEnd ||
      (requestedStart - scheduleStart) % slotDuration !== 0
    ) {
      return res.status(400).json({ success: false, message: `Choose an available slot during the physician's working hours (${schedule.startTime}–${schedule.endTime}).` });
    }

    const reservedBlocks = [];
    for (let block = requestedStart; block < requestedStart + slotDuration; block += 15) {
      reservedBlocks.push(toTime(block));
    }

    // Check doctor and patient conflicts before reserving the slot.
    const conflictingDoctor = await Appointment.findOne({
      doctor: doctor._id,
      appointmentDate,
      status: { $in: ['confirmed', 'pending'] },
      slotReserved: true,
      reservedBlocks: { $in: reservedBlocks },
    });
    if (conflictingDoctor) {
      return res.status(409).json({ success: false, message: 'That appointment time is already booked for this doctor.' });
    }

    // Check patient conflict
    const conflictingPatient = await Appointment.findOne({
      patient: patient._id,
      appointmentDate,
      status: { $in: ['confirmed', 'pending'] },
      slotReserved: true,
      reservedBlocks: { $in: reservedBlocks },
    });
    if (conflictingPatient) {
      return res.status(409).json({ success: false, message: 'This patient already has an appointment booked at that time.' });
    }

    const startsAt = new Date(requestedAt);
    const endsAt = new Date(startsAt.getTime() + slotDuration * 60_000);

    const isNurseUser = req.user.medicalStaffDetails?.professionalType === 'nurse' ||
      req.user.medicalStaffDetails?.specialization?.toLowerCase() === 'nursing';

    // Staff bookings never grant nursing access: the patient must approve it through the nursing-access endpoint.
    const assignNurseId = null;

    let appointment;
    try {
      appointment = await Appointment.create({
        patient: patient._id,
        doctor: doctor._id,
        assignedNurse: assignNurseId,
        nursingAccessConsent: Boolean(assignNurseId),
        startsAt,
        endsAt,
        nursingAccessOpensAt: assignNurseId ? new Date(startsAt.getTime() - 30 * 60_000) : undefined,
        nursingAccessClosesAt: assignNurseId ? new Date(endsAt.getTime() + 30 * 60_000) : undefined,
        nursingAccessRevokedAt: null,
        hospitalName: staffHospital,
        appointmentDate,
        time,
        durationMinutes: slotDuration,
        reservedBlocks,
        slotReserved: true,
        status: 'confirmed',
        bookedBy: req.user._id,
        bookingChannel: isNurseUser ? 'nurse_assisted' : 'physician',
        chiefComplaint: typeof chiefComplaint === 'string' ? chiefComplaint.trim().slice(0, 500) : '',
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: 'That appointment slot was just booked. Choose another available slot.' });
      }
      throw error;
    }

    await createAuditLog({
      userId: patient._id,
      performedBy: req.user._id,
      action: 'APPOINTMENT_BOOKED_BY_STAFF',
      details: `Appointment booked by ${req.user.name} (${req.user.medicalStaffDetails?.professionalType || 'staff'}) for Dr. ${doctor.name}`,
      resourceId: appointment._id,
      resourceType: 'Appointment',
      req,
    });

    const populated = await Appointment.findById(appointment._id)
      .populate('doctor', 'name medicalStaffDetails')
      .populate('patient', 'name mediVaultId email')
      .populate('assignedNurse', 'name');

    return res.status(201).json({
      success: true,
      message: `Appointment confirmed for ${patient.name} with Dr. ${doctor.name}.`,
      appointment: populated,
    });
  } catch (error) {
    return next(error);
  }
};
