import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, FileCheck2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { hospitalAPI } from '../services/api';
import { PostalAddressFields } from '../components/PostalAddressFields';

export const LabOrganizationRegisterPage: React.FC = () => {
  const { register } = useAuth();
  const [managerName, setManagerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organizationType, setOrganizationType] = useState<'independent_lab' | 'hospital_lab' | 'franchise'>('independent_lab');
  const [name, setName] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [hospitals, setHospitals] = useState<{id:string;name:string;city:string;state:string}[]>([]);
  const [hospitalLoadError, setHospitalLoadError] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [district, setDistrict] = useState('');
  const [postOffice, setPostOffice] = useState('');
  const [credentialExpiresAt, setCredentialExpiresAt] = useState('');
  const [credentialDocument, setCredentialDocument] = useState<File | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => { if (organizationType !== 'hospital_lab') return; hospitalAPI.directory().then((response) => setHospitals(response.hospitals)).catch(() => setHospitalLoadError('Could not load available hospitals. Refresh and try again.')); }, [organizationType]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!/^[6-9]\d{9}$/.test(phone)) return setError('Enter a valid 10-digit Indian mobile number.');
    if (password.length < 6) return setError('Password must contain at least 6 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    if (organizationType === 'hospital_lab' && !hospitalId) return setError('Select the hospital that operates this laboratory.');
    if (!credentialDocument || credentialDocument.size > 4 * 1024 * 1024 ||
        !['application/pdf', 'image/jpeg', 'image/png'].includes(credentialDocument.type)) {
      return setError('Upload a PDF, PNG, or JPEG registration document up to 4 MB.');
    }
    if (!credentialExpiresAt || new Date(`${credentialExpiresAt}T23:59:59`) <= new Date()) {
      return setError('The laboratory registration expiry must be in the future.');
    }

    setBusy(true);
    try {
      await register({
        name: managerName.trim(),
        email: email.trim(),
        password,
        phone: `+91${phone}`,
        role: 'lab_manager',
        labOrganizationDetails: {
          name: name.trim(),
          organizationType,
          ...(organizationType === 'hospital_lab' ? { hospitalId } : {}),
          hospitalName: organizationType === 'hospital_lab' ? hospitalName.trim() : '',
          registrationNumber: registrationNumber.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          postalCode: postalCode.trim(),
          district: district.trim(),
          postOffice: postOffice.trim(),
        },
        credentialExpiresAt,
        credentialDocument,
      });
      setSubmitted(true);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Could not submit the laboratory organization application.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-700 dark:text-teal-300"><ShieldCheck className="h-3.5 w-3.5" />MediVault Laboratory Network</div>
        <h1 className="text-2xl font-semibold">Register a laboratory</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Apply as an independent laboratory, an in-house hospital laboratory, or a laboratory chain. A platform administrator reviews chain enrollment; approved chain admins manage their locations.</p>
      </header>

      {submitted ? (
        <section className="surface-card space-y-3 p-6">
          <div className="flex items-center gap-2 text-base font-semibold"><FileCheck2 className="h-5 w-5 text-teal-600" />Application submitted</div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Your laboratory application is awaiting platform administrator review. Chain applicants become chain admins after approval and can then add locations.</p>
          <Link to="/lab/login" className="inline-flex text-sm font-semibold text-teal-700 hover:underline dark:text-teal-300">Go to laboratory sign in</Link>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="surface-card space-y-5 p-5 sm:p-6">
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
          <section className="space-y-3">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold"><Building2 className="h-4 w-4" />Laboratory details</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium">Laboratory type
                <select value={organizationType} onChange={(event) => setOrganizationType(event.target.value as typeof organizationType)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
                  <option value="independent_lab">Independent laboratory</option>
                  <option value="hospital_lab">In-house hospital laboratory</option>
                  <option value="franchise">Laboratory chain (parent)</option>
                </select>
              </label>
              <label className="text-xs font-medium">Laboratory name *
                <input required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
              {organizationType === 'hospital_lab' && <label className="text-xs font-medium sm:col-span-2">Operating hospital *
                <select required value={hospitalId} onChange={(event) => { setHospitalId(event.target.value); setHospitalName(hospitals.find((hospital) => hospital.id === event.target.value)?.name || ''); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="">Select an available hospital</option>{hospitals.map((hospital) => <option key={hospital.id} value={hospital.id}>{hospital.name} · {hospital.city}, {hospital.state}</option>)}</select>
                {hospitalLoadError && <span role="alert" className="mt-1 block text-rose-700">{hospitalLoadError}</span>}
                {!hospitalLoadError && !hospitals.length && <span className="mt-1 block text-slate-500">No administrator-created hospitals are currently available.</span>}
              </label>}
              <label className="text-xs font-medium">Laboratory registration number *
                <input required maxLength={100} value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <PostalAddressFields className="sm:col-span-2" value={{ address, city, state, postalCode, district, postOffice }} onChange={(postal) => { setAddress(postal.address); setCity(postal.city); setState(postal.state); setPostalCode(postal.postalCode); setDistrict(postal.district); setPostOffice(postal.postOffice); }} />
            </div>
          </section>
          <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold">Account manager and documents</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium">Manager name *
                <input required maxLength={100} value={managerName} onChange={(event) => setManagerName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="text-xs font-medium">Email *
                <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-300 dark:bg-slate-950" />
              </label>
              <label className="text-xs font-medium">Mobile number *
                <div className="mt-1 flex rounded-lg border border-slate-300 dark:border-slate-700"><span className="border-r px-3 py-2 text-sm text-slate-500">+91</span><input required inputMode="numeric" pattern="[6-9][0-9]{9}" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} className="min-w-0 flex-1 rounded-r-lg bg-white px-3 py-2 text-sm dark:bg-slate-950" /></div>
              </label>
              <label className="text-xs font-medium">Registration expiry *
                <input required type="date" value={credentialExpiresAt} onChange={(event) => setCredentialExpiresAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="text-xs font-medium">Password *
                <input required type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="text-xs font-medium">Confirm password *
                <input required type="password" minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="text-xs font-medium sm:col-span-2">Registration document (PDF, PNG, JPEG; up to 4 MB) *
                <input required type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => setCredentialDocument(event.target.files?.[0])} className="mt-1 block w-full text-sm" />
              </label>
            </div>
          </section>
          <button type="submit" disabled={busy} className="button-primary w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busy ? 'Submitting application…' : 'Submit laboratory application'}</button>
        </form>
      )}
      {!submitted && <p className="text-center text-sm text-slate-500">Laboratory staff? <Link to="/lab/staff/register" className="font-semibold text-teal-700 hover:underline dark:text-teal-300">Apply to join a verified laboratory</Link></p>}
    </main>
  );
};
