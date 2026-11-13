import mongoose from 'mongoose';

const prescriptionShareSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalNote', required: true, index: true },
    accessedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    channel: { type: String, enum: ['code', 'directory'], default: 'code', required: true, index: true },
    pharmacyOrganization: { type: mongoose.Schema.Types.ObjectId, ref: 'PharmacyOrganization', default: null, index: true },
    tokenHash: { type: String, unique: true, sparse: true, select: false },
    prescriptionUpdatedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

prescriptionShareSchema.index({ patient: 1, createdAt: -1 });

export default mongoose.model('PrescriptionShare', prescriptionShareSchema);
