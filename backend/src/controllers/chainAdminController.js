import mongoose from 'mongoose';
import User from '../models/User.js';
import PharmacyOrganization from '../models/PharmacyOrganization.js';
import LabOrganization from '../models/LabOrganization.js';
import { createAuditLog } from '../services/auditService.js';

export const createChainAdmin = async (req, res, next) => {
  try {
    const { chainType, chainId, name, email, phone, temporaryPassword } = req.body || {};
    if (!['pharmacy', 'lab'].includes(chainType) || !mongoose.Types.ObjectId.isValid(chainId || '') || ![name, email, phone, temporaryPassword].every((value) => String(value || '').trim()) || String(temporaryPassword).length < 8) return res.status(400).json({ success: false, message: 'Provide a valid chain, admin details, and a temporary password of at least 8 characters.' });
    const Model = chainType === 'pharmacy' ? PharmacyOrganization : LabOrganization;
    const role = chainType === 'pharmacy' ? 'pharmacy_chain_admin' : 'lab_chain_admin';
    const field = chainType === 'pharmacy' ? 'pharmacyChain' : 'labChain';
    const organization = await Model.findOne({ _id: chainId, organizationType: 'franchise', isActive: true, 'verification.status': 'verified', 'verification.expiresAt': { $gt: new Date() } });
    if (!organization) return res.status(404).json({ success: false, message: 'An approved, active chain is required.' });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    const phoneMatch = String(phone).replace(/[\s()-]/g, '').match(/^\+?91([6-9]\d{9})$/);
    if (!phoneMatch) return res.status(400).json({ success: false, message: 'Enter a valid Indian mobile number.' });
    const user = await User.create({ name: String(name).trim(), email: normalizedEmail, phone: `+91${phoneMatch[1]}`, password: String(temporaryPassword), role, [field]: organization._id, approvalStatus: 'approved', isActive: true, mustChangePassword: true });
    organization.admins.addToSet(user._id);
    await organization.save();
    await createAuditLog({ userId: user._id, performedBy: req.user._id, action: 'ADMIN_USER_UPDATED', details: `Platform administrator created a chain admin for ${organization.name}.`, resourceId: organization._id, resourceType: chainType === 'pharmacy' ? 'PharmacyOrganization' : 'LabOrganization', req });
    res.status(201).json({ success: true, message: 'Chain admin created. They must change the temporary password at first login.', user: { id: user._id, name: user.name, email: user.email, mustChangePassword: true } });
  } catch (error) { next(error); }
};
