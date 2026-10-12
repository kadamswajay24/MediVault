import mongoose from 'mongoose';

const policyEnrollmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    planId: {
      type: String,
      required: true,
    },
    planName: {
      type: String,
      required: true,
    },
    provider: {
      type: String,
      required: true,
    },
    coverageAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    monthlyPremium: {
      type: Number,
      required: true,
      min: 0,
    },
    policyNumber: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['demo_active'],
      default: 'demo_active',
    },
    nextPremiumDue: {
      type: Date,
      required: true,
    },
    payments: [
      {
        amount: { type: Number, required: true, min: 0 },
        paidAt: { type: Date, default: Date.now },
        mode: { type: String, enum: ['demo'], default: 'demo' },
      },
    ],
  },
  { timestamps: true }
);

policyEnrollmentSchema.index({ patient: 1, createdAt: -1 });
policyEnrollmentSchema.index({ patient: 1, planId: 1 }, { unique: true });

export default mongoose.model('PolicyEnrollment', policyEnrollmentSchema);
