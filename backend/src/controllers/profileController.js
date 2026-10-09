import HealthProfile from '../models/HealthProfile.js';
import User from '../models/User.js';
import { createAuditLog } from '../services/auditService.js';

// @desc    Get user health profile
// @route   GET /api/profile
// @access  Private
export const getProfile = async (req, res, next) => {
  try {
    const targetUserId = req.effectivePatientId || req.user._id;
    let profile = await HealthProfile.findOne({ user: targetUserId });

    // If profile not yet created, create one automatically
    if (!profile) {
      const targetUser = await User.findById(targetUserId);
      profile = await HealthProfile.create({
        user: targetUserId,
        fullName: targetUser ? targetUser.name : req.user.name,
        bloodGroup: 'Unknown',
        allergies: [],
        medicalConditions: [],
        medications: [],
        emergencyContact: { name: '', relationship: '', phone: '' },
      });
    }

    return res.status(200).json({
      success: true,
      profile,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user health profile
// @route   PUT /api/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const targetUserId = req.effectivePatientId || req.user._id;

    // Check read-only permission for caregiver
    if (req.proxyDelegation && req.proxyDelegation.accessLevel === 'read_only') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Your caregiver access level is read-only for this patient.',
      });
    }

    const {
      fullName,
      dateOfBirth,
      gender,
      bloodGroup,
      allergies,
      medicalConditions,
      medications,
      emergencyContact,
    } = req.body;

    let profile = await HealthProfile.findOne({ user: targetUserId });

    if (!profile) {
      profile = new HealthProfile({ user: targetUserId });
    }

    if (fullName !== undefined) profile.fullName = fullName.trim();
    if (dateOfBirth !== undefined) profile.dateOfBirth = dateOfBirth;
    if (gender !== undefined) profile.gender = gender;
    if (bloodGroup !== undefined) profile.bloodGroup = bloodGroup;

    // Sanitize array values
    if (Array.isArray(allergies)) {
      profile.allergies = allergies.map((item) => String(item).trim()).filter(Boolean);
    }
    if (Array.isArray(medicalConditions)) {
      profile.medicalConditions = medicalConditions
        .map((item) => String(item).trim())
        .filter(Boolean);
    }
    if (Array.isArray(medications)) {
      profile.medications = medications
        .map((item) => String(item).trim())
        .filter(Boolean);
    }

    // Emergency contact
    if (emergencyContact && typeof emergencyContact === 'object') {
      profile.emergencyContact = {
        name: emergencyContact.name ? String(emergencyContact.name).trim() : '',
        relationship: emergencyContact.relationship
          ? String(emergencyContact.relationship).trim()
          : '',
        phone: emergencyContact.phone ? String(emergencyContact.phone).trim() : '',
      };
    }

    // Also update User name if fullName changed and updating self
    if (
      targetUserId.toString() === req.user._id.toString() &&
      fullName &&
      fullName.trim().length > 0 &&
      fullName.trim() !== req.user.name
    ) {
      await User.findByIdAndUpdate(req.user._id, { name: fullName.trim() });
    }

    await profile.save();

    // Audit log
    const proxyNotice = req.isProxyActing ? ` by caregiver ${req.user.name}` : '';
    await createAuditLog({
      userId: targetUserId,
      performedBy: req.user._id,
      action: 'PROFILE_UPDATE',
      details: `Health profile updated with new clinical demographics or contact info${proxyNotice}`,
      resourceId: profile._id,
      resourceType: 'HealthProfile',
      req,
    });

    return res.status(200).json({
      success: true,
      message: 'Health profile updated successfully',
      profile,
    });
  } catch (error) {
    next(error);
  }
};
