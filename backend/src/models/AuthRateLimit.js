import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  _id: String,
  count: { type: Number, required: true },
  lease: String,
  expiresAt: { type: Date, required: true, expires: 0 },
});

export default mongoose.model('AuthRateLimit', schema);
