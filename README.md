# MediVault – Smart & Secure Personal Health Management System

MediVault is a secure, personal health management platform designed for patients to organize, protect, and track their lifelong medical records, clinical profiles, and activity audit trails in one isolated environment.

---

## 🌟 Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Lucide Icons + React Router v7 + Axios
- **Backend**: Node.js + Express (ES Modules)
- **Database**: MongoDB + Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens) + bcryptjs
- **File Management**: Multer (Local storage with MIME validation & size limits)

---

## 🚀 Core MVP Features (30–40% Scope)

1. **User Registration & Login**:
   - Secure sign-up with email validation and encrypted password hashing (bcrypt).
   - Patients can register and access their accounts immediately.
   - Medical staff and insurance agents require administrator approval before signing in.
   - Administrator accounts are provisioned by an existing system operator, never through public registration.

2. **JWT Authentication & Protected Routing**:
   - Protected client-side routes via `ProtectedRoute`.
   - Express authorization middleware enforcing Bearer token verification.

3. **User Health Profile**:
   - Demographics: Full name, Date of Birth, Gender, Blood group selection (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`, `Unknown`).
   - Clinical tag management: Known Allergies, Medical Conditions, Ongoing Medications.
   - Emergency contact card: Contact name, relationship, and direct phone link.

4. **Medical Record Upload**:
   - Supported formats: **PDF**, **PNG**, **JPG/JPEG** (up to 10 MB).
   - Metadata: Title, category, clinical notes/description, record date.
   - 6 Standard Categories:
     - *Laboratory Report*
     - *Prescription*
     - *Vaccination*
     - *Medical History*
     - *Medication*
     - *Other*

5. **Medical Records Hub**:
   - Full search across titles and clinical descriptions.
   - Category filtering pills with instant counts.
   - In-modal previews for images and PDF documents.
   - Direct secure document download and safe deletion with confirmation.

6. **Personal Health Dashboard**:
   - Real-time stat cards (Total records, category counts, profile completeness score).
   - Emergency contact quick-dial card & blood group badge.
   - Recent records list with one-click preview.
   - Basic chronological health record timeline.

7. **System & Clinical Audit Logs**:
   - Automatic background logging for:
     - `LOGIN`
     - `ACCESS_REQUESTED` / `ACCESS_REQUEST_DECIDED` / `ACCESS_REVOKED`
     - `PROFILE_UPDATE`
     - `RECORD_UPLOAD`
     - `RECORD_VIEW` / Download
     - `RECORD_DELETE`
   - Complete trace with timestamps, IP addresses, and resource details.

8. **Strict User-Level Authorization & Security**:
   - Patients can access their own records; proxies and clinicians can access patient data only through authorized, patient-specific grants.
   - Unauthorized attempts by other users return `403 Forbidden`.
   - Medical staff request access to one identified patient, state a clinical purpose, and request an access end time.
   - The patient, their authorized full-access proxy, or an administrator may approve for a chosen end time or deny the request.
   - Patients, proxies, staff, or administrators may revoke an active grant; approved access expires automatically and is enforced by the API.

9. **Architectural Readiness for Future Milestones**:
   - Future hook interfaces in `recordService.js` for:
     - Blockchain hash anchoring
     - IPFS decentralized file pinning
     - OCR text extraction (Tesseract / Vision API)
     - Role-Based Access Control (Doctor portal & FHIR format)

---

## 📁 Project Structure

```text
medivault/
├── backend/
│   ├── src/
│   │   ├── scripts/
│   │   │   └── promoteAdmin.js       # Provision an administrator from an existing account
│   │   ├── config/
│   │   │   └── db.js                 # MongoDB connection logic
│   │   ├── controllers/
│   │   │   ├── authController.js     # User registration, login & session
│   │   │   ├── profileController.js  # Health profile CRUD
│   │   │   ├── recordController.js   # File upload, download, query, delete
│   │   │   ├── dashboardController.js# Aggregate statistics & timeline
│   │   │   └── auditController.js    # Security & clinical audit trail
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js     # JWT Bearer token protection
│   │   │   ├── uploadMiddleware.js   # Multer file storage & MIME checks
│   │   │   └── errorHandler.js       # Centralized Express error handler
│   │   ├── models/
│   │   │   ├── User.js               # User accounts & bcrypt hooks
│   │   │   ├── HealthProfile.js      # Patient clinical demographics
│   │   │   ├── MedicalRecord.js      # Documents & future metadata placeholders
│   │   │   ├── ClinicalAccessRequest.js # Patient-specific, expiring staff access grants
│   │   │   └── AuditLog.js           # Immutable event logging
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── profileRoutes.js
│   │   │   ├── recordRoutes.js
│   │   │   ├── dashboardRoutes.js
│   │   │   ├── auditRoutes.js
│   │   │   ├── clinicalAccessRoutes.js
│   │   ├── services/
│   │   │   ├── auditService.js       # Asynchronous audit event logger
│   │   │   └── recordService.js      # File cleaner & future extension hooks
│   │   └── server.js                 # Express server entrypoint
│   ├── uploads/                      # Uploaded document storage
│   ├── test_mvp.js                   # Automated end-to-end verification tests
│   ├── .env.example
│   ├── .env
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx            # Navigation, branding & user status
│   │   │   ├── ProtectedRoute.tsx    # Auth route guard
│   │   │   ├── UploadModal.tsx       # Document upload modal with drag & drop
│   │   │   └── RecordViewerModal.tsx # In-modal preview, download & delete
│   │   ├── context/
│   │   │   └── AuthContext.tsx       # Authentication state & session sync
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx         # Secure sign-in
│   │   │   ├── RegisterPage.tsx      # Sign up page
│   │   │   ├── AccessRequestsPage.tsx # Patient/proxy/admin decisions and staff grants
│   │   │   ├── DashboardPage.tsx     # Metrics, health alerts & timeline
│   │   │   ├── RecordsPage.tsx       # Searchable & filterable records grid
│   │   │   ├── ProfilePage.tsx       # Demographic & allergy editor
│   │   │   └── AuditLogsPage.tsx     # Activity trail table
│   │   ├── services/
│   │   │   └── api.ts                # Axios client with interceptors
│   │   ├── types/
│   │   │   └── index.ts              # TypeScript data models
│   │   ├── App.tsx                   # Main routing & layout
│   │   ├── main.tsx
│   │   └── index.css                 # Design tokens & glassmorphic styles
│   ├── vite.config.ts                # Vite config + Tailwind v4 + Proxy
│   ├── index.html
│   └── package.json
├── README.md
└── .gitignore
```

---

## ⚙️ Setup & Installation Instructions

### Prerequisites
- **Node.js** (v18 or higher)
- **MongoDB** running locally on port 27017 or a MongoDB Atlas URI

### 1. Clone & Setup Backend

```bash
cd backend

# Install backend dependencies
npm install

# Review or update environment variables (.env is preconfigured for local dev)
cp .env.example .env

# Start backend server
npm run dev
# Server will run at: http://localhost:5000
```

### 2. Setup Frontend

```bash
cd ../frontend

# Install frontend dependencies
npm install

# Start Vite development server
npm run dev
# Frontend will run at: http://localhost:5173
```

### Provision the First Administrator

Public sign-up is limited to patients and staff; administrator access cannot be self-requested.
After registering a trusted operator account as a patient, promote it from the backend using
an account with database access:

```bash
cd backend
npm run admin:promote -- operator@example.com
```

The operator can then sign in and approve pending medical staff and insurance agent accounts
from the administration user directory.

---

## ☁️ Deployment (Vercel Services + MongoDB Atlas)

The root `vercel.json` deploys the Vite frontend and Express API as separate Vercel
services in one project. Requests to `/api/*` are routed to the backend; all other paths
go to the frontend. The API remains a normal local Express server outside Vercel.

### Local development

- Run MongoDB locally and set `backend/.env` to use
  `MONGODB_URI=mongodb://127.0.0.1:27017/medivault`.
- Keep `frontend/.env` set to `VITE_API_BASE_URL=/api`; Vite proxies API and upload
  requests to the local backend.
- Start the backend and frontend using the setup steps above. Local uploads remain in
  `backend/uploads`.

### Hosted deployment

1. Import the repository root into Vercel from GitHub. Keep the project root at the
   repository root so Vercel can read the top-level `vercel.json` and build both services.
2. Create a MongoDB Atlas cluster and database user. Configure Atlas network access so the
   Vercel backend can reach it. MongoDB is an external service; its URI is not a Vercel
   service binding.
3. Set environment variables for the backend service in Vercel:
   - `MONGODB_URI`: the Atlas connection string
   - `JWT_SECRET`: a unique, randomly generated production secret
   - `JWT_EXPIRES_IN`: for example, `7d`
   - `CLIENT_URL`: comma-separated exact origins only if the frontend is hosted separately
     from the API (for example, `https://app.example.com`). Same-origin Vercel service
     requests are allowed automatically; this variable is not needed for the bundled app.
   - `NODE_ENV=production`
4. The frontend uses the same-origin `/api` path, so it needs no backend URL binding and
   no `VITE_API_BASE_URL` override for this routing setup.
5. Deploy and check `https://your-app.vercel.app/api/health`.

Vercel serverless filesystems are ephemeral. The backend currently stores medical uploads
on disk, so uploads written to `/tmp` may disappear between invocations and are not
durable. Configure external persistent object storage and adapt upload/download handling
before relying on uploads in production. The existing 10 MB upload limit may also exceed
Vercel's function request-body limit.

Never commit `.env` files or expose production secrets in `VITE_*` variables. MediVault
handles sensitive health information; this deployment setup does not by itself make the
application compliant with healthcare privacy regulations. Do not use it for real
patient data until hosting, access controls, encryption, backups, and compliance have
been independently reviewed.

---

## 🧪 Automated End-to-End Verification

The backend includes an automated test script verifying all 10 core MVP requirements (registration, login, profile updates, file upload via Multer, filtering/search, download, dashboard stats, user isolation security, and audit logs):

```bash
cd backend
npm test
```

Expected output:
```text
=== STARTING MEDIVAULT MVP VERIFICATION TESTS ===
✓ Health check passed
✓ Registration & token generation passed
✓ Login passed
✓ Health Profile management passed
✓ File Upload via Multer passed
✓ Records query, category filter and search passed
✓ View and download passed
✓ Dashboard statistics & timeline passed
✓ User Isolation & Authorization verified successfully (403 Forbidden returned)
✓ Audit logs verified
🎉 ALL 10 MEDIVAULT MVP BACKEND VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉
```

### Multi-Stakeholder RBAC End-to-End Test Suite

Run the full role-based access verification suite covering all 5 stakeholders (Patients, Caregiver Proxies, Medical Staff Doctors, Insurance Agents, and Admins):

```bash
cd backend
npm run test:rbac
```

---

## 📡 API Reference Overview

### Separate Sign-In Portals
- The public home (`/`) is patient-facing and shows only patient sign-in (`/patient/login`) and patient registration (`/patient/register`).
- Organization access is separate at `/organization`, with dedicated sign-in paths for medical staff (`/clinical/login`) and insurance/governance (`/insurance/login`).
- Clinician and insurance-agent applications are available at `/organization/register`. Administrator accounts are provisioned by an existing system owner.

The sign-in forms accept only the account roles assigned to their portal. Backend role authorization remains the enforcement boundary for protected data and operations.

### 1. Authentication & Profiles
| Method | Endpoint | Description | Roles |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register as a patient or submit a staff application; staff access requires administrator approval | Public |
| `POST` | `/api/auth/login` | Login and receive role-annotated JWT token | Public |
| `GET` | `/api/auth/me` | Current authenticated user profile & role details | Authenticated |
| `GET` | `/api/profile` | Get patient clinical profile (supports `x-patient-context` for proxies and approved medical staff) | Patient / Proxy / Medical Staff with active grant |
| `PUT` | `/api/profile` | Update demographics, allergies, emergency contacts | Patient / Full Proxy |

### 2. Medical Records Hub
| Method | Endpoint | Description | Roles |
|---|---|---|---|
| `GET` | `/api/records` | List records (`?search`, `?category`, `?sort`, `x-patient-context`) | Patient / Proxy / Medical Staff with active grant |
| `POST` | `/api/records` | Upload medical document (`file`, `title`, `category`, `recordDate`) | Patient / Full Proxy |
| `GET` | `/api/records/:id` | View specific record metadata | Patient / Proxy / Medical Staff with active grant |
| `GET` | `/api/records/:id/download` | Download physical document | Patient / Proxy / Medical Staff with active grant |
| `DELETE` | `/api/records/:id` | Delete record & disk file | Patient / Full Proxy |

### 3. Dual-Context Caregiver & Proxy Delegation
| Method | Endpoint | Description | Roles |
|---|---|---|---|
| `POST` | `/api/proxy/delegate` | Grant caregiver proxy access (`proxyEmail`, `relationship`, `accessLevel`) | Patient / Admin |
| `GET` | `/api/proxy/my-proxies` | List active caregivers authorized for the patient | Patient |
| `GET` | `/api/proxy/my-dependents` | List active dependents managed by the caregiver | Caregiver / User |
| `DELETE` | `/api/proxy/:id` | Revoke proxy delegation | Patient / Caregiver / Admin |

### 4. Health Insurance Claims & Adjuster Verification
| Method | Endpoint | Description | Roles |
|---|---|---|---|
| `POST` | `/api/claims` | File new reimbursement/cashless claim with attached vault records | Patient / Caregiver |
| `GET` | `/api/claims` | List claims for the authenticated patient or insurance agent | Patient / Insurance Agent |
| `GET` | `/api/claims/:id` | View claim details, patient notes, and attached documents | Patient / Insurance Agent |
| `PUT` | `/api/claims/:id/review` | Evaluate claim (`status`, `approvedAmount`, `agentRemarks`) | Insurance Agent |
| `GET` | `/api/claims/:claimId/records/:recordId/download` | Privacy-preserving download of verified claim attachment | Insurance Agent |

### 5. Medical Staff & Clinical Consultations
| Method | Endpoint | Description | Roles |
|---|---|---|---|
| `GET` | `/api/medical-staff/patients/search` | Search active patient accounts by name or email (no clinical data returned) | Approved Medical Staff |
| `POST` | `/api/medical-staff/notes` | Add a clinical consultation note & digital prescription for a patient with an active access grant | Medical Staff |
| `GET` | `/api/medical-staff/patients/:patientId/notes` | Get clinical notes and prescriptions for an authorized patient | Patient / Medical Staff with active grant |
| `GET` | `/api/medical-staff/patients/:patientId/overview` | View patient clinical profile and record history with an active access grant | Medical Staff |
| `GET` | `/api/medical-staff/my-consultations` | Get all consultations authored by the logged-in doctor | Medical Staff |

### 6. Patient-Specific Clinical Access
| Method | Endpoint | Description | Roles |
|---|---|---|---|
| `POST` | `/api/clinical-access` | Request access to one patient with a clinical purpose and requested end time | Approved Medical Staff |
| `GET` | `/api/clinical-access` | List requests and grants visible to the authenticated user | Patient / Authorized Proxy / Medical Staff / Admin |
| `PUT` | `/api/clinical-access/:id/decision` | Approve with a chosen future expiration or deny a pending request | Patient / Authorized Full Proxy / Admin |
| `PUT` | `/api/clinical-access/:id/revoke` | Revoke an active grant immediately | Patient / Authorized Full Proxy / Requesting Medical Staff / Admin |

### 7. System Governance & Administration
| Method | Endpoint | Description | Roles |
|---|---|---|---|
| `GET` | `/api/admin/users` | List all users across all roles (`?role`, `?status`, `?search`) | Admin |
| `PUT` | `/api/admin/users/:id/role` | Update user role (`patient`, `medical_staff`, `insurance_agent`, `admin`) | Admin |
| `PUT` | `/api/admin/users/:id/status` | Activate or deactivate user account | Admin |
| `GET` | `/api/admin/stats` | Platform-wide analytics (users by role, records, claims) | Admin |
| `GET` | `/api/admin/audit-logs` | Global immutable compliance audit trail across all stakeholders | Admin |
| `GET` | `/api/health` | Service health status check | Public |

---

## 🔒 Security & Privacy Features

- **Multi-Stakeholder RBAC**: Strict role enforcement (`patient`, `medical_staff`, `insurance_agent`, `admin`) with route guards.
- **Dual-Context Caregiver Delegation**: Authorized proxies can switch context using `x-patient-context` header with granular `read_only` or `full` privileges.
- **Privacy-Preserving Insurance Verification**: Insurance agents can only inspect records explicitly attached to an active claim.
- **MIME Validation & Sanitization**: Restricts uploads strictly to `application/pdf`, `image/jpeg`, `image/png` with random timestamp hashed filenames.
- **Immutable Cross-Stakeholder Audit Trail**: Captures logins, proxy delegations, caregiver actions, claim submissions, claim reviews, and administrative changes with IP and user agent.
