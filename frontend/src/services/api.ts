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
  AdminStatsResponse,
  User,
  UserRole,
  MedicalStaffDetails,
  InsuranceDetails,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token and active dependent context
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('medivault_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const activeDependent = localStorage.getItem('medivault_active_dependent');
    if (activeDependent) {
      try {
        const dep = JSON.parse(activeDependent);
        if (dep && dep.id) {
          config.headers['x-patient-context'] = dep.id;
        }
      } catch (e) {
        // Ignore parse error
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
      localStorage.removeItem('medivault_token');
      localStorage.removeItem('medivault_user');
      localStorage.removeItem('medivault_active_dependent');
      if (
        !window.location.pathname.includes('/login') &&
        !window.location.pathname.includes('/register')
      ) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: async (credentials: { email: string; password: string }): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/login', credentials);
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
  }): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/register', userData);
    return res.data;
  },

  getMe: async (): Promise<{ success: boolean; user: User }> => {
    const res = await api.get('/auth/me');
    return res.data;
  },
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
  }): Promise<{ success: boolean; count: number; records: MedicalRecord[] }> => {
    const res = await api.get('/records', { params });
    return res.data;
  },

  getRecordById: async (id: string): Promise<{ success: boolean; record: MedicalRecord }> => {
    const res = await api.get(`/records/${id}`);
    return res.data;
  },

  uploadRecord: async (
    formData: FormData
  ): Promise<{ success: boolean; message: string; record: MedicalRecord }> => {
    const res = await api.post('/records', formData, {
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

  downloadRecordUrl: (id: string): string => {
    return `${API_BASE_URL}/records/${id}/download`;
  },
};

export const dashboardAPI = {
  getStats: async (): Promise<DashboardResponse> => {
    const res = await api.get('/dashboard/stats');
    return res.data;
  },
};

export const auditAPI = {
  getLogs: async (params?: {
    action?: string;
    limit?: number;
  }): Promise<{ success: boolean; count: number; logs: AuditLog[] }> => {
    const res = await api.get('/audit-logs', { params });
    return res.data;
  },
};

export const proxyAPI = {
  delegateAccess: async (data: {
    proxyEmail: string;
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

export const claimAPI = {
  submitClaim: async (data: {
    policyNumber: string;
    insuranceCompany: string;
    claimType?: string;
    claimAmount: number;
    records?: string[];
    patientNotes?: string;
    hospitalName?: string;
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

export const medicalStaffAPI = {
  addClinicalNote: async (data: {
    patientId: string;
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

  getPatientNotes: async (
    patientId: string
  ): Promise<{ success: boolean; count: number; notes: MedicalNote[] }> => {
    const res = await api.get(`/medical-staff/patients/${patientId}/notes`);
    return res.data;
  },

  getPatientClinicalOverview: async (
    patientId: string
  ): Promise<{
    success: boolean;
    patient: User;
    profile: HealthProfile | null;
    records: MedicalRecord[];
    notes: MedicalNote[];
  }> => {
    const res = await api.get(`/medical-staff/patients/${patientId}/overview`);
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

export const adminAPI = {
  getUsers: async (params?: {
    role?: string;
    status?: string;
    search?: string;
  }): Promise<{ success: boolean; count: number; users: User[] }> => {
    const res = await api.get('/admin/users', { params });
    return res.data;
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

export default api;
