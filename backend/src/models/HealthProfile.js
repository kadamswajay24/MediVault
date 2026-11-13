import mongoose from 'mongoose';

const healthProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    fullName: {
      type: String,
      trim: true,
      default: '',
    },
    dateOfBirth: {
      type: String, // Stored as ISO date string (YYYY-MM-DD) for consistency
      default: '',
    },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    city: { type: String, trim: true, maxlength: 100, default: '' },
    district: { type: String, trim: true, maxlength: 100, default: '' },
    state: { type: String, trim: true, maxlength: 100, default: '' },
    postalCode: { type: String, trim: true, match: [/^$|^[1-9][0-9]{5}$/, 'PIN code must contain six digits.'], default: '' },
    postOffice: { type: String, trim: true, maxlength: 150, default: '' },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other', 'Prefer not to say', ''],
      default: '',
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown', ''],
      default: 'Unknown',
    },
    allergies: {
      type: [String],
      default: [],
    },
    medicalConditions: {
      type: [String],
      default: [],
    },
    medications: {
      type: [String],
      default: [],
    },
    emergencyContact: {
      name: { type: String, trim: true, default: '' },
      relationship: { type: String, trim: true, default: '' },
      phone: {
        type: String, trim: true, default: '',
        set: (value) => {
          if (typeof value !== 'string') return value;
          const compact = value.trim().replace(/[ () .-]/g, '');
          if (/^[0-9]{10}$/.test(compact)) return `+91${compact}`;
          if (/^\+91[0-9]{10}$/.test(compact)) return compact;
          return value.trim();
        },
        validate: {
          validator: (value) => !value || /^\+91[0-9]{10}$/.test(value),
          message: 'Emergency phone number must be +91 followed by exactly 10 digits.',
        },
      },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('HealthProfile', healthProfileSchema);
