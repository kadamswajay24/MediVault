import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assignedApprovers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    hospitalName: { type: String, required: true, trim: true },
    appointmentDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    time: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    durationMinutes: { type: Number, required: true, enum: [15, 30, 45, 60] },
    reservedBlocks: { type: [String], required: true },
    slotReserved: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['confirmed', 'pending', 'declined', 'cancelled'],
      default: 'confirmed',
      index: true,
    },
    decisionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
  },
  { timestamps: true }
);

appointmentSchema.index(
  { doctor: 1, appointmentDate: 1, reservedBlocks: 1 },
  { unique: true, partialFilterExpression: { slotReserved: true } }
);
appointmentSchema.index({ patient: 1, appointmentDate: 1 });
appointmentSchema.index({ doctor: 1, status: 1, appointmentDate: 1 });

export default mongoose.model('Appointment', appointmentSchema);
