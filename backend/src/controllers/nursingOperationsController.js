import Appointment from '../models/Appointment.js';
import NurseWorkspaceProfile from '../models/NurseWorkspaceProfile.js';
import NurseTeamResource from '../models/NurseTeamResource.js';
import User from '../models/User.js';
import { createAuditLog } from '../services/auditService.js';

const getHospitalName = (user) => String(user?.medicalStaffDetails?.hospitalAffiliation || '').trim();
const validDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
export const getMyNursingOperations = async (req, res, next) => {
  try {
    const profile = await NurseWorkspaceProfile.findOneAndUpdate(
      { nurse: req.user._id },
      { $setOnInsert: { nurse: req.user._id } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).select('-__v');
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, profile, hospitalName: getHospitalName(req.user) });
  } catch (error) { return next(error); }
};

export const updateMyNursingOperations = async (req, res, next) => {
  try {
    const { shifts, trainingRecords } = req.body || {};
    if (!Array.isArray(shifts) || shifts.length > 7 || !Array.isArray(trainingRecords) || trainingRecords.length > 50) {
      return res.status(400).json({ success: false, message: 'Provide up to seven weekly shifts and 50 training records.' });
    }
    const weekdays = new Set();
    for (const shift of shifts) {
      if (!Number.isInteger(shift?.dayOfWeek) || shift.dayOfWeek < 0 || shift.dayOfWeek > 6 || weekdays.has(shift.dayOfWeek) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(shift.startTime || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(shift.endTime || '') || shift.startTime >= shift.endTime) {
        return res.status(400).json({ success: false, message: 'Each weekday can have one valid shift, with an end time after its start.' });
      }
      weekdays.add(shift.dayOfWeek);
    }
    for (const training of trainingRecords) {
      if (typeof training?.title !== 'string' || !training.title.trim() || training.title.trim().length > 120 ||
        (training?.provider !== undefined && (typeof training.provider !== 'string' || training.provider.length > 120)) || !validDate(training.completedOn) ||
        (training.expiresOn && !validDate(training.expiresOn))) {
        return res.status(400).json({ success: false, message: 'Training records need a title, valid completion date, and optional valid expiry date.' });
      }
    }
    const profile = await NurseWorkspaceProfile.findOneAndUpdate(
      { nurse: req.user._id },
      { $set: { nurse: req.user._id, shifts, trainingRecords: trainingRecords.map(({ title, provider = '', completedOn, expiresOn = '' }) => ({ title: title.trim(), provider: provider.trim(), completedOn, expiresOn })) } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).select('-__v');
    await createAuditLog({ userId: req.user._id, action: 'NURSING_OPERATIONS_UPDATED', details: 'Nursing shift availability or training records updated', resourceId: profile._id, resourceType: 'NurseWorkspaceProfile', req });
    return res.json({ success: true, profile, message: 'Your nursing operations profile was saved.' });
  } catch (error) { return next(error); }
};

export const getNursingTeam = async (req, res, next) => {
  try {
    const hospitalName = getHospitalName(req.user);
    if (!hospitalName) return res.status(400).json({ success: false, message: 'Add a hospital affiliation before using the team roster.' });
    const nurses = await User.find({
      role: 'medical_staff', isActive: true, approvalStatus: 'approved',
      'medicalStaffDetails.hospitalAffiliation': hospitalName,
      $or: [
        { 'medicalStaffDetails.professionalType': 'nurse' },
        { 'medicalStaffDetails.professionalType': { $in: ['', null] }, 'medicalStaffDetails.specialization': /^Nursing$/i },
      ],
    }).select('name medicalStaffDetails.professionalType medicalStaffDetails.specialization').sort({ name: 1 });
    const ids = nurses.map((nurse) => nurse._id);
    const [profiles, workload] = await Promise.all([
      NurseWorkspaceProfile.find({ nurse: { $in: ids } }).select('nurse shifts'),
      Appointment.aggregate([
        { $match: { assignedNurse: { $in: ids }, status: 'confirmed', startsAt: { $gte: new Date() } } },
        { $group: { _id: '$assignedNurse', count: { $sum: 1 } } },
      ]),
    ]);
    const profileByNurse = new Map(profiles.map((profile) => [profile.nurse.toString(), profile]));
    const workloadByNurse = new Map(workload.map((item) => [item._id.toString(), item.count]));
    const localTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const currentDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(localTime.find((part) => part.type === 'weekday')?.value || '');
    const currentTime = `${localTime.find((part) => part.type === 'hour')?.value || '00'}:${localTime.find((part) => part.type === 'minute')?.value || '00'}`;
    const team = nurses.map((nurse) => {
      const profile = profileByNurse.get(nurse._id.toString());
      const shift = profile?.shifts.find((item) => item.dayOfWeek === currentDay && item.startTime <= currentTime && item.endTime > currentTime);
      return {
        id: nurse._id,
        name: nurse.name,
        professionalType: 'nurse',
        specialization: nurse.medicalStaffDetails.specialization || 'Nursing',
        shiftToday: shift ? `${shift.startTime}–${shift.endTime} IST` : 'Not scheduled now',
        upcomingAppointmentCount: workloadByNurse.get(nurse._id.toString()) || 0,
      };
    });
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, hospitalName, nurses: team });
  } catch (error) { return next(error); }
};

