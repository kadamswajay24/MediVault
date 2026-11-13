import mongoose from 'mongoose';

const pharmacyOrganizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', default: null, index: true },
    organizationType: { type: String, enum: ['hospital', 'independent_pharmacy', 'franchise'], required: true, index: true },
    franchiseParent: { type: mongoose.Schema.Types.ObjectId, ref: 'PharmacyOrganization', default: null, index: true },
    registrationNumber: { type: String, required: true, trim: true, maxlength: 100 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    city: { type: String, required: true, trim: true, maxlength: 100, index: true },
    district: { type: String, trim: true, maxlength: 100, default: '' },
    state: { type: String, required: true, trim: true, maxlength: 100 },
    postalCode: { type: String, required: true, trim: true, maxlength: 6, match: /^[1-9][0-9]{5}$/ },
    postOffice: { type: String, trim: true, maxlength: 150, default: '' },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    openingHours: { type: String, required: true, trim: true, maxlength: 200 },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
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
  },
  { timestamps: true }
);

pharmacyOrganizationSchema.index({ 'verification.status': 1, isActive: 1, city: 1 });

export default mongoose.model('PharmacyOrganization', pharmacyOrganizationSchema);
