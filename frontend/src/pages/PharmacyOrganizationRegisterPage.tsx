import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, FileCheck2, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { hospitalAPI } from '../services/api';
import { PostalAddressFields } from '../components/PostalAddressFields';

export const PharmacyOrganizationRegisterPage: React.FC = () => {
  const { register } = useAuth();
  const [managerName, setManagerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organizationType, setOrganizationType] = useState<'hospital' | 'independent_pharmacy' | 'franchise'>('independent_pharmacy');
  const [hospitals,setHospitals]=useState<{id:string;name:string;city:string;state:string}[]>([]);
  const [hospitalId,setHospitalId]=useState('');
  const [hospitalLoadError,setHospitalLoadError]=useState('');
  const [name, setName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [district, setDistrict] = useState('');
  const [postOffice, setPostOffice] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [credentialExpiresAt, setCredentialExpiresAt] = useState('');
  const [credentialDocument, setCredentialDocument] = useState<File | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(()=>{if(organizationType!=='hospital')return;hospitalAPI.directory().then(r=>setHospitals(r.hospitals)).catch(()=>setHospitalLoadError('Could not load available hospitals. Refresh and try again.'));},[organizationType]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!/^[6-9]\d{9}$/.test(phone)) return setError('Enter a valid 10-digit Indian mobile number.');
    if (password.length < 6) return setError('Password must contain at least 6 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    if (organizationType==='hospital' && !hospitalId) return setError('Select the hospital this in-house pharmacy belongs to.');
    if (!credentialDocument || credentialDocument.size > 4 * 1024 * 1024 ||
        !['application/pdf', 'image/jpeg', 'image/png'].includes(credentialDocument.type)) {
      return setError('Upload a PDF, PNG, or JPEG registration document up to 4 MB.');
    }
    if (!credentialExpiresAt || new Date(`${credentialExpiresAt}T23:59:59`) <= new Date()) {
      return setError('The organization registration expiry must be in the future.');
    }

    setBusy(true);
    try {
      await register({
        name: managerName.trim(),
        email: email.trim(),
        password,
        phone: `+91${phone}`,
        role: 'pharmacy_manager',
        pharmacyOrganizationDetails: {
          name: name.trim(),
          organizationType,
          ...(organizationType==='hospital'?{hospitalId}:{}),
          registrationNumber: registrationNumber.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          postalCode: postalCode.trim(),
          district: district.trim(),
          postOffice: postOffice.trim(),
          openingHours: openingHours.trim(),
        },
        credentialExpiresAt,
        credentialDocument,
      });
      setSubmitted(true);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Could not submit the pharmacy organization application.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-700 dark:text-teal-300"><ShieldCheck className="h-3.5 w-3.5" />MediVault Pharmacy Network</div>
        <h1 className="text-2xl font-semibold">Register a pharmacy organization</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Apply as a hospital pharmacy, independent pharmacy, or franchise parent. A franchise parent is not listed as a dispensing location; after approval, its chain admins add and approve branches from the manager workspace.</p>
      </header>

      {submitted ? (
        <section className="surface-card space-y-3 p-6">
          <div className="flex items-center gap-2 text-base font-semibold"><FileCheck2 className="h-5 w-5 text-teal-600" />Application submitted</div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Your pharmacy organization and manager account are awaiting MediVault review. The organization will not appear in the directory or accept shared prescriptions until approved. After approval, the manager can review pharmacist membership requests.</p>
          <Link to="/pharmacy/login" className="inline-flex text-sm font-semibold text-teal-700 hover:underline dark:text-teal-300">Go to pharmacy sign in</Link>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="surface-card space-y-5 p-5 sm:p-6">
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}

          <section className="space-y-3">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold"><Building2 className="h-4 w-4" />Organization details</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium">Organization type
                <select value={organizationType} onChange={(event) => setOrganizationType(event.target.value as typeof organizationType)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
                  <option value="independent_pharmacy">Independent pharmacy</option>
                  <option value="hospital">Hospital / in-house pharmacy</option>
                  <option value="franchise">Pharmacy franchise (parent organization)</option>
                </select>
              </label>
              {organizationType==='hospital'&&<label className="text-xs font-medium">Hospital *
                <select required value={hospitalId} onChange={e=>setHospitalId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="">Select an available hospital</option>{hospitals.map(h=><option key={h.id} value={h.id}>{h.name} · {h.city}, {h.state}</option>)}</select>
                {hospitalLoadError&&<span role="alert" className="mt-1 block text-rose-700">{hospitalLoadError}</span>}{!hospitalLoadError&&!hospitals.length&&<span className="mt-1 block text-slate-500">No administrator-created hospitals are currently available.</span>}
              </label>}
              <label className="text-xs font-medium">Legal / public name *
                <input required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="text-xs font-medium">{organizationType === 'franchise' ? 'Franchise registration number *' : 'Pharmacy registration number *'}
                <input required maxLength={100} value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <PostalAddressFields className="sm:col-span-2" value={{ address, city, state, postalCode, district, postOffice }} onChange={(postal) => { setAddress(postal.address); setCity(postal.city); setState(postal.state); setPostalCode(postal.postalCode); setDistrict(postal.district); setPostOffice(postal.postOffice); }} />
              <label className="text-xs font-medium">Opening hours *
                <input required maxLength={200} placeholder="e.g. Mon–Sat, 9 am–9 pm" value={openingHours} onChange={(event) => setOpeningHours(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
            </div>
          </section>

          <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold">Organization manager account</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium">Manager name *
                <input required maxLength={100} value={managerName} onChange={(event) => setManagerName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="text-xs font-medium">Manager phone *
                <div className="mt-1 flex rounded-lg border border-slate-300 dark:border-slate-700"><span className="border-r px-3 py-2 text-sm text-slate-500">+91</span><input required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} className="min-w-0 flex-1 rounded-r-lg bg-white px-3 py-2 text-sm dark:bg-slate-950" /></div>
              </label>
              <label className="text-xs font-medium">Email *
                <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="text-xs font-medium">Password *
                <input required type="password" minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="text-xs font-medium">Confirm password *
                <input required type="password" minLength={6} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
            </div>
          </section>

          <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold">Registration document for MediVault review</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium">Document expiry date *
                <input required type="date" value={credentialExpiresAt} onChange={(event) => setCredentialExpiresAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="text-xs font-medium">Pharmacy registration document *
                <input required type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => setCredentialDocument(event.target.files?.[0])} className="mt-1 w-full text-sm" />
                <span className="mt-1 block text-[11px] text-slate-500">PDF, PNG or JPEG up to 4 MB.</span>
              </label>
            </div>
            <p className="text-xs text-slate-500">A “MediVault verified” badge means the submitted organization document was reviewed and is currently valid. It is not a guarantee of dispensing quality or clinical outcomes.</p>
          </section>

          <button type="submit" disabled={busy} className="button-primary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting application…</> : 'Apply to join the MediVault directory'}
          </button>
        </form>
      )}
      {!submitted && <p className="text-center text-sm text-slate-500">Already registered? <Link to="/pharmacy/login" className="font-semibold text-teal-700 hover:underline dark:text-teal-300">Pharmacy sign in</Link></p>}
    </main>
  );
};
