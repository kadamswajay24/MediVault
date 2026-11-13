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
    assignedNurse: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    nursingAccessConsent: { type: Boolean, default: false },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    nursingAccessOpensAt: { type: Date },
    nursingAccessClosesAt: { type: Date },
    nursingAccessRevokedAt: { type: Date, default: null },
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
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bookingChannel: {
      type: String,
      enum: ['patient_portal', 'nurse_assisted', 'physician'],
      default: 'patient_portal',
    },
    chiefComplaint: { type: String, trim: true, maxlength: 500, default: '' },
    decisionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
