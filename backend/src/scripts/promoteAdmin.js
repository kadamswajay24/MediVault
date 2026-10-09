import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error('Usage: npm run admin:promote -- <existing-user-email>');
  process.exitCode = 1;
} else {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medivault');

    const user = await User.findOne({ email });
    if (!user) {
      throw new Error(`No user account found for ${email}. Create a patient account first.`);
    }

    user.role = 'admin';
    user.approvalStatus = 'approved';
    user.isActive = true;
    await user.save();

    console.info(`Administrator access granted to ${email}.`);
  } catch (error) {
    console.error('[Admin Provisioning] Failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
