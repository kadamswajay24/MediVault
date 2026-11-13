import test from 'node:test';
import assert from 'node:assert/strict';
import { cancelAppointment, staffBookAppointment } from './src/controllers/appointmentController.js';
import { getPatientClinicalOverview } from './src/controllers/medicalStaffController.js';
import Appointment from './src/models/Appointment.js';
import AuditLog from './src/models/AuditLog.js';
import ClinicalAccessRequest from './src/models/ClinicalAccessRequest.js';
import HealthProfile from './src/models/HealthProfile.js';
import InsuranceClaim from './src/models/InsuranceClaim.js';
import MedicalNote from './src/models/MedicalNote.js';
import MedicalRecord from './src/models/MedicalRecord.js';
import NursingEntry from './src/models/NursingEntry.js';
import User from './src/models/User.js';
const id = '507f1f77bcf86cd799439011';
const response = () => ({ code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const request = (accessLevel = 'full') => ({ headers: {}, params: { id }, effectivePatientId: 'patient', user: { _id: 'viewer' }, proxyDelegation: { accessLevel } });
const next = (error) => { throw error; };
test('cancellation is patient-scoped and atomically releases reserved slot', async t => {
  t.mock.method(Appointment, 'findOneAndUpdate', async (filter, update, options) => {
    assert.equal(filter.patient, 'patient');
    assert.deepEqual(filter.status.$in, ['pending', 'confirmed']);
    assert.ok(filter.$or[0].appointmentDate.$gt);
    assert.match(filter.$or[1].time.$gt, /^\d{2}:\d{2}$/);
    assert.equal(update.$set.status, 'cancelled');
    assert.equal(update.$set.slotReserved, false);
    assert.equal(update.$set.cancelledBy, 'viewer');
    assert.ok(options.runValidators);
    return { _id: id, hospitalName: 'Hospital', appointmentDate: '2099-01-01', time: '10:00' };
  });
  const audit = t.mock.method(AuditLog, 'create', async entry => { assert.equal(entry.action, 'APPOINTMENT_CANCELLED'); });
  const res = response(); await cancelAppointment(request(), res, next);
  assert.equal(res.code, 200); assert.equal(res.body.success, true); assert.equal(audit.mock.callCount(), 1);
});
test('read-only caregiver cannot cancel', async t => {
  const mutation = t.mock.method(Appointment, 'findOneAndUpdate', async () => { throw new Error('must not mutate'); });
  const res = response(); await cancelAppointment(request('read_only'), res, next);
  assert.equal(res.code, 403); assert.equal(mutation.mock.callCount(), 0);
});
test('unavailable, past, or already cancelled appointment cannot be updated', async t => {
  t.mock.method(Appointment, 'findOneAndUpdate', async () => null);
  const audit = t.mock.method(AuditLog, 'create', async () => {});
  const res = response(); await cancelAppointment(request(), res, next);
  assert.equal(res.code, 409); assert.equal(audit.mock.callCount(), 0);
});
test('malformed appointment ID is rejected', async () => {
  const req = request(); req.params.id = 'invalid';
  const res = response(); await cancelAppointment(req, res, next); assert.equal(res.code, 400);
});
test('claim retains ordered review events and validates their status', () => {
  const claim = new InsuranceClaim({ patient: id, claimNumber: 'TEST', policyNumber: 'POLICY', insuranceCompany: 'Company', insuranceCompanyId: id, claimAmount: 100,
    history: [{ status: 'Submitted', note: 'Submitted' }, { status: 'More Information Needed', note: 'Attach invoice' }] });
  assert.equal(claim.validateSync(), undefined);
  assert.equal(claim.history[1].note, 'Attach invoice');
  claim.history.push({ status: 'invalid' }); assert.ok(claim.validateSync());
});

// Exercise inbox handlers without an HTTP server or live database.
const { default: notificationRouter } = await import('./src/routes/notificationRoutes.js');
const { default: NotificationRead } = await import('./src/models/NotificationRead.js');
const handler = (path, method) => notificationRouter.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack[0].handle;
const query = value => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => value });
test('notification inbox only reads selected patient events and viewer receipts', async t => {
  t.mock.method(AuditLog, 'find', filter => {
    assert.equal(filter.user, 'patient');
    assert.ok(filter.action.$in.includes('APPOINTMENT_CANCELLED'));
    assert.ok(filter.action.$in.includes('APPOINTMENT_BOOKED_BY_STAFF'));
    return query([
      { _id: id, action: 'APPOINTMENT_CANCELLED', details: 'Cancelled', timestamp: new Date() },
      { _id: '507f1f77bcf86cd799439015', action: 'APPOINTMENT_BOOKED_BY_STAFF', details: 'Assisted booking', timestamp: new Date() },
    ]);
  });
  t.mock.method(NotificationRead, 'find', filter => {
    assert.equal(filter.viewer, 'viewer');
    return query([{ notification: id }]);
  });
  const res = response(); await handler('/', 'get')(request(), res, next);
  assert.equal(res.body.notifications[0].read, true);
  assert.equal(res.body.notifications[0].href, '/appointments');
  assert.equal(res.body.notifications[1].href, '/appointments');
  assert.equal(res.body.notifications[0].ipAddress, undefined);
});
test('foreign notification cannot receive a read receipt', async t => {
  t.mock.method(AuditLog, 'findOne', filter => {
    assert.equal(filter.user, 'patient');
    return { select: async () => null };
  });
  const writes = t.mock.method(NotificationRead, 'updateOne', async () => {});
  const res = response(); await handler('/:id/read', 'put')(request(), res, next);
  assert.equal(res.code, 404); assert.equal(writes.mock.callCount(), 0);
});

