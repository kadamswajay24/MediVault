import mongoose from 'mongoose';

export const AUDIT_ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'PROFILE_UPDATE',
  'RECORD_UPLOAD',
  'RECORD_VIEW',
  'RECORD_DELETE',
  'PROXY_GRANTED',
  'PROXY_REVOKED',
  'PROXY_ACTION',
  'CLAIM_SUBMITTED',
  'CLAIM_REVIEWED',
  'CLINICAL_NOTE_ADDED',
  'ACCESS_REQUESTED',
  'ACCESS_REQUEST_DECIDED',
  'ACCESS_REVOKED',
  'ADMIN_USER_UPDATED',
];

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    action: {
      type: String,
      required: true,
      enum: AUDIT_ACTIONS,
      index: true,
    },
    details: {
      type: String,
      required: true,
      trim: true,
    },
    resourceId: {
      type: String,
      default: null,
    },
    resourceType: {
      type: String,
      default: 'General',
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1',
    },
    userAgent: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

auditLogSchema.index({ user: 1, timestamp: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
