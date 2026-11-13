import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import LabOrder from '../models/LabOrder.js';
import LabOrganization from '../models/LabOrganization.js';
import MedicalRecord from '../models/MedicalRecord.js';
import User from '../models/User.js';
import ClinicalAccessRequest from '../models/ClinicalAccessRequest.js';
import { saveFile, deleteFile } from '../services/fileStorageService.js';
import { createAuditLog } from '../services/auditService.js';

const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const verifiedLab = (id) => LabOrganization.findOne({ _id: id, isActive: true, 'verification.status': 'verified', 'verification.expiresAt': { $gt: new Date() } });

export const listPatientOrders = async (req, res, next) => {
  try {
    const orders = await LabOrder.find({ patient: req.user._id }).sort({ createdAt: -1 }).populate('organization', 'name city').populate('resultRecord', 'title fileUrl').populate('requestedBy', 'name').lean();
    res.json({ success: true, orders: orders.map((o) => ({ id: o._id, organization: o.organization, tests: o.tests, clinicalNote: o.clinicalNote, status: o.status, resultRecord: o.resultRecord, createdAt: o.createdAt, submittedAt: o.submittedAt, accessExpiresAt: o.accessExpiresAt, requestedBy: o.requestedBy?.name || 'Patient' })) });
  } catch (e) { next(e); }
};

export const createPatientOrder = async (req, res, next) => {
  try {
    const { organizationId, tests, clinicalNote = '' } = req.body || {};
    if (!validId(organizationId)) return res.status(400).json({ success: false, message: 'Choose a valid laboratory.' });
    if (!Array.isArray(tests) || tests.length < 1 || tests.length > 20 || tests.some((t) => typeof t !== 'string' || !t.trim() || t.trim().length > 120)) return res.status(400).json({ success: false, message: 'Enter between 1 and 20 test names (120 characters each).' });
    if (typeof clinicalNote !== 'string' || clinicalNote.length > 1000) return res.status(400).json({ success: false, message: 'Clinical note must be 1000 characters or fewer.' });
    const lab = await verifiedLab(organizationId);
    if (!lab) return res.status(404).json({ success: false, message: 'That laboratory is not currently verified and available.' });
    const order = await LabOrder.create({ patient: req.user._id, organization: lab._id, tests: [...new Set(tests.map((t) => t.trim()))], clinicalNote: clinicalNote.trim() });
    await createAuditLog({ userId: req.user._id, action: 'LAB_ORDER_REQUESTED', details: `Patient shared a test request with ${lab.name}.`, resourceId: order._id, resourceType: 'LabOrder', req });
    res.status(201).json({ success: true, message: 'Test request shared with the selected laboratory.', order: { id: order._id, status: order.status } });
  } catch (e) { next(e); }
};

export const createPhysicianOrder = async (req, res, next) => {
  try {
    const { patientMediVaultId, organizationId, tests, clinicalNote = '', accessExpiresAt } = req.body || {};
    const patient = await User.findOne({ mediVaultId: String(patientMediVaultId || '').toUpperCase(), role: 'patient', isActive: true });
    const expires = new Date(accessExpiresAt);
    if (!patient || Number.isNaN(expires.getTime()) || expires <= new Date() || expires > new Date(Date.now() + 30 * 86400000)) return res.status(400).json({ success:false, message:'Select a valid patient and access expiry within 30 days.' });
    const grant = await ClinicalAccessRequest.findOne({ patient: patient._id, medicalStaff: req.user._id, status:'approved', expiresAt: { $gt: expires } });
    if (!grant) return res.status(403).json({ success:false, message:'An active patient-approved clinical access grant through the selected expiry is required.' });
    if (!validId(organizationId) || !Array.isArray(tests) || !tests.length || tests.length > 20 || tests.some(t => typeof t !== 'string' || !t.trim() || t.trim().length > 120)) return res.status(400).json({ success:false, message:'Choose a laboratory and enter 1–20 valid tests.' });
    const lab = await verifiedLab(organizationId); if (!lab) return res.status(404).json({success:false,message:'Verified laboratory unavailable.'});
    const order = await LabOrder.create({ patient:patient._id, requestedBy:req.user._id, source:'physician', organization:lab._id, tests:tests.map(t=>t.trim()), clinicalNote:String(clinicalNote).slice(0,1000), accessExpiresAt:expires });
    await createAuditLog({ userId:patient._id, performedBy:req.user._id, action:'LAB_ORDER_CREATED_BY_PHYSICIAN', details:'Physician created a time-limited laboratory order.', resourceId:order._id, resourceType:'LabOrder', req });
    res.status(201).json({success:true,order:{id:order._id}});
  } catch(e){next(e);}
};

