import mongoose from 'mongoose';
import InsuranceCompany from '../models/InsuranceCompany.js';
import User from '../models/User.js';
import Hospital from '../models/Hospital.js';
import { generateCompanyAgentId } from '../services/agentIdService.js';
import { createAuditLog } from '../services/auditService.js';
import { deleteFile, readFile, saveFile, sendFile } from '../services/fileStorageService.js';
import { parseExpiryDate } from '../utils/dateValidation.js';
import { parseJsonField } from '../utils/parseJsonField.js';

const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const companyForAdmin = (req) => InsuranceCompany.findOne({ _id: req.user.insuranceCompany, admins: req.user._id, isActive: true, 'verification.status': 'verified', 'verification.expiresAt': { $gt: new Date() } });

export const listInsuranceCompanies = async (_req, res, next) => {
  try {
    const companies = await InsuranceCompany.find({ isActive: true, 'verification.status': 'verified', 'verification.expiresAt': { $gt: new Date() } })
      .select('name city state').sort({ name: 1 }).lean();
    res.json({ success: true, companies: companies.map((company) => ({ ...company, id: String(company._id) })) });
  } catch (error) { next(error); }
};

export const applyInsuranceCompany = async (req, res, next) => {
  let documentId;
  let user;
  try {
    const { name, email, password, phone, companyName, registrationNumber, credentialExpiresAt } = req.body || {};
    const submittedAddress = req.body?.postalAddress
      ? parseJsonField(req.body.postalAddress, 'postalAddress')
      : req.body || {};
    const { address, city, district, state, postalCode, postOffice } = submittedAddress;
    const normalizedPhone = String(phone || '').replace(/[\s()-]/g, '');
    const phoneMatch = normalizedPhone.match(/^(?:\+?91)?([6-9]\d{9})$/);
    const expiresAt = parseExpiryDate(credentialExpiresAt);
    if (![name, email, password, companyName, registrationNumber, address, city, state, postalCode].every((value) => String(value || '').trim()) || !/^[1-9][0-9]{5}$/.test(String(postalCode)) || !phoneMatch || password.length < 8 || !req.file || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      return res.status(400).json({ success: false, message: 'Complete all company and admin details, use a password of at least 8 characters, and upload a current registration document.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedName = String(companyName).trim().toLocaleLowerCase();
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    if (await InsuranceCompany.exists({ normalizedName })) return res.status(409).json({ success: false, message: 'An application for this insurer already exists.' });

    documentId = await saveFile(req.file.buffer, `insurer-registration-${Date.now()}`);
    user = await User.create({
      name: String(name).trim(), email: normalizedEmail, password: String(password), phone: `+91${phoneMatch[1]}`,
      role: 'insurer_admin', approvalStatus: 'pending', isActive: false,
    });
    const company = await InsuranceCompany.create({
      name: String(companyName).trim(), normalizedName, registrationNumber: String(registrationNumber).trim(),
      address: String(address).trim(), city: String(city).trim(), district: String(district || '').trim(), state: String(state).trim(), postalCode: String(postalCode).trim(), postOffice: String(postOffice || '').trim(), owner: user._id, admins: [user._id],
      verification: { status: 'pending', expiresAt, documentStorageFileId: documentId, documentFileName: req.file.originalname, documentFileType: req.file.mimetype, documentFileSize: req.file.size, submittedAt: new Date() },
    });
    user.insuranceCompany = company._id;
    await user.save();
    documentId = null;
    await createAuditLog({ userId: user._id, action: 'INSURANCE_COMPANY_APPLIED', details: `${company.name} submitted an insurer enrollment application.`, resourceId: company._id, resourceType: 'InsuranceCompany', req });
    return res.status(202).json({ success: true, pendingApproval: true, message: 'Company application submitted for administrator approval. The initial admin can sign in with the chosen password after approval.' });
  } catch (error) {
    if (documentId) await deleteFile({ storageFileId: documentId }).catch(() => {});
    if (user?._id) await User.findByIdAndDelete(user._id).catch(() => {});
    next(error);
  }
};

export const listInsuranceCompaniesForAdmin = async (_req, res, next) => {
  try {
    const companies = await InsuranceCompany.find({}).populate('owner', 'name email').populate('verification.reviewedBy', 'name').sort({ createdAt: -1 }).lean();
    res.json({ success: true, companies: companies.map(({ verification, ...company }) => ({
      ...company,
      id: String(company._id),
      verification: { ...verification, documentStorageFileId: undefined },
    })) });
  } catch (error) { next(error); }
};

export const downloadInsuranceCompanyDocument = async (req, res, next) => {
  try {
    if (!validId(req.params.companyId)) return res.status(400).json({ success: false, message: 'A valid insurer is required.' });
    const company = await InsuranceCompany.findById(req.params.companyId);
    if (!company?.verification.documentStorageFileId) return res.status(404).json({ success: false, message: 'Registration document not found.' });
    const file = { storageFileId: company.verification.documentStorageFileId, fileName: company.verification.documentFileName || 'insurer-registration', fileType: company.verification.documentFileType || 'application/octet-stream' };
    const buffer = await readFile(file);
    await createAuditLog({ userId: company.owner, performedBy: req.user._id, action: 'INSURANCE_COMPANY_REVIEWED', details: `Platform administrator viewed enrollment documents for ${company.name}.`, resourceId: company._id, resourceType: 'InsuranceCompany', req });
    return sendFile(res, file, buffer);
  } catch (error) { next(error); }
};

export const reviewInsuranceCompany = async (req, res, next) => {
  try {
    if (!validId(req.params.companyId)) return res.status(400).json({ success: false, message: 'A valid insurer is required.' });
    const { decision, reviewNote = '' } = req.body || {};
    if (!['verified', 'rejected'].includes(decision)) return res.status(400).json({ success: false, message: 'Choose verified or rejected.' });
    if (decision !== 'verified' && !String(reviewNote).trim()) return res.status(400).json({ success: false, message: 'Add a note when requesting changes or rejecting the application.' });
    const company = await InsuranceCompany.findById(req.params.companyId);
    if (!company) return res.status(404).json({ success: false, message: 'Insurer application not found.' });
    if (decision === 'verified' && (company.verification.status !== 'pending' || company.verification.expiresAt <= new Date())) return res.status(409).json({ success: false, message: 'The company must have a pending application and a current registration document.' });
    company.verification.status = decision;
    company.verification.reviewNote = String(reviewNote).trim().slice(0, 1000);
    company.verification.reviewedAt = new Date();
    company.verification.reviewedBy = req.user._id;
    company.isActive = decision !== 'rejected';
    await company.save();
    if (decision === 'verified') {
      await User.updateMany({ _id: { $in: [company.owner, ...company.admins] }, insuranceCompany: company._id, role: 'insurer_admin' }, { $set: { approvalStatus: 'approved', isActive: true } });
    } else if (decision === 'rejected') {
      await User.updateMany({ insuranceCompany: company._id, role: 'insurer_admin' }, { $set: { isActive: false, approvalStatus: 'pending' } });
    }
    await createAuditLog({ userId: company.owner, performedBy: req.user._id, action: 'INSURANCE_COMPANY_REVIEWED', details: `Platform administrator marked ${company.name} enrollment ${decision}${reviewNote ? `: ${String(reviewNote).trim().slice(0, 250)}` : ''}.`, resourceId: company._id, resourceType: 'InsuranceCompany', req });
    res.json({ success: true, message: `Insurer application marked ${decision}.` });
  } catch (error) { next(error); }
};

export const createInsuranceCompanyAdmin = async (req, res, next) => {
  try {
    const { name, email, phone, temporaryPassword } = req.body || {};
    if (!validId(req.params.companyId) || ![name, email, phone, temporaryPassword].every((value) => String(value || '').trim()) || String(temporaryPassword).length < 8) return res.status(400).json({ success: false, message: 'Provide the company, admin name, email, phone, and a temporary password of at least 8 characters.' });
    const company = await InsuranceCompany.findOne({ _id: req.params.companyId, isActive: true, 'verification.status': 'verified' });
    if (!company) return res.status(404).json({ success: false, message: 'An approved insurer is required.' });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    const phoneMatch = String(phone).replace(/[\s()-]/g, '').match(/^\+?91([6-9]\d{9})$/);
    if (!phoneMatch) return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number.' });
    const user = await User.create({ name: String(name).trim(), email: normalizedEmail, phone: `+91${phoneMatch[1]}`, password: String(temporaryPassword), role: 'insurer_admin', insuranceCompany: company._id, approvalStatus: 'approved', isActive: true, mustChangePassword: true });
    company.admins.addToSet(user._id);
    await company.save();
    await createAuditLog({ userId: user._id, performedBy: req.user._id, action: 'INSURANCE_COMPANY_ADMIN_CREATED', details: `Platform administrator created an insurer admin for ${company.name}.`, resourceId: company._id, resourceType: 'InsuranceCompany', req });
    res.status(201).json({ success: true, message: 'Company admin created. They must change the temporary password at first login.', user: { id: user._id, name: user.name, email: user.email, mustChangePassword: true } });
  } catch (error) { next(error); }
};

export const getMyInsuranceCompany = async (req, res, next) => {
  try {
    const company = await companyForAdmin(req);
    if (!company) return res.status(404).json({ success: false, message: 'Your insurer organization is unavailable.' });
    res.json({ success: true, company: { id: company._id, name: company.name, city: company.city, state: company.state } });
  } catch (error) { next(error); }
};

export const listCompanyHospitals = async (req, res, next) => {
  try {
    const company = await companyForAdmin(req);
    if (!company) return res.status(404).json({ success: false, message: 'Your insurer organization is unavailable.' });
    const hospitals = await Hospital.find({ isActive: true }).select('name city state').sort({ name: 1 }).lean();
    res.json({ success: true, hospitals: hospitals.map((hospital) => ({ ...hospital, id: String(hospital._id) })) });
  } catch (error) { next(error); }
};

const validateHospitalAssignments = async (hospitalIds) => {
  if (!Array.isArray(hospitalIds) || hospitalIds.length === 0 || hospitalIds.some((id) => !validId(id))) return null;
  const ids = [...new Set(hospitalIds.map(String))];
  const hospitals = await Hospital.find({ _id: { $in: ids }, isActive: true }).select('_id');
  return hospitals.length === ids.length ? hospitals.map((hospital) => hospital._id) : null;
};

export const createCompanyAgent = async (req, res, next) => {
  try {
    const company = await companyForAdmin(req);
    if (!company) return res.status(404).json({ success: false, message: 'Your approved insurer is unavailable.' });
    const { name, email, phone, licenseNumber = '', temporaryPassword, hospitalIds } = req.body || {};
    if (![name, email, phone, temporaryPassword].every((value) => String(value || '').trim()) || String(temporaryPassword).length < 8) return res.status(400).json({ success: false, message: 'Provide agent details and a temporary password of at least 8 characters.' });
    const assignments = await validateHospitalAssignments(hospitalIds);
    if (!assignments) return res.status(400).json({ success: false, message: 'Assign at least one active hospital to this agent.' });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    const phoneMatch = String(phone).replace(/[\s()-]/g, '').match(/^\+?91([6-9]\d{9})$/);
    if (!phoneMatch) return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number.' });
    const user = await User.create({
      name: String(name).trim(), email: normalizedEmail, phone: `+91${phoneMatch[1]}`, password: String(temporaryPassword),
      role: 'insurance_agent', insuranceCompany: company._id, insuranceAgentHospitals: assignments,
      insuranceDetails: { companyName: company.name, agentId: generateCompanyAgentId(company.name), licenseNumber: String(licenseNumber).trim() },
      approvalStatus: 'approved', isActive: true, mustChangePassword: true,
      credentialVerification: { status: 'verified' },
    });
    await createAuditLog({ userId: user._id, performedBy: req.user._id, action: 'INSURANCE_AGENT_APPROVED', details: `${req.user.name} created an agent account for ${company.name} and assigned ${assignments.length} hospital(s).`, resourceId: user._id, resourceType: 'User', req });
    res.status(201).json({ success: true, message: 'Agent account created. They must change the temporary password at first sign-in.', agent: { id: String(user._id), name: user.name, email: user.email, insuranceAgentHospitals: assignments.map(String), mustChangePassword: true } });
  } catch (error) { next(error); }
};

const findCompanyAgent = async (req, res) => {
  const company = await companyForAdmin(req);
  if (!company) { res.status(404).json({ success: false, message: 'Your insurer organization is unavailable.' }); return null; }
  if (!validId(req.params.userId)) { res.status(400).json({ success: false, message: 'A valid agent account is required.' }); return null; }
  const agent = await User.findOne({ _id: req.params.userId, role: 'insurance_agent', insuranceCompany: company._id });
  if (!agent) { res.status(404).json({ success: false, message: 'Agent application not found for your insurer.' }); return null; }
  return { company, agent };
};

export const listCompanyAgents = async (req, res, next) => {
  try {
    const company = await companyForAdmin(req);
    if (!company) return res.status(404).json({ success: false, message: 'Your insurer organization is unavailable.' });
    const agents = await User.find({ insuranceCompany: company._id, role: 'insurance_agent' }).select('name email phone approvalStatus isActive mustChangePassword insuranceAgentHospitals insuranceDetails.agentId insuranceDetails.licenseNumber credentialVerification.status credentialVerification.expiresAt credentialVerification.reviewNote credentialVerification.documentFileName createdAt').populate('insuranceAgentHospitals', 'name city state').sort({ createdAt: -1 }).lean();
    res.json({ success: true, agents: agents.map((agent) => ({
      ...agent,
      id: String(agent._id),
      insuranceAgentHospitals: (agent.insuranceAgentHospitals || []).map((hospital) => ({ ...hospital, id: String(hospital._id) })),
    })) });
  } catch (error) { next(error); }
};

export const updateCompanyAgentHospitals = async (req, res, next) => {
  try {
    const target = await findCompanyAgent(req, res);
    if (!target) return;
    const assignments = await validateHospitalAssignments(req.body?.hospitalIds);
    if (!assignments) return res.status(400).json({ success: false, message: 'Assign at least one active hospital to this agent.' });
    target.agent.insuranceAgentHospitals = assignments;
    await target.agent.save();
    await createAuditLog({ userId: target.agent._id, performedBy: req.user._id, action: 'INSURANCE_AGENT_APPROVED', details: `${req.user.name} updated hospital assignments for ${target.agent.name} at ${target.company.name}.`, resourceId: target.agent._id, resourceType: 'User', req });
    res.json({ success: true, message: 'Agent hospital assignments updated.' });
  } catch (error) { next(error); }
};

export const downloadCompanyAgentCredential = async (req, res, next) => {
  try {
    const target = await findCompanyAgent(req, res);
    if (!target) return;
    const { company, agent } = target;
    if (!agent.credentialVerification?.documentStorageFileId) return res.status(404).json({ success: false, message: 'Agent credential document not found.' });
    const file = { storageFileId: agent.credentialVerification.documentStorageFileId, fileName: agent.credentialVerification.documentFileName || 'agent-credential', fileType: agent.credentialVerification.documentFileType || 'application/octet-stream' };
    const buffer = await readFile(file);
    await createAuditLog({ userId: agent._id, performedBy: req.user._id, action: 'INSURANCE_AGENT_REVIEWED', details: `Insurer administrator viewed credentials for ${agent.name} at ${company.name}.`, resourceId: agent._id, resourceType: 'User', req });
    return sendFile(res, file, buffer);
  } catch (error) { next(error); }
};

export const reviewCompanyAgentCredential = async (req, res, next) => {
  try {
    const { decision, reviewNote = '' } = req.body || {};
    if (!['verified', 'needs_changes', 'rejected'].includes(decision)) return res.status(400).json({ success: false, message: 'Choose verified, needs_changes, or rejected.' });
    if (decision !== 'verified' && !String(reviewNote).trim()) return res.status(400).json({ success: false, message: 'Add a note when requesting changes or rejecting credentials.' });
    const target = await findCompanyAgent(req, res);
    if (!target) return;
    const { company, agent } = target;
    if (!agent.credentialVerification?.documentStorageFileId) return res.status(404).json({ success: false, message: 'Credential document not found.' });
    if (decision === 'verified' && (agent.credentialVerification.status !== 'pending' || !agent.credentialVerification.expiresAt || agent.credentialVerification.expiresAt <= new Date())) return res.status(409).json({ success: false, message: 'Only current, pending credentials can be verified.' });
    agent.credentialVerification.status = decision;
    agent.credentialVerification.reviewNote = String(reviewNote).trim().slice(0, 1000);
    agent.credentialVerification.reviewedAt = new Date();
    agent.credentialVerification.reviewedBy = req.user._id;
    await agent.save();
    await createAuditLog({ userId: agent._id, performedBy: req.user._id, action: 'INSURANCE_AGENT_REVIEWED', details: `Insurer administrator marked credentials for ${agent.name} ${decision} at ${company.name}.`, resourceId: agent._id, resourceType: 'User', req });
    res.json({ success: true, message: `Agent credentials marked ${decision}.` });
  } catch (error) { next(error); }
};

export const approveCompanyAgent = async (req, res, next) => {
  try {
    const target = await findCompanyAgent(req, res);
    if (!target) return;
    const { company, agent } = target;
    const assignments = await validateHospitalAssignments(req.body?.hospitalIds);
    if (!assignments) return res.status(400).json({ success: false, message: 'Assign at least one active hospital before approving this agent.' });
    if (agent.approvalStatus !== 'pending' || agent.credentialVerification?.status !== 'verified' || !agent.credentialVerification.expiresAt || agent.credentialVerification.expiresAt <= new Date()) return res.status(409).json({ success: false, message: 'Verify a current agent credential before approving this account.' });
    agent.insuranceAgentHospitals = assignments;
    agent.approvalStatus = 'approved';
    agent.isActive = true;
    await agent.save();
    await createAuditLog({ userId: agent._id, performedBy: req.user._id, action: 'INSURANCE_AGENT_APPROVED', details: `${req.user.name} approved ${agent.name} for ${company.name}.`, resourceId: agent._id, resourceType: 'User', req });
    res.json({ success: true, message: 'Insurance agent approved and assigned to selected hospitals.' });
  } catch (error) { next(error); }
};
