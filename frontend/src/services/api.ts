import axios from 'axios';
import type {
  AuthResponse,
  HealthProfile,
  MedicalRecord,
  DashboardResponse,
  AuditLog,
  InsuranceClaim,
  ProxyDelegation,
  MedicalNote,
  MedicalStaffClinicalOverview,
  AdminStatsResponse,
  User,
  UserRole,
  MedicalStaffDetails,
  InsuranceDetails,
  InsurancePolicyPlan,
  ManagedInsurancePolicyPlan,
  InsurancePlanAssistantMessage,
  InsurancePlanAssistantDraft,
  PolicyEnrollment,
  MedicalRecordSummary,
  PrescriptionDispenseRecord,
  PrescriptionShareInfo,
  SharedPrescription,
  PharmacyOrganization,
  LabOrganization,
  LabOrderSummary,
  LabStaffOrder,
} from '../types';
import type { CatalogSearchMedicine } from '../constants/specialtyMedicineCatalog';
import {
  AUTH_SESSION_KEYS,
  clearTabAuthSession,
  loginPathForPortal,
  type AuthPortal,
} from '../utils/authSession';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export type PostalOffice = { name: string; city: string; district: string; state: string; pincode: string };
export const locationsAPI = {
  lookupPincode: async (pincode: string): Promise<{ success: boolean; pincode: string; offices: PostalOffice[]; cached: boolean }> => {
    const res = await api.get(`/locations/pincode/${encodeURIComponent(pincode)}`);
    return res.data;
  },
};

