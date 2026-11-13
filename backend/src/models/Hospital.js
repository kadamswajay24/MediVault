import mongoose from 'mongoose';

const hospitalSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 150 },
  registrationNumber: { type: String, required: true, trim: true, maxlength: 100, unique: true },
  address: { type: String, required: true, trim: true, maxlength: 300 },
  city: { type: String, required: true, trim: true, maxlength: 100, index: true },
  district: { type: String, trim: true, maxlength: 100, default: '' },
  state: { type: String, required: true, trim: true, maxlength: 100 },
  postalCode: { type: String, trim: true, maxlength: 6, match: [/^$|^[1-9][0-9]{5}$/, 'PIN code must contain six digits.'], default: '' },
  postOffice: { type: String, trim: true, maxlength: 150, default: '' },
  isActive: { type: Boolean, default: true, index: true },
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending', index: true },
}, { timestamps: true });

export default mongoose.model('Hospital', hospitalSchema);
