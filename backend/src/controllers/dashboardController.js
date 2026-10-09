import MedicalRecord, { RECORD_CATEGORIES } from '../models/MedicalRecord.js';
import HealthProfile from '../models/HealthProfile.js';
import InsuranceClaim from '../models/InsuranceClaim.js';
import ProxyDelegation from '../models/ProxyDelegation.js';
import User from '../models/User.js';

// @desc    Get dashboard statistics, health summary, and timeline
// @route   GET /api/dashboard/stats
// @access  Private
export const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.effectivePatientId || req.user._id;

    // Run parallel queries for optimal performance
    const [
      totalRecords,
      recentRecords,
      healthProfile,
      categoryStats,
      targetUser,
      claimsCount,
      proxiesCount,
    ] = await Promise.all([
      MedicalRecord.countDocuments({ user: userId }),
      MedicalRecord.find({ user: userId })
        .sort({ recordDate: -1, createdAt: -1 })
        .limit(5),
      HealthProfile.findOne({ user: userId }),
      MedicalRecord.aggregate([
        { $match: { user: userId } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      User.findById(userId).select('name email role'),
      InsuranceClaim.countDocuments({ patient: userId }),
      ProxyDelegation.countDocuments({ patient: userId, status: 'active' }),
    ]);

    // Format category breakdown with default zeroes for all categories
    const categoryMap = RECORD_CATEGORIES.reduce((acc, cat) => {
      acc[cat] = 0;
      return acc;
    }, {});

    categoryStats.forEach((item) => {
      if (item._id && categoryMap[item._id] !== undefined) {
        categoryMap[item._id] = item.count;
      }
    });

    // Calculate profile completeness score
    let completenessScore = 20; // Basic account creation
    if (healthProfile) {
      if (healthProfile.fullName) completenessScore += 15;
      if (healthProfile.dateOfBirth) completenessScore += 15;
      if (healthProfile.gender) completenessScore += 10;
      if (healthProfile.bloodGroup && healthProfile.bloodGroup !== 'Unknown') completenessScore += 15;
      if (healthProfile.allergies && healthProfile.allergies.length > 0) completenessScore += 10;
      if (
        healthProfile.emergencyContact &&
        healthProfile.emergencyContact.name &&
        healthProfile.emergencyContact.phone
      ) {
        completenessScore += 15;
      }
    }
    completenessScore = Math.min(100, completenessScore);

    // Timeline items (chronological health records order)
    const timeline = await MedicalRecord.find({ user: userId })
      .sort({ recordDate: -1 })
      .limit(10)
      .select('title category recordDate fileType fileName');

    return res.status(200).json({
      success: true,
      stats: {
        totalRecords,
        categories: categoryMap,
        completenessScore,
        claimsCount,
        proxiesCount,
      },
      healthProfile: healthProfile || {
        fullName: targetUser ? targetUser.name : req.user.name,
        bloodGroup: 'Unknown',
        allergies: [],
        medicalConditions: [],
        medications: [],
        emergencyContact: { name: '', relationship: '', phone: '' },
      },
      recentRecords,
      timeline,
      isProxyContext: !!req.isProxyActing,
      targetUser: targetUser || null,
    });
  } catch (error) {
    next(error);
  }
};