// Request interceptor to attach JWT token and active dependent context
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem(AUTH_SESSION_KEYS.token);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const activeDependent = sessionStorage.getItem(AUTH_SESSION_KEYS.activeDependent);
    if (activeDependent) {
      try {
        const dep = JSON.parse(activeDependent);
        if (dep && dep.mediVaultId) {
          config.headers['x-patient-context'] = dep.mediVaultId;
        }
      } catch (error) {
        console.warn('[API] Clearing invalid active patient context:', error);
        sessionStorage.removeItem(AUTH_SESSION_KEYS.activeDependent);
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = String(error.config?.url || '');
      const isPublicAuthAttempt = /\/auth\/(login|register)(\/|$)/.test(requestUrl);
      if (isPublicAuthAttempt) return Promise.reject(error);

      const loginPath = loginPathForPortal(sessionStorage.getItem(AUTH_SESSION_KEYS.portal));
      clearTabAuthSession();
      if (
        !window.location.pathname.includes('/login') &&
        !window.location.pathname.includes('/register')
      ) {
        window.location.href = loginPath;
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: async (credentials: { email: string; password: string }, portal: AuthPortal): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>(`/auth/login/${portal}`, credentials);
    return res.data;
  },

  register: async (userData: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    phone?: string;
    medicalStaffDetails?: MedicalStaffDetails;
    insuranceDetails?: InsuranceDetails;
    credentialDocument?: File;
    credentialExpiresAt?: string;
    patientAddress?: { address: string; city: string; district: string; state: string; postalCode: string; postOffice: string };
    pharmacyOrganizationDetails?: {
      name: string;
      organizationType: 'hospital' | 'independent_pharmacy' | 'franchise';
      hospitalId?: string;
      registrationNumber: string;
      address: string;
      city: string;
      district?: string;
      state: string;
      postalCode: string;
      postOffice?: string;
      openingHours: string;
    };
    labOrganizationDetails?: {
      name: string;
      organizationType: 'independent_lab' | 'hospital_lab' | 'franchise';
      hospitalId?: string;
      hospitalName?: string;
      registrationNumber: string;
      address: string;
      city: string;
      district?: string;
      state: string;
      postalCode: string;
      postOffice?: string;
    };
  }): Promise<AuthResponse> => {
    let payload: FormData | typeof userData = userData;
    if (userData.credentialDocument) {
      const formData = new FormData();
      formData.append('name', userData.name);
      formData.append('email', userData.email);
      formData.append('password', userData.password);
      formData.append('role', userData.role || 'patient');
      formData.append('phone', userData.phone || '');
      if (userData.medicalStaffDetails) formData.append('medicalStaffDetails', JSON.stringify(userData.medicalStaffDetails));
      if (userData.insuranceDetails) formData.append('insuranceDetails', JSON.stringify(userData.insuranceDetails));
      if (userData.pharmacyOrganizationDetails) formData.append('pharmacyOrganizationDetails', JSON.stringify(userData.pharmacyOrganizationDetails));
      if (userData.labOrganizationDetails) formData.append('labOrganizationDetails', JSON.stringify(userData.labOrganizationDetails));
      if (userData.patientAddress) formData.append('patientAddress', JSON.stringify(userData.patientAddress));
      formData.append('credentialExpiresAt', userData.credentialExpiresAt || '');
      formData.append('credentialDocument', userData.credentialDocument);
      payload = formData;
    }
    const res = await api.post<AuthResponse>('/auth/register', payload, userData.credentialDocument
      ? { headers: { 'Content-Type': 'multipart/form-data' } }
      : undefined);
    return res.data;
  },

  resubmitCredential: async (data: { licenseNumber: string; credentialExpiresAt: string; credentialDocument: File }) => {
    const formData = new FormData();
    formData.append('licenseNumber', data.licenseNumber);
    formData.append('credentialExpiresAt', data.credentialExpiresAt);
    formData.append('credentialDocument', data.credentialDocument);
    const res = await api.post('/auth/credentials/resubmit', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data as { success: boolean; message: string; user: User };
  },

  getMe: async (): Promise<{ success: boolean; user: User }> => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  changePassword: async (data: { currentPassword: string; newPassword: string }) => (await api.post('/auth/password/change', data)).data as { success: boolean; message: string; user: User },
};

export const profileAPI = {
  getProfile: async (): Promise<{ success: boolean; profile: HealthProfile }> => {
    const res = await api.get('/profile');
    return res.data;
  },

  updateProfile: async (
    profileData: Partial<HealthProfile>
  ): Promise<{ success: boolean; message: string; profile: HealthProfile }> => {
    const res = await api.put('/profile', profileData);
    return res.data;
  },
};

export const recordAPI = {
  getRecords: async (params?: {
    category?: string;
    search?: string;
    sort?: string;
  }, signal?: AbortSignal): Promise<{ success: boolean; count: number; records: MedicalRecord[] }> => {
    const res = await api.get('/records', { params, signal });
    return res.data;
  },

  getRecordById: async (id: string): Promise<{ success: boolean; record: MedicalRecord }> => {
    const res = await api.get(`/records/${id}`);
    return res.data;
  },

  checkRecordAccess: async (id: string): Promise<void> => {
    await api.get(`/records/${id}/access`);
  },

  getRecordSummary: async (
    id: string
  ): Promise<{
    success: boolean;
    summary: MedicalRecordSummary;
    model: string;
    stored: false;
  }> => {
    const res = await api.get(`/records/${id}/summary`);
    return res.data;
  },

  getRecordFile: async (id: string): Promise<Blob> => {
    const res = await api.get(`/records/${id}/download`, { responseType: 'blob' });
    return res.data;
  },

  uploadRecord: async (
    formData: FormData,
    onProgress?: (percent: number) => void
  ): Promise<{ success: boolean; message: string; record: MedicalRecord }> => {
    const res = await api.post('/records', formData, {
      onUploadProgress: (event) => {
        if (event.total) onProgress?.(Math.round(event.loaded * 100 / event.total));
      },
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  deleteRecord: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/records/${id}`);
    return res.data;
  },

};

export const dashboardAPI = {
  getStats: async (): Promise<DashboardResponse> => {
    const res = await api.get('/dashboard/stats');
    return res.data;
  },
};

export const medicationReminderAPI = {
  getAll: async (): Promise<{ success: boolean; reminders: MedicationReminder[] }> => {
    const res = await api.get('/medication-reminders');
    return res.data;
  },
  create: async (data: {
    medicationName: string;
    time: string;
    confirmCurrentUse: boolean;
  }): Promise<{ success: boolean; reminder: MedicationReminder }> => {
    const res = await api.post('/medication-reminders', data);
    return res.data;
  },
  remove: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/medication-reminders/${id}`);
    return res.data;
  },
  getTodayAdherence: async (): Promise<{
    success: boolean;
    date: string;
    adherenceRate: number;
    totalScheduled: number;
    takenCount: number;
    items: MedicationAdherenceItem[];
  }> => {
    const res = await api.get('/medication-reminders/adherence/today');
    return res.data;
  },
  logAdherence: async (data: {
    reminderId: string;
    status: 'taken' | 'skipped';
    date?: string;
  }): Promise<{ success: boolean; log: any }> => {
    const res = await api.post('/medication-reminders/adherence/log', data);
    return res.data;
  },
  resetAdherence: async (reminderId: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/medication-reminders/adherence/log/${reminderId}`);
    return res.data;
  },
};

export interface MedicationReminder {
  _id: string;
  medicationName: string;
  time: string;
  timezone: 'Asia/Kolkata';
  createdAt: string;
}

export interface MedicationAdherenceItem {
  reminderId: string;
  medicationName: string;
  time: string;
  status: 'pending' | 'taken' | 'skipped';
  takenAt: string | null;
  logId: string | null;
}

export const auditAPI = {
  getLogs: async (params?: {
    action?: string;
    limit?: number;
    page?: number;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ success: boolean; count: number; total: number; page: number; pages: number; logs: AuditLog[] }> => {
    const res = await api.get('/audit-logs', { params });
    return res.data;
  },
};

export const proxyAPI = {
  delegateAccess: async (data: {
    proxyMediVaultId: string;
    relationship: string;
    accessLevel?: 'read_only' | 'full';
    notes?: string;
  }): Promise<{ success: boolean; message: string; delegation: any }> => {
    const res = await api.post('/proxy/delegate', data);
    return res.data;
  },

  getMyProxies: async (): Promise<{ success: boolean; count: number; proxies: ProxyDelegation[] }> => {
    const res = await api.get('/proxy/my-proxies');
    return res.data;
  },

  getMyDependents: async (): Promise<{
    success: boolean;
    count: number;
    dependents: {
      delegationId: string;
      patient: User;
      relationship: string;
      accessLevel: 'read_only' | 'full';
      grantedAt: string;
      profile: HealthProfile | null;
    }[];
  }> => {
    const res = await api.get('/proxy/my-dependents');
    return res.data;
  },

  revokeProxy: async (delegationId: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/proxy/${delegationId}`);
    return res.data;
  },
};

export interface ClinicalAccessRequest {
  _id: string;
  patient: User;
  medicalStaff: User;
  reason: string;
  requestedUntil: string;
  expiresAt?: string;
  status: 'pending' | 'approved' | 'denied' | 'revoked';
  decidedBy?: User;
  decidedAt?: string;
  revokedAt?: string;
  isExpired?: boolean;
  createdAt: string;
}

export interface AppointmentScheduleDay {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: 15 | 30 | 45 | 60;
}

export interface AppointmentEntry {
  _id: string;
  patient?: User | string;
  doctor: User | string;
  hospitalName: string;
  appointmentDate: string;
  time: string;
  durationMinutes: number;
  startsAt?: string;
  endsAt?: string;
  status: 'confirmed' | 'pending' | 'declined' | 'cancelled';
  assignedNurse?: User | string | null;
  nursingAccessConsent?: boolean;
  nursingAccessOpensAt?: string;
  nursingAccessClosesAt?: string;
  nursingAccessRevokedAt?: string | null;
  createdAt: string;
}

export const appointmentsAPI = {
  cancel: async (id: string): Promise<{ success: boolean; message: string }> => (await api.put(`/appointments/${id}/cancel`)).data,
  getHospitals: async (): Promise<{
    success: boolean;
    hospitals: {
      name: string;
      doctors: {
        id: string;
        name: string;
        professionalType: 'physician';
        specialization: string;
        hospitalName: string;
        schedule: AppointmentScheduleDay[];
      }[];
      nurses: { id: string; name: string; professionalType: 'nurse'; specialization: string; hospitalName: string }[];
    }[];
  }> => {
    const res = await api.get('/appointments/hospitals');
    return res.data;
  },

  getAvailability: async (doctorId: string, date: string): Promise<{
    success: boolean;
    schedule: AppointmentScheduleDay | null;
    slots: { time: string; status: 'available' | 'booked' }[];
    alternatives: string[];
  }> => {
    const res = await api.get('/appointments/availability', { params: { doctorId, date } });
    return res.data;
  },

  getMine: async (): Promise<{ success: boolean; appointments: AppointmentEntry[] }> => {
    const res = await api.get('/appointments/mine');
    return res.data;
  },

  book: async (data: {
    doctorId: string;
    appointmentDate: string;
    time: string;
    timeZoneOffsetMinutes: number;
    nurseId?: string;
    nursingAccessConsent?: boolean;
  }): Promise<{ success: boolean; message: string; appointment: AppointmentEntry }> => {
    const res = await api.post('/appointments', data);
    return res.data;
  },

  lookupPatientByMediVaultId: async (
    mediVaultId: string
  ): Promise<{
    success: boolean;
    patient: {
      id: string;
      name: string;
      mediVaultId: string;
      dateOfBirth?: string;
      gender?: string;
    };
  }> => {
    const res = await api.get('/appointments/lookup-patient', { params: { mediVaultId } });
    return res.data;
  },

  staffBook: async (data: {
    patientMediVaultId: string;
    doctorId: string;
    appointmentDate: string;
    time: string;
    chiefComplaint?: string;
  }): Promise<{
    success: boolean;
    message: string;
    appointment: AppointmentEntry;
  }> => {
    const res = await api.post('/appointments/staff-book', data);
    return res.data;
  },

  getMySchedule: async (): Promise<{
    success: boolean;
    schedule: AppointmentScheduleDay[];
    managerIds: string[];
    availableManagers: Pick<User, 'id' | 'name' | 'medicalStaffDetails'>[];
  }> => {
    const res = await api.get('/appointments/mine/schedule');
    return res.data;
  },

  updateMySchedule: async (
    schedule: AppointmentScheduleDay[],
    managerIds: string[]
  ): Promise<{
    success: boolean;
    message: string;
    schedule: AppointmentScheduleDay[];
    managerIds: string[];
  }> => {
    const res = await api.put('/appointments/mine/schedule', { schedule, managerIds });
    return res.data;
  },

  getMyRequests: async (): Promise<{
    success: boolean;
    appointments: AppointmentEntry[];
  }> => {
    const res = await api.get('/appointments/mine/requests');
    return res.data;
  },

  getMyStaffAppointments: async (date: string, time: string): Promise<{
    success: boolean;
    upcoming: AppointmentEntry[];
    recent: AppointmentEntry[];
  }> => {
    const res = await api.get('/appointments/mine/calendar', { params: { date, time } });
    return res.data;
  },

  decide: async (
    id: string,
    decision: 'confirmed' | 'declined'
  ): Promise<{ success: boolean; message: string; appointment: AppointmentEntry }> => {
    const res = await api.put(`/appointments/${id}/decision`, { decision });
    return res.data;
  },
  getMyNursingAppointments: async (): Promise<{ success: boolean; appointments: AppointmentEntry[] }> => {
    const res = await api.get('/appointments/mine/nursing');
    return res.data;
  },
  getNursingEntries: async (appointmentId: string): Promise<{ success: boolean; appointment: AppointmentEntry; profile: { allergies: string[]; medicalConditions: string[]; medications: string[]; emergencyContact: { name: string; relationship: string; phone: string } } | null; entries: any[] }> => {
    const res = await api.get(`/appointments/${encodeURIComponent(appointmentId)}/nursing-entries`);
    return res.data;
  },
  addNursingEntry: async (appointmentId: string, data: { entryType: 'observation' | 'nursing_note'; note: string; vitals?: Record<string, number | ''> }): Promise<{ success: boolean; entry: any }> => {
    const res = await api.post(`/appointments/${encodeURIComponent(appointmentId)}/nursing-entries`, data);
    return res.data;
  },
  revokeNursingAccess: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.put(`/appointments/${encodeURIComponent(id)}/nursing-access/revoke`);
    return res.data;
  },
  assignNurse: async (id: string, nurseId: string): Promise<{ success: boolean; message: string; appointment: AppointmentEntry }> => {
    const res = await api.put(`/appointments/${encodeURIComponent(id)}/nursing-access`, { nurseId, nursingAccessConsent: true });
    return res.data;
  },
};

