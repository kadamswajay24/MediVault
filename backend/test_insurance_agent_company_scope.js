import test from 'node:test';
import assert from 'node:assert/strict';
import InsuranceClaim from './src/models/InsuranceClaim.js';
import { getClaims, getClaimById, reviewClaim } from './src/controllers/claimController.js';

const response = () => ({ code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const next = (error) => { throw error; };
const request = (role = 'insurance_agent') => ({ params: { id: 'claim-id' }, query: {}, body: { status: 'Under Review' }, user: { _id: 'agent-id', role, insuranceCompany: 'company-a', insuranceAgentHospitals: ['hospital-a'] } });
const populatedQuery = (value) => {
  const query = Promise.resolve(value);
  query.populate = () => query;
  return query;
};

test('agent claims are filtered by both insurer and assigned hospitals', async (t) => {
  let filter;
  t.mock.method(InsuranceClaim, 'find', (query) => {
    filter = query;
    return { populate() { return this; }, sort: async () => [] };
  });
  const res = response();

  await getClaims(request(), res, next);

  assert.equal(String(filter.insuranceCompanyId), 'company-a');
  assert.deepEqual(filter.hospital.$in, ['hospital-a']);
});

test('agent claim listing fails closed without insurer or hospital assignments', async (t) => {
  t.mock.method(InsuranceClaim, 'find', () => assert.fail('must not query claims'));
  const req = request();
  req.user.insuranceAgentHospitals = [];
  const res = response();

  await getClaims(req, res, next);

  assert.equal(res.code, 403);
});

test('insurer admins see the complete company queue, including claims without a hospital', async (t) => {
  let filter;
  t.mock.method(InsuranceClaim, 'find', (query) => {
    filter = query;
    return { populate() { return this; }, sort: async () => [] };
  });
  const res = response();

  await getClaims(request('insurer_admin'), res, next);

  assert.equal(String(filter.insuranceCompanyId), 'company-a');
  assert.equal('hospital' in filter, false);
});

test('agent cannot read a claim for another assigned hospital', async (t) => {
  const claim = { patient: { _id: 'patient-id' }, insuranceCompanyId: 'company-a', hospital: 'hospital-b' };
  t.mock.method(InsuranceClaim, 'findById', () => populatedQuery(claim));
  const res = response();

  await getClaimById(request(), res, next);

  assert.equal(res.code, 404);
});

test('agent cannot review a claim outside its insurer and hospital assignment', async (t) => {
  const claim = { patient: { _id: 'patient-id' }, insuranceCompanyId: 'company-a', hospital: 'hospital-b', status: 'Submitted', save: async () => assert.fail('must not save an out-of-scope claim') };
  t.mock.method(InsuranceClaim, 'findById', () => populatedQuery(claim));
  const res = response();

  await reviewClaim(request(), res, next);

  assert.equal(res.code, 404);
});

test('insurer admin cannot read another insurer claim', async (t) => {
  const claim = { patient: { _id: 'patient-id' }, insuranceCompanyId: 'company-b', hospital: 'hospital-a' };
  t.mock.method(InsuranceClaim, 'findById', () => populatedQuery(claim));
  const res = response();

  await getClaimById(request('insurer_admin'), res, next);

  assert.equal(res.code, 404);
});
