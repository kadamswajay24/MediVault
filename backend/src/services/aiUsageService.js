import { randomUUID } from 'node:crypto';
import AuthRateLimit from '../models/AuthRateLimit.js';
import { AiServiceError } from './aiProviderService.js';

const limited = (seconds) => Object.assign(new AiServiceError('AI request limit reached. Please try again later.', 429), { retryAfter: Math.max(1, seconds) });
const setting = (name, fallback) => {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new AiServiceError('AI usage limits are misconfigured.', 503);
  return parsed;
};

export const withAiUsage = async (userId, operation) => {
  if (!userId) throw new AiServiceError('Sign in to use AI features.', 401);
  const now = Date.now();
  const lockId = `ai-lock:${userId}`;
  const lease = randomUUID();
  let locked = false;
  try {
    try {
      const lock = await AuthRateLimit.findOneAndUpdate(
        { _id: lockId, expiresAt: { $lte: new Date(now) } },
        { $set: { count: 1, expiresAt: new Date(now + 90000), lease } },
        { upsert: true, new: true },
      );
      locked = Boolean(lock);
    } catch (error) {
      if (error.code === 11000) throw limited(90);
      throw error;
    }
    if (!locked) throw limited(90);
    const limits = [
      [`user:${userId}`, 60000, setting('AI_USER_REQUESTS_PER_MINUTE', 5)],
      [`user:${userId}`, 86400000, setting('AI_USER_REQUESTS_PER_DAY', 20)],
      ['global', 60000, setting('AI_GLOBAL_REQUESTS_PER_MINUTE', 10)],
      ['global', 86400000, setting('AI_GLOBAL_REQUESTS_PER_DAY', 100)],
    ];
    for (const [identity, windowMs, limit] of limits) {
      const window = Math.floor(now / windowMs);
      const expiresAt = new Date((window + 1) * windowMs);
      const _id = `ai:${identity}:${windowMs}:${window}`;
      const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt } };
      let counter;
      try { counter = await AuthRateLimit.findOneAndUpdate({ _id }, update, { upsert: true, new: true }); }
      catch (error) {
        if (error.code !== 11000) throw error;
        counter = await AuthRateLimit.findOneAndUpdate({ _id }, update, { new: true });
      }
      if (!counter || counter.count > limit) throw limited(Math.ceil((expiresAt.getTime() - now) / 1000));
    }
  } catch (error) {
    if (locked) await AuthRateLimit.deleteOne({ _id: lockId, lease }).catch(() => {});
    if (error instanceof AiServiceError) throw error;
    throw new AiServiceError('AI usage tracking is temporarily unavailable. Please try again later.', 503);
  }
  try { return await operation(); }
  finally {
    // Await release before completing the serverless request. The TTL also expires abandoned leases.
    await AuthRateLimit.deleteOne({ _id: lockId, lease }).catch(() => {});
  }
};