export interface NurseShiftEntry {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface NurseTrainingEntry {
  _id?: string;
  title: string;
  provider: string;
  completedOn: string;
  expiresOn: string;
}

export interface NurseTeamResourceEntry {
  _id: string;
  kind: 'checklist_template' | 'shift_handover';
  title: string;
  category: 'staffing' | 'equipment' | 'supplies' | 'unit_operations';
  notes: string;
  checklistItems: string[];
  author: User | string;
  createdAt: string;
}

export const nursingOperationsAPI = {
  getMine: async (): Promise<{ success: boolean; hospitalName: string; profile: { shifts: NurseShiftEntry[]; trainingRecords: NurseTrainingEntry[] } }> =>
    (await api.get('/nursing-operations/mine')).data,
  updateMine: async (data: { shifts: NurseShiftEntry[]; trainingRecords: NurseTrainingEntry[] }): Promise<{ success: boolean; message: string; profile: { shifts: NurseShiftEntry[]; trainingRecords: NurseTrainingEntry[] } }> =>
    (await api.put('/nursing-operations/mine', data)).data,
  getTeam: async (): Promise<{ success: boolean; hospitalName: string; nurses: { id: string; name: string; specialization: string; shiftToday: string; upcomingAppointmentCount: number }[] }> =>
    (await api.get('/nursing-operations/team')).data,
  getResources: async (): Promise<{ success: boolean; resources: NurseTeamResourceEntry[] }> =>
    (await api.get('/nursing-operations/resources')).data,
  createResource: async (data: { kind: NurseTeamResourceEntry['kind']; title: string; category?: NurseTeamResourceEntry['category']; notes?: string; checklistItems?: string[] }): Promise<{ success: boolean; resource: NurseTeamResourceEntry }> =>
    (await api.post('/nursing-operations/resources', data)).data,
  deleteResource: async (id: string): Promise<{ success: boolean; message: string }> =>
    (await api.delete(`/nursing-operations/resources/${encodeURIComponent(id)}`)).data,
};

export const clinicalAccessAPI = {
  getRequests: async (): Promise<{ success: boolean; requests: ClinicalAccessRequest[] }> => {
    const res = await api.get('/clinical-access');
    return res.data;
  },

  createRequest: async (data: {
    patientMediVaultId: string;
    reason: string;
    reasonDetails?: string;
    requestedUntil: string;
  }): Promise<{ success: boolean; message: string; request: ClinicalAccessRequest }> => {
    const res = await api.post('/clinical-access', data);
    return res.data;
  },

  decideRequest: async (
    id: string,
    data: { decision: 'approved' | 'denied'; expiresAt?: string }
  ): Promise<{ success: boolean; message: string; request: ClinicalAccessRequest }> => {
    const res = await api.put(`/clinical-access/${id}/decision`, data);
    return res.data;
  },

  revokeRequest: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.put(`/clinical-access/${id}/revoke`);
    return res.data;
  },
};

