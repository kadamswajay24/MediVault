import React, { useCallback, useEffect, useState } from 'react';
import { insuranceCompanyAPI } from '../services/api';
import { PolicyPlanManager } from '../components/AdminPolicyPlans';

type HospitalOption = { id: string; name: string; city: string; state: string };
type Agent = {
  id: string; name: string; email: string; phone?: string; approvalStatus: string; isActive: boolean;
  insuranceDetails?: { agentId?: string; licenseNumber?: string };
  credentialVerification?: { status?: string; expiresAt?: string; reviewNote?: string; documentFileName?: string };
  insuranceAgentHospitals?: Array<string | HospitalOption>;
};

const initialAgentForm = { name: '', email: '', phone: '', licenseNumber: '', temporaryPassword: '' };

export const InsuranceCompanyAdminPage: React.FC = () => {
  const [company, setCompany] = useState<{ id: string; name: string } | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [agentForm, setAgentForm] = useState(initialAgentForm);
  const [newAgentHospitals, setNewAgentHospitals] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [companyResult, agentResult, hospitalResult] = await Promise.all([
        insuranceCompanyAPI.mine(), insuranceCompanyAPI.agents(), insuranceCompanyAPI.hospitals(),
      ]);
      setCompany(companyResult.company);
      setAgents(agentResult.agents);
      setHospitals(hospitalResult.hospitals);
      setAssignments((current) => {
        const next = { ...current };
        agentResult.agents.forEach((agent: Agent) => {
          if (!(agent.id in next)) next[agent.id] = (agent.insuranceAgentHospitals || []).map((hospital) => typeof hospital === 'string' ? hospital : hospital.id);
        });
        return next;
      });
    } catch (requestError: any) { setError(requestError.response?.data?.message || 'Unable to load company onboarding.'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const toggleHospital = (current: string[], hospitalId: string) => current.includes(hospitalId)
    ? current.filter((id) => id !== hospitalId)
    : [...current, hospitalId];

  const decision = async (agent: Agent, status: 'verified' | 'needs_changes' | 'rejected') => {
    const reviewNote = status === 'verified' ? '' : window.prompt(status === 'rejected' ? 'Reason for rejecting credentials:' : 'What must the applicant change?') || '';
    if (status !== 'verified' && !reviewNote.trim()) return;
    setError(''); setNotice(''); setBusy(true);
    try { const result = await insuranceCompanyAPI.reviewAgent(agent.id, status, reviewNote); setNotice(result.message); await refresh(); }
    catch (requestError: any) { setError(requestError.response?.data?.message || 'Could not save credential review.'); }
    finally { setBusy(false); }
  };

  const approve = async (agent: Agent) => {
    const selected = assignments[agent.id] || [];
    if (!selected.length) return setError('Assign at least one hospital before approving this agent.');
    setError(''); setNotice(''); setBusy(true);
    try { const result = await insuranceCompanyAPI.approveAgent(agent.id, selected); setNotice(result.message); await refresh(); }
    catch (requestError: any) { setError(requestError.response?.data?.message || 'Could not approve the agent.'); }
    finally { setBusy(false); }
  };

  const viewDocument = async (agent: Agent) => {
    try { const blob = await insuranceCompanyAPI.agentDocument(agent.id); const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener,noreferrer'); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); }
    catch { setError('Could not open this credential document.'); }
  };

  const saveAssignments = async (agent: Agent) => {
    const selected = assignments[agent.id] || [];
    if (!selected.length) return setError('Assign at least one hospital to this agent.');
    setError(''); setNotice(''); setBusy(true);
    try { const result = await insuranceCompanyAPI.updateAgentHospitals(agent.id, selected); setNotice(result.message); await refresh(); }
    catch (requestError: any) { setError(requestError.response?.data?.message || 'Could not update hospital assignments.'); }
    finally { setBusy(false); }
  };

  const createAgent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newAgentHospitals.length) return setError('Assign at least one hospital to this agent.');
    setError(''); setNotice(''); setBusy(true);
    try {
      const result = await insuranceCompanyAPI.createAgent({ ...agentForm, phone: `+91${agentForm.phone.replace(/\D/g, '').slice(-10)}`, hospitalIds: newAgentHospitals });
      setNotice(result.message); setAgentForm(initialAgentForm); setNewAgentHospitals([]); await refresh();
    } catch (requestError: any) { setError(requestError.response?.data?.message || 'Could not create the agent account.'); }
    finally { setBusy(false); }
  };

  const hospitalPicker = (value: string[], onChange: (next: string[]) => void, id: string) => (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold">Assigned hospitals *</legend>
      {hospitals.length ? <div className="grid gap-2 sm:grid-cols-2">{hospitals.map((hospital) => <label key={`${id}-${hospital.id}`} className="flex items-start gap-2 rounded-lg border p-2 text-xs dark:border-slate-700"><input type="checkbox" checked={value.includes(hospital.id)} onChange={() => onChange(toggleHospital(value, hospital.id))} /><span><strong>{hospital.name}</strong><span className="block text-slate-500">{hospital.city}, {hospital.state}</span></span></label>)}</div> : <p className="text-xs text-slate-500">No active administrator-created hospitals are available.</p>}
    </fieldset>
  );

  const pendingAgents = agents.filter((agent) => agent.approvalStatus === 'pending' || agent.credentialVerification?.status !== 'verified');
  const activeAgents = agents.filter((agent) => agent.approvalStatus === 'approved');

  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
    <header><h1 className="text-2xl font-semibold">{company?.name || 'Insurance company'} administration</h1><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Manage plans and agents for your company. Assign each agent to the hospitals they handle.</p></header>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}{notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</p>}

    <section className="surface-card space-y-4 p-5"><h2 className="text-lg font-semibold">Hire an insurance agent</h2><p className="text-sm text-slate-500">Create an account for a vetted agent and assign one or more active hospitals. The agent must change the temporary password at first sign-in.</p>
      <form onSubmit={createAgent} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(['name', 'email', 'licenseNumber', 'temporaryPassword'] as const).map((field) => <label key={field} className="text-xs font-medium">{field === 'licenseNumber' ? 'License number' : field === 'temporaryPassword' ? 'Temporary password *' : `${field[0].toUpperCase()}${field.slice(1)} *`}<input required={field !== 'licenseNumber'} type={field === 'email' ? 'email' : field === 'temporaryPassword' ? 'password' : 'text'} maxLength={field === 'name' ? 100 : field === 'licenseNumber' ? 100 : undefined} minLength={field === 'temporaryPassword' ? 8 : undefined} value={agentForm[field]} onChange={(event) => setAgentForm((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-950" /></label>)}
        </div>
        <label className="text-xs font-medium">Agent mobile number *<span className="mt-1 flex rounded-lg border dark:border-slate-700"><span className="border-r px-3 py-2 text-sm text-slate-500">+91</span><input required type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10} value={agentForm.phone} onChange={(event) => setAgentForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, '').slice(0, 10) }))} className="min-w-0 flex-1 rounded-r-lg bg-transparent px-3 py-2 text-sm" /></span></label>
        {hospitalPicker(newAgentHospitals, setNewAgentHospitals, 'new')}
        <button disabled={busy || !hospitals.length} className="button-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? 'Creating…' : 'Create agent account'}</button>
      </form>
    </section>

    <section className="surface-card space-y-4 p-5"><h2 className="text-lg font-semibold">Agent applications</h2>
      {pendingAgents.length === 0 ? <p className="text-sm text-slate-500">No agent applications need review.</p> : pendingAgents.map((agent) => {
        const credential = agent.credentialVerification || {};
        const current = credential.status === 'verified' && credential.expiresAt && new Date(credential.expiresAt) > new Date();
        const selected = assignments[agent.id] || [];
        return <article key={agent.id} className="space-y-3 rounded-lg border p-4 dark:border-slate-700"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-medium">{agent.name}</h3><p className="text-sm text-slate-500">{agent.email} · {agent.insuranceDetails?.agentId || 'ID pending'}</p><p className="mt-1 text-xs text-slate-500">Account: {agent.approvalStatus} · Credentials: {credential.status || 'pending'}{credential.expiresAt ? ` · Expires ${new Date(credential.expiresAt).toLocaleDateString('en-IN')}` : ''}</p>{credential.reviewNote && <p className="mt-1 text-xs text-amber-700">{credential.reviewNote}</p>}</div><div className="flex flex-wrap gap-2">{credential.documentFileName && <button type="button" onClick={() => void viewDocument(agent)} className="rounded border px-3 py-1.5 text-xs">View credentials</button>}{credential.status === 'pending' && <button type="button" disabled={busy} onClick={() => void decision(agent, 'verified')} className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Verify credentials</button>}{credential.status !== 'needs_changes' && <button type="button" disabled={busy} onClick={() => void decision(agent, 'needs_changes')} className="rounded border px-3 py-1.5 text-xs disabled:opacity-50">Request changes</button>}{credential.status !== 'rejected' && <button type="button" disabled={busy} onClick={() => void decision(agent, 'rejected')} className="rounded border border-rose-300 px-3 py-1.5 text-xs text-rose-700 disabled:opacity-50">Reject</button>}</div></div>
          {hospitalPicker(selected, (next) => setAssignments((current) => ({ ...current, [agent.id]: next })), agent.id)}
          {agent.approvalStatus === 'pending' && <button type="button" disabled={busy || !current || !selected.length} onClick={() => void approve(agent)} className="button-primary rounded px-3 py-1.5 text-xs disabled:opacity-50">Approve agent and assignments</button>}
        </article>;
      })}
    </section>

    <section className="surface-card space-y-4 p-5"><h2 className="text-lg font-semibold">Active agents</h2>
      {activeAgents.length ? activeAgents.map((agent) => <article key={agent.id} className="space-y-3 rounded-lg border p-4 dark:border-slate-700"><div><h3 className="font-medium">{agent.name}</h3><p className="text-sm text-slate-500">{agent.email} · {agent.insuranceDetails?.agentId || 'Agent'} · {agent.isActive ? 'Active' : 'Suspended'}</p></div>{hospitalPicker(assignments[agent.id] || [], (next) => setAssignments((current) => ({ ...current, [agent.id]: next })), agent.id)}<button type="button" disabled={busy} onClick={() => void saveAssignments(agent)} className="rounded border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Save hospital assignments</button></article>) : <p className="text-sm text-slate-500">No active agents yet.</p>}
    </section>

    <section id="plans" className="surface-card space-y-4 p-5"><h2 className="text-lg font-semibold">Marketplace plans</h2><p className="text-sm text-slate-500">Plans created here belong to {company?.name || 'your company'}. You control their publication status; agents and platform admins cannot manage them.</p><PolicyPlanManager companyName={company?.name} /></section>
  </main>;
};
