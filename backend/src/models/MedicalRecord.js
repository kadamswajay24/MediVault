import mongoose from 'mongoose';

export const RECORD_CATEGORIES = [
  'Laboratory Report',
  'Prescription',
  'Vaccination',
  'Medical History',
  'Medication',
  'Other',
];

const medicalRecordSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Record title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    category: {
      type: String,
      required: [true, 'Record category is required'],
      enum: {
        values: RECORD_CATEGORIES,
        message: 'Invalid category: {VALUE}',
      },
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    recordDate: {
      type: Date,
      default: Date.now,
    },
    fileName: {
      type: String,
      required: true,
    },
    storedFileName: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    // Extensible placeholders for future milestones (Blockchain, IPFS, OCR, Encryption)
    metadata: {
      ipfsHash: { type: String, default: null },
      blockchainTxHash: { type: String, default: null },
      isEncrypted: { type: Boolean, default: false },
      ocrExtractedText: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for high performance search & user isolation
medicalRecordSchema.index({ user: 1, category: 1 });
medicalRecordSchema.index({ user: 1, recordDate: -1 });
medicalRecordSchema.index({ title: 'text', description: 'text' });

export default mongoose.model('MedicalRecord', medicalRecordSchema);
