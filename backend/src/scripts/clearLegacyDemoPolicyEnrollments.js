import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PolicyEnrollment from '../models/PolicyEnrollment.js';

dotenv.config();

const confirmed = process.argv.includes('--confirm');
const allowRemote = process.argv.includes('--allow-remote');

if (!confirmed) {
  console.error('Refusing to delete enrollment data without --confirm.');
  process.exitCode = 1;
} else {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medivault';
  const target = new URL(uri);
  const localHosts = ['localhost', '127.0.0.1', '::1'];

  if (!localHosts.includes(target.hostname) && !allowRemote) {
    console.error(
      `Refusing to delete from remote MongoDB host "${target.hostname}" without --allow-remote.`
    );
    process.exitCode = 1;
  } else {
    try {
      await mongoose.connect(uri);
      const result = await PolicyEnrollment.deleteMany({
        planId: { $in: ['essential', 'family', 'plus'] },
      });
      console.info(
        `Removed ${result.deletedCount} legacy demo enrollment(s) from ${mongoose.connection.host}/${mongoose.connection.name}.`
      );
    } catch (error) {
      console.error('[Legacy Demo Policy Cleanup] Failed:', error.message);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  }
}
