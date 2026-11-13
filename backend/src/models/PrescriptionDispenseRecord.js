import mongoose from 'mongoose';

const prescriptionDispenseRecordSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalNote', required: true, index: true },
    share: { type: mongoose.Schema.Types.ObjectId, ref: 'PrescriptionShare', required: true },
    pharmacist: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pharmacyName: { type: String, trim: true, maxlength: 150, default: '' },
    items: [{
      medicineName: { type: String, required: true, trim: true, maxlength: 200 },
      status: { type: String, enum: ['dispensed', 'partially_dispensed', 'unavailable'], required: true },
      quantityDispensed: { type: String, trim: true, maxlength: 100, default: '' },
    }],
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true }
);

prescriptionDispenseRecordSchema.index({ patient: 1, createdAt: -1 });
prescriptionDispenseRecordSchema.index({ pharmacist: 1, createdAt: -1 });

export default mongoose.model('PrescriptionDispenseRecord', prescriptionDispenseRecordSchema);
