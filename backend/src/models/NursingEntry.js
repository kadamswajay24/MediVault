import mongoose from 'mongoose';

const nursingEntrySchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
  nurse: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  entryType: { type: String, enum: ['observation', 'nursing_note'], required: true },
  note: { type: String, trim: true, maxlength: 4000, default: '' },
  vitals: {
    temperatureC: { type: Number, min: 25, max: 45 },
    pulseBpm: { type: Number, min: 20, max: 300 },
    respiratoryRatePerMin: { type: Number, min: 1, max: 100 },
    systolicMmHg: { type: Number, min: 40, max: 300 },
    diastolicMmHg: { type: Number, min: 20, max: 200 },
    oxygenSaturationPercent: { type: Number, min: 0, max: 100 },
  },
}, { timestamps: true });

nursingEntrySchema.index({ patient: 1, createdAt: -1 });
export default mongoose.model('NursingEntry', nursingEntrySchema);
