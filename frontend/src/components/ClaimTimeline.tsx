import type { InsuranceClaim } from '../types';
export function ClaimTimeline({ claim }: { claim: InsuranceClaim }) {
  const history = claim.history || [];
  const partial = !history.some(event => event.status === 'Submitted');
  const events = partial ? [{ status: 'Submitted', note: 'Claim submitted', at: claim.createdAt }, ...history] : history;
  return <details className="mt-3 min-w-48 whitespace-normal text-left text-sm">
    <summary className="cursor-pointer font-semibold text-[var(--mv-accent)]">Claim progress</summary>
    <p className="my-3 text-slate-600 dark:text-slate-300">{claim.status === 'More Information Needed' ? 'Action needed: review the insurer remarks and contact your insurer with the requested information.' : claim.status === 'Approved' ? 'Approved. Review the approved amount; approval does not confirm payment.' : claim.status === 'Rejected' ? 'Rejected. Review the insurer remarks for the decision details.' : 'Awaiting the next insurer review.'}</p>
    <ol className="space-y-3 border-l border-slate-300 pl-4 dark:border-slate-700">{events.map((entry, index) => <li key={index}>
      <p className="font-semibold">{entry.status}</p><time className="text-xs text-slate-500">{new Date(entry.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short' })}</time>
      {entry.note && <p className="break-words text-slate-600 dark:text-slate-300">{entry.note}</p>}
    </li>)}</ol>
    {partial && <p className="mt-2 text-xs text-slate-500">Earlier review history was not recorded. Current status: {claim.status}.</p>}
  </details>;
}
