import mongoose from 'mongoose';
import { randomBytes } from 'crypto';
import User from '../models/User.js';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medivault');
    console.log(`[MongoDB Connected]: ${conn.connection.host}/${conn.connection.name}`);

    await User.init();
    const usersWithoutIds = await User.find({
      $or: [
        { mediVaultId: { $exists: false } },
        { mediVaultId: '' },
      ],
    }).select('_id').lean();

    for (const user of usersWithoutIds) {
      await User.collection.updateOne(
        {
          _id: user._id,
          $or: [
            { mediVaultId: { $exists: false } },
            { mediVaultId: '' },
          ],
        },
        { $set: { mediVaultId: `MV-${randomBytes(8).toString('hex').toUpperCase()}` } }
      );
    }

    if (usersWithoutIds.length > 0) {
      console.log(`[MediVault IDs]: Assigned IDs to ${usersWithoutIds.length} existing accounts.`);
    }
  } catch (error) {
    console.error(`[MongoDB Connection Error]: ${error.message}`);
    process.exit(1);
  }
};
