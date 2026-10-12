import { randomBytes } from 'crypto';
import PolicyEnrollment from '../models/PolicyEnrollment.js';

export const POLICY_PLANS = [
  {
    id: 'essential',
    name: 'Essential Care',
    provider: 'MediVault Demo Insurance',
    description: 'An illustrative individual health plan for everyday care needs.',
    coverageAmount: 500000,
    monthlyPremium: 799,
    highlights: ['Hospitalization cover (illustrative)', 'Digital policy overview', 'Monthly billing example'],
  },
  {
    id: 'family',
    name: 'Family Health',
    provider: 'MediVault Demo Insurance',
    description: 'An illustrative shared-coverage plan for a family.',
    coverageAmount: 1000000,
    monthlyPremium: 1499,
    highlights: ['Family coverage example', 'Digital policy overview', 'Monthly billing example'],
  },
  {
    id: 'plus',
    name: 'Health Plus',
    provider: 'MediVault Demo Insurance',
    description: 'An illustrative higher-coverage plan with a larger example limit.',
    coverageAmount: 2000000,
    monthlyPremium: 2299,
    highlights: ['Higher coverage example', 'Digital policy overview', 'Monthly billing example'],
  },
];

const addOneMonth = (date) => {
  const nextDate = new Date(date);
  const dayOfMonth = nextDate.getDate();
  nextDate.setDate(1);
  nextDate.setMonth(nextDate.getMonth() + 1);
  const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
  nextDate.setDate(Math.min(dayOfMonth, lastDay));
  return nextDate;
};

export const getPolicyPlans = (_req, res) => {
  return res.status(200).json({
    success: true,
    plans: POLICY_PLANS,
    demoMode: true,
  });
};

export const getMyPolicies = async (req, res, next) => {
  try {
    const policies = await PolicyEnrollment.find({ patient: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, policies, demoMode: true });
  } catch (error) {
    next(error);
  }
};

export const enrollInPolicy = async (req, res, next) => {
  try {
    const plan = POLICY_PLANS.find((candidate) => candidate.id === req.params.planId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Policy plan not found.' });
    }

    const existingEnrollment = await PolicyEnrollment.exists({
      patient: req.user._id,
      planId: plan.id,
    });
    if (existingEnrollment) {
      return res.status(409).json({
        success: false,
        message: 'This demo plan is already in your policies.',
      });
    }

    const now = new Date();
    const policyNumber = `DEMO-${randomBytes(6).toString('hex').toUpperCase()}`;
    const policy = await PolicyEnrollment.create({
      patient: req.user._id,
      planId: plan.id,
      planName: plan.name,
      provider: plan.provider,
      coverageAmount: plan.coverageAmount,
      monthlyPremium: plan.monthlyPremium,
      policyNumber,
      nextPremiumDue: now,
    });

    return res.status(201).json({
      success: true,
      message: 'Demo enrollment created. This is not an insurance policy or confirmation of coverage.',
      policy,
      demoMode: true,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This demo plan is already in your policies.',
      });
    }
    next(error);
  }
};

export const payMonthlyPremium = async (req, res, next) => {
  try {
    const policy = await PolicyEnrollment.findOne({
      _id: req.params.enrollmentId,
      patient: req.user._id,
      status: 'demo_active',
    });
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Demo policy enrollment not found.' });
    }

    const paidAt = new Date();
    if (policy.nextPremiumDue > paidAt) {
      return res.status(400).json({
        success: false,
        message: `The next premium is not due until ${policy.nextPremiumDue.toLocaleDateString('en-IN')}.`,
      });
    }

    policy.payments.push({ amount: policy.monthlyPremium, paidAt, mode: 'demo' });
    policy.nextPremiumDue = addOneMonth(paidAt);
    await policy.save();

    return res.status(200).json({
      success: true,
      message: 'Demo premium payment recorded. No money was charged.',
      policy,
      demoMode: true,
    });
  } catch (error) {
    next(error);
  }
};
