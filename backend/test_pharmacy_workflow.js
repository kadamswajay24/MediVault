import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDispenseRecord,
  createPrescriptionShare,
  lookupSharedPrescription,
} from './src/controllers/pharmacyController.js';
import AuditLog from './src/models/AuditLog.js';
import MedicalNote from './src/models/MedicalNote.js';
import PrescriptionDispenseRecord from './src/models/PrescriptionDispenseRecord.js';
import PrescriptionShare from './src/models/PrescriptionShare.js';
import PharmacyOrganization from './src/models/PharmacyOrganization.js';
import User from './src/models/User.js';
import { resolvePatientContext } from './src/middleware/authMiddleware.js';

const id = '507f1f77bcf86cd799439011';
const response = () => ({
  code: 200,
  body: null,
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; },
});
const next = (error) => { throw error; };
const request = (overrides = {}) => ({
  body: {},
  params: {},
  headers: {},
  user: { _id: id, name: 'Pharmacist One', medicalStaffDetails: { hospitalAffiliation: 'City Pharmacy' } },
  ...overrides,
});
const selectedQuery = (value) => Object.assign(Promise.resolve(value), {
  select() { return this; },
  populate() { return this; },
});
const prescription = {
  _id: '507f1f77bcf86cd799439012',
  title: 'Issued prescription',
  noteType: 'Prescription',
  deletedAt: null,
  updatedAt: new Date('2026-11-10T10:00:00.000Z'),
  createdAt: new Date('2026-11-10T09:00:00.000Z'),
  doctor: { name: 'Doctor One' },
  prescriptionItems: [{ medicineName: 'Medicine A', dosage: '1 tablet', frequency: 'Once daily', duration: '5 days' }],
};

