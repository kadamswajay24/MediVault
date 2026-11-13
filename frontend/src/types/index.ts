export type UserRole = 'patient' | 'medical_staff' | 'insurance_agent' | 'insurer_admin' | 'pharmacy_manager' | 'pharmacy_chain_admin' | 'lab_manager' | 'lab_chain_admin' | 'hospital_admin' | 'admin';
export type AuthPortal = 'patient' | 'clinical' | 'insurance' | 'insurance_admin' | 'pharmacy' | 'lab' | 'hospital' | 'admin';

export interface PharmacyOrganization {
  id: string;
  name: string;
  organizationType: 'hospital' | 'independent_pharmacy' | 'franchise';
  address: string;
  city: string;
  district?: string;
  state: string;
  postalCode: string;
  postOffice?: string;
  phone: string;
  openingHours: string;
  verification?: {
    status: 'pending' | 'needs_changes' | 'verified' | 'rejected';
    expiresAt: string;
    reviewNote?: string;
    documentFileName?: string;
    hasDocument?: boolean;
    submittedAt?: string;
    reviewedAt?: string;
  };
  manager?: { name: string; email: string };
  isActive?: boolean;
  mustChangePassword?: boolean;
  registrationNumber?: string;
  franchiseParent?: string;
}

export interface LabOrganization {
  id: string;
  name: string;
  organizationType: 'independent_lab' | 'hospital_lab' | 'franchise';
  hospitalName?: string;
  hospital?: string | { id: string; name: string } | null;
  registrationNumber?: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  postOffice?: string;
  manager?: { name: string; email: string };
  admins?: Array<{ name: string; email: string }>;
  branches?: LabOrganization[];
  franchiseParent?: string;
  isActive?: boolean;
  verification?: {
    status: 'pending' | 'needs_changes' | 'verified' | 'rejected';
    expiresAt: string;
    reviewNote?: string;
    documentFileName?: string;
    hasDocument?: boolean;
  };
}

export interface LabOrderSummary {
  id: string;
  organization: { name: string; city: string };
  tests: string[];
  clinicalNote: string;
  status: 'requested' | 'result_submitted' | 'cancelled';
  resultRecord?: { _id: string; title: string; fileUrl: string } | null;
  createdAt: string;
  submittedAt?: string | null;
  accessExpiresAt?: string | null;
  requestedBy?: string;
}

export interface LabStaffOrder {
  id: string;
  patientName: string;
  tests: string[];
  clinicalNote: string;
  status: 'requested' | 'result_submitted' | 'cancelled';
  resultTitle: string;
  createdAt: string;
}

export interface MedicalStaffDetails {
  professionalType?: 'physician' | 'nurse' | 'pharmacist' | 'lab_technologist';
  registrationAuthority?: string;
  registrationState?: string;
  licenseNumber?: string;
  pharmacyOrganizationId?: string;
  labOrganizationId?: string;
  hospitalId?: string;
  specialization?: string;
  hospitalAffiliation?: string;
}

export interface InsuranceDetails {
  companyName?: string;
  insuranceCompanyId?: string;
  agentId?: string;
  licenseNumber?: string;
}

