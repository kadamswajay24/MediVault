import test from 'node:test';
import assert from 'node:assert/strict';
import { getDashboardStats } from './src/controllers/dashboardController.js';
import MedicalRecord from './src/models/MedicalRecord.js';
import HealthProfile from './src/models/HealthProfile.js';
import InsuranceClaim from './src/models/InsuranceClaim.js';
import MedicalNote from './src/models/MedicalNote.js';
import ProxyDelegation from './src/models/ProxyDelegation.js';
import User from './src/models/User.js';
import Appointment from './src/models/Appointment.js';
import ClinicalAccessRequest from './src/models/ClinicalAccessRequest.js';

for (const readOnly of [false, true]) {
  test(`dashboard scopes attention to the selected patient (read-only: ${readOnly})`, async (t) => {
    const chain = (value) => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, then(resolve) { return Promise.resolve(value).then(resolve); } });
    const patient = 'selected-patient';
    const appointments = [{ _id: 'appointment', hospitalName: 'Hospital', status: 'confirmed' }];
    for (const model of [MedicalRecord, MedicalNote, ProxyDelegation]) {
      t.mock.method(model, 'countDocuments', () => Promise.resolve(0));
    }
    t.mock.method(MedicalRecord, 'find', () => chain([]));
    t.mock.method(MedicalRecord, 'aggregate', () => Promise.resolve([]));
    t.mock.method(MedicalNote, 'find', () => chain([]));
    t.mock.method(HealthProfile, 'findOne', () => Promise.resolve(null));
    t.mock.method(User, 'findById', () => chain({ name: 'Patient' }));
    t.mock.method(InsuranceClaim, 'countDocuments', (filter) => {
      assert.equal(filter.patient, patient);
      return Promise.resolve(filter.status === 'More Information Needed' ? 2 : 4);
    });
    const access = t.mock.method(ClinicalAccessRequest, 'countDocuments', (filter) => {
      assert.equal(filter.patient, patient);
      assert.equal(filter.status, 'pending');
      assert.ok(filter.requestedUntil.$gt instanceof Date);
      return Promise.resolve(3);
    });
    t.mock.method(Appointment, 'find', (filter) => {
      assert.equal(filter.patient, patient);
      assert.deepEqual(filter.status.$in, ['confirmed', 'pending']);
      assert.match(filter.$or[1].time.$gte, /^\d{2}:\d{2}$/);
      return chain(appointments);
    });
    let body;
    await getDashboardStats({ effectivePatientId: patient, user: { _id: 'caregiver' }, proxyDelegation: { accessLevel: readOnly ? 'read_only' : 'full' } }, {
      status(code) { assert.equal(code, 200); return this; },
      json(value) { body = value; },
    }, (error) => { throw error; });
    assert.equal(body.attention.pendingAccessRequests, readOnly ? 0 : 3);
    assert.equal(access.mock.callCount(), readOnly ? 0 : 1);
    assert.equal(body.attention.claimsNeedingInformation, 2);
    assert.deepEqual(body.attention.upcomingAppointments, appointments);
  });
}
