import path from 'path';
import fs from 'fs';
import MedicalRecord, { RECORD_CATEGORIES } from '../models/MedicalRecord.js';
import ProxyDelegation from '../models/ProxyDelegation.js';
import { createAuditLog } from '../services/auditService.js';
import { removePhysicalFile } from '../services/recordService.js';
import { getUploadDirectory } from '../middleware/uploadMiddleware.js';

// Helper to check record access permissions
const canAccessRecord = async (user, record, proxyDelegation = null) => {
  // 1. Direct owner
  if (record.user.toString() === user._id.toString()) return true;

  // 2. Administrator
  if (user.role === 'admin') return true;

  // 3. Medical staff consultation
  if (user.role === 'medical_staff') return true;

  // 4. Caregiver / Proxy
  if (proxyDelegation && proxyDelegation.patient._id.toString() === record.user.toString()) {
    return true;
  }

  const delegation = await ProxyDelegation.findOne({
    patient: record.user,
    proxyUser: user._id,
    status: 'active',
  });
  if (delegation) return true;

  return false;
};

// @desc    Upload a new medical record
// @route   POST /api/records
// @access  Private
export const uploadRecord = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please upload a PDF, PNG, or JPG/JPEG file.',
      });
    }

    const { title, category, description, recordDate } = req.body;
    const targetUserId = req.effectivePatientId || req.user._id;

    if (!title || !title.trim()) {
      removePhysicalFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Record title is required.',
      });
    }

    if (!category || !RECORD_CATEGORIES.includes(category)) {
      removePhysicalFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: `Category is required and must be one of: ${RECORD_CATEGORIES.join(', ')}.`,
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    const record = await MedicalRecord.create({
      user: targetUserId,
      title: title.trim(),
      category,
      description: description ? description.trim() : '',
      recordDate: recordDate ? new Date(recordDate) : new Date(),
      fileName: req.file.originalname,
      storedFileName: req.file.filename,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      fileUrl,
    });

    // Audit log
    const proxyNotice = req.isProxyActing ? ` on behalf of patient` : '';
    await createAuditLog({
      userId: targetUserId,
      performedBy: req.user._id,
      action: 'RECORD_UPLOAD',
      details: `Uploaded record: "${record.title}" (${record.category})${proxyNotice}`,
      resourceId: record._id,
      resourceType: 'MedicalRecord',
      req,
    });

    return res.status(201).json({
      success: true,
      message: 'Medical record uploaded successfully',
      record,
    });
  } catch (error) {
    if (req.file?.path) {
      removePhysicalFile(req.file.path);
    }
    next(error);
  }
};

// @desc    Get all medical records for authenticated user (with search and category filter)
// @route   GET /api/records
// @access  Private
export const getRecords = async (req, res, next) => {
  try {
    const { category, search, sort = 'newest' } = req.query;
    const targetUserId = req.effectivePatientId || req.user._id;

    const query = { user: targetUserId };

    if (category && category !== 'All' && RECORD_CATEGORIES.includes(category)) {
      query.category = category;
    }

    if (search && search.trim()) {
      const sanitizedSearch = search.trim();
      query.$or = [
        { title: { $regex: sanitizedSearch, $options: 'i' } },
        { description: { $regex: sanitizedSearch, $options: 'i' } },
      ];
    }

    let sortOption = { recordDate: -1 };
    if (sort === 'oldest') {
      sortOption = { recordDate: 1 };
    } else if (sort === 'title') {
      sortOption = { title: 1 };
    }

    const records = await MedicalRecord.find(query).sort(sortOption);

    return res.status(200).json({
      success: true,
      count: records.length,
      records,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single medical record by ID
// @route   GET /api/records/:id
// @access  Private
export const getRecordById = async (req, res, next) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Medical record not found.',
      });
    }

    // Enforce authorization
    const hasAccess = await canAccessRecord(req.user, record, req.proxyDelegation);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access. You do not have permission to view this record.',
      });
    }

    // Audit log
    await createAuditLog({
      userId: record.user,
      performedBy: req.user._id,
      action: 'RECORD_VIEW',
      details: `Viewed record details: "${record.title}"`,
      resourceId: record._id,
      resourceType: 'MedicalRecord',
      req,
    });

    return res.status(200).json({
      success: true,
      record,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Download medical record physical file
// @route   GET /api/records/:id/download
// @access  Private
export const downloadRecord = async (req, res, next) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Medical record not found.',
      });
    }

    // Enforce authorization
    const hasAccess = await canAccessRecord(req.user, record, req.proxyDelegation);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access. You cannot download this file.',
      });
    }

    const uploadDir = getUploadDirectory();
    const filePath = path.join(uploadDir, record.storedFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'The requested physical file was not found on the server storage.',
      });
    }

    // Audit log
    await createAuditLog({
      userId: record.user,
      performedBy: req.user._id,
      action: 'RECORD_VIEW',
      details: `Downloaded document: "${record.fileName}" for record "${record.title}"`,
      resourceId: record._id,
      resourceType: 'MedicalRecord',
      req,
    });

    return res.download(filePath, record.fileName);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete medical record
// @route   DELETE /api/records/:id
// @access  Private
export const deleteRecord = async (req, res, next) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Medical record not found.',
      });
    }

    // Caregivers with read_only cannot delete
    if (req.proxyDelegation && req.proxyDelegation.accessLevel === 'read_only') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. Caregiver has read-only access.',
      });
    }

    // Enforce authorization
    const hasAccess = await canAccessRecord(req.user, record, req.proxyDelegation);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access. You cannot delete this record.',
      });
    }

    // Delete physical file
    const uploadDir = getUploadDirectory();
    const filePath = path.join(uploadDir, record.storedFileName);
    removePhysicalFile(filePath);

    // Delete database entry
    await record.deleteOne();

    // Audit log
    await createAuditLog({
      userId: record.user,
      performedBy: req.user._id,
      action: 'RECORD_DELETE',
      details: `Deleted record: "${record.title}" (${record.category})`,
      resourceId: record._id,
      resourceType: 'MedicalRecord',
      req,
    });

    return res.status(200).json({
      success: true,
      message: 'Medical record deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};
