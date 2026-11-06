import assert from 'node:assert/strict';
import test from 'node:test';
import { getJwtSecret } from './src/config/auth.js';
import { deleteRecord } from './src/controllers/recordController.js';
import MedicalRecord from './src/models/MedicalRecord.js';
import ProxyDelegation from './src/models/ProxyDelegation.js';

test('JWT configuration rejects missing, short, and legacy secrets', () => {
  const original = process.env.JWT_SECRET;
  try {
    for (const secret of ['', 'short', 'medivault_super_secret_jwt_key_2026_dev_env']) {
      process.env.JWT_SECRET = secret;
      assert.throws(getJwtSecret, /JWT_SECRET/);
    }
    delete process.env.JWT_SECRET;
    assert.throws(getJwtSecret, /JWT_SECRET/);
    process.env.JWT_SECRET = 'a-unique-test-secret-with-at-least-32-characters';
    assert.equal(getJwtSecret(), process.env.JWT_SECRET);
  } finally {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  }
});

test('read-only caregiver cannot delete a record without patient-context headers', async (t) => {
  let deleted = false;
  const record = { user: 'patient-id', deleteOne: async () => { deleted = true; } };
  t.mock.method(MedicalRecord, 'findById', async () => record);
  const delegation = { patient: 'patient-id', proxyUser: 'caregiver-id', status: 'active', accessLevel: 'read_only' };
  t.mock.method(ProxyDelegation, 'findOne', async (query) => {
    assert.equal(query.patient, delegation.patient);
    assert.equal(query.proxyUser, delegation.proxyUser);
    return Object.entries(query).every(([key, value]) => delegation[key] === value) ? delegation : null;
  });
  let status;
  const res = { status(code) { status = code; return this; }, json(body) { return body; } };
  await deleteRecord({ params: { id: 'record-id' }, user: { _id: 'caregiver-id', role: 'patient' } }, res, (error) => { throw error; });
  assert.equal(status, 403);
  assert.equal(deleted, false);
});
