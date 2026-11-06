import test from 'node:test';
import assert from 'node:assert/strict';
import { cancelAppointment } from './src/controllers/appointmentController.js';
import Appointment from './src/models/Appointment.js';
import AuditLog from './src/models/AuditLog.js';
import InsuranceClaim from './src/models/InsuranceClaim.js';
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
  const claim = new InsuranceClaim({ patient: id, claimNumber: 'TEST', policyNumber: 'POLICY', insuranceCompany: 'Company', claimAmount: 100,
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
    return query([{ _id: id, action: 'APPOINTMENT_CANCELLED', details: 'Cancelled', timestamp: new Date() }]);
  });
  t.mock.method(NotificationRead, 'find', filter => {
    assert.equal(filter.viewer, 'viewer');
    return query([{ notification: id }]);
  });
  const res = response(); await handler('/', 'get')(request(), res, next);
  assert.equal(res.body.notifications[0].read, true);
  assert.equal(res.body.notifications[0].href, '/appointments');
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
