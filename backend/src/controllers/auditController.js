import AuditLog from '../models/AuditLog.js';

// @desc    Get audit logs for authenticated user
// @route   GET /api/audit-logs
// @access  Private
export const getAuditLogs = async (req, res, next) => {
  try {
    const requestedLimit = parseInt(req.query.limit, 10) || 50;
    const limit = Math.min(Math.max(requestedLimit, 1), 100);
    const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), 10000);
    const action = req.query.action;

    // Patient audit entries are stored against the patient whose vault was
    // affected. resolvePatientContext validates an active dependent context.
    const subjectId = req.user.role === 'patient'
      ? req.effectivePatientId || req.user._id
      : req.user._id;
    const query = { user: subjectId };
    if (action && action !== 'ALL') {
      query.action = action;
    }

    const dateRange = {};
    const parseIndiaDate = (value, isEnd = false) => {
      if (!value) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
      const [year, month, day] = value.split('-').map(Number);
      const calendarDate = new Date(Date.UTC(year, month - 1, day));
      if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) return null;
      const date = new Date(`${value}T00:00:00+05:30`);
      if (Number.isNaN(date.getTime())) return null;
      if (isEnd) date.setUTCDate(date.getUTCDate() + 1);
      return date;
    };
    if (req.query.dateFrom) {
      const dateFrom = parseIndiaDate(String(req.query.dateFrom));
      if (!dateFrom) return res.status(400).json({ success: false, message: 'Invalid start date.' });
      dateRange.$gte = dateFrom;
    }
    if (req.query.dateTo) {
      const dateTo = parseIndiaDate(String(req.query.dateTo), true);
      if (!dateTo) return res.status(400).json({ success: false, message: 'Invalid end date.' });
      dateRange.$lt = dateTo;
    }
    if (dateRange.$gte && dateRange.$lt && dateRange.$gte >= dateRange.$lt) {
      return res.status(400).json({ success: false, message: 'The end date must be on or after the start date.' });
    }
    if (Object.keys(dateRange).length) query.timestamp = dateRange;

    const [logs, total] = await Promise.all([AuditLog.find(query)
      .populate('performedBy', 'name role')
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit), AuditLog.countDocuments(query)]);

    return res.status(200).json({
      success: true,
      count: logs.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      logs,
    });
  } catch (error) {
    next(error);
  }
};
