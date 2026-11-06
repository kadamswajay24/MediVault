import mongoose from 'mongoose';

const medicationReminderSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    medicationName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    medicationKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    time: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
      enum: ['Asia/Kolkata'],
    },
    confirmedCurrentUseAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

medicationReminderSchema.index(
  { patient: 1, medicationKey: 1, time: 1 },
  { unique: true }
);

export default mongoose.model('MedicationReminder', medicationReminderSchema);
