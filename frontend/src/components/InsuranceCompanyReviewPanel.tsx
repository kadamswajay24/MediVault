import React, { useCallback, useEffect, useState } from 'react';
import { adminAPI } from '../services/api';

export const InsuranceCompanyReviewPanel: React.FC = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [admins, setAdmins] = useState<Record<string,{name:string;email:string;phone:string;temporaryPassword:string}>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    try { const result = await adminAPI.getInsuranceCompanies(); setCompanies(result.companies); }
    catch (requestError: any) { setError(requestError.response?.data?.message || 'Could not load insurer applications.'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const review = async (company: any, decision: 'verified'|'rejected') => {
    const reviewNote = decision === 'verified' ? '' : notes[company.id] || '';
    if (decision !== 'verified' && !reviewNote.trim()) return setError('Add a note before rejecting an insurer.');
    setError('');
    try { const result = await adminAPI.reviewInsuranceCompany(company.id,decision,reviewNote); setNotice(result.message); await refresh(); }
    catch (requestError: any) { setError(requestError.response?.data?.message || 'Could not save insurer review.'); }
  };
  const openDocument = async (company: any) => {
    try { const blob = await adminAPI.insuranceCompanyDocument(company.id); const url = URL.createObjectURL(blob); window.open(url,'_blank','noopener,noreferrer'); window.setTimeout(() => URL.revokeObjectURL(url),60_000); }
    catch { setError('Could not open company registration document.'); }
  };
  const createAdmin = async (company: any) => {
    const form = admins[company.id] || {name:'',email:'',phone:'',temporaryPassword:''};
    if (!form.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || !/^[6-9]\d{9}$/.test(form.phone) || form.temporaryPassword.length < 8) {
      setError('Enter an admin name, valid email, 10-digit Indian mobile number, and temporary password of at least 8 characters.');
      return;
    }
    setError('');
    try { const result = await adminAPI.createInsuranceCompanyAdmin(company.id,{...form,phone:`+91${form.phone}`}); setNotice(result.message); setAdmins((current) => ({...current,[company.id]:{name:'',email:'',phone:'',temporaryPassword:''}})); }
    catch (requestError: any) { setError(requestError.response?.data?.message || 'Could not create company admin.'); }
  };
  return <section className="space-y-4">
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
    {companies.length ? companies.map((company) => <article key={company.id} className="surface-card space-y-3 p-5">
      <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">{company.name}</h2><p className="text-sm text-slate-500">{company.registrationNumber} · {company.city}, {company.state}</p><p className="text-xs text-slate-500">Initial admin: {company.owner?.name} · {company.owner?.email} · Status: {company.verification?.status}</p>{company.verification?.reviewNote && <p className="mt-1 text-xs text-amber-700">{company.verification.reviewNote}</p>}</div><button type="button" onClick={() => void openDocument(company)} className="h-fit rounded border px-3 py-1.5 text-xs">View registration</button></div>
      {company.verification?.status === 'pending' && <><label className="block text-xs">Review note (required to reject)<input value={notes[company.id] || ''} onChange={(event) => setNotes((current) => ({...current,[company.id]:event.target.value}))} className="mt-1 w-full rounded border p-2" /></label><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void review(company,'verified')} className="rounded bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">Approve enrollment</button><button type="button" onClick={() => void review(company,'rejected')} className="rounded border border-rose-300 px-3 py-2 text-xs text-rose-700">Reject</button></div></>}
      {company.verification?.status === 'verified' && <details><summary className="cursor-pointer text-sm font-semibold">Provision another company admin</summary><p className="mt-2 text-xs text-slate-500">They must change this temporary password when they first sign in.</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><input required maxLength={100} placeholder="Admin name" value={(admins[company.id] || {name:'',email:'',phone:'',temporaryPassword:''}).name} onChange={(event) => setAdmins((current) => ({...current,[company.id]:{...(current[company.id] || {name:'',email:'',phone:'',temporaryPassword:''}),name:event.target.value}}))} className="rounded border p-2 text-sm" /><input required type="email" maxLength={254} placeholder="Email" value={(admins[company.id] || {name:'',email:'',phone:'',temporaryPassword:''}).email} onChange={(event) => setAdmins((current) => ({...current,[company.id]:{...(current[company.id] || {name:'',email:'',phone:'',temporaryPassword:''}),email:event.target.value}}))} className="rounded border p-2 text-sm" /><label className="flex items-center rounded border dark:border-slate-700"><span className="border-r px-2 py-2 text-xs text-slate-500">+91</span><input required type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10-digit mobile number" value={(admins[company.id] || {name:'',email:'',phone:'',temporaryPassword:''}).phone} onChange={(event) => setAdmins((current) => ({...current,[company.id]:{...(current[company.id] || {name:'',email:'',phone:'',temporaryPassword:''}),phone:event.target.value.replace(/\D/g,'').slice(0,10)}}))} className="min-w-0 flex-1 bg-transparent p-2 text-sm" /></label><input required minLength={8} type="password" placeholder="Temporary password (8+ characters)" value={(admins[company.id] || {name:'',email:'',phone:'',temporaryPassword:''}).temporaryPassword} onChange={(event) => setAdmins((current) => ({...current,[company.id]:{...(current[company.id] || {name:'',email:'',phone:'',temporaryPassword:''}),temporaryPassword:event.target.value}}))} className="rounded border p-2 text-sm" /></div><button type="button" onClick={() => void createAdmin(company)} className="button-primary mt-2 rounded px-3 py-2 text-xs">Create admin</button></details>}
    </article>) : <div className="surface-card p-8 text-center text-sm text-slate-500">No insurer enrollment applications.</div>}
  </section>;
};