export interface User {
  id: string;
  mediVaultId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword?: boolean;
  approvalStatus?: 'pending' | 'approved';
  phone?: string;
  pharmacyOrganization?: string | PharmacyOrganization | null;
  pharmacyMembershipStatus?: 'not_applicable' | 'pending' | 'approved' | 'rejected';
  labOrganization?: string | LabOrganization | null;
  labMembershipStatus?: 'not_applicable' | 'pending' | 'approved' | 'rejected';
  hospitalAdminOf?: string[];
  medicalStaffDetails?: MedicalStaffDetails;
  insuranceDetails?: InsuranceDetails;
  insuranceAgentHospitals?: Array<string | { id: string; name: string; city?: string; state?: string }>;
  credentialVerification?: {
    status: 'pending' | 'needs_changes' | 'verified' | 'rejected';
    expiresAt?: string | null;
    documentFileName?: string;
    documentFileType?: string;
    documentFileSize?: number;
    submittedAt?: string | null;
    reviewedAt?: string | null;
    reviewNote?: string;
  };
  createdAt?: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user: User;
  message?: string;
  pendingApproval?: boolean;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface HealthProfile {
  _id?: string;
  user?: string;
  fullName: string;
  dateOfBirth: string;
    address: string;
    city: string;
    district: string;
    state: string;
    postalCode: string;
    postOffice: string;
  gender: string;
  bloodGroup: string;
  allergies: string[];
  medicalConditions: string[];
  medications: string[];
  emergencyContact: EmergencyContact;
  createdAt?: string;
  updatedAt?: string;
}

export type RecordCategory =
  | 'Laboratory Report'
  | 'Prescription'
  | 'Vaccination'
  | 'Medical History'
  | 'Medication'
  | 'Other';

export const RECORD_CATEGORIES: RecordCategory[] = [
  'Laboratory Report',
  'Prescription',
  'Vaccination',
  'Medical History',
  'Medication',
  'Other',
];

export interface MedicalRecord {
  _id: string;
  user: string;
  title: string;
  category: RecordCategory;
  description: string;
  recordDate: string;
  fileName: string;
  storedFileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  createdAt: string;
  updatedAt?: string;
  metadata?: {
    ipfsHash?: string | null;
    blockchainTxHash?: string | null;
    isEncrypted?: boolean;
    ocrExtractedText?: string;
    identityCheck?: {
      status: 'matched' | 'needs_review' | 'unverified' | 'not_checked';
      message: string;
      checkedAt: string | null;
      confidence: number | null;
      extractionMethod: 'pdf_text' | 'ocr' | 'unavailable';
    };
  };
}

export interface MedicalRecordSummary {
  summary: string;
  keyFindings: string[];
  medicationMentions: string[];
  datesAndValues: string[];
  questionsForDoctor: string[];
}

export type ClaimType =
  | 'Hospitalization'
  | 'Outpatient'
  | 'Prescription Reimbursement'
  | 'Diagnostic Test'
  | 'Emergency Care'
  | 'Dental / Vision'
  | 'Other';

export type ClaimStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Approved'
  | 'Rejected'
  | 'More Information Needed';

export interface InsuranceClaim {
  history?: { status: ClaimStatus; note: string; at: string }[];
  _id: string;
  patient: User | string;
  claimNumber: string;
  policyNumber: string;
  insuranceCompany: string;
  insuranceCompanyId?: string;
  claimType: ClaimType;
  claimAmount: number;
  approvedAmount: number;
  status: ClaimStatus;
  records: MedicalRecord[];
  patientNotes?: string;
  hospitalName?: string;
  hospital?: string | { _id?: string; name?: string } | null;
  admissionDate?: string;
  dischargeDate?: string;
  assignedAgent?: User | null;
  agentRemarks?: string;
  reviewedAt?: string;
  supplementalPayments?: {
    _id: string;
    amount: number;
    reason: string;
    authorizedBy?: User | string;
    depositedAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface InsurancePolicyPlan {
  id: string;
  name: string;
  provider: string;
  description: string;
  coverageAmount: number;
  monthlyPremium: number;
  highlights: string[];
}

export interface ManagedInsurancePolicyPlan extends Omit<InsurancePolicyPlan, 'id'> {
  _id: string;
  planId: string;
  insuranceCompany: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface InsurancePlanAssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface InsurancePlanAssistantDraft {
  name: string | null;
  description: string | null;
  coverageAmount: number | null;
  monthlyPremium: number | null;
  highlights: string[];
}

export interface PolicyEnrollment {
  _id: string;
  planId: string;
  planName: string;
  provider: string;
  coverageAmount: number;
  monthlyPremium: number;
  policyNumber: string;
  status: 'demo_active';
  nextPremiumDue: string;
  payments: {
    _id: string;
    amount: number;
    paidAt: string;
    mode: 'demo';
  }[];
  createdAt: string;
}

export interface ProxyDelegation {
  _id: string;
  patient: User;
  proxyUser: User;
  relationship: string;
  accessLevel: 'read_only' | 'full';
  status: 'active' | 'revoked';
  notes?: string;
  grantedAt: string;
}

export interface PrescriptionItem {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface MedicalNote {
  _id: string;
  patient: User | string;
  doctor: User;
  noteType: 'Consultation' | 'Prescription' | 'Diagnosis' | 'Follow-up' | 'Lab Review';
  title: string;
  diagnosis?: string;
  prescriptionItems: PrescriptionItem[];
  clinicalNotes?: string;
  followUpDate?: string;
  linkedRecords?: MedicalRecord[];
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
  deletionRequest?: {
    status?: 'pending' | 'approved' | 'denied';
    reason?: string;
    requestedAt?: string;
    reviewedAt?: string;
  };
}

export interface PrescriptionShareInfo {
  id: string;
  prescriptionTitle: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  active: boolean;
  channel: 'code' | 'directory';
  pharmacyOrganization?: Pick<PharmacyOrganization, 'id' | 'name' | 'organizationType' | 'city'> | null;
}

export interface PrescriptionDispenseRecord {
  id: string;
  prescriptionTitle: string;
  pharmacistName: string;
  pharmacyName: string;
  items: {
    medicineName: string;
    status: 'dispensed' | 'partially_dispensed' | 'unavailable';
    quantityDispensed: string;
  }[];
  notes: string;
  createdAt: string;
}

export interface SharedPrescription {
  shareId: string;
  expiresAt: string;
  patientName: string;
  prescription: {
    id: string;
    title: string;
    createdAt: string;
    doctorName: string;
    items: PrescriptionItem[];
  };
}

export interface MedicalStaffClinicalOverview {
  success: boolean;
  patient: User;
  profile: HealthProfile | null;
  records: MedicalRecord[];
  notes: MedicalNote[];
  nursingEntries: {
    _id: string;
    entryType: 'observation' | 'nursing_note';
    note: string;
    vitals?: Record<string, number>;
    nurse?: { name: string } | string;
    createdAt: string;
  }[];
}

export interface AuditLog {
  _id: string;
  user: User | string;
  performedBy?: User | string | null;
  action:
    | 'LOGIN'
    | 'LOGOUT'
    | 'PROFILE_UPDATE'
    | 'RECORD_UPLOAD'
    | 'RECORD_VIEW'
    | 'MEDICATION_REMINDER_SET'
    | 'MEDICATION_REMINDER_REMOVED'
    | 'MEDICATION_ADHERENCE_LOGGED'
    | 'PRESCRIPTION_SHARED'
    | 'PRESCRIPTION_SHARE_ACCESSED'
    | 'PRESCRIPTION_SHARE_REVOKED'
    | 'PRESCRIPTION_DISPENSE_RECORDED'
    | 'PHARMACY_MEMBERSHIP_REVIEWED'
    | 'PHARMACY_ORGANIZATION_REVIEWED'
    | 'RECORD_DELETE'
    | 'PROXY_GRANTED'
    | 'PROXY_REVOKED'
    | 'PROXY_ACTION'
    | 'CLAIM_SUBMITTED'
    | 'CLAIM_REVIEWED'
    | 'CLINICAL_NOTE_ADDED'
    | 'NURSING_ENTRY_ADDED'
    | 'NURSING_OPERATIONS_UPDATED'
    | 'NURSING_TEAM_RESOURCE_ADDED'
    | 'NURSING_TEAM_RESOURCE_REMOVED'
    | 'CLINICAL_NOTE_UPDATED'
    | 'CLINICAL_NOTE_DELETION_REQUESTED'
    | 'CLINICAL_NOTE_DELETION_DECIDED'
    | 'ACCESS_REQUESTED'
    | 'ACCESS_REQUEST_DECIDED'
    | 'ACCESS_REVOKED'
    | 'APPOINTMENT_BOOKED'
    | 'APPOINTMENT_BOOKED_BY_STAFF'
    | 'APPOINTMENT_REVIEWED'
    | 'ADMIN_USER_UPDATED';
  details: string;
  resourceId?: string | null;
  resourceType?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface DashboardStats {
  totalRecords: number;
  categories: Record<string, number>;
  completenessScore: number;
  claimsCount?: number;
  proxiesCount?: number;
  prescriptionsCount?: number;
}

export interface DashboardResponse {
  success: boolean;
  attention?: {
    pendingAccessRequests: number;
    claimsNeedingInformation: number;
    upcomingAppointments: { _id: string; hospitalName: string; appointmentDate: string; time: string; status: 'confirmed' | 'pending' }[];
  };
  stats: DashboardStats;
  healthProfile: HealthProfile;
  recentRecords: MedicalRecord[];
  prescriptions: {
    _id: string;
    title: string;
    prescriptionItems: PrescriptionItem[];
    createdAt: string;
  }[];
  prescriptionRecords: MedicalRecord[];
  timeline: {
    _id: string;
    title: string;
    category: RecordCategory;
    recordDate: string;
    fileType: string;
    fileName: string;
  }[];
  isProxyContext?: boolean;
  targetUser?: User | null;
}

export interface AdminStatsResponse {
  success: boolean;
  stats: {
    totalUsers: number;
    usersByRole: Record<string, number>;
    totalRecords: number;
    totalClaims: number;
    claimsStatusMap: Record<string, number>;
    activeDelegations: number;
    totalAuditLogs: number;
  };
}
