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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PASSWORD = process.env.DEMO_SEED_PASSWORD;

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

  // Ensure uploads directory exists
  const uploadsDir = path.resolve(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Create sample document
  const sampleDiskFile = path.join(uploadsDir, 'sample_angiogram_report.pdf');
  if (!fs.existsSync(sampleDiskFile)) {
    fs.writeFileSync(sampleDiskFile, '%PDF-1.4 Clinical Diagnostic Evaluation - MediVault');
  }

  // Create sample medical record for patient
  let sampleRecord = await MedicalRecord.findOne({ user: patient._id });
  if (!sampleRecord) {
    sampleRecord = await MedicalRecord.create({
      user: patient._id,
      title: 'Coronary Angiogram Diagnostic Report',
      category: 'Laboratory Report',
      description: 'Pre-procedure cardiac angiography evaluation at Apollo Hospital',
      recordDate: new Date('2026-10-02'),
      fileName: 'Coronary_Angiogram_Report.pdf',
      storedFileName: 'sample_angiogram_report.pdf',
      fileType: 'application/pdf',
      fileSize: 204850,
      fileUrl: '/uploads/sample_angiogram_report.pdf',
    });
  }

  // Create sample insurance claim
  let sampleClaim = await InsuranceClaim.findOne({ patient: patient._id });
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
      agentRemarks: 'Discharge summary and angiography verified. Approved minus $3000 copay deductible.',
      reviewedAt: new Date(),
    });
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
