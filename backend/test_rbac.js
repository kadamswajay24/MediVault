import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runRBACTests() {
  console.log('=== STARTING MEDIVAULT MULTI-STAKEHOLDER RBAC VERIFICATION TESTS ===\n');
  const BASE_URL = 'http://localhost:5000/api';
  const timestamp = Date.now();

  // Helper to register user
  const registerUser = async (data) => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success || !json.token) {
      throw new Error(`Failed to register ${data.name}: ${json.message}`);
    }
    return { token: json.token, user: json.user };
  };

  // 1. Register Stakeholders
  console.log('[TEST 1] Registering Multi-Stakeholder Accounts...');

  // A. Patient
  const patientData = {
    name: 'Rohan Verma (Patient)',
    email: `rohan_${timestamp}@medivault.io`,
    password: 'Password@2026',
    role: 'patient',
    phone: '+91 9876543210',
  };
  const patient = await registerUser(patientData);
  console.log('✓ Patient registered:', patient.user.name, `(${patient.user.role})`);

  // B. Caregiver / Proxy
  const caregiverData = {
    name: 'Priya Verma (Caregiver Daughter)',
    email: `priya_${timestamp}@medivault.io`,
    password: 'Password@2026',
    role: 'patient',
    phone: '+91 9876543211',
  };
  const caregiver = await registerUser(caregiverData);
  console.log('✓ Caregiver registered:', caregiver.user.name);

  // C. Medical Staff (Doctor)
  const doctorData = {
    name: 'Dr. Sameer Kulkarni',
    email: `doctor_${timestamp}@medivault.io`,
    password: 'Password@2026',
    role: 'medical_staff',
    phone: '+91 9876543212',
    medicalStaffDetails: {
      licenseNumber: 'MCI-MH-49201',
      specialization: 'Cardiologist',
      hospitalAffiliation: 'Apollo Multispeciality Hospital',
    },
  };
  const doctor = await registerUser(doctorData);
  console.log('✓ Medical Staff registered:', doctor.user.name, `(${doctor.user.role})`);

  // D. Insurance Agent
  const agentData = {
    name: 'Vikram Mehta (Insurance Adjuster)',
    email: `agent_${timestamp}@medivault.io`,
    password: 'Password@2026',
    role: 'insurance_agent',
    phone: '+91 9876543213',
    insuranceDetails: {
      companyName: 'Star Health & Allied Insurance',
      agentId: 'AGT-STAR-8841',
      licenseNumber: 'IRDAI-AG-99321',
    },
  };
  const agent = await registerUser(agentData);
  console.log('✓ Insurance Agent registered:', agent.user.name, `(${agent.user.role})`);

  // E. Administrator
  const adminData = {
    name: 'Chief Admin',
    email: `admin_${timestamp}@medivault.io`,
    password: 'Password@2026',
    role: 'admin',
    phone: '+91 9876543214',
  };
  const admin = await registerUser(adminData);
  console.log('✓ Administrator registered:', admin.user.name, `(${admin.user.role})\n`);

  // 2. Patient Uploads a Medical Document
  console.log('[TEST 2] Patient Uploading Medical Record...');
  const sampleFilePath = path.join(__dirname, 'test_report.pdf');
  fs.writeFileSync(sampleFilePath, '%PDF-1.4 Clinical Diagnostic Evaluation - MediVault RBAC');

  const fileBlob = new Blob([fs.readFileSync(sampleFilePath)], { type: 'application/pdf' });
  const uploadForm = new FormData();
  uploadForm.append('file', fileBlob, 'Cardiac_Angiogram_Report.pdf');
  uploadForm.append('title', 'Coronary Angiogram Diagnostic Report');
  uploadForm.append('category', 'Laboratory Report');
  uploadForm.append('description', 'Pre-procedure cardiac angiography evaluation');
  uploadForm.append('recordDate', '2026-10-02');

  const uploadRes = await fetch(`${BASE_URL}/records`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${patient.token}` },
    body: uploadForm,
  });
  const uploadData = await uploadRes.json();
  if (!uploadData.success || !uploadData.record) {
    throw new Error(`Record upload failed: ${uploadData.message}`);
  }
  const recordId = uploadData.record._id;
  console.log('✓ Patient Record Uploaded ID:', recordId, `(${uploadData.record.title})\n`);

  // 3. Dual-Context Caregiver / Proxy Delegation Flow
  console.log('[TEST 3] Testing Dual-Context Caregiver Proxy Delegation...');
  // Patient delegates proxy access to daughter
  const delegateRes = await fetch(`${BASE_URL}/proxy/delegate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${patient.token}`,
    },
    body: JSON.stringify({
      proxyEmail: caregiverData.email,
      relationship: 'Child',
      accessLevel: 'full',
      notes: 'Authorized daughter to manage medical documents and insurance claims',
    }),
  });
  const delegateData = await delegateRes.json();
  if (!delegateData.success) throw new Error(`Proxy delegation failed: ${delegateData.message}`);
  console.log('✓ Proxy delegation granted from Patient to Caregiver');

  // Caregiver queries their dependents
  const dependentsRes = await fetch(`${BASE_URL}/proxy/my-dependents`, {
    headers: { Authorization: `Bearer ${caregiver.token}` },
  });
  const dependentsData = await dependentsRes.json();
  console.log('Caregiver active dependents count:', dependentsData.count);
  if (dependentsData.count !== 1 || dependentsData.dependents[0].patient.email !== patientData.email) {
    throw new Error('Caregiver dependents query failed');
  }
  console.log('✓ Caregiver verified dependent link to:', dependentsData.dependents[0].patient.name);

  // Caregiver uploads a record on behalf of the patient using header
  const caregiverUploadForm = new FormData();
  caregiverUploadForm.append('file', fileBlob, 'Hospital_Discharge_Summary.pdf');
  caregiverUploadForm.append('title', 'Inpatient Hospital Discharge Summary');
  caregiverUploadForm.append('category', 'Medical History');
  caregiverUploadForm.append('description', 'Uploaded by daughter Priya on behalf of father Rohan');
  caregiverUploadForm.append('recordDate', '2026-10-06');

  const proxyUploadRes = await fetch(`${BASE_URL}/records`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${caregiver.token}`,
      'x-patient-context': patient.user.id,
    },
    body: caregiverUploadForm,
  });
  const proxyUploadData = await proxyUploadRes.json();
  if (!proxyUploadData.success) throw new Error(`Proxy upload failed: ${proxyUploadData.message}`);
  const dischargeSummaryId = proxyUploadData.record._id;
  console.log('✓ Caregiver successfully uploaded record on behalf of dependent:', proxyUploadData.record.title);

  // Caregiver fetches patient records via proxy context
  const proxyRecordsRes = await fetch(`${BASE_URL}/records`, {
    headers: {
      Authorization: `Bearer ${caregiver.token}`,
      'x-patient-context': patient.user.id,
    },
  });
  const proxyRecordsData = await proxyRecordsRes.json();
  console.log('Caregiver saw dependent records count:', proxyRecordsData.count);
  if (proxyRecordsData.count !== 2) throw new Error('Proxy record count mismatch');
  console.log('✓ Caregiver proxy read/write verification passed\n');

  // 4. Health Insurance Claims Flow
  console.log('[TEST 4] Testing Health Insurance Claims & Adjuster Verification...');
  // Patient submits an insurance claim attaching both documents
  const claimPayload = {
    policyNumber: 'STAR-HEALTH-POL-772910',
    insuranceCompany: 'Star Health & Allied Insurance',
    claimType: 'Hospitalization',
    claimAmount: 85000,
    records: [recordId, dischargeSummaryId],
    patientNotes: 'Emergency coronary angiography hospitalization reimbursement',
    hospitalName: 'Apollo Multispeciality Hospital',
    admissionDate: '2026-10-02',
    dischargeDate: '2026-10-06',
  };

  const claimSubmitRes = await fetch(`${BASE_URL}/claims`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${patient.token}`,
    },
    body: JSON.stringify(claimPayload),
  });
  const claimSubmitData = await claimSubmitRes.json();
  if (!claimSubmitData.success || !claimSubmitData.claim) {
    throw new Error(`Claim submission failed: ${claimSubmitData.message}`);
  }
  const claimId = claimSubmitData.claim._id;
  console.log('✓ Claim Submitted:', claimSubmitData.claim.claimNumber, `Amount: $${claimSubmitData.claim.claimAmount}`);

  // Insurance Agent fetches claims for Star Health
  const agentClaimsRes = await fetch(`${BASE_URL}/claims`, {
    headers: { Authorization: `Bearer ${agent.token}` },
  });
  const agentClaimsData = await agentClaimsRes.json();
  console.log('Insurance Agent incoming claims queue count:', agentClaimsData.count);
  if (agentClaimsData.count < 1) throw new Error('Agent failed to see submitted claim');
  console.log('✓ Insurance Agent successfully accessed incoming claims queue');

  // Insurance Agent evaluates and approves claim
  const reviewRes = await fetch(`${BASE_URL}/claims/${claimId}/review`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${agent.token}`,
    },
    body: JSON.stringify({
      status: 'Approved',
      approvedAmount: 82000,
      agentRemarks: 'Discharge summary and angiography verified. Approved subject to $3000 copay deductible.',
    }),
  });
  const reviewData = await reviewRes.json();
  if (!reviewData.success || reviewData.claim.status !== 'Approved') {
    throw new Error('Claim evaluation failed');
  }
  console.log('✓ Insurance Agent approved claim. Approved Amount: $', reviewData.claim.approvedAmount);

  // Insurance Agent downloads attached claim document (privacy-preserving)
  const agentDlRes = await fetch(`${BASE_URL}/claims/${claimId}/records/${recordId}/download`, {
    headers: { Authorization: `Bearer ${agent.token}` },
  });
  if (agentDlRes.status !== 200) throw new Error('Agent document download failed');
  console.log('✓ Insurance Agent successfully downloaded verified claim attachment');

  // Verify Patient sees updated status
  const patientClaimRes = await fetch(`${BASE_URL}/claims/${claimId}`, {
    headers: { Authorization: `Bearer ${patient.token}` },
  });
  const patientClaimData = await patientClaimRes.json();
  if (patientClaimData.claim.status !== 'Approved') throw new Error('Patient status mismatch');
  console.log('✓ Patient verified claim status is now:', patientClaimData.claim.status, '\n');

  // 5. Medical Staff / Doctor Consultation Flow
  console.log('[TEST 5] Testing Medical Staff Clinical Consultation...');
  // Doctor looks up patient clinical overview
  const doctorOverviewRes = await fetch(
    `${BASE_URL}/medical-staff/patients/${patient.user.id}/overview`,
    {
      headers: { Authorization: `Bearer ${doctor.token}` },
    }
  );
  const doctorOverviewData = await doctorOverviewRes.json();
  if (!doctorOverviewData.success) throw new Error('Doctor overview failed');
  console.log('✓ Doctor accessed patient overview for:', doctorOverviewData.patient.name);
  console.log('  Records available to doctor:', doctorOverviewData.records.length);

  // Doctor issues a clinical note & digital prescription
  const notePayload = {
    patientId: patient.user.id,
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
    linkedRecords: [recordId],
  };

  const addNoteRes = await fetch(`${BASE_URL}/medical-staff/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${doctor.token}`,
    },
    body: JSON.stringify(notePayload),
  });
  const addNoteData = await addNoteRes.json();
  if (!addNoteData.success || !addNoteData.note) throw new Error('Failed to create clinical note');
  console.log('✓ Doctor issued clinical prescription:', addNoteData.note.title);

  // Patient views notes
  const patientNotesRes = await fetch(
    `${BASE_URL}/medical-staff/patients/${patient.user.id}/notes`,
    {
      headers: { Authorization: `Bearer ${patient.token}` },
    }
  );
  const patientNotesData = await patientNotesRes.json();
  if (patientNotesData.count < 1) throw new Error('Patient failed to view doctor note');
  console.log('✓ Patient retrieved clinical note authored by:', patientNotesData.notes[0].doctor.name, '\n');

  // 6. Administrator Governance Flow
  console.log('[TEST 6] Testing Admin User Governance & Platform Analytics...');
  // Non-admin tries to access admin stats -> should return 403 Forbidden
  const illegalAdminRes = await fetch(`${BASE_URL}/admin/stats`, {
    headers: { Authorization: `Bearer ${patient.token}` },
  });
  if (illegalAdminRes.status !== 403) throw new Error('Admin endpoint security leak! Expected 403 Forbidden');
  console.log('✓ Role authorization security verified: Patient blocked from Admin stats (403 Forbidden)');

  // Admin views platform stats
  const adminStatsRes = await fetch(`${BASE_URL}/admin/stats`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  const adminStatsData = await adminStatsRes.json();
  console.log('Admin Platform Stats:', adminStatsData.stats.usersByRole);
  console.log('Total Records in System:', adminStatsData.stats.totalRecords);
  console.log('Total Claims Processed:', adminStatsData.stats.totalClaims);
  console.log('Active Caregiver Delegations:', adminStatsData.stats.activeDelegations);
  if (adminStatsData.stats.totalClaims < 1) throw new Error('Admin stats mismatch');
  console.log('✓ Admin platform metrics verified');

  // Admin lists all users
  const adminUsersRes = await fetch(`${BASE_URL}/admin/users`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  const adminUsersData = await adminUsersRes.json();
  console.log('Total registered users seen by Admin:', adminUsersData.count);
  if (adminUsersData.count < 5) throw new Error('Admin user list incomplete');
  console.log('✓ Admin user management directory verified');

  // Admin views global audit logs
  const adminAuditRes = await fetch(`${BASE_URL}/admin/audit-logs`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  const adminAuditData = await adminAuditRes.json();
  console.log('Global Audit Logs count:', adminAuditData.count);
  console.log(
    'Recent actions across platform:',
    adminAuditData.logs.map((l) => l.action).slice(0, 5)
  );
  if (adminAuditData.count < 5) throw new Error('Global audit trail missing');
  console.log('✓ Global compliance and audit trail verified\n');

  // Clean up test file
  if (fs.existsSync(sampleFilePath)) fs.unlinkSync(sampleFilePath);

  console.log('🎉 ALL MULTI-STAKEHOLDER RBAC TESTS PASSED WITH 100% SUCCESS! 🎉\n');
}

runRBACTests().catch((err) => {
  console.error('❌ RBAC Test failed:', err);
  process.exit(1);
});
