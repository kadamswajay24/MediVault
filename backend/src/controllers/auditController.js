import AuditLog from '../models/AuditLog.js';

// @desc    Get audit logs for authenticated user
// @route   GET /api/audit-logs
// @access  Private
export const getAuditLogs = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const action = req.query.action;

    const query = { user: req.user._id };
    if (action && action !== 'ALL') {
      query.action = action;
    }

    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit);

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    next(error);
  }
};
