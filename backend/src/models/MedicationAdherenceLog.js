import mongoose from 'mongoose';

const medicationAdherenceLogSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reminder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MedicationReminder',
      required: true,
      index: true,
    },
    loggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String, // 'YYYY-MM-DD' in Asia/Kolkata
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    scheduledTime: {
      type: String, // 'HH:mm'
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    medicationName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: ['taken', 'skipped'],
      required: true,
      default: 'taken',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 250,
      default: '',
    },
    takenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// One status entry per reminder per scheduled day
medicationAdherenceLogSchema.index(
  { patient: 1, reminder: 1, date: 1 },
  { unique: true }
);

medicationAdherenceLogSchema.index({ patient: 1, date: -1 });

export default mongoose.model('MedicationAdherenceLog', medicationAdherenceLogSchema);