const staffBookingRequest = (time = '10:00') => ({
  headers: {},
  body: {
    patientMediVaultId: 'MV-4BDB61AAFAA83B9A',
    doctorId: '507f1f77bcf86cd799439012',
    appointmentDate: '2099-01-05',
    time,
    assignSelfNurse: true,
  },
  user: {
    _id: '507f1f77bcf86cd799439013',
    name: 'Nurse One',
    medicalStaffDetails: { professionalType: 'nurse', hospitalAffiliation: 'City Hospital' },
  },
});
const bookingPatient = { _id: '507f1f77bcf86cd799439014', name: 'Patient One' };
const bookingDoctor = {
  _id: '507f1f77bcf86cd799439012',
  name: 'Doctor One',
  medicalStaffDetails: {
    professionalType: 'physician',
    hospitalAffiliation: 'City Hospital',
    appointmentSchedule: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00', slotDurationMinutes: 30 }],
  },
};
const selectedQuery = value => Object.assign(Promise.resolve(value), { select() { return this; } });

test('assisted booking requires a configured schedule for the selected weekday', async t => {
  t.mock.method(User, 'findOne', filter => selectedQuery(filter.mediVaultId ? bookingPatient : {
    ...bookingDoctor,
    medicalStaffDetails: { ...bookingDoctor.medicalStaffDetails, appointmentSchedule: [] },
  }));
  const create = t.mock.method(Appointment, 'create', async () => { throw new Error('must not create'); });
  const res = response();
  await staffBookAppointment(staffBookingRequest(), res, next);
  assert.equal(res.code, 400);
  assert.match(res.body.message, /configured working hours/);
  assert.equal(create.mock.callCount(), 0);
});

test('assisted booking rejects times outside configured hours', async t => {
  t.mock.method(User, 'findOne', filter => selectedQuery(filter.mediVaultId ? bookingPatient : bookingDoctor));
  const create = t.mock.method(Appointment, 'create', async () => { throw new Error('must not create'); });
  const res = response();
  await staffBookAppointment(staffBookingRequest('08:30'), res, next);
  assert.equal(res.code, 400);
  assert.match(res.body.message, /working hours/);
  assert.equal(create.mock.callCount(), 0);
});

