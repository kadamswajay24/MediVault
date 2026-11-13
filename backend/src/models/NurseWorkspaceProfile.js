import mongoose from 'mongoose';

const shiftSchema = new mongoose.Schema({
  dayOfWeek: { type: Number, min: 0, max: 6, required: true },
  startTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
  endTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
}, { _id: false });

const trainingSchema = new mongoose.Schema({
  title: { type: String, trim: true, required: true, maxlength: 120 },
  provider: { type: String, trim: true, maxlength: 120, default: '' },
  completedOn: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, required: true },
  expiresOn: { type: String, match: /^$|^\d{4}-\d{2}-\d{2}$/, default: '' },
}, { _id: true });

const nurseWorkspaceProfileSchema = new mongoose.Schema({
  nurse: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  shifts: { type: [shiftSchema], default: [] },
  trainingRecords: { type: [trainingSchema], default: [] },
}, { timestamps: true });

export default mongoose.model('NurseWorkspaceProfile', nurseWorkspaceProfileSchema);
