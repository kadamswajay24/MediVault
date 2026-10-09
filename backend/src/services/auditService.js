import AuditLog from '../models/AuditLog.js';

/**
 * Log user action for health records and profile events.
 * Executes cleanly without breaking request flows on failure.
 */
export const createAuditLog = async ({
  userId,
  performedBy = null,
  action,
  details,
  resourceId = null,
  resourceType = 'General',
  req = null,
}) => {
  try {
    if (!userId || !action) return;

    const ipAddress =
      req?.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req?.socket?.remoteAddress ||
      '127.0.0.1';
    const userAgent = req?.headers['user-agent'] || 'Browser Client';

    await AuditLog.create({
      user: userId,
      performedBy: performedBy || (req?.user?._id?.toString() !== userId?.toString() ? req?.user?._id : null),
      action,
      details,
      resourceId: resourceId ? String(resourceId) : null,
      resourceType,
      ipAddress,
      userAgent,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[AuditLog Error]: Failed to create log entry:', error.message);
  }
};
