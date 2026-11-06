import mongoose from 'mongoose';

export const CLINICAL_ACCESS_REASONS = [
  'Continuity of care',
  'Reviewing test results',
  'Diagnosis or treatment planning',
  'Medication or prescription review',
  'Follow-up care',
  'Emergency or urgent care',
  'Second opinion',
  'Other',
];

const clinicalAccessRequestSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    medicalStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    requestedUntil: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'denied', 'revoked'],
      default: 'pending',
      index: true,
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    decidedAt: {
      type: Date,
    },
    revokedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

clinicalAccessRequestSchema.index({ medicalStaff: 1, patient: 1, status: 1, expiresAt: 1 });

export default mongoose.model('ClinicalAccessRequest', clinicalAccessRequestSchema);
