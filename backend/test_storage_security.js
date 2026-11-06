import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFileContent } from './src/middleware/uploadMiddleware.js';
import { clientAddress, createAuthRateLimit } from './src/middleware/authRateLimit.js';
import AuthRateLimit from './src/models/AuthRateLimit.js';

test('upload signature validation rejects spoofed MIME and empty files', () => {
  for (const buffer of [Buffer.from('<html>not a PDF</html>'), Buffer.alloc(0)]) {
    let code;
    validateFileContent({ file: { buffer, mimetype: 'application/pdf' } }, {
      status(value) { code = value; return this; }, json() {},
    }, () => assert.fail('spoofed file accepted'));
    assert.equal(code, 400);
  }
});

test('upload signature validation accepts supported signatures', () => {
  for (const [mimetype, buffer] of [
    ['application/pdf', Buffer.from('%PDF-1.4')],
    ['image/jpeg', Buffer.from([255, 216, 255, 224])],
    ['image/png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
  ]) {
    let accepted = false;
    validateFileContent({ file: { mimetype, buffer } }, {}, () => { accepted = true; });
    assert.equal(accepted, true);
  }
});

test('forwarding headers are ignored outside Vercel', () => {
  const original = process.env.VERCEL;
  try {
    delete process.env.VERCEL;
    const req = { headers: { 'x-forwarded-for': '198.51.100.1' }, socket: { remoteAddress: '127.0.0.1' } };
    assert.equal(clientAddress(req), '127.0.0.1');
    process.env.VERCEL = '1';
    assert.equal(clientAddress(req), '198.51.100.1');
  } finally {
    if (original === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = original;
  }
});

test('authentication fails closed when shared counters are unavailable', async (t) => {
  const original = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-only-secret-at-least-thirty-two-characters';
  t.mock.method(AuthRateLimit, 'findOneAndUpdate', async () => { throw new Error('offline'); });
  let code;
  try {
    await createAuthRateLimit({ action: 'test', windowMs: 1000, ipLimit: 1 })({ headers: {}, socket: {} }, {
      status(value) { code = value; return this; }, json() {},
    }, () => assert.fail('counter failure bypassed limiter'));
    assert.equal(code, 503);
  } finally {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  }
});
