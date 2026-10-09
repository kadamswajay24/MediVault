import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('=== STARTING MEDIVAULT MVP VERIFICATION TESTS ===\n');
  const BASE_URL = 'http://localhost:5000/api';

  // 1. Health check
  console.log('[TEST 1] Checking API Health...');
  const healthRes = await fetch(`${BASE_URL}/health`);
  const healthData = await healthRes.json();
  console.log('Health response:', healthData);
  if (healthData.status !== 'online') throw new Error('Health check failed');
  console.log('✓ Health check passed\n');

  // 2. Public registration restrictions and staff approval
  console.log('[TEST 2] Verifying staff approval and administrator registration restrictions...');
  const roleRegistrationRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Public Admin Attempt',
      email: `admin_${Date.now()}@medivault.io`,
      password: 'Password@2026',
      role: 'admin',
    }),
  });
  if (roleRegistrationRes.status !== 400) {
    throw new Error('Public administrator registration should be rejected');
  }

  const pendingStaffEmail = `staff_${Date.now()}@medivault.io`;
  const pendingStaffRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Pending Medical Staff',
      email: pendingStaffEmail,
      password: 'Password@2026',
      role: 'medical_staff',
      phone: '+91 9876543214',
    }),
  });
  const pendingStaffData = await pendingStaffRes.json();
  if (
    pendingStaffRes.status !== 202 ||
    !pendingStaffData.pendingApproval ||
    pendingStaffData.token
  ) {
    throw new Error('Medical staff registration should wait for administrator approval');
  }

  const pendingLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: pendingStaffEmail, password: 'Password@2026' }),
  });
  if (pendingLoginRes.status !== 403) {
    throw new Error('Pending staff must not be able to sign in');
  }
  console.log('✓ Staff approval gate and administrator registration restriction passed\n');

  // 3. User 1 Registration
  const missingPhoneRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Missing Phone Patient',
      email: `missing_phone_${Date.now()}@medivault.io`,
      password: 'Password@2026',
    }),
  });
  if (missingPhoneRes.status !== 400) {
    throw new Error('Registration without an Indian mobile number should be rejected');
  }

  const nonIndianPhoneRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Invalid Phone Patient',
      email: `invalid_phone_${Date.now()}@medivault.io`,
      password: 'Password@2026',
      phone: '9876543210',
    }),
  });
  if (nonIndianPhoneRes.status !== 400) {
    throw new Error('Registration without the +91 country code should be rejected');
  }

  const testUser = {
    name: 'Ashish Patient',
    email: `patient_${Date.now()}@medivault.io`,
    password: 'Password@2026',
    phone: '+91 9876543215',
  };
  console.log('[TEST 2] Registering User 1:', testUser.email);
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser),
  });
  const regData = await regRes.json();
  console.log('Registration status:', regRes.status, 'success:', regData.success);
  if (
    !regData.success ||
    !regData.token ||
    regData.user?.role !== 'patient' ||
    regData.user?.approvalStatus !== 'approved' ||
    regData.user?.phone !== '+919876543215'
  ) {
    throw new Error('Patient registration failed, was not immediately approved, or did not normalize the Indian mobile number');
  }
  const user1Token = regData.token;
  console.log('✓ Registration & token generation passed\n');

  // 3. User 1 Login
  console.log('[TEST 3] Logging in User 1...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUser.email, password: testUser.password }),
  });
  const loginData = await loginRes.json();
  if (!loginData.success || !loginData.token) throw new Error('Login failed');
  console.log('✓ Login passed\n');

  // 4. Health Profile: Get & Update
  console.log('[TEST 4] Updating Health Profile...');
  const profilePayload = {
    fullName: 'Ashish Patient',
    dateOfBirth: '1998-05-14',
    gender: 'Male',
    bloodGroup: 'O+',
    allergies: ['Penicillin', 'Peanuts'],
    medicalConditions: ['Hypertension'],
    medications: ['Amlodipine 5mg'],
    emergencyContact: {
      name: 'Ramesh Sharma',
      relationship: 'Brother',
      phone: '+91 9876543210',
    },
  };

  const updateProfileRes = await fetch(`${BASE_URL}/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1Token}`,
    },
    body: JSON.stringify(profilePayload),
  });
  const updateProfileData = await updateProfileRes.json();
  console.log('Update profile status:', updateProfileRes.status, 'success:', updateProfileData.success);
  if (!updateProfileData.success || updateProfileData.profile.bloodGroup !== 'O+') {
    throw new Error('Profile update failed');
  }

  const getProfileRes = await fetch(`${BASE_URL}/profile`, {
    headers: { Authorization: `Bearer ${user1Token}` },
  });
  const getProfileData = await getProfileRes.json();
  console.log('Fetched profile blood group:', getProfileData.profile.bloodGroup);
  console.log('Allergies:', getProfileData.profile.allergies);
  console.log('✓ Health Profile management passed\n');

  // 5. Medical Record Upload (Multipart)
  console.log('[TEST 5] Uploading Medical Record...');
  // Create sample test file
  const sampleFilePath = path.join(__dirname, 'test_sample.pdf');
  fs.writeFileSync(sampleFilePath, '%PDF-1.4 Sample Medical Report Content for MediVault');

  const fileBlob = new Blob([fs.readFileSync(sampleFilePath)], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('file', fileBlob, 'Blood_Test_Report_2026.pdf');
  formData.append('title', 'Complete Blood Count (CBC) Panel');
  formData.append('category', 'Laboratory Report');
  formData.append('description', 'Routine annual hemogram and lipid profile');
  formData.append('recordDate', '2026-10-01');

  const uploadRes = await fetch(`${BASE_URL}/records`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user1Token}` },
    body: formData,
  });
  const uploadData = await uploadRes.json();
  console.log('Upload status:', uploadRes.status, 'success:', uploadData.success);
  if (!uploadData.success || !uploadData.record) throw new Error('Upload failed');
  const recordId = uploadData.record._id;
  console.log('Uploaded Record ID:', recordId);
  console.log('✓ File Upload via Multer passed\n');

  // Upload a second record for testing filtering
  const formData2 = new FormData();
  formData2.append('file', fileBlob, 'Cardio_Prescription.pdf');
  formData2.append('title', 'Cardiology Clinic Prescription');
  formData2.append('category', 'Prescription');
  formData2.append('description', 'Blood pressure management advice');
  formData2.append('recordDate', '2026-10-05');

  await fetch(`${BASE_URL}/records`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user1Token}` },
    body: formData2,
  });

  // 6. Medical Records Querying & Filtering
  console.log('[TEST 6] Querying records, search and category filtering...');
  const allRecordsRes = await fetch(`${BASE_URL}/records`, {
    headers: { Authorization: `Bearer ${user1Token}` },
  });
  const allRecordsData = await allRecordsRes.json();
  console.log('Total records count:', allRecordsData.count);
  if (allRecordsData.count !== 2) throw new Error('Record count mismatch');

  // Filter category
  const filterRes = await fetch(`${BASE_URL}/records?category=Laboratory+Report`, {
    headers: { Authorization: `Bearer ${user1Token}` },
  });
  const filterData = await filterRes.json();
  console.log('Filtered (Laboratory Report) count:', filterData.count);
  if (filterData.count !== 1) throw new Error('Category filter failed');

  // Search
  const searchRes = await fetch(`${BASE_URL}/records?search=Prescription`, {
    headers: { Authorization: `Bearer ${user1Token}` },
  });
  const searchData = await searchRes.json();
  console.log('Search ("Prescription") count:', searchData.count);
  if (searchData.count !== 1) throw new Error('Search failed');
  console.log('✓ Records query, category filter and search passed\n');

  // 7. View & Download record
  console.log('[TEST 7] Viewing and downloading record...');
  const viewRes = await fetch(`${BASE_URL}/records/${recordId}`, {
    headers: { Authorization: `Bearer ${user1Token}` },
  });
  const viewData = await viewRes.json();
  if (!viewData.success || viewData.record.title !== 'Complete Blood Count (CBC) Panel') {
    throw new Error('View record failed');
  }

  const dlRes = await fetch(`${BASE_URL}/records/${recordId}/download`, {
    headers: { Authorization: `Bearer ${user1Token}` },
  });
  console.log('Download HTTP status:', dlRes.status);
  if (dlRes.status !== 200) throw new Error('Download failed');
  console.log('✓ View and download passed\n');

  // 8. Dashboard stats & timeline
  console.log('[TEST 8] Checking Dashboard stats & timeline...');
  const dashRes = await fetch(`${BASE_URL}/dashboard/stats`, {
    headers: { Authorization: `Bearer ${user1Token}` },
  });
  const dashData = await dashRes.json();
  console.log('Dashboard totalRecords:', dashData.stats.totalRecords);
  console.log('Dashboard completenessScore:', dashData.stats.completenessScore);
  console.log('Dashboard timeline items:', dashData.timeline.length);
  if (dashData.stats.totalRecords !== 2 || dashData.timeline.length !== 2) {
    throw new Error('Dashboard stats verification failed');
  }
  console.log('✓ Dashboard statistics & timeline passed\n');

  // 9. User-level authorization security check (User 2 cannot access User 1's records)
  console.log('[TEST 9] Enforcing User Isolation & Authorization...');
  const user2 = {
    name: 'Unrelated User',
    email: `intruder_${Date.now()}@medivault.io`,
    password: 'Password@2026',
  };
  const reg2Res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user2),
  });
  const reg2Data = await reg2Res.json();
  const user2Token = reg2Data.token;

  // User 2 lists records -> should see 0 records
  const user2RecordsRes = await fetch(`${BASE_URL}/records`, {
    headers: { Authorization: `Bearer ${user2Token}` },
  });
  const user2RecordsData = await user2RecordsRes.json();
  console.log('User 2 record count (should be 0):', user2RecordsData.count);
  if (user2RecordsData.count !== 0) throw new Error('User 2 saw User 1 records!');

  // User 2 tries to GET User 1 record by ID -> should return 403 Forbidden
  const illegalViewRes = await fetch(`${BASE_URL}/records/${recordId}`, {
    headers: { Authorization: `Bearer ${user2Token}` },
  });
  console.log('User 2 viewing User 1 record status code:', illegalViewRes.status);
  if (illegalViewRes.status !== 403) throw new Error('Security isolation failed! Expected 403 Forbidden');

  // User 2 tries to DELETE User 1 record by ID -> should return 403 Forbidden
  const illegalDeleteRes = await fetch(`${BASE_URL}/records/${recordId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${user2Token}` },
  });
  console.log('User 2 deleting User 1 record status code:', illegalDeleteRes.status);
  if (illegalDeleteRes.status !== 403) throw new Error('Security isolation failed on delete!');
  console.log('✓ User Isolation & Authorization verified successfully (403 Forbidden returned)\n');

  // 10. Audit Logs
  console.log('[TEST 10] Checking Audit Trail...');
  const auditRes = await fetch(`${BASE_URL}/audit-logs`, {
    headers: { Authorization: `Bearer ${user1Token}` },
  });
  const auditData = await auditRes.json();
  console.log('User 1 audit entries count:', auditData.count);
  console.log(
    'Audit actions logged:',
    auditData.logs.map((l) => l.action).slice(0, 5)
  );
  if (auditData.count < 4) throw new Error('Audit trail missing entries');
  console.log('✓ Audit logs verified\n');

  // Clean up test file
  if (fs.existsSync(sampleFilePath)) fs.unlinkSync(sampleFilePath);

  console.log('🎉 ALL 10 MEDIVAULT MVP BACKEND VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
