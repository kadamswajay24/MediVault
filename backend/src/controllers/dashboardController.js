import MedicalRecord, { RECORD_CATEGORIES } from '../models/MedicalRecord.js';
import HealthProfile from '../models/HealthProfile.js';
import InsuranceClaim from '../models/InsuranceClaim.js';
import MedicalNote from '../models/MedicalNote.js';
import ProxyDelegation from '../models/ProxyDelegation.js';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import ClinicalAccessRequest from '../models/ClinicalAccessRequest.js';

// @desc    Get dashboard statistics, health summary, and timeline
// @route   GET /api/dashboard/stats
// @access  Private
export const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.effectivePatientId || req.user._id;

    const appointmentNow = new Date();
    const appointmentToday = appointmentNow.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const appointmentTime = appointmentNow.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

    // Run parallel queries for optimal performance
    const [
      totalRecords,
      recentRecords,
      healthProfile,
      categoryStats,
      targetUser,
      claimsCount,
      proxiesCount,
      prescriptionNotes,
      prescriptionsCount,
      prescriptionRecords,
      pendingAccessRequests,
      claimsNeedingInformation,
      upcomingAppointments,
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
      MedicalNote.find({ patient: userId, noteType: 'Prescription', deletedAt: null })
        .select('title prescriptionItems createdAt')
        .sort({ createdAt: -1 })
        .limit(5),
      MedicalNote.countDocuments({ patient: userId, noteType: 'Prescription', deletedAt: null }),
      MedicalRecord.find({ user: userId, category: 'Prescription' })
        .sort({ recordDate: -1, createdAt: -1 })
        .limit(5),
      req.proxyDelegation?.accessLevel === 'read_only' ? Promise.resolve(0) :
        ClinicalAccessRequest.countDocuments({ patient: userId, status: 'pending', requestedUntil: { $gt: new Date() } }),
      InsuranceClaim.countDocuments({ patient: userId, status: 'More Information Needed' }),
      Appointment.find({ patient: userId, status: { $in: ['confirmed', 'pending'] },
        $or: [{ appointmentDate: { $gt: appointmentToday } }, { appointmentDate: appointmentToday, time: { $gte: appointmentTime } }] })
        .select('hospitalName appointmentDate time status').sort({ appointmentDate: 1, time: 1 }).limit(5),
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
    categoryMap.Prescription += prescriptionsCount;

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
      attention: { pendingAccessRequests, claimsNeedingInformation, upcomingAppointments },
      stats: {
        totalRecords,
        categories: categoryMap,
        completenessScore,
        claimsCount,
        proxiesCount,
        prescriptionsCount,
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
      prescriptions: prescriptionNotes,
      prescriptionRecords,
      timeline,
      isProxyContext: !!req.isProxyActing,
      targetUser: targetUser || null,
    });
  } catch (error) {
    next(error);
  }
};
