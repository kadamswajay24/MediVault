import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import AuthRateLimit from '../models/AuthRateLimit.js';
import { getJwtSecret } from '../config/auth.js';

export const clientAddress = (req) => {
  // Only trust the platform's overwritten forwarding header on Vercel.
  const forwarded = process.env.VERCEL ? req.headers['x-forwarded-for']?.split(',')[0].trim() : null;
  return (forwarded && isIP(forwarded) ? forwarded : req.socket?.remoteAddress) || 'unknown';
};

export const createAuthRateLimit = ({ action, windowMs, ipLimit, accountLimit, unavailableMessage = 'Sign-in is temporarily unavailable. Please try again later.' }) => async (req, res, next) => {
  try {
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    const expiresAt = new Date((window + 1) * windowMs);
    const keys = [[`ip:${clientAddress(req)}`, ipLimit]];
    if (accountLimit && typeof req.body?.email === 'string') {
      keys.push([`account:${req.body.email.trim().toLowerCase()}`, accountLimit]);
    }
    for (const [identity, limit] of keys) {
      const digest = createHmac('sha256', getJwtSecret()).update(identity).digest('hex');
      const _id = `${action}:${window}:${digest}`;
      const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt } };
      let counter;
      try {
        counter = await AuthRateLimit.findOneAndUpdate({ _id }, update, { upsert: true, new: true });
      } catch (error) {
        if (error.code !== 11000) throw error;
        counter = await AuthRateLimit.findOneAndUpdate({ _id }, update, { new: true });
      }
      if (!counter || counter.count > limit) {
        res.set('Retry-After', String(Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000))));
        res.set('Cache-Control', 'no-store');
        return res.status(429).json({ success: false, message: 'Too many attempts. Please try again later.' });
      }
    }
    return next();
  } catch (error) {
    console.error('[Auth rate limit] Storage unavailable:', error.message);
    return res.status(503).json({ success: false, message: unavailableMessage });
  }
};

export const loginRateLimit = createAuthRateLimit({ action: 'login', windowMs: 15 * 60 * 1000, ipLimit: 30, accountLimit: 10 });
export const registerRateLimit = createAuthRateLimit({ action: 'register', windowMs: 60 * 60 * 1000, ipLimit: 10 });
