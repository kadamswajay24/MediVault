import mongoose from 'mongoose';

export const NOTE_TYPES = [
  'Consultation',
  'Prescription',
  'Diagnosis',
  'Follow-up',
  'Lab Review',
];

const medicalNoteSchema = new mongoose.Schema(
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
    noteType: {
      type: String,
      enum: NOTE_TYPES,
      default: 'Consultation',
    },
    title: {
      type: String,
      required: [true, 'Note title is required'],
      trim: true,
      maxlength: 200,
    },
    diagnosis: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    prescriptionItems: [
      {
        medicineName: { type: String, required: true },
        dosage: { type: String, default: '' },
        frequency: { type: String, default: 'Once daily' },
        duration: { type: String, default: '5 days' },
        instructions: { type: String, default: '' },
      },
    ],
    clinicalNotes: {
      type: String,
      default: '',
      maxlength: 3000,
    },
    followUpDate: {
      type: Date,
    },
    linkedRecords: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MedicalRecord',
      },
    ],
  },
  {
    timestamps: true,
  }
);

medicalNoteSchema.index({ patient: 1, createdAt: -1 });
medicalNoteSchema.index({ doctor: 1, createdAt: -1 });

export default mongoose.model('MedicalNote', medicalNoteSchema);