export const claimAPI = {
  submitClaim: async (data: {
    policyNumber: string;
    insuranceCompany: string;
    claimType?: string;
    claimAmount: number;
    records?: string[];
    patientNotes?: string;
    hospitalId?: string;
    admissionDate?: string;
    dischargeDate?: string;
  }): Promise<{ success: boolean; message: string; claim: InsuranceClaim }> => {
    const res = await api.post('/claims', data);
    return res.data;
  },

  getClaims: async (params?: {
    status?: string;
    search?: string;
    insuranceCompany?: string;
  }): Promise<{ success: boolean; count: number; claims: InsuranceClaim[] }> => {
    const res = await api.get('/claims', { params });
    return res.data;
  },

  getClaimById: async (id: string): Promise<{ success: boolean; claim: InsuranceClaim }> => {
    const res = await api.get(`/claims/${id}`);
    return res.data;
  },

  reviewClaim: async (
    id: string,
    data: {
      status: string;
      approvedAmount?: number;
      agentRemarks?: string;
    }
  ): Promise<{ success: boolean; message: string; claim: InsuranceClaim }> => {
    const res = await api.put(`/claims/${id}/review`, data);
    return res.data;
  },

  supplementClaim: async (
    id: string,
    data: {
      additionalAmount: number;
      reason?: string;
    }
  ): Promise<{ success: boolean; message: string; claim: InsuranceClaim }> => {
    const res = await api.put(`/claims/${id}/supplement`, data);
    return res.data;
  },

  downloadClaimRecordUrl: (claimId: string, recordId: string): string => {
    return `${API_BASE_URL}/claims/${claimId}/records/${recordId}/download`;
  },
};

export const policyAPI = {
  getPlans: async (): Promise<{
    success: boolean;
    plans: InsurancePolicyPlan[];
    demoMode: boolean;
  }> => {
    const res = await api.get('/policies/plans');
    return res.data;
  },

  getMyPolicies: async (): Promise<{
    success: boolean;
    policies: PolicyEnrollment[];
    demoMode: boolean;
  }> => {
    const res = await api.get('/policies/mine');
    return res.data;
  },

  enroll: async (planId: string): Promise<{
    success: boolean;
    message: string;
    policy: PolicyEnrollment;
    demoMode: boolean;
  }> => {
    const res = await api.post(`/policies/plans/${planId}/enroll`);
    return res.data;
  },

  payMonthlyPremium: async (enrollmentId: string): Promise<{
    success: boolean;
    message: string;
    policy: PolicyEnrollment;
    demoMode: boolean;
  }> => {
    const res = await api.post(`/policies/mine/${enrollmentId}/payments`);
    return res.data;
  },
};