test('assisted booking rejects times that do not align with physician slots', async t => {
  t.mock.method(User, 'findOne', filter => selectedQuery(filter.mediVaultId ? bookingPatient : bookingDoctor));
  const create = t.mock.method(Appointment, 'create', async () => { throw new Error('must not create'); });
  const res = response();
  await staffBookAppointment(staffBookingRequest('09:15'), res, next);
  assert.equal(res.code, 400);
  assert.match(res.body.message, /available slot/);
  assert.equal(create.mock.callCount(), 0);
});

test('staff booking never grants nursing access, even when the old self-assign flag is sent', async t => {
  t.mock.method(User, 'findOne', filter => selectedQuery(filter.mediVaultId ? bookingPatient : bookingDoctor));
  t.mock.method(Appointment, 'findOne', async () => null);
  const create = t.mock.method(Appointment, 'create', async appointment => ({ ...appointment, _id: id }));
  t.mock.method(Appointment, 'findById', () => ({
    populate() { return this; },
    then(resolve, reject) { return Promise.resolve({ _id: id }).then(resolve, reject); },
  }));
  const audit = t.mock.method(AuditLog, 'create', async entry => {
    assert.equal(entry.action, 'APPOINTMENT_BOOKED_BY_STAFF');
    assert.doesNotMatch(entry.details, /nursing access/);
  });

  const res = response();
  await staffBookAppointment({ ...staffBookingRequest(), body: { ...staffBookingRequest().body, assignSelfNurse: true } }, res, next);
  const appointment = create.mock.calls[0].arguments[0];
  assert.equal(res.code, 201);
  assert.equal(appointment.assignedNurse, null);
  assert.equal(appointment.nursingAccessConsent, false);
  assert.equal(appointment.nursingAccessOpensAt, undefined);
  assert.equal(appointment.nursingAccessClosesAt, undefined);
  assert.equal(audit.mock.callCount(), 1);
});

test('physician clinical overview includes only the active assigned appointment nursing entries', async t => {
  const appointment = { _id: id };
  t.mock.method(User, 'findOne', () => selectedQuery({ _id: '507f1f77bcf86cd799439014', name: 'Patient One' }));
  t.mock.method(ClinicalAccessRequest, 'findOne', async () => null);
  const appointmentFind = t.mock.method(Appointment, 'findOne', filter => {
    assert.equal(filter.patient, '507f1f77bcf86cd799439014');
    assert.equal(filter.doctor, '507f1f77bcf86cd799439016');
    if (filter.assignedNurse) {
      assert.equal(filter.nursingAccessConsent, true);
      assert.equal(filter.nursingAccessRevokedAt, null);
      return selectedQuery(appointment);
    }
    return Promise.resolve(appointment);
  });
  t.mock.method(HealthProfile, 'findOne', async () => null);
  const emptyList = () => Object.assign(Promise.resolve([]), {
    sort() { return this; },
    select() { return this; },
    populate() { return this; },
    limit() { return this; },
  });
  t.mock.method(MedicalRecord, 'find', emptyList);
  t.mock.method(MedicalNote, 'find', emptyList);
  const nursingEntries = [{ _id: 'entry-one', note: 'Observation' }];
  const nursingFind = t.mock.method(NursingEntry, 'find', filter => {
    assert.equal(filter.appointment, id);
    assert.equal(filter.patient, '507f1f77bcf86cd799439014');
    return Object.assign(Promise.resolve(nursingEntries), {
      populate() { return this; },
      sort() { return this; },
      limit() { return this; },
    });
  });
  t.mock.method(AuditLog, 'create', async () => {});

  const req = {
    params: { patientId: 'MV-4BDB61AAFAA83B9A' },
    user: { _id: '507f1f77bcf86cd799439016', name: 'Doctor One' },
    headers: {},
  };
  const res = response();
  await getPatientClinicalOverview(req, res, next);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.nursingEntries, nursingEntries);
  assert.equal(appointmentFind.mock.callCount(), 2);
  assert.equal(nursingFind.mock.callCount(), 1);
});
