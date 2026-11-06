import { withAiUsage } from '../services/aiUsageService.js';
import { randomBytes } from 'crypto';
import PolicyPlan from '../models/PolicyPlan.js';
import { createAuditLog } from '../services/auditService.js';
import {
  generateInsurancePlanAssistantResponse,
  LocalAiSummaryError,
} from '../services/localAiSummaryService.js';

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

const normalizePlanFields = (data, fields = planFields) =>
  Object.fromEntries(
    fields
      .filter((field) => data[field] !== undefined)
      .map((field) => [
        field,
        field === 'highlights'
          ? data[field].map((item) => item.trim())
          : typeof data[field] === 'string'
            ? data[field].trim()
            : data[field],
      ])
  );

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
      ...normalizePlanFields(req.body),
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

export const getInsuranceAgentPolicyPlans = async (req, res, next) => {
  try {
    const plans = await PolicyPlan.find({ createdBy: req.user._id }).sort({ updatedAt: -1 });
    return res.status(200).json({ success: true, plans });
  } catch (error) {
    next(error);
  }
};

export const createInsuranceAgentPolicyPlan = async (req, res, next) => {
  try {
    if (req.body.status !== undefined) {
      return res.status(400).json({
        success: false,
        message: 'New insurance-agent listings must be submitted as drafts for admin review.',
      });
    }

    const provider = req.user.insuranceDetails?.companyName?.trim();
    if (!provider) {
      return res.status(400).json({
        success: false,
        message: 'An insurance company must be assigned to your account before creating a plan.',
      });
    }

    const errors = validatePlanData({ ...req.body, provider });
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join(' ') });
    }

    const plan = await PolicyPlan.create({
      ...normalizePlanFields({ ...req.body, provider }),
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

export const updateInsuranceAgentPolicyPlan = async (req, res, next) => {
  try {
    if (req.body.provider !== undefined || req.body.status !== undefined) {
      return res.status(400).json({
        success: false,
        message: 'Insurance agents cannot change a plan provider or listing status.',
      });
    }

    const editableFields = planFields.filter((field) => field !== 'provider');
    const errors = validatePlanData(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join(' ') });
    }
    if (!editableFields.some((field) => req.body[field] !== undefined)) {
      return res.status(400).json({ success: false, message: 'Provide at least one plan field to update.' });
    }

    const plan = await PolicyPlan.findOne({
      planId: req.params.planId,
      createdBy: req.user._id,
    });
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Marketplace plan not found.' });
    }

    plan.set(normalizePlanFields(req.body, editableFields));
    plan.updatedBy = req.user._id;
    await plan.save();
    await auditPlanChange(req, plan, 'POLICY_PLAN_UPDATED');

    return res.status(200).json({ success: true, message: 'Marketplace plan updated.', plan });
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

    plan.set(normalizePlanFields(req.body));
    if (req.body.status !== undefined) plan.status = req.body.status;
    plan.updatedBy = req.user._id;
    await plan.save();
    await auditPlanChange(req, plan, 'POLICY_PLAN_UPDATED');

    return res.status(200).json({ success: true, message: 'Marketplace plan updated.', plan });
  } catch (error) {
    next(error);
  }
};

export const chatWithInsurancePlanAssistant = async (req, res, next) => {
  try {
    const result = await withAiUsage(req.user._id, () => generateInsurancePlanAssistantResponse(req.body?.messages));
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    if (error instanceof LocalAiSummaryError) {
      res.statusCode = error.statusCode;
    }
    return next(error);
  }
};