export const medicalStaffAPI = {
  createLabOrder: async(data:{patientMediVaultId:string;organizationId:string;tests:string[];clinicalNote:string;accessExpiresAt:string}):Promise<{success:boolean;message?:string}> => (await api.post('/medical-staff/lab-orders',data)).data,
  searchMedicineCatalog: async (
    query: string,
    candidates: CatalogSearchMedicine[]
  ): Promise<{ success: boolean; matches: string[]; model: string }> => {
    const res = await api.post('/medical-staff/medicine-catalog/search', {
      query,
      candidates: candidates.map(({ id, name, searchText }) => ({ id, name, searchText })),
    });
    return res.data;
  },

  searchPatients: async (search: string): Promise<{ success: boolean; patients: User[] }> => {
    const res = await api.get('/medical-staff/patients/search', { params: { search } });
    return res.data;
  },

  addClinicalNote: async (data: {
    patientMediVaultId: string;
    noteType?: string;
    title: string;
    diagnosis?: string;
    prescriptionItems?: any[];
    clinicalNotes?: string;
    followUpDate?: string;
    linkedRecords?: string[];
  }): Promise<{ success: boolean; message: string; note: MedicalNote }> => {
    const res = await api.post('/medical-staff/notes', data);
    return res.data;
  },

  updateClinicalNote: async (
    noteId: string,
    data: {
      noteType: string;
      title: string;
      diagnosis?: string;
      prescriptionItems: MedicalNote['prescriptionItems'];
      clinicalNotes?: string;
      followUpDate?: string;
    }
  ): Promise<{ success: boolean; message: string; note: MedicalNote }> => {
    const res = await api.put(`/medical-staff/notes/${noteId}`, data);
    return res.data;
  },

  requestNoteDeletion: async (
    noteId: string,
    reason: string
  ): Promise<{ success: boolean; message: string; note: MedicalNote }> => {
    const res = await api.post(`/medical-staff/notes/${noteId}/deletion-request`, { reason });
    return res.data;
  },

  decideNoteDeletion: async (
    noteId: string,
    decision: 'approved' | 'denied'
  ): Promise<{ success: boolean; message: string; note: MedicalNote }> => {
    const res = await api.put(`/medical-staff/notes/${noteId}/deletion-decision`, { decision });
    return res.data;
  },

  getPatientNotes: async (
    patientId: string
  ): Promise<{ success: boolean; count: number; notes: MedicalNote[] }> => {
    const res = await api.get(`/medical-staff/patients/${patientId}/notes`);
    return res.data;
  },

  getPatientClinicalOverview: async (
    patientId: string
  ): Promise<MedicalStaffClinicalOverview> => {
    const res = await api.get(`/medical-staff/patients/${patientId}/overview`);
    return res.data;
  },

  getPatientAiSummary: async (
    patientId: string
  ): Promise<{
    success: boolean;
    summary: MedicalRecordSummary;
    model: string;
    stored: false;
  }> => {
    const res = await api.get(
      `/medical-staff/patients/${encodeURIComponent(patientId)}/ai-summary`
    );
    return res.data;
  },

  submitPatientAiSummaryFeedback: async (
    patientId: string,
    category: 'incorrect_information' | 'missing_information' | 'duplicate_information' | 'other_issue'
  ): Promise<{ success: boolean; message: string }> => {
    const res = await api.post(
      `/medical-staff/patients/${encodeURIComponent(patientId)}/ai-summary/feedback`,
      { category }
    );
    return res.data;
  },

  getDoctorConsultations: async (): Promise<{
    success: boolean;
    count: number;
    notes: MedicalNote[];
  }> => {
    const res = await api.get('/medical-staff/my-consultations');
    return res.data;
  },
};

export const pharmacyAPI = {
  getDirectory: async (): Promise<{ success: boolean; organizations: PharmacyOrganization[] }> => {
    const res = await api.get('/pharmacy/organizations');
    return res.data;
  },

  createPrescriptionShare: async (prescriptionId: string): Promise<{
    success: boolean;
    message: string;
    share: { id: string; prescriptionTitle: string; expiresAt: string; pharmacyOrganization?: PharmacyOrganization | null };
    token?: string;
  }> => {
    const res = await api.post('/pharmacy/prescription-shares', { prescriptionId });
    return res.data;
  },
  shareWithOrganization: async (prescriptionId: string, pharmacyOrganizationId: string): Promise<{
    success: boolean;
    message: string;
    share: { id: string; prescriptionTitle: string; expiresAt: string; pharmacyOrganization: PharmacyOrganization };
  }> => {
    const res = await api.post('/pharmacy/prescription-shares', { prescriptionId, pharmacyOrganizationId });
    return res.data;
  },

  getPrescriptionShares: async (): Promise<{ success: boolean; shares: PrescriptionShareInfo[] }> => {
    const res = await api.get('/pharmacy/prescription-shares');
    return res.data;
  },

  revokePrescriptionShare: async (shareId: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.put(`/pharmacy/prescription-shares/${shareId}/revoke`);
    return res.data;
  },

  getMyDispenseRecords: async (): Promise<{ success: boolean; records: PrescriptionDispenseRecord[] }> => {
    const res = await api.get('/pharmacy/dispenses/mine');
    return res.data;
  },

  lookupSharedPrescription: async (token: string): Promise<SharedPrescription> => {
    const res = await api.post('/pharmacy/pharmacist/prescriptions/lookup', { token });
    return res.data;
  },

  createDispenseRecord: async (shareId: string, data: {
    items: { status: 'dispensed' | 'partially_dispensed' | 'unavailable'; quantityDispensed: string }[];
    notes: string;
  }): Promise<{ success: boolean; message: string }> => {
    const res = await api.post(`/pharmacy/pharmacist/shares/${shareId}/dispenses`, data);
    return res.data;
  },

  getOrganizationShares: async (): Promise<{
    success: boolean;
    shares: { id: string; patientName: string; prescriptionTitle: string; sharedAt: string; expiresAt: string; openedByCurrentUser: boolean }[];
  }> => {
    const res = await api.get('/pharmacy/pharmacist/organization-shares');
    return res.data;
  },

  openOrganizationShare: async (shareId: string): Promise<SharedPrescription> => {
    const res = await api.post(`/pharmacy/pharmacist/organization-shares/${shareId}/open`);
    return res.data;
  },
};

