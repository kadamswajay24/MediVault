import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createCanvas } from '@napi-rs/canvas';
import recordRoutes from './src/routes/recordRoutes.js';
import claimRoutes from './src/routes/claimRoutes.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { createAuthRateLimit } from './src/middleware/authRateLimit.js';
import AuthRateLimit from './src/models/AuthRateLimit.js';
import User from './src/models/User.js';
import MedicalRecord from './src/models/MedicalRecord.js';
import InsuranceClaim from './src/models/InsuranceClaim.js';

// Explicit, local-only test server; never reads the application's MONGODB_URI.
const uri = process.env.TEST_STORAGE_MONGO_URI;
test('GridFS upload, reconnect, authorization, deletion and concurrent shared rate limits', { skip: !uri }, async (t) => {
  const target = new URL(uri);
  assert.equal(target.protocol, 'mongodb:');
  assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname));
  const dbName = `medivault_storage_test_${randomUUID().replaceAll('-', '')}`;
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'isolated-storage-test-secret-at-least-32-characters';
  let server;
  try {
    await mongoose.connect(uri, { dbName });
    await AuthRateLimit.init();
    const owner = await User.create({ name: 'Synthetic Owner', email: 'owner@example.com', password: 'test-password-123' });
    const outsider = await User.create({ name: 'Synthetic Other', email: 'other@example.com', password: 'test-password-123' });
    const agent = await User.create({ name: 'Synthetic Agent', email: 'agent@example.com', password: 'test-password-123', role: 'insurance_agent', insuranceDetails: { companyName: 'Example Insurance' } });
    const token = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    const app = express();
    app.use(express.json());
    app.use('/api/records', recordRoutes);
    app.use('/api/claims', claimRoutes);
    app.use(errorHandler);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (route, user = owner, options = {}) => fetch(base + route, { ...options, headers: { Authorization: `Bearer ${token(user)}`, ...options.headers } });
    const canvas = createCanvas(400, 80);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 400, 80);
    ctx.fillStyle = 'black'; ctx.font = '24px sans-serif'; ctx.fillText('SYNTHETIC TEST ONLY', 10, 45);
    const bytes = canvas.toBuffer('image/png');
    const form = (buffer, type = 'image/png') => {
      const data = new FormData();
      data.append('file', new Blob([buffer], { type }), 'synthetic.png');
      data.append('title', 'Synthetic test'); data.append('category', 'Other');
      return data;
    };
    const uploaded = await request('/api/records', owner, { method: 'POST', body: form(bytes) });
    const payload = await uploaded.json();
    assert.equal(uploaded.status, 201, JSON.stringify(payload));
    assert.ok(payload.record.storageFileId);
    const id = payload.record._id;
    const fileId = new mongoose.Types.ObjectId(payload.record.storageFileId);
    assert.equal(await mongoose.connection.db.collection('medicalFiles.files').countDocuments({ _id: fileId }), 1);
    await mongoose.disconnect();
    await mongoose.connect(uri, { dbName });
    const downloaded = await request(`/api/records/${id}/download`);
    assert.equal(downloaded.status, 200);
    assert.match(downloaded.headers.get('cache-control'), /no-store/);
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
    assert.equal((await request(`/api/records/${id}/download`, outsider)).status, 403);
    assert.equal((await request(`/api/records/${id}`, outsider, { method: 'DELETE' })).status, 403);
    assert.equal((await request('/api/records', owner, { method: 'POST', body: form(Buffer.from('spoofed')) })).status, 400);
    assert.equal((await request('/api/records', owner, { method: 'POST', body: form(Buffer.alloc(4 * 1024 * 1024 + 1)) })).status, 413);
    const claimId = new mongoose.Types.ObjectId();
    await InsuranceClaim.collection.insertOne({ _id: claimId, patient: owner._id, records: [new mongoose.Types.ObjectId(id)], insuranceCompany: 'Other Insurance', claimNumber: 'SYNTHETIC' });
    const claimRoute = `/api/claims/${claimId}/records/${id}/download`;
    assert.equal((await request(claimRoute, agent)).status, 403);
    await InsuranceClaim.collection.updateOne({ _id: claimId }, { $set: { insuranceCompany: 'Example Insurance' } });
    assert.equal((await request(claimRoute, agent)).status, 200);
    await InsuranceClaim.collection.updateOne({ _id: claimId }, { $set: { patient: outsider._id } });
    assert.equal((await request(claimRoute, agent)).status, 403);
    assert.equal((await request(`/api/records/${id}`, owner, { method: 'DELETE' })).status, 200);
    assert.equal(await MedicalRecord.countDocuments({ _id: id }), 0);
    assert.equal(await mongoose.connection.db.collection('medicalFiles.files').countDocuments({ _id: fileId }), 0);
    assert.equal(await mongoose.connection.db.collection('medicalFiles.chunks').countDocuments({ files_id: fileId }), 0);

    const save = t.mock.method(MedicalRecord.prototype, 'save', async () => { throw new Error('simulated metadata failure'); });
    assert.equal((await request('/api/records', owner, { method: 'POST', body: form(bytes) })).status, 500);
    save.mock.restore();
    assert.equal(await mongoose.connection.db.collection('medicalFiles.files').countDocuments(), 0);
    assert.equal(await mongoose.connection.db.collection('medicalFiles.chunks').countDocuments(), 0);

    // Separate middleware instances share atomic database counters.
    const options = { action: 'parallel-test', windowMs: 3600000, ipLimit: 100, accountLimit: 10 };
    const limiters = [createAuthRateLimit(options), createAuthRateLimit(options)];
    const results = await Promise.all(Array.from({ length: 25 }, async (_, i) => {
      let status = 200;
      await limiters[i % 2]({ headers: {}, socket: { remoteAddress: '127.0.0.1' }, body: { email: i % 2 ? 'OWNER@example.com' : ' owner@example.com ' } }, {
        set(name, value) { if (name === 'Retry-After') assert.ok(Number(value) > 0); },
        status(value) { status = value; return this; }, json() {},
      }, () => {});
      return status;
    }));
    assert.equal(results.filter((code) => code === 200).length, 10);
    assert.equal(results.filter((code) => code === 429).length, 15);
    const counters = await AuthRateLimit.find().lean();
    assert.ok(counters.every((counter) => !counter._id.includes('example.com')));
    const indexes = await AuthRateLimit.collection.indexes();
    assert.ok(indexes.some((index) => index.expireAfterSeconds === 0));
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});