export const getNursingTeamResources = async (req, res, next) => {
  try {
    const hospitalName = getHospitalName(req.user);
    if (!hospitalName) return res.status(400).json({ success: false, message: 'Add a hospital affiliation before using team resources.' });
    const filter = { hospitalName };
    if (['checklist_template', 'shift_handover'].includes(req.query.kind)) filter.kind = req.query.kind;
    const resources = await NurseTeamResource.find(filter).sort({ createdAt: -1 }).limit(100).populate('author', 'name');
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, resources });
  } catch (error) { return next(error); }
};

export const createNursingTeamResource = async (req, res, next) => {
  try {
    const hospitalName = getHospitalName(req.user);
    const { kind, title, category = 'unit_operations', notes = '', checklistItems = [] } = req.body || {};
    if (!hospitalName) return res.status(400).json({ success: false, message: 'Add a hospital affiliation before creating team resources.' });
    if (!['checklist_template', 'shift_handover'].includes(kind) || typeof title !== 'string' || !title.trim() || title.trim().length > 100 ||
      typeof notes !== 'string' || notes.length > 1200 || !Array.isArray(checklistItems) || checklistItems.length > 30 ||
      checklistItems.some((item) => typeof item !== 'string' || !item.trim() || item.trim().length > 160)) {
      return res.status(400).json({ success: false, message: 'Enter a title, short operational note, and up to 30 checklist items.' });
    }
    if (kind === 'shift_handover' && !['staffing', 'equipment', 'supplies', 'unit_operations'].includes(category)) {
      return res.status(400).json({ success: false, message: 'Choose a staffing, equipment, supplies, or unit operations category.' });
    }
    if (kind === 'checklist_template' && !checklistItems.length) return res.status(400).json({ success: false, message: 'Add at least one reusable checklist item.' });
    const textToCheck = `${title} ${notes} ${checklistItems.join(' ')}`;
    if (/MV-[A-F0-9]{16}/i.test(textToCheck)) return res.status(400).json({ success: false, message: 'Team resources cannot contain patient MediVault IDs.' });
    const resource = await NurseTeamResource.create({
      hospitalName, author: req.user._id, kind, title: title.trim(), category,
      notes: notes.trim(), checklistItems: checklistItems.map((item) => item.trim()),
    });
    await createAuditLog({ userId: req.user._id, action: 'NURSING_TEAM_RESOURCE_ADDED', details: `Nursing team ${kind.replace('_', ' ')} created`, resourceId: resource._id, resourceType: 'NurseTeamResource', req });
    await resource.populate('author', 'name');
    return res.status(201).json({ success: true, resource });
  } catch (error) { return next(error); }
};

export const deleteNursingTeamResource = async (req, res, next) => {
  try {
    const resource = await NurseTeamResource.findOneAndDelete({ _id: req.params.id, hospitalName: getHospitalName(req.user), author: req.user._id });
    if (!resource) return res.status(404).json({ success: false, message: 'Only your own team resource can be removed.' });
    await createAuditLog({ userId: req.user._id, action: 'NURSING_TEAM_RESOURCE_REMOVED', details: `Nursing team ${resource.kind.replace('_', ' ')} removed`, resourceId: resource._id, resourceType: 'NurseTeamResource', req });
    return res.json({ success: true, message: 'Team resource removed.' });
  } catch (error) { return next(error); }
};
