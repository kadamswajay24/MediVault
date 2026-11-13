import mongoose from 'mongoose';

const labOrderSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  source: { type: String, enum: ['patient', 'physician'], default: 'patient', required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'LabOrganization', required: true, index: true },
  tests: [{ type: String, trim: true, required: true, maxlength: 120 }],
  clinicalNote: { type: String, trim: true, default: '', maxlength: 1000 },
  accessExpiresAt: { type: Date, default: null, index: true },
  status: { type: String, enum: ['requested', 'result_submitted', 'cancelled'], default: 'requested', index: true },
  resultRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord', default: null },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  submittedAt: { type: Date, default: null },
}, { timestamps: true });

labOrderSchema.index({ organization: 1, status: 1, createdAt: -1 });
export default mongoose.model('LabOrder', labOrderSchema);
