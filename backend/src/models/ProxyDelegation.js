import mongoose from 'mongoose';

const proxyDelegationSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    proxyUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    relationship: {
      type: String,
      required: [true, 'Relationship is required'],
      enum: ['Parent', 'Child', 'Spouse', 'Guardian', 'Caregiver', 'Other'],
      default: 'Caregiver',
    },
    accessLevel: {
      type: String,
      enum: ['read_only', 'full'],
      default: 'full',
    },
    status: {
      type: String,
      enum: ['active', 'revoked'],
      default: 'active',
      index: true,
    },
    notes: {
      type: String,
      default: '',
      maxlength: 500,
    },
    grantedAt: {
      type: Date,
      default: Date.now,
    },
    revokedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// One active or historical delegation record per patient-proxy pair
proxyDelegationSchema.index({ patient: 1, proxyUser: 1 }, { unique: true });

export default mongoose.model('ProxyDelegation', proxyDelegationSchema);
