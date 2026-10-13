import Appointment from '../models/Appointment.js';
import ProxyDelegation from '../models/ProxyDelegation.js';
import User from '../models/User.js';
import { createAuditLog } from '../services/auditService.js';

const activeStaffFilter = {
  role: 'medical_staff',
  isActive: true,
  approvalStatus: 'approved',
  'medicalStaffDetails.hospitalAffiliation': { $type: 'string', $regex: /\S/ },
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
    const hospitals = new Map();

    staff.forEach((doctor) => {
      const hospitalName = doctor.medicalStaffDetails.hospitalAffiliation.trim();
      const key = hospitalName.toLocaleLowerCase();
      if (!hospitals.has(key)) hospitals.set(key, { name: hospitalName, doctors: [] });
      hospitals.get(key).doctors.push({
        id: doctor._id,
        name: doctor.name,
        specialization: doctor.medicalStaffDetails.specialization,
        schedule: doctor.medicalStaffDetails.appointmentSchedule || [],
      });
    });

    return res.status(200).json({ success: true, hospitals: [...hospitals.values()] });
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
      .sort({ appointmentDate: 1, time: 1 })
      .limit(100);
    return res.status(200).json({ success: true, appointments });
  } catch (error) {
    return next(error);
  }
};

export const createAppointment = async (req, res, next) => {
  try {
    const { doctorId, appointmentDate, time } = req.body;
    const timeZoneOffsetMinutes = req.body.timeZoneOffsetMinutes === undefined
      ? 0
      : Number(req.body.timeZoneOffsetMinutes);
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
          ...activeStaffFilter,
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
          ...activeStaffFilter,
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
