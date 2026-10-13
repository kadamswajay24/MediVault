import { randomBytes } from 'crypto';
import PolicyPlan from '../models/PolicyPlan.js';
import { createAuditLog } from '../services/auditService.js';

const planFields = ['name', 'provider', 'description', 'coverageAmount', 'monthlyPremium', 'highlights'];
const planStatuses = ['draft', 'published', 'archived'];

const validatePlanData = (data, { partial = false } = {}) => {
  const errors = [];

  for (const field of ['name', 'provider', 'description']) {
    if (partial && data[field] === undefined) continue;
    const limits = { name: 120, provider: 120, description: 1000 };
    if (
      typeof data[field] !== 'string' ||
      !data[field].trim() ||
      data[field].trim().length > limits[field]
    ) {
      errors.push(`${field} is required and must be no longer than ${limits[field]} characters.`);
    }
  }

  for (const field of ['coverageAmount', 'monthlyPremium']) {
    if (partial && data[field] === undefined) continue;
    if (
      typeof data[field] !== 'number' ||
      !Number.isFinite(data[field]) ||
      (field === 'coverageAmount' ? data[field] <= 0 : data[field] < 0)
    ) {
      errors.push(`${field} must be a valid ${field === 'coverageAmount' ? 'positive' : 'non-negative'} number.`);
    }
  }

  if (data.highlights !== undefined) {
    if (
      !Array.isArray(data.highlights) ||
      data.highlights.length > 12 ||
      data.highlights.some(
        (item) => typeof item !== 'string' || !item.trim() || item.trim().length > 160
      )
    ) {
      errors.push('Highlights must contain up to 12 non-empty entries of 160 characters or fewer.');
    }
  }

  if (data.status !== undefined && !planStatuses.includes(data.status)) {
    errors.push(`Status must be one of: ${planStatuses.join(', ')}.`);
  }

  return errors;
};

const auditPlanChange = (req, plan, action) =>
  createAuditLog({
    userId: req.user._id,
    performedBy: req.user._id,
    action,
    details: `${action === 'POLICY_PLAN_CREATED' ? 'Created' : 'Updated'} marketplace plan "${plan.name}" (${plan.status}).`,
    resourceId: plan._id,
    resourceType: 'PolicyPlan',
    req,
  });

export const getAdminPolicyPlans = async (_req, res, next) => {
  try {
    const plans = await PolicyPlan.find().sort({ updatedAt: -1 });
    return res.status(200).json({ success: true, plans });
  } catch (error) {
    next(error);
  }
};

export const createAdminPolicyPlan = async (req, res, next) => {
  try {
    const errors = validatePlanData(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join(' ') });
    }

    const plan = await PolicyPlan.create({
      ...Object.fromEntries(
        planFields
          .filter((field) => req.body[field] !== undefined)
          .map((field) => [
            field,
            field === 'highlights'
              ? req.body[field].map((item) => item.trim())
              : typeof req.body[field] === 'string'
                ? req.body[field].trim()
                : req.body[field],
          ])
      ),
      planId: `custom-${randomBytes(8).toString('hex')}`,
      status: 'draft',
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    await auditPlanChange(req, plan, 'POLICY_PLAN_CREATED');

    return res.status(201).json({
      success: true,
      message: 'Custom plan created as a draft.',
      plan,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminPolicyPlan = async (req, res, next) => {
  try {
    const errors = validatePlanData(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join(' ') });
    }
    if (!planFields.some((field) => req.body[field] !== undefined) && req.body.status === undefined) {
      return res.status(400).json({ success: false, message: 'Provide at least one plan field to update.' });
    }

    const plan = await PolicyPlan.findOne({ planId: req.params.planId });
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Custom marketplace plan not found.' });
    }

    for (const field of planFields) {
      if (req.body[field] === undefined) continue;
      plan.set(field, field === 'highlights'
        ? req.body[field].map((item) => item.trim())
        : typeof req.body[field] === 'string'
          ? req.body[field].trim()
          : req.body[field]);
    }
    if (req.body.status !== undefined) plan.status = req.body.status;
    plan.updatedBy = req.user._id;
    await plan.save();
    await auditPlanChange(req, plan, 'POLICY_PLAN_UPDATED');

    return res.status(200).json({ success: true, message: 'Marketplace plan updated.', plan });
  } catch (error) {
    next(error);
  }
};