test('patient shares only an owned digital prescription and receives the raw code once', async (t) => {
  t.mock.method(MedicalNote, 'findOne', (filter) => {
    assert.equal(filter.patient, id);
    assert.equal(filter.noteType, 'Prescription');
    assert.equal(filter.deletedAt, null);
    return { select: async () => prescription };
  });
  let storedShare;
  t.mock.method(PrescriptionShare, 'create', async (data) => {
    storedShare = data;
    return { _id: '507f1f77bcf86cd799439013', ...data };
  });
  t.mock.method(AuditLog, 'create', async () => {});

  const res = response();
  await createPrescriptionShare(request({
    user: { _id: id },
    body: { prescriptionId: prescription._id },
  }), res, next);
  assert.equal(res.code, 201);
  assert.match(res.body.token, /^[a-f0-9]{64}$/);
  assert.notEqual(storedShare.tokenHash, res.body.token);
  assert.match(storedShare.tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(storedShare.patient, id);
  assert.equal(storedShare.prescription, prescription._id);
  assert.equal(storedShare.expiresAt.getTime() - Date.now() <= 24 * 60 * 60 * 1000, true);
});

test('patient can share one prescription with a currently verified directory organization', async (t) => {
  const organizationId = '507f1f77bcf86cd799439016';
  const organization = { _id: organizationId, name: 'Verified Pharmacy' };
  t.mock.method(MedicalNote, 'findOne', () => ({
    select: async () => prescription,
  }));
  t.mock.method(PharmacyOrganization, 'findOne', (filter) => {
    assert.equal(filter._id, organizationId);
    assert.equal(filter.isActive, true);
    assert.equal(filter['verification.status'], 'verified');
    return selectedQuery(organization);
  });
  let storedShare;
  t.mock.method(PrescriptionShare, 'create', async (data) => {
    storedShare = data;
    return { _id: '507f1f77bcf86cd799439017', ...data };
  });
  const audit = t.mock.method(AuditLog, 'create', async () => {});

  const res = response();
  await createPrescriptionShare(request({
    user: { _id: id },
    body: { prescriptionId: prescription._id, pharmacyOrganizationId: organizationId },
  }), res, next);

  assert.equal(res.code, 201);
  assert.equal(storedShare.channel, 'directory');
  assert.equal(storedShare.pharmacyOrganization, organizationId);
  assert.equal(storedShare.tokenHash, undefined);
  assert.equal(res.body.token, undefined);
  assert.equal(res.body.share.pharmacyOrganization.name, organization.name);
  assert.equal(audit.mock.calls[0].arguments[0].action, 'PRESCRIPTION_SHARED');
});

test('pharmacist lookup rejects malformed access codes without querying shares', async (t) => {
  const lookup = t.mock.method(PrescriptionShare, 'findOneAndUpdate', async () => {
    throw new Error('share lookup must not run');
  });
  const res = response();
  await lookupSharedPrescription(request({ body: { token: 'not-a-code' } }), res, next);
  assert.equal(res.code, 400);
  assert.equal(lookup.mock.callCount(), 0);
});

test('valid access code binds its share to the pharmacist and returns only prescription details', async (t) => {
  const share = {
    _id: '507f1f77bcf86cd799439013',
    patient: '507f1f77bcf86cd799439014',
    prescription: prescription._id,
    prescriptionUpdatedAt: prescription.updatedAt,
    expiresAt: new Date(Date.now() + 60_000),
  };
  t.mock.method(PrescriptionShare, 'findOneAndUpdate', (filter, update, options) => {
    assert.match(filter.tokenHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(filter.$or, [{ accessedBy: null }, { accessedBy: id }]);
    assert.deepEqual(update, { $set: { accessedBy: id } });
    assert.equal(options.new, true);
    return selectedQuery(share);
  });
  t.mock.method(MedicalNote, 'findById', () => selectedQuery(prescription));
  t.mock.method(User, 'findById', () => selectedQuery({ name: 'Patient One', role: 'patient', isActive: true }));
  t.mock.method(AuditLog, 'create', async () => {});

  const res = response();
  await lookupSharedPrescription(request({ body: { token: 'a'.repeat(64) } }), res, next);
  assert.equal(res.code, 200);
  assert.equal(res.body.patientName, 'Patient One');
  assert.equal(res.body.prescription.items[0].medicineName, 'Medicine A');
  assert.equal(res.body.prescription.diagnosis, undefined);
  assert.equal(res.body.prescription.patient, undefined);
});

test('pharmacists cannot use a clinical grant to access general patient records', async (t) => {
  const lookup = t.mock.method(User, 'findOne', async () => {
    throw new Error('general patient lookup must not run');
  });
  let continued = false;
  const res = response();
  await resolvePatientContext({
    method: 'GET',
    headers: { 'x-patient-context': 'MV-0123456789ABCDEF' },
    query: {},
    user: {
      _id: id,
      mediVaultId: 'MV-1111111111111111',
      role: 'medical_staff',
      medicalStaffDetails: { professionalType: 'pharmacist' },
    },
  }, res, () => { continued = true; });
  assert.equal(res.code, 403);
  assert.equal(continued, false);
  assert.equal(lookup.mock.callCount(), 0);
});

test('dispensing rejects missing quantities before creating a record', async (t) => {
  const share = {
    _id: '507f1f77bcf86cd799439013',
    patient: '507f1f77bcf86cd799439014',
    prescription: prescription._id,
    accessedBy: id,
    prescriptionUpdatedAt: prescription.updatedAt,
  };
  t.mock.method(PrescriptionShare, 'findOne', async (filter) => {
    assert.equal(filter.accessedBy, id);
    return share;
  });
  t.mock.method(MedicalNote, 'findById', () => selectedQuery(prescription));
  t.mock.method(User, 'findById', () => selectedQuery({ role: 'patient', isActive: true }));
  const create = t.mock.method(PrescriptionDispenseRecord, 'create', async () => {
    throw new Error('record must not be created');
  });

  const res = response();
  await createDispenseRecord(request({
    params: { shareId: share._id },
    body: { items: [{ status: 'dispensed', quantityDispensed: '' }] },
  }), res, next);
  assert.equal(res.code, 400);
  assert.equal(create.mock.callCount(), 0);
});

test('dispensing snapshots medicine names from the prescription and audits the patient record', async (t) => {
  const share = {
    _id: '507f1f77bcf86cd799439013',
    patient: '507f1f77bcf86cd799439014',
    prescription: prescription._id,
    accessedBy: id,
    prescriptionUpdatedAt: prescription.updatedAt,
  };
  t.mock.method(PrescriptionShare, 'findOne', async (filter) => {
    assert.equal(filter.accessedBy, id);
    return share;
  });
  t.mock.method(MedicalNote, 'findById', () => selectedQuery(prescription));
  t.mock.method(User, 'findById', () => selectedQuery({ role: 'patient', isActive: true }));
  let storedRecord;
  t.mock.method(PrescriptionDispenseRecord, 'create', async (data) => {
    storedRecord = data;
    return { _id: '507f1f77bcf86cd799439015', ...data };
  });
  const audit = t.mock.method(AuditLog, 'create', async () => {});

  const res = response();
  await createDispenseRecord(request({
    params: { shareId: share._id },
    body: {
      items: [{ medicineName: 'Forged medicine', status: 'partially_dispensed', quantityDispensed: '2 tablets' }],
      notes: 'Partial supply',
    },
  }), res, next);
  assert.equal(res.code, 201);
  assert.equal(storedRecord.patient, share.patient);
  assert.equal(storedRecord.pharmacist, id);
  assert.equal(storedRecord.items[0].medicineName, 'Medicine A');
  assert.equal(storedRecord.items[0].quantityDispensed, '2 tablets');
  assert.equal(audit.mock.calls[0].arguments[0].action, 'PRESCRIPTION_DISPENSE_RECORDED');
});
