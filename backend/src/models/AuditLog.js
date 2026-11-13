import mongoose from 'mongoose';

export const AUDIT_ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'PROFILE_UPDATE',
  'RECORD_UPLOAD',
  'RECORD_VIEW',
  'RECORD_AI_SUMMARIZED',
  'AI_SUMMARY_FEEDBACK',
  'MEDICATION_REMINDER_SET',
  'MEDICATION_REMINDER_REMOVED',
  'MEDICATION_ADHERENCE_LOGGED',
  'PRESCRIPTION_SHARED',
  'PRESCRIPTION_SHARE_ACCESSED',
  'PRESCRIPTION_SHARE_REVOKED',
  'PRESCRIPTION_DISPENSE_RECORDED',
  'PHARMACY_MEMBERSHIP_REVIEWED',
  'PHARMACY_ORGANIZATION_REVIEWED',
  'LAB_MEMBERSHIP_REVIEWED',
  'LAB_ORGANIZATION_REVIEWED',
  'LAB_ORDER_REQUESTED',
  'LAB_ORDER_CREATED_BY_PHYSICIAN',
  'LAB_RESULT_SUBMITTED',
  'LAB_ORDER_CANCELLED',
  'RECORD_DELETE',
  'PROXY_GRANTED',
  'PROXY_REVOKED',
  'PROXY_ACTION',
  'CLAIM_SUBMITTED',
  'CLAIM_REVIEWED',
  'CLINICAL_NOTE_ADDED',
  'NURSING_ENTRY_ADDED',
  'NURSING_OPERATIONS_UPDATED',
  'NURSING_TEAM_RESOURCE_ADDED',
  'NURSING_TEAM_RESOURCE_REMOVED',
  'CLINICAL_NOTE_UPDATED',
  'CLINICAL_NOTE_DELETION_REQUESTED',
  'CLINICAL_NOTE_DELETION_DECIDED',
  'ACCESS_REQUESTED',
  'ACCESS_REQUEST_DECIDED',
  'ACCESS_REVOKED',
  'APPOINTMENT_BOOKED',
  'APPOINTMENT_BOOKED_BY_STAFF',
  'APPOINTMENT_REVIEWED',
  'APPOINTMENT_CANCELLED',
  'ADMIN_USER_UPDATED',
  'POLICY_PLAN_CREATED',
  'POLICY_PLAN_UPDATED',
  'INSURANCE_COMPANY_APPLIED',
  'INSURANCE_COMPANY_REVIEWED',
  'INSURANCE_COMPANY_ADMIN_CREATED',
  'INSURANCE_AGENT_REVIEWED',
  'INSURANCE_AGENT_APPROVED',
  'HOSPITAL_CREATED',
  'HOSPITAL_ADMIN_CREATED',
  'PASSWORD_CHANGED',
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
