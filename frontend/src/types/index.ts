export type UserRole = 'patient' | 'medical_staff' | 'insurance_agent' | 'admin';

export interface MedicalStaffDetails {
  licenseNumber?: string;
  specialization?: string;
  hospitalAffiliation?: string;
}

export interface InsuranceDetails {
  companyName?: string;
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
  approvalStatus?: 'pending' | 'approved';
  phone?: string;
  medicalStaffDetails?: MedicalStaffDetails;
  insuranceDetails?: InsuranceDetails;
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
  };
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
  _id: string;
  patient: User | string;
  claimNumber: string;
  policyNumber: string;
  insuranceCompany: string;
  claimType: ClaimType;
  claimAmount: number;
  approvedAmount: number;
  status: ClaimStatus;
  records: MedicalRecord[];
  patientNotes?: string;
  hospitalName?: string;
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
    | 'RECORD_DELETE'
    | 'PROXY_GRANTED'
    | 'PROXY_REVOKED'
    | 'PROXY_ACTION'
    | 'CLAIM_SUBMITTED'
    | 'CLAIM_REVIEWED'
    | 'CLINICAL_NOTE_ADDED'
    | 'ACCESS_REQUESTED'
    | 'ACCESS_REQUEST_DECIDED'
    | 'ACCESS_REVOKED'
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
}

export interface DashboardResponse {
  success: boolean;
  stats: DashboardStats;
  healthProfile: HealthProfile;
  recentRecords: MedicalRecord[];
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
