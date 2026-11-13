import mongoose from 'mongoose';

const insuranceCompanySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 150 },
  normalizedName: { type: String, required: true, unique: true, lowercase: true, trim: true },
  registrationNumber: { type: String, required: true, trim: true, maxlength: 100 },
  address: { type: String, required: true, trim: true, maxlength: 300 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  district: { type: String, trim: true, maxlength: 100, default: '' },
  state: { type: String, required: true, trim: true, maxlength: 100 },
  postalCode: { type: String, trim: true, maxlength: 6, match: [/^$|^[1-9][0-9]{5}$/, 'PIN code must contain six digits.'], default: '' },
  postOffice: { type: String, trim: true, maxlength: 150, default: '' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
  verification: {
    status: { type: String, enum: ['pending', 'needs_changes', 'verified', 'rejected'], default: 'pending', index: true },
    expiresAt: { type: Date, required: true },
    documentStorageFileId: { type: mongoose.Schema.Types.ObjectId, required: true },
    documentFileName: { type: String, default: '' },
    documentFileType: { type: String, default: '' },
    documentFileSize: { type: Number, default: 0 },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

export default mongoose.model('InsuranceCompany', insuranceCompanySchema);
