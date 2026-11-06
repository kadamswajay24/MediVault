import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  viewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notification: { type: mongoose.Schema.Types.ObjectId, ref: 'AuditLog', required: true },
}, { timestamps: true });
schema.index({ viewer: 1, notification: 1 }, { unique: true });
export default mongoose.model('NotificationRead', schema);
