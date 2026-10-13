import mongoose from 'mongoose';

const policyPlanSchema = new mongoose.Schema(
  {
    planId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    coverageAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    monthlyPremium: {
      type: Number,
      required: true,
      min: 0,
    },
    highlights: {
      type: [String],
      default: [],
      validate: {
        validator: (items) =>
          items.length <= 12 &&
          items.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= 160),
        message: 'Plans can have up to 12 non-empty highlights of 160 characters or fewer.',
      },
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

policyPlanSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('PolicyPlan', policyPlanSchema);