export const cancelPatientOrder = async (req, res, next) => {
  try {
    const order = await LabOrder.findOneAndUpdate({ _id: req.params.orderId, patient: req.user._id, status: 'requested' }, { $set: { status: 'cancelled' } }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Open laboratory request not found.' });
    await createAuditLog({ userId: req.user._id, action: 'LAB_ORDER_CANCELLED', details: 'Patient cancelled an open laboratory request.', resourceId: order._id, resourceType: 'LabOrder', req });
    res.json({ success: true, message: 'Laboratory request cancelled.' });
  } catch (e) { next(e); }
};

const assertLabStaff = async (req, res) => {
  const user = await User.findById(req.user._id).select('role medicalStaffDetails.professionalType labOrganization labMembershipStatus');
  if (!user || user.role !== 'medical_staff' || user.medicalStaffDetails?.professionalType !== 'lab_technologist' || user.labMembershipStatus !== 'approved') {
    res.status(403).json({ success: false, message: 'Approved laboratory technologist membership is required.' }); return null;
  }
  const lab = await verifiedLab(user.labOrganization);
  if (!lab) { res.status(403).json({ success: false, message: 'Your laboratory is not currently verified.' }); return null; }
  return lab;
};

export const listLabOrders = async (req, res, next) => {
  try {
    const lab = await assertLabStaff(req, res); if (!lab) return;
    const orders = await LabOrder.find({ organization: lab._id, status:'requested', $or:[{source:'patient'}, {accessExpiresAt:{$gt:new Date()}}] }).sort({ createdAt: -1 }).populate('patient', 'name').populate('resultRecord', 'title').lean();
    res.json({ success: true, orders: orders.map((o) => ({ id: o._id, patientName: o.patient?.name || 'Patient', tests: o.tests, clinicalNote: o.clinicalNote, status: o.status, resultTitle: o.resultRecord?.title || '', createdAt: o.createdAt, accessExpiresAt:o.accessExpiresAt, source:o.source })) });
  } catch (e) { next(e); }
};

export const revokePatientOrder = async(req,res,next)=>{try{const order=await LabOrder.findOneAndUpdate({_id:req.params.orderId,patient:req.user._id,source:'physician',status:'requested'},{$set:{status:'cancelled'}},{new:true});if(!order)return res.status(404).json({success:false,message:'Active physician lab order not found.'});await createAuditLog({userId:req.user._id,action:'LAB_ORDER_CANCELLED',details:'Patient revoked laboratory access and cancelled the order.',resourceId:order._id,resourceType:'LabOrder',req}).catch(()=>{});res.json({success:true,message:'Lab access revoked and order cancelled.'});}catch(e){next(e);}};

export const submitLabResult = async (req, res, next) => {
  let fileId;
  let recordId;
  let claimed = false;
  // Removes the stored file and any saved record that did not make it onto a claimed order.
  const discardUnclaimed = async () => {
    if (claimed) return;
    if (recordId) await MedicalRecord.deleteOne({ _id: recordId }).catch(() => {});
    if (fileId) await deleteFile({ storageFileId: fileId }).catch(() => {});
  };
  try {
    const lab = await assertLabStaff(req, res); if (!lab) return;
    if (!validId(req.params.orderId)) return res.status(400).json({ success: false, message: 'Invalid laboratory request.' });
    const order = await LabOrder.findOne({ _id: req.params.orderId, organization: lab._id, status: 'requested', $or:[{source:'patient'}, {accessExpiresAt:{$gt:new Date()}}] });
    if (!order) return res.status(404).json({ success: false, message: 'Open request for your laboratory not found.' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Attach the laboratory report as a PDF, PNG, or JPG.' });
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    if (!title || title.length > 150) return res.status(400).json({ success: false, message: 'Enter a report title up to 150 characters.' });
    const record = new MedicalRecord({ user: order.patient, title, category: 'Laboratory Report', description: `Submitted by ${lab.name}. Requested tests: ${order.tests.join(', ')}.`, recordDate: new Date(), fileName: req.file.originalname, storedFileName: randomUUID(), fileType: req.file.mimetype, fileSize: req.file.size, fileUrl: '' });
    record.fileUrl = `/api/records/${record._id}/download`;
    await record.validate();
    fileId = await saveFile(req.file.buffer, record.storedFileName);
    record.storageFileId = fileId;
    await record.save();
    recordId = record._id;
    // Claim the order atomically: only one concurrent submission can move it out of "requested".
    const submittedOrder = await LabOrder.findOneAndUpdate(
      { _id: order._id, organization: lab._id, status: 'requested', $or:[{source:'patient'}, {accessExpiresAt:{$gt:new Date()}}] },
      { $set: { status: 'result_submitted', resultRecord: record._id, submittedBy: req.user._id, submittedAt: new Date() } },
      { new: true }
    );
    if (!submittedOrder) {
      await discardUnclaimed();
      return res.status(409).json({ success: false, message: 'This laboratory request was already completed or is no longer open.' });
    }
    claimed = true;
    await createAuditLog({ userId: order.patient, performedBy: req.user._id, action: 'LAB_RESULT_SUBMITTED', details: `${req.user.name} submitted a laboratory report for "${title}".`, resourceId: order._id, resourceType: 'LabOrder', req }).catch((error) => console.error('[Lab audit] Result event could not be recorded:', error.message));
    res.status(201).json({ success: true, message: 'Report saved to the patient medical records.', orderId: order._id });
  } catch (e) { await discardUnclaimed(); next(e); }
};
