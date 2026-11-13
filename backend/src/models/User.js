import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const appointmentScheduleSchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    startTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
    endTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
    slotDurationMinutes: { type: Number, enum: [15, 30, 45, 60], required: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/,
        'Please provide a valid email address',
      ],
    },
    mediVaultId: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      immutable: true,
      default: () => `MV-${randomBytes(8).toString('hex').toUpperCase()}`,
      match: /^MV-[A-F0-9]{16}$/,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['patient', 'medical_staff', 'insurance_agent', 'insurer_admin', 'pharmacy_manager', 'pharmacy_chain_admin', 'lab_manager', 'lab_chain_admin', 'hospital_admin', 'admin'],
      default: 'patient',
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved'],
      default: 'approved',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    pharmacyOrganization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PharmacyOrganization',
      default: null,
      index: true,
    },
    pharmacyMembershipStatus: {
      type: String,
      enum: ['not_applicable', 'pending', 'approved', 'rejected'],
      default: 'not_applicable',
      index: true,
    },
    labOrganization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabOrganization',
      default: null,
      index: true,
    },
    insuranceCompany: { type: mongoose.Schema.Types.ObjectId, ref: 'InsuranceCompany', default: null, index: true },
    insuranceAgentHospitals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', index: true }],
    pharmacyChain: { type: mongoose.Schema.Types.ObjectId, ref: 'PharmacyOrganization', default: null, index: true },
    labChain: { type: mongoose.Schema.Types.ObjectId, ref: 'LabOrganization', default: null, index: true },
    labMembershipStatus: {
      type: String,
      enum: ['not_applicable', 'pending', 'approved', 'rejected'],
      default: 'not_applicable',
      index: true,
    },
    hospitalAdminOf: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', index: true }],
    medicalStaffDetails: {
      professionalType: {
        type: String,
        enum: ['', 'physician', 'nurse', 'pharmacist', 'lab_technologist'],
        default: '',
        index: true,
      },
      licenseNumber: { type: String, trim: true, default: '' },
      registrationAuthority: { type: String, trim: true, default: '' },
      registrationState: { type: String, trim: true, default: '' },
      specialization: { type: String, trim: true, default: '' },
      hospitalAffiliation: { type: String, trim: true, default: '' },
      hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', default: null, index: true },
      appointmentSchedule: {
        type: [appointmentScheduleSchema],
        default: [],
      },
      appointmentManagers: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        default: [],
      },
    },
    insuranceDetails: {
      companyName: { type: String, trim: true, default: '' },
      agentId: { type: String, trim: true, default: '' },
      licenseNumber: { type: String, trim: true, default: '' },
    },
    credentialVerification: {
      status: { type: String, enum: ['pending', 'needs_changes', 'verified', 'rejected'], default: 'verified' },
      expiresAt: { type: Date, default: null },
      documentStorageFileId: { type: mongoose.Schema.Types.ObjectId, default: null },
      documentFileName: { type: String, default: '' },
      documentFileType: { type: String, default: '' },
      documentFileSize: { type: Number, default: 0 },
      submittedAt: { type: Date, default: null },
      reviewedAt: { type: Date, default: null },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reviewNote: { type: String, trim: true, maxlength: 1000, default: '' },
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password helper
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', userSchema);
