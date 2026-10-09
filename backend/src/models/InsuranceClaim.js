import mongoose from 'mongoose';

export const CLAIM_TYPES = [
  'Hospitalization',
  'Outpatient',
  'Prescription Reimbursement',
  'Diagnostic Test',
  'Emergency Care',
  'Dental / Vision',
  'Other',
];

export const CLAIM_STATUSES = [
  'Submitted',
  'Under Review',
  'Approved',
  'Rejected',
  'More Information Needed',
];

// Statuses that are considered "adjudication-locked" — no fresh re-adjudication, only supplements
export const ADJUDICATED_STATUSES = ['Approved', 'Rejected'];

const insuranceClaimSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    claimNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    policyNumber: {
      type: String,
      required: [true, 'Policy number is required'],
      trim: true,
    },
    insuranceCompany: {
      type: String,
      required: [true, 'Insurance company name is required'],
      trim: true,
    },
    claimType: {
      type: String,
      enum: CLAIM_TYPES,
      default: 'Hospitalization',
    },
    claimAmount: {
      type: Number,
      required: [true, 'Claim amount is required'],
      min: [0, 'Claim amount cannot be negative'],
    },
    approvedAmount: {
      type: Number,
      default: 0,
      min: [0, 'Approved amount cannot be negative'],
    },
    status: {
      type: String,
      enum: CLAIM_STATUSES,
      default: 'Submitted',
      index: true,
    },
    records: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MedicalRecord',
      },
    ],
    patientNotes: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    hospitalName: {
      type: String,
      default: '',
      trim: true,
    },
    admissionDate: {
      type: Date,
    },
    dischargeDate: {
      type: Date,
    },
    assignedAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    agentRemarks: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    reviewedAt: {
      type: Date,
    },
    // Supplemental top-up deposits after initial adjudication
    supplementalPayments: [
      {
        amount: { type: Number, required: true, min: 0 },
        reason: { type: String, trim: true, default: '' },
        authorizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        depositedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

insuranceClaimSchema.index({ insuranceCompany: 1, status: 1 });
insuranceClaimSchema.index({ patient: 1, createdAt: -1 });

export default mongoose.model('InsuranceClaim', insuranceClaimSchema);