export const pharmacyOrganizationAPI = {
  getApplication: async (): Promise<{
    success: boolean;
    organization: {
      id: string;
      name: string;
      organizationType: 'hospital' | 'independent_pharmacy' | 'franchise';
      verification: {
        status: 'pending' | 'needs_changes' | 'verified' | 'rejected';
        expiresAt: string;
        reviewNote?: string;
      };
    };
  }> => {
    const res = await api.get('/pharmacy-organizations/application');
    return res.data;
  },
  getMine: async (): Promise<{
    success: boolean;
    organization: PharmacyOrganization & { registrationNumber: string; verification: NonNullable<PharmacyOrganization['verification']> };
    pharmacists: User[];
    branches: PharmacyOrganization[];
  }> => {
    const res = await api.get('/pharmacy-organizations/mine');
    return res.data;
  },
  updateMine: async (data: { phone: string; openingHours: string }): Promise<{ success: boolean; message: string }> => {
    const res = await api.put('/pharmacy-organizations/mine', data);
    return res.data;
  },
  decidePharmacist: async (userId: string, decision: 'approved' | 'rejected'): Promise<{ success: boolean; message: string }> => {
    const res = await api.put(`/pharmacy-organizations/pharmacists/${userId}/decision`, { decision });
    return res.data;
  },
  setPharmacistStatus: async (userId: string, isActive: boolean): Promise<{ success: boolean; message: string }> => {
    const res = await api.put(`/pharmacy-organizations/pharmacists/${userId}/status`, { isActive });
    return res.data;
  },
  resubmitCredentials: async (credentialExpiresAt: string, credentialDocument: File): Promise<{ success: boolean; message: string }> => {
    const formData = new FormData();
    formData.append('credentialExpiresAt', credentialExpiresAt);
    formData.append('credentialDocument', credentialDocument);
    const res = await api.post('/pharmacy-organizations/application/credentials', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data;
  },
  createBranch: async (data: {
    name: string;
    organizationType: 'hospital' | 'independent_pharmacy';
    registrationNumber: string;
    address: string;
    city: string;
    district?: string;
    state: string;
    postalCode: string;
    postOffice?: string;
    phone: string;
    openingHours: string;
    credentialExpiresAt: string;
    credentialDocument: File;
  }): Promise<{ success: boolean; message: string; branch: PharmacyOrganization }> => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => formData.append(key, value));
    const res = await api.post('/pharmacy-organizations/branches', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data;
  },
  resubmitBranchCredentials: async (branchId: string, credentialExpiresAt: string, credentialDocument: File): Promise<{ success: boolean; message: string }> => {
    const formData = new FormData();
    formData.append('credentialExpiresAt', credentialExpiresAt);
    formData.append('credentialDocument', credentialDocument);
    const res = await api.post(`/pharmacy-organizations/branches/${branchId}/credentials`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data;
  },
};

export const labAPI = {
  getDirectory: async (): Promise<{ success: boolean; organizations: LabOrganization[] }> => {
    const res = await api.get('/labs/organizations');
    return res.data;
  },
  getApplication: async (): Promise<{ success: boolean; organization: LabOrganization }> => {
    const res = await api.get('/labs/application');
    return res.data;
  },
  getMine: async (): Promise<{ success: boolean; organization: LabOrganization; branches: LabOrganization[]; staff: User[] }> => {
    const res = await api.get('/labs/mine');
    return res.data;
  },
  createBranch: async (data: { name: string; registrationNumber: string; address: string; city: string; district?: string; state: string; postalCode: string; postOffice?: string; credentialExpiresAt: string; credentialDocument: File }): Promise<{ success: boolean; message: string; branch: LabOrganization }> => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => formData.append(key, value));
    return (await api.post('/labs/branches', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
  },
  decideStaff: async (userId: string, decision: 'approved' | 'rejected'): Promise<{ success: boolean; message: string }> => {
    const res = await api.put(`/labs/staff/${userId}/decision`, { decision });
    return res.data;
  },
  resubmitCredentials: async (credentialExpiresAt: string, credentialDocument: File): Promise<{ success: boolean; message: string }> => {
    const formData = new FormData();
    formData.append('credentialExpiresAt', credentialExpiresAt);
    formData.append('credentialDocument', credentialDocument);
    const res = await api.post('/labs/application/credentials', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data;
  },
  getPatientOrders: async (): Promise<{ success: boolean; orders: LabOrderSummary[] }> => (await api.get('/labs/orders/mine')).data,
  createOrder: async (data: { organizationId: string; tests: string[]; clinicalNote: string }): Promise<{ success: boolean; message: string }> => (await api.post('/labs/orders', data)).data,
  cancelOrder: async (id: string): Promise<{ success: boolean; message: string }> => (await api.put(`/labs/orders/${id}/cancel`)).data,
  revokeOrder: async (id:string):Promise<{success:boolean;message:string}> => (await api.put(`/labs/orders/${id}/revoke`)).data,
  getStaffOrders: async (): Promise<{ success: boolean; orders: LabStaffOrder[] }> => (await api.get('/labs/staff/orders')).data,
  submitResult: async (id: string, title: string, file: File): Promise<{ success: boolean; message: string }> => {
    const form = new FormData(); form.append('title', title); form.append('file', file);
    return (await api.post(`/labs/staff/orders/${id}/result`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
  },
};

export const adminAPI = {
  getHospitals: async (): Promise<{success:boolean;hospitals:any[]}> => (await api.get('/admin/hospitals')).data,
  createHospitalAdmin: async (hospitalId:string, data:{name:string;email:string;phone:string;temporaryPassword:string}):Promise<any> => (await api.post(`/admin/hospitals/${hospitalId}/admins`, data)).data,
  createHospital: async (data:{name:string;registrationNumber:string;address:string;city:string;state:string}):Promise<any> => (await api.post('/admin/hospitals',data)).data,
  getInsuranceCompanies: async ():Promise<{success:boolean;companies:any[]}> => (await api.get('/admin/insurance-companies')).data,
  reviewInsuranceCompany: async(companyId:string,decision:'verified'|'rejected',reviewNote=''):Promise<{success:boolean;message:string}> => (await api.put(`/admin/insurance-companies/${companyId}/review`,{decision,reviewNote})).data,
  insuranceCompanyDocument: async(companyId:string):Promise<Blob> => (await api.get(`/admin/insurance-companies/${companyId}/document`,{responseType:'blob'})).data,
  createInsuranceCompanyAdmin: async(companyId:string,data:{name:string;email:string;phone:string;temporaryPassword:string}):Promise<any> => (await api.post(`/admin/insurance-companies/${companyId}/admins`,data)).data,
  createChainAdmin: async (data: { chainType: 'pharmacy' | 'lab'; chainId: string; name: string; email: string; phone: string; temporaryPassword: string }): Promise<any> => (await api.post('/admin/chain-admins', data)).data,
  assignHospitalAdmin: async(hospitalId:string,userId:string):Promise<any> => (await api.put(`/admin/hospitals/${hospitalId}/admins/${userId}`)).data,
  getPharmacyOrganizations: async (): Promise<{ success: boolean; organizations: PharmacyOrganization[] }> => {
    const res = await api.get('/admin/pharmacy-organizations');
    return {
      ...res.data,
      organizations: res.data.organizations.map((organization: PharmacyOrganization & { _id?: string }) => ({
        ...organization,
        id: organization.id || organization._id || '',
      })),
    };
  },
  reviewPharmacyOrganization: async (organizationId: string, decision: 'verified' | 'needs_changes' | 'rejected', reviewNote: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.put(`/admin/pharmacy-organizations/${organizationId}/review`, { decision, reviewNote });
    return res.data;
  },
  getPharmacyOrganizationDocument: async (organizationId: string): Promise<Blob> => {
    const res = await api.get(`/admin/pharmacy-organizations/${organizationId}/document`, { responseType: 'blob' });
    return res.data as Blob;
  },
  getLabOrganizations: async (): Promise<{ success: boolean; organizations: LabOrganization[] }> => {
    const res = await api.get('/admin/labs');
    return {
      ...res.data,
      organizations: res.data.organizations.map((organization: LabOrganization & { _id?: string }) => ({
        ...organization,
        id: organization.id || organization._id || '',
      })),
    };
  },
  reviewLabOrganization: async (organizationId: string, decision: 'verified' | 'needs_changes' | 'rejected', reviewNote: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.put(`/admin/labs/${organizationId}/review`, { decision, reviewNote });
    return res.data;
  },
  getLabOrganizationDocument: async (organizationId: string): Promise<Blob> => {
    const res = await api.get(`/admin/labs/${organizationId}/document`, { responseType: 'blob' });
    return res.data as Blob;
  },
  getUsers: async (params?: {
    role?: string;
    status?: string;
    search?: string;
  }): Promise<{ success: boolean; count: number; users: User[] }> => {
    const res = await api.get<{
      success: boolean;
      count: number;
      users: Array<Omit<User, 'id'> & { id?: string; _id?: string }>;
    }>('/admin/users', { params });
    return {
      ...res.data,
      users: res.data.users.map((user) => ({
        ...user,
        id: user.id || user._id || '',
      })),
    };
  },

  updateUserRole: async (
    userId: string,
    data: {
      role: UserRole;
      medicalStaffDetails?: MedicalStaffDetails;
      insuranceDetails?: InsuranceDetails;
    }
  ): Promise<{ success: boolean; message: string; user: User }> => {
    const res = await api.put(`/admin/users/${userId}/role`, data);
    return res.data;
  },

  toggleUserStatus: async (
    userId: string,
    isActive: boolean
  ): Promise<{ success: boolean; message: string; user: User }> => {
    const res = await api.put(`/admin/users/${userId}/status`, { isActive });
    return res.data;
  },

  approveUser: async (
    userId: string
  ): Promise<{ success: boolean; message: string; user: User }> => {
    const res = await api.put(`/admin/users/${userId}/approve`);
    return res.data;
  },

  reviewCredential: async (userId: string, decision: 'verified' | 'needs_changes' | 'rejected', reviewNote: string) => {
    const res = await api.put(`/admin/users/${userId}/credential-review`, { decision, reviewNote });
    return res.data as { success: boolean; message: string; user: User };
  },

  getCredentialDocument: async (userId: string): Promise<Blob> => {
    const res = await api.get(`/admin/users/${userId}/credential-document`, { responseType: 'blob' });
    return res.data as Blob;
  },

  getStats: async (): Promise<AdminStatsResponse> => {
    const res = await api.get('/admin/stats');
    return res.data;
  },

  getAuditLogs: async (params?: {
    action?: string;
    userId?: string;
    limit?: number;
  }): Promise<{ success: boolean; count: number; logs: AuditLog[] }> => {
    const res = await api.get('/admin/audit-logs', { params });
    return res.data;
  },
};

export const hospitalAPI = {
  directory: async ():Promise<{success:boolean;hospitals:{id:string;name:string;city:string;state:string}[]}> => (await api.get('/hospitals')).data,
  mine: async():Promise<{success:boolean;hospitals:any[]}> => (await api.get('/hospitals/mine')).data,
  workspace: async(id:string):Promise<any> => (await api.get(`/hospitals/${id}/workspace`)).data,
  applications: async():Promise<{success:boolean;applications:any[]}> => (await api.get('/hospitals/applications')).data,
  reviewStaffCredential: async(userId:string,decision:'verified'|'needs_changes'|'rejected',reviewNote=''):Promise<{success:boolean;message:string}> => (await api.put(`/hospitals/applications/${userId}/credential-review`,{decision,reviewNote})).data,
  approveStaff: async(userId:string):Promise<{success:boolean;message:string}> => (await api.put(`/hospitals/applications/${userId}/approve`)).data,
  staffCredentialDocument: async(userId:string):Promise<Blob> => (await api.get(`/hospitals/applications/${userId}/credential-document`,{responseType:'blob'})).data,
};

export const insuranceCompanyAPI = {
  directory: async (): Promise<{ success: boolean; companies: { id: string; name: string; city: string; state: string }[] }> => (await api.get('/insurance-companies')).data,
  apply: async (data: FormData): Promise<{ success: boolean; pendingApproval: boolean; message: string }> => (await api.post('/insurance-companies/applications', data, { headers: { 'Content-Type': 'multipart/form-data' } })).data,
  mine: async (): Promise<{ success: boolean; company: { id: string; name: string; city: string; state: string } }> => (await api.get('/insurance-companies/mine')).data,
  hospitals: async (): Promise<{ success: boolean; hospitals: { id: string; name: string; city: string; state: string }[] }> => (await api.get('/insurance-companies/hospitals')).data,
  agents: async (): Promise<{ success: boolean; agents: any[] }> => (await api.get('/insurance-companies/agents')).data,
  createAgent: async (data: { name: string; email: string; phone: string; licenseNumber?: string; temporaryPassword: string; hospitalIds: string[] }): Promise<{ success: boolean; message: string; agent: any }> => (await api.post('/insurance-companies/agents', data)).data,
  agentDocument: async (userId: string): Promise<Blob> => (await api.get(`/insurance-companies/agents/${userId}/credential-document`, { responseType: 'blob' })).data,
  reviewAgent: async (userId: string, decision: 'verified' | 'needs_changes' | 'rejected', reviewNote = ''): Promise<{ success: boolean; message: string }> => (await api.put(`/insurance-companies/agents/${userId}/credential-review`, { decision, reviewNote })).data,
  approveAgent: async (userId: string, hospitalIds: string[]): Promise<{ success: boolean; message: string }> => (await api.put(`/insurance-companies/agents/${userId}/approve`, { hospitalIds })).data,
  updateAgentHospitals: async (userId: string, hospitalIds: string[]): Promise<{ success: boolean; message: string }> => (await api.put(`/insurance-companies/agents/${userId}/hospitals`, { hospitalIds })).data,
};

export const insuranceAPI = {
  chatWithPlanAssistant: async (
    messages: InsurancePlanAssistantMessage[]
  ): Promise<{
    success: boolean;
    reply: string;
    plan: InsurancePlanAssistantDraft;
    model: string;
  }> => {
    const res = await api.post('/insurance/plan-assistant', { messages });
    return res.data;
  },

  getPolicyPlans: async (): Promise<{
    success: boolean;
    plans: ManagedInsurancePolicyPlan[];
  }> => {
    const res = await api.get('/insurance/policy-plans');
    return res.data;
  },

  createPolicyPlan: async (data: Omit<InsurancePolicyPlan, 'id' | 'provider'>): Promise<{
    success: boolean;
    message: string;
    plan: ManagedInsurancePolicyPlan;
  }> => {
    const res = await api.post('/insurance/policy-plans', data);
    return res.data;
  },

  updatePolicyPlan: async (
    planId: string,
    data: Partial<Omit<InsurancePolicyPlan, 'id' | 'provider'>> & { status?: ManagedInsurancePolicyPlan['status'] }
  ): Promise<{
    success: boolean;
    message: string;
    plan: ManagedInsurancePolicyPlan;
  }> => {
    const res = await api.put(`/insurance/policy-plans/${planId}`, data);
    return res.data;
  },
};

export default api;
