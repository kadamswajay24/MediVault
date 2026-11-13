import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Loader2,
  Stethoscope,
  Phone,
  Pill,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import type { UserRole } from '../types';
import { MEDICAL_SPECIALIZATIONS } from '../constants/medicalSpecializations';
import { hospitalAPI, insuranceCompanyAPI, labAPI, pharmacyAPI } from '../services/api';
import type { LabOrganization, PharmacyOrganization } from '../types';
import { PostalAddressFields, emptyPostalAddress, type PostalAddress } from '../components/PostalAddressFields';

type RegistrationPortal = 'patient' | 'clinical' | 'insurance' | 'lab';

export const RegisterPage: React.FC<{ portal: RegistrationPortal }> = ({ portal }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [patientAddress, setPatientAddress] = useState<PostalAddress>(emptyPostalAddress);
  const [role, setRole] = useState<UserRole>(
    portal === 'patient' ? 'patient' : portal === 'insurance' ? 'insurance_agent' : 'medical_staff'
  );
  const [staffType, setStaffType] = useState<'doctor' | 'nurse' | 'pharmacist' | 'lab_technologist'>(portal === 'lab' ? 'lab_technologist' : 'doctor');
  const isPatientPortal = portal === 'patient';
  const signInPath = portal === 'patient'
    ? '/patient/login'
    : portal === 'insurance'
      ? '/insurance/login'
      : portal === 'lab'
        ? '/lab/login'
      : '/clinical/login';

  // Role details
  const [licenseNumber, setLicenseNumber] = useState('');
  const [credentialExpiresAt, setCredentialExpiresAt] = useState('');
  const [credentialDocument, setCredentialDocument] = useState<File | undefined>();
  const [specialization, setSpecialization] = useState('');
  const [customSpecialization, setCustomSpecialization] = useState('');
  const [selectedHospitalId, setSelectedHospitalId] = useState('');
  const [hospitalDirectory, setHospitalDirectory] = useState<{ id: string; name: string; city: string; state: string }[]>([]);
  const [hospitalDirectoryError, setHospitalDirectoryError] = useState<string | null>(null);
  const [pharmacyOrganizationId, setPharmacyOrganizationId] = useState('');
  const [pharmacyOrganizations, setPharmacyOrganizations] = useState<PharmacyOrganization[]>([]);
  const [pharmacyDirectoryError, setPharmacyDirectoryError] = useState<string | null>(null);
  const [labOrganizationId, setLabOrganizationId] = useState('');
  const [labOrganizations, setLabOrganizations] = useState<LabOrganization[]>([]);
  const [labDirectoryError, setLabDirectoryError] = useState<string | null>(null);
  const [insuranceCompanyId, setInsuranceCompanyId] = useState('');
  const [insuranceCompanies, setInsuranceCompanies] = useState<{id:string;name:string;city:string;state:string}[]>([]);
  const [insuranceCompanyError, setInsuranceCompanyError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registrationPending, setRegistrationPending] = useState(false);
  const [issuedMediVaultId, setIssuedMediVaultId] = useState<string | null>(null);
  const [issuedAgentId, setIssuedAgentId] = useState<string | null>(null);

  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (portal === 'clinical') {
      hospitalAPI.directory()
        .then((response) => setHospitalDirectory(response.hospitals))
        .catch(() => setHospitalDirectoryError('The verified hospital directory is temporarily unavailable.'));
      pharmacyAPI.getDirectory()
        .then((response) => setPharmacyOrganizations(response.organizations))
        .catch(() => setPharmacyDirectoryError('The verified pharmacy directory is temporarily unavailable.'));
    }
    if (portal === 'insurance') {
      insuranceCompanyAPI.directory().then((response) => setInsuranceCompanies(response.companies)).catch(() => setInsuranceCompanyError('The enrolled insurer directory is temporarily unavailable.'));
    }
    if (portal === 'lab') {
      labAPI.getDirectory()
        .then((response) => setLabOrganizations(response.organizations))
        .catch(() => setLabDirectoryError('The verified laboratory directory is temporarily unavailable.'));
    }
  }, [portal]);

  const handlePhoneChange = (value: string) => {
    const formattedNumber = value.trim().replace(/[\s()-]/g, '');
    const internationalNumber = formattedNumber.match(/^\+?91([6-9]\d{9})$/);
    const digits = value.replace(/\D/g, '');
    setPhone(internationalNumber ? internationalNumber[1] : digits.slice(0, 10));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    if (role === 'insurance_agent' && !insuranceCompanyId) {
      setError('Select your insurance company.');
      return;
    }
    if (role === 'medical_staff' && staffType === 'pharmacist' && !pharmacyOrganizationId) {
      setError('Select the MediVault-verified hospital or pharmacy you work for.');
      return;
    }
    if (role === 'medical_staff' && staffType === 'lab_technologist' && !labOrganizationId) {
      setError('Select the MediVault-verified laboratory you work for.');
      return;
    }
    if (role === 'medical_staff' && ['doctor', 'nurse'].includes(staffType) && !selectedHospitalId) {
      setError('Select a MediVault hospital for your staff application.');
      return;
    }

    if (!isPatientPortal) {
      if (!licenseNumber.trim() || !credentialExpiresAt || !credentialDocument) {
        setError('Staff applications require a license number, expiry date, and credential document.');
        return;
      }
      if (new Date(`${credentialExpiresAt}T23:59:59`) <= new Date()) {
        setError('The credential expiry date must be in the future.');
        return;
      }
      if (credentialDocument.size > 4 * 1024 * 1024) {
        setError('Credential documents must be 4 MB or smaller.');
        return;
      }
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(credentialDocument.type)) {
        setError('Upload a PDF, PNG, or JPEG credential document.');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const result = await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        phone: `+91${phone}`,
        patientAddress: isPatientPortal ? patientAddress : undefined,
        medicalStaffDetails:
          role === 'medical_staff'
            ? {
              professionalType: staffType === 'nurse' ? 'nurse' : staffType === 'pharmacist' ? 'pharmacist' : staffType === 'lab_technologist' ? 'lab_technologist' : 'physician',
              pharmacyOrganizationId: staffType === 'pharmacist' ? pharmacyOrganizationId : undefined,
              labOrganizationId: staffType === 'lab_technologist' ? labOrganizationId : undefined,
                hospitalId: ['doctor', 'nurse'].includes(staffType) ? selectedHospitalId : undefined,
                licenseNumber,
                specialization:
                  specialization === 'Other' ? customSpecialization.trim() : specialization,
              }
            : undefined,
        insuranceDetails:
          role === 'insurance_agent'
            ? {
                companyName: insuranceCompanies.find((company) => company.id === insuranceCompanyId)?.name || '',
                insuranceCompanyId,
                licenseNumber,
              }
            : undefined,
        credentialExpiresAt: isPatientPortal ? undefined : credentialExpiresAt,
        credentialDocument,
      });

      if (result.pendingApproval) {
        setIssuedMediVaultId(result.user.mediVaultId);
        setIssuedAgentId(result.user.insuranceDetails?.agentId || null);
        setRegistrationPending(true);
        return;
      }

      if (role === 'insurance_agent') navigate('/claims');
      else if (role === 'medical_staff') navigate(staffType === 'pharmacist' ? '/pharmacy' : '/medical-staff');
      else navigate('/dashboard');
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Registration failed. Please check your information.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-8">
      <div className="max-w-lg w-full space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {isPatientPortal
              ? 'Create your account'
              : portal === 'clinical'
                ? 'Apply for medical staff access'
                : portal === 'lab'
                  ? 'Apply to join a laboratory'
                : 'Apply for insurance access'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isPatientPortal
              ? 'Enter your details to get started.'
              : portal === 'lab'
                ? 'Your laboratory and credentials must be reviewed, then your laboratory manager approves your membership.'
                : 'Applications are reviewed by an administrator before access is granted.'}
          </p>
        </div>

        {registrationPending ? (
          <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Application submitted for review
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              You can sign in to track this application. Staff tools stay locked until an
              administrator verifies your credential and approves the account.
            </p>
            {issuedMediVaultId && (
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                Your MediVault ID: <span className="font-sans font-semibold">{issuedMediVaultId}</span>
              </p>
            )}
            {issuedAgentId && (
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                Portal-generated agent ID: <span className="font-sans font-semibold">{issuedAgentId}</span>
              </p>
            )}
            <Link
              to={signInPath}
              className="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Return to sign in <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
        /* Card Form */
        <div className="surface-card p-5 sm:p-6">
          {error && (
            <div role="alert" className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {portal === 'clinical' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Medical staff role
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRole('medical_staff');
                    setStaffType('doctor');
                    if (specialization === 'Nursing' || specialization === 'Pharmacy') setSpecialization('');
                  }}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                    role === 'medical_staff' && staffType === 'doctor'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 font-bold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Stethoscope className="w-4 h-4 mb-1 text-blue-600" />
                  <div>Doctor</div>
                  <div className="text-[10px] text-slate-400 font-normal">Clinician</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRole('medical_staff');
                    setStaffType('nurse');
                    setSpecialization('Nursing');
                  }}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                    role === 'medical_staff' && staffType === 'nurse'
                      ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/30 text-teal-900 dark:text-teal-200 font-bold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Stethoscope className="w-4 h-4 mb-1 text-teal-600" />
                  <div>Nurse</div>
                  <div className="text-[10px] text-slate-400 font-normal">Nursing staff</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRole('medical_staff');
                    setStaffType('pharmacist');
                    setSpecialization('Pharmacy');
                  }}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                    role === 'medical_staff' && staffType === 'pharmacist'
                      ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/30 text-teal-900 dark:text-teal-200 font-bold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Pill className="w-4 h-4 mb-1 text-teal-600" />
                  <div>Pharmacist</div>
                  <div className="text-[10px] text-slate-400 font-normal">Pharmacy staff</div>
                </button>
              </div>
            </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="register-name-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    id="register-name-input"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="register-phone-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <span className="absolute left-9 top-1/2 -translate-y-1/2 border-r border-slate-300 pr-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
                    +91
                  </span>
                  <input
                      type="tel"
                      id="register-phone-input"
                      required
                      inputMode="numeric"
                      autoComplete="tel-national"
                      pattern="[6-9][0-9]{9}"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="9876543210"
                      aria-label="10-digit Indian mobile number"
                      title="Enter a 10-digit Indian mobile number starting with 6, 7, 8, or 9."
                      className="w-full pl-[4.4rem] pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="register-email-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  id="register-email-input"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {isPatientPortal && <section className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <div><h2 className="text-sm font-semibold">Home address</h2><p className="mt-1 text-xs text-slate-500">Optional. Add it now or update it later in your health profile.</p></div>
              <PostalAddressFields value={patientAddress} onChange={setPatientAddress} required={false} />
            </section>}

            {/* Medical Staff Specific Fields */}
            {role === 'medical_staff' && (
              <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 space-y-2.5">
                <span className="text-[11px] font-bold uppercase text-blue-600 dark:text-blue-400 block">
                  {staffType === 'pharmacist' ? 'Pharmacy Credentials' : staffType === 'lab_technologist' ? 'Laboratory Credentials' : 'Clinician Credentials'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    placeholder={staffType === 'pharmacist' ? 'Pharmacy registration / license #' : staffType === 'lab_technologist' ? 'Laboratory professional registration / license #' : 'Medical License # (e.g. MCI-MH-992)'}
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded"
                  />
                  {staffType !== 'doctor' ? (
                    <div className="flex items-center rounded border bg-slate-50 px-2.5 py-1.5 text-slate-600 dark:bg-slate-900 dark:text-slate-300" aria-label={staffType === 'nurse' ? 'Nursing specialization' : 'Pharmacy scope'}>
                      {staffType === 'nurse' ? 'Nursing' : staffType === 'pharmacist' ? 'Pharmacy' : 'Laboratory'}
                    </div>
                  ) : <select
                    aria-label="Medical specialization"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded"
                  >
                    <option value="">Select specialization</option>
                    {MEDICAL_SPECIALIZATIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                    <option value="Other">Other</option>
                  </select>}
                </div>
                {specialization === 'Other' && (
                  <input
                    type="text"
                    placeholder="Enter specialization"
                    value={customSpecialization}
                    onChange={(e) => setCustomSpecialization(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded text-xs"
                  />
                )}
                {['doctor', 'nurse'].includes(staffType) && (
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    MediVault hospital *
                    <select required value={selectedHospitalId} onChange={(event) => setSelectedHospitalId(event.target.value)} className="mt-1 w-full rounded border bg-white px-2.5 py-2 text-sm dark:bg-slate-900">
                      <option value="">Select a hospital</option>
                      {hospitalDirectory.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name} · {hospital.city}, {hospital.state}</option>)}
                    </select>
                    {hospitalDirectoryError && <span role="alert" className="mt-1 block text-rose-600">{hospitalDirectoryError}</span>}
                    {!hospitalDirectoryError && hospitalDirectory.length === 0 && <span className="mt-1 block font-normal text-slate-500">No administrator-created hospitals are currently available.</span>}
                  </label>
                )}
                {staffType === 'pharmacist' && (
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    MediVault-verified hospital / pharmacy *
                    <select required value={pharmacyOrganizationId} onChange={(event) => setPharmacyOrganizationId(event.target.value)} className="mt-1 w-full rounded border bg-white px-2.5 py-2 text-sm dark:bg-slate-900">
                      <option value="">Select an organization</option>
                      {pharmacyOrganizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>
                          {organization.name} · {organization.organizationType === 'hospital' ? 'Hospital' : 'Independent pharmacy'} · {organization.city}
                        </option>
                      ))}
                    </select>
                    {pharmacyDirectoryError && <span role="alert" className="mt-1 block text-rose-600">{pharmacyDirectoryError}</span>}
                    {!pharmacyDirectoryError && pharmacyOrganizations.length === 0 && <span className="mt-1 block font-normal text-slate-500">No verified organizations are currently accepting applications.</span>}
                  </label>
                )}
                {staffType === 'lab_technologist' && (
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    MediVault-verified laboratory *
                    <select required value={labOrganizationId} onChange={(event) => setLabOrganizationId(event.target.value)} className="mt-1 w-full rounded border bg-white px-2.5 py-2 text-sm dark:bg-slate-900">
                      <option value="">Select a laboratory</option>
                      {labOrganizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>
                          {organization.name} · {organization.organizationType === 'hospital_lab' ? `Hospital lab${organization.hospitalName ? ` · ${organization.hospitalName}` : ''}` : 'Independent lab'} · {organization.city}
                        </option>
                      ))}
                    </select>
                    {labDirectoryError && <span role="alert" className="mt-1 block text-rose-600">{labDirectoryError}</span>}
                    {!labDirectoryError && labOrganizations.length === 0 && <span className="mt-1 block font-normal text-slate-500">No verified laboratories are currently accepting applications.</span>}
                  </label>
                )}
              </div>
            )}

            {/* Insurance Agent Specific Fields */}
            {role === 'insurance_agent' && (
              <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 space-y-2.5">
                <span className="text-[11px] font-bold uppercase text-amber-600 dark:text-amber-400 block">
                  Insurance Provider Affiliation
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <select
                    required
                    value={insuranceCompanyId}
                    onChange={(e) => setInsuranceCompanyId(e.target.value)}
                    aria-label="Insurance company"
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded text-slate-700 dark:text-slate-300"
                  >
                    <option value="">Select an enrolled insurance company</option>
                    {insuranceCompanies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                  {insuranceCompanyError && <span role="alert" className="text-rose-600">{insuranceCompanyError}</span>}
                </div>
                {!insuranceCompanyError && !insuranceCompanies.length && <p className="text-xs text-slate-500">No approved insurers are accepting agent applications. <Link className="font-semibold underline" to="/insurance/company/register">Enroll an insurance company</Link></p>}
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  MediVault will generate a company-specific agent ID for you.
                </p>
                <input
                  required
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="Insurance license / registration number"
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded text-xs"
                />
              </div>
            )}

            {!isPatientPortal && (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                <div>
                  <label htmlFor="credential-expiry" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Credential expiry date *
                  </label>
                  <input
                    id="credential-expiry"
                    required
                    type="date"
                    value={credentialExpiresAt}
                    onChange={(e) => setCredentialExpiresAt(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="credential-document" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Upload license or credential document *
                  </label>
                  <input
                    id="credential-document"
                    required
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    onChange={(e) => setCredentialDocument(e.target.files?.[0])}
                    className="w-full text-xs text-slate-700 dark:text-slate-300"
                  />
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                    PDF, PNG, or JPEG; up to 4 MB. An administrator must verify it before staff access is approved.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="register-password-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    id="register-password-input"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="register-confirm-password-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    id="register-confirm-password-input"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="button-primary w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Create account</span>
              )}
            </button>
          </form>
        </div>
        )}

        <p className="text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link
            to={signInPath}
            className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
