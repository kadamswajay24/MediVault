import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import User from './src/models/User.js';
import HealthProfile from './src/models/HealthProfile.js';
import MedicalRecord from './src/models/MedicalRecord.js';
import ProxyDelegation from './src/models/ProxyDelegation.js';
import InsuranceClaim from './src/models/InsuranceClaim.js';
import MedicalNote from './src/models/MedicalNote.js';
import AuditLog from './src/models/AuditLog.js';
import ClinicalAccessRequest from './src/models/ClinicalAccessRequest.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PASSWORD = process.env.DEMO_SEED_PASSWORD;

const createDemoPdf = () => {
  const lines = [
    'MediVault - DEMONSTRATION ONLY',
    'Report: Coronary Angiogram Diagnostic Report',
    'Patient: Rohan Verma',
    'Date: 2026-10-02',
    'Synthetic sample; not a real clinical document.',
    'Not for clinical care or insurance decisions.',
  ];
  const escapePdfText = (value) => value.replace(/([\\()])/g, '\\$1');
  const content = [
    'BT',
    '/F1 18 Tf',
    '72 740 Td',
    `(${escapePdfText(lines[0])}) Tj`,
    '/F1 11 Tf',
    ...lines.slice(1).flatMap((line) => ['0 -24 Td', `(${escapePdfText(line)}) Tj`]),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream`,
  ];
  const chunks = [Buffer.from('%PDF-1.4\n', 'ascii')];
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(chunks.reduce((size, chunk) => size + chunk.length, 0));
    chunks.push(Buffer.from(`${index + 1} 0 obj\n${object}\nendobj\n`, 'ascii'));
  });

  const xrefOffset = chunks.reduce((size, chunk) => size + chunk.length, 0);
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    '0000000000 65535 f \n',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  ];
  chunks.push(Buffer.from(xref.join(''), 'ascii'));
  return Buffer.concat(chunks);
};

if (process.env.NODE_ENV !== 'development') {
  throw new Error('Demo data can only be seeded when NODE_ENV=development.');
}

if (!PASSWORD || PASSWORD.length < 12) {
  throw new Error('Set DEMO_SEED_PASSWORD to a value of at least 12 characters before seeding.');
}

async function seedDemoData() {
  console.log('[MediVault Seed] Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medivault');
  console.log('[MediVault Seed] Connected successfully.');

  // 1. Create or update Demo Patient
  let patient = await User.findOne({ email: 'patient@medivault.io' });
  if (!patient) {
    patient = await User.create({
      name: 'Rohan Verma',
      email: 'patient@medivault.io',
      password: PASSWORD,
      role: 'patient',
      phone: '+91 9876543210',
    });
  } else {
    patient.password = PASSWORD;
    patient.role = 'patient';
    await patient.save();
  }

  // Ensure Patient Health Profile
  let profile = await HealthProfile.findOne({ user: patient._id });
  if (!profile) {
    profile = await HealthProfile.create({
      user: patient._id,
      fullName: 'Rohan Verma',
      dateOfBirth: '1975-06-12',
      gender: 'Male',
      bloodGroup: 'B+',
      allergies: ['Penicillin', 'Sulfa Drugs'],
      medicalConditions: ['Hypertension', 'Type 2 Diabetes'],
      medications: ['Amlodipine 5mg', 'Metformin 500mg'],
      emergencyContact: {
        name: 'Priya Verma',
        relationship: 'Daughter',
        phone: '+91 9876543211',
      },
    });
  }

  // 2. Create or update Demo Caregiver
  let caregiver = await User.findOne({ email: 'caregiver@medivault.io' });
  if (!caregiver) {
    caregiver = await User.create({
      name: 'Priya Verma',
      email: 'caregiver@medivault.io',
      password: PASSWORD,
      role: 'patient',
      phone: '+91 9876543211',
    });
  } else {
    caregiver.password = PASSWORD;
    await caregiver.save();
  }

  // Ensure Proxy Delegation
  let delegation = await ProxyDelegation.findOne({
    patient: patient._id,
    proxyUser: caregiver._id,
  });
  if (!delegation) {
    delegation = await ProxyDelegation.create({
      patient: patient._id,
      proxyUser: caregiver._id,
      relationship: 'Child',
      accessLevel: 'full',
      status: 'active',
      notes: 'Authorized daughter to manage health vault and file insurance claims',
    });
  }

  // 3. Create or update Demo Doctor
  let doctor = await User.findOne({ email: 'doctor@medivault.io' });
  if (!doctor) {
    doctor = await User.create({
      name: 'Dr. Sameer Kulkarni',
      email: 'doctor@medivault.io',
      password: PASSWORD,
      role: 'medical_staff',
      phone: '+91 9876543212',
      medicalStaffDetails: {
        licenseNumber: 'MCI-MH-49201',
        specialization: 'Senior Cardiologist',
        hospitalAffiliation: 'Apollo Multispeciality Hospital',
      },
    });
  } else {
    doctor.password = PASSWORD;
    doctor.role = 'medical_staff';
    doctor.medicalStaffDetails = {
      licenseNumber: 'MCI-MH-49201',
      specialization: 'Senior Cardiologist',
      hospitalAffiliation: 'Apollo Multispeciality Hospital',
    };
    await doctor.save();
  }

  // 4. Create or update Demo Insurance Agent
  let agent = await User.findOne({ email: 'agent@medivault.io' });
  if (!agent) {
    agent = await User.create({
      name: 'Vikram Mehta',
      email: 'agent@medivault.io',
      password: PASSWORD,
      role: 'insurance_agent',
      phone: '+91 9876543213',
      insuranceDetails: {
        companyName: 'Star Health & Allied Insurance',
        agentId: 'AGT-STAR-8841',
        licenseNumber: 'IRDAI-AG-99321',
      },
    });
  } else {
    agent.password = PASSWORD;
    agent.role = 'insurance_agent';
    agent.insuranceDetails = {
      companyName: 'Star Health & Allied Insurance',
      agentId: 'AGT-STAR-8841',
      licenseNumber: 'IRDAI-AG-99321',
    };
    await agent.save();
  }

  // 5. Create or update Demo Admin
  let admin = await User.findOne({ email: 'admin@medivault.io' });
  if (!admin) {
    admin = await User.create({
      name: 'Chief Admin',
      email: 'admin@medivault.io',
      password: PASSWORD,
      role: 'admin',
      phone: '+91 9876543214',
    });
  } else {
    admin.password = PASSWORD;
    admin.role = 'admin';
    await admin.save();
  }

  const existingClinicalAccess = await ClinicalAccessRequest.findOne({
    patient: patient._id,
    medicalStaff: doctor._id,
  });
  if (!existingClinicalAccess) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await ClinicalAccessRequest.create({
      patient: patient._id,
      medicalStaff: doctor._id,
      reason: 'Synthetic demo patient-approved medication review',
      requestedUntil: expiresAt,
      expiresAt,
      status: 'approved',
      decidedBy: patient._id,
      decidedAt: new Date(),
    });
  }

  // Ensure uploads directory exists
  const uploadsDir = path.resolve(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const sampleFileName = 'medivault_demo_sample_report.pdf';
  const sampleDiskFile = path.join(uploadsDir, sampleFileName);
  const samplePdf = createDemoPdf();
  fs.writeFileSync(sampleDiskFile, samplePdf);

  // Create sample medical record for patient
  let sampleRecord = await MedicalRecord.findOne({ user: patient._id });
  if (!sampleRecord) {
    sampleRecord = new MedicalRecord({
      user: patient._id,
      title: 'Coronary Angiogram Diagnostic Report',
      category: 'Laboratory Report',
      description: 'Synthetic demo document for testing record viewing and local summaries.',
      recordDate: new Date('2026-10-02'),
      fileName: 'MediVault_Demo_Clinical_Record.pdf',
      storedFileName: sampleFileName,
      fileType: 'application/pdf',
      fileSize: samplePdf.length,
      fileUrl: '',
      metadata: {
        ocrExtractedText: '',
        identityCheck: {
          status: 'not_checked',
          message: 'Automated identity checks were not run on this synthetic demo record.',
          extractionMethod: 'unavailable',
        },
      },
    });
  }
  sampleRecord.description = 'Synthetic demo document for testing record viewing and local summaries.';
  sampleRecord.fileName = 'MediVault_Demo_Clinical_Record.pdf';
  sampleRecord.storedFileName = sampleFileName;
  sampleRecord.fileType = 'application/pdf';
  sampleRecord.fileSize = samplePdf.length;
  sampleRecord.fileUrl = `/api/records/${sampleRecord._id}/download`;
  sampleRecord.set('metadata.ocrExtractedText', '');
  sampleRecord.set('metadata.identityCheck', {
    status: 'not_checked',
    message: 'Automated identity checks were not run on this synthetic demo record.',
    extractionMethod: 'unavailable',
  });
  await sampleRecord.save();

  // Create sample insurance claim
  let sampleClaim = await InsuranceClaim.findOne({
    patient: patient._id,
    claimNumber: 'CLM-2026-781920',
  });
  if (!sampleClaim) {
    sampleClaim = await InsuranceClaim.create({
      patient: patient._id,
      claimNumber: 'CLM-2026-781920',
      policyNumber: 'STAR-HEALTH-POL-772910',
      insuranceCompany: 'Star Health & Allied Insurance',
      claimType: 'Hospitalization',
      claimAmount: 65000,
      approvedAmount: 62000,
      status: 'Approved',
      records: [sampleRecord._id],
      patientNotes: 'Emergency coronary angiography hospitalization reimbursement',
      hospitalName: 'Apollo Multispeciality Hospital',
      admissionDate: new Date('2026-10-02'),
      dischargeDate: new Date('2026-10-06'),
      assignedAgent: agent._id,
      agentRemarks: 'Approved subject to an INR 3,000 copay deductible.',
      reviewedAt: new Date(),
    });
  } else {
    sampleClaim.records = [sampleRecord._id];
    sampleClaim.agentRemarks = 'Approved subject to an INR 3,000 copay deductible.';
    await sampleClaim.save();
  }

  // Create sample medical note from doctor
  let sampleNote = await MedicalNote.findOne({ patient: patient._id });
  if (!sampleNote) {
    sampleNote = await MedicalNote.create({
      patient: patient._id,
      doctor: doctor._id,
      noteType: 'Prescription',
      title: 'Post-Angioplasty Medication & Lifestyle Plan',
      diagnosis: 'Coronary artery disease, post stent placement',
      prescriptionItems: [
        {
          medicineName: 'Aspirin 75mg',
          dosage: '1 tab',
          frequency: 'Once daily after breakfast',
          duration: '90 days',
          instructions: 'Do not discontinue without cardiologist consent',
        },
        {
          medicineName: 'Atorvastatin 40mg',
          dosage: '1 tab',
          frequency: 'Once daily at bedtime',
          duration: '90 days',
          instructions: 'Lipid lowering therapy',
        },
      ],
      clinicalNotes: 'Blood pressure controlled at 122/78 mmHg. Follow up in 4 weeks with lipid panel.',
      followUpDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      linkedRecords: [sampleRecord._id],
    });
  }

  console.log('✓ Demo Stakeholder Accounts Ready:');
  console.log('  Demo account passwords are set from DEMO_SEED_PASSWORD.');

  await mongoose.disconnect();
}

seedDemoData().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
