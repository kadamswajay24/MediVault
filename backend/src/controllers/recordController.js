import { withAiUsage } from '../services/aiUsageService.js';
import { randomUUID } from 'node:crypto';
import { saveFile, readFile, deleteFile, sendFile } from '../services/fileStorageService.js';
import MedicalRecord, { RECORD_CATEGORIES } from '../models/MedicalRecord.js';
import HealthProfile from '../models/HealthProfile.js';
import User from '../models/User.js';
import ProxyDelegation from '../models/ProxyDelegation.js';
import ClinicalAccessRequest from '../models/ClinicalAccessRequest.js';
import { createAuditLog } from '../services/auditService.js';
import {
  extractDocumentText,
  inspectPatientIdentity,
  LocalAiSummaryError,
  summarizeDocumentLocally,
} from '../services/localAiSummaryService.js';

// Helper to check record access permissions
const canAccessRecord = async (user, record, action = 'read') => {
  // 1. Direct owner
  if (record.user.toString() === user._id.toString()) return true;

  // Medical staff require a current grant for each patient's records.
  if (user.role === 'medical_staff') {
    if (action !== 'read') return false;
    return Boolean(await ClinicalAccessRequest.findOne({
      patient: record.user,
      medicalStaff: user._id,
      status: 'approved',
      expiresAt: { $gt: new Date() },
    }));
  }

  // Resolve permission from the record owner, independently of client context.
  const delegation = await ProxyDelegation.findOne({
    patient: record.user,
    proxyUser: user._id,
    status: 'active',
    ...(action === 'delete' ? { accessLevel: 'full' } : {}),
  });
  if (delegation) return true;

  return false;
};

// @desc    Upload a new medical record
// @route   POST /api/records
// @access  Private
export const uploadRecord = async (req, res, next) => {
  let storedFileId;
  let recordSaved = false;
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
      return res.status(400).json({
        success: false,
        message: 'Record title is required.',
      });
    }

    if (!category || !RECORD_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Category is required and must be one of: ${RECORD_CATEGORIES.join(', ')}.`,
      });
    }

    let extractedText = '';
    let identityCheck;
    try {
      const extracted = await extractDocumentText(
        req.file.buffer,
        req.file.mimetype
      );
      extractedText = extracted.text;

      const [owner, profile] = await Promise.all([
        User.findById(targetUserId).select('name mediVaultId'),
        HealthProfile.findOne({ user: targetUserId }).select('fullName dateOfBirth'),
      ]);
      if (!owner) {
        throw new Error('The patient account for this upload could not be found.');
      }

      identityCheck = {
        ...inspectPatientIdentity(extractedText, {
          names: [profile?.fullName, owner.name],
          dateOfBirth: profile?.dateOfBirth,
          mediVaultId: owner.mediVaultId,
          confidence: extracted.confidence,
        }),
        checkedAt: new Date(),
        confidence: extracted.confidence,
        extractionMethod: extracted.method,
      };
    } catch (error) {
      if (!(error instanceof LocalAiSummaryError)) throw error;
      console.error(`[Record OCR] ${error.code || 'extraction_failed'}: ${error.message}`);
      identityCheck = {
        status: 'unverified',
        message: 'Local text extraction failed. Please review the original document manually.',
        checkedAt: new Date(),
        confidence: null,
        extractionMethod: 'unavailable',
      };
    }

    const record = new MedicalRecord({
      user: targetUserId,
      title: title.trim(),
      category,
      description: description ? description.trim() : '',
      recordDate: recordDate ? new Date(recordDate) : new Date(),
      fileName: req.file.originalname,
      storedFileName: randomUUID(),
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      fileUrl: '',
      metadata: {
        ocrExtractedText: extractedText,
        identityCheck,
      },
    });
    record.fileUrl = `/api/records/${record._id}/download`;
    await record.validate();
    storedFileId = await saveFile(req.file.buffer, record.storedFileName);
    record.storageFileId = storedFileId;
    await record.save();
    recordSaved = true;

    // Audit log
    const proxyNotice = req.isProxyActing ? ` on behalf of patient` : '';
    await createAuditLog({
      userId: targetUserId,
      performedBy: req.user._id,
      action: 'RECORD_UPLOAD',
      details:
        `Uploaded record: "${record.title}" (${record.category}); identity check: ` +
        `${identityCheck?.status || 'unverified'}${proxyNotice}`,
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
    if (storedFileId && !recordSaved) {
      await deleteFile({ storageFileId: storedFileId }).catch((cleanupError) => {
        console.error("[Upload cleanup]", cleanupError.message);
      });
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
    const hasAccess = await canAccessRecord(req.user, record);
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

// @desc    Generate an ephemeral summary using the configured AI provider
// @route   GET /api/records/:id/summary
// @access  Private
export const summarizeRecord = async (req, res, next) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Medical record not found.',
      });
    }

    const hasAccess = await canAccessRecord(req.user, record);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access. You do not have permission to summarize this record.',
      });
    }

    const { summary, model } = await withAiUsage(req.user._id, async () => summarizeDocumentLocally(
      await readFile(record),
      record.fileType,
      record.metadata?.ocrExtractedText || '',
      req.user.role === 'medical_staff' ? 'clinician' : 'patient'
    ));

    await createAuditLog({
      userId: record.user,
      performedBy: req.user._id,
      action: 'RECORD_AI_SUMMARIZED',
      details: 'Generated an AI summary for a medical record.',
      resourceId: record._id,
      resourceType: 'MedicalRecord',
      req,
    });

    res.set('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true,
      summary,
      model,
      stored: false,
    });
  } catch (error) {
    if (error instanceof LocalAiSummaryError) {
      res.statusCode = error.statusCode;
    }
    return next(error);
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
    const hasAccess = await canAccessRecord(req.user, record);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access. You cannot download this file.',
      });
    }

    const buffer = await readFile(record);

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

    return sendFile(res, record, buffer);
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
    const hasAccess = await canAccessRecord(req.user, record, 'delete');
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access. You cannot delete this record.',
      });
    }

    await deleteFile(record);

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
