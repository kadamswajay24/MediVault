import mongoose from 'mongoose';

const nurseTeamResourceSchema = new mongoose.Schema({
  hospitalName: { type: String, trim: true, required: true, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['checklist_template', 'shift_handover'], required: true, index: true },
  title: { type: String, trim: true, required: true, maxlength: 100 },
  category: { type: String, enum: ['staffing', 'equipment', 'supplies', 'unit_operations'], default: 'unit_operations' },
  notes: { type: String, trim: true, maxlength: 1200, default: '' },
  checklistItems: [{ type: String, trim: true, maxlength: 160 }],
}, { timestamps: true });

nurseTeamResourceSchema.index({ hospitalName: 1, kind: 1, createdAt: -1 });
export default mongoose.model('NurseTeamResource', nurseTeamResourceSchema);
