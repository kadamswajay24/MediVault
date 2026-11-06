import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Building2, Info, Loader2, MapPin, Search, ShieldCheck } from 'lucide-react';
import { appointmentsAPI } from '../services/api';

type Hospital = Awaited<ReturnType<typeof appointmentsAPI.getHospitals>>['hospitals'][number];

export const CashlessHospitalFinder: React.FC = () => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHospitals = async () => {
    try {
      const response = await appointmentsAPI.getHospitals();
      setHospitals(response.hospitals);
    } catch (requestError: unknown) {
      const message = (
        requestError as { response?: { data?: { message?: string } } }
      ).response?.data?.message;
      setError(message || 'Unable to load MediVault-associated hospitals.');
    } finally {
      setLoading(false);
    }
  };

  const retryLoadingHospitals = () => {
    setLoading(true);
    setError(null);
    void loadHospitals();
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHospitals();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredHospitals = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return hospitals;
    return hospitals.filter((hospital) =>
      [
        hospital.name,
        ...hospital.doctors.flatMap((doctor) => [doctor.name, doctor.specialization]),
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query)
    );
  }, [hospitals, search]);

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-slate-200 p-5 dark:border-slate-800">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            <MapPin className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                MediVault cashless facilities
              </h2>
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                Network
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Hospitals associated with active, approved MediVault clinicians.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Search hospitals or specialties
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={100}
              placeholder="Search hospital, doctor, or specialty"
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </span>
        </label>

        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              MediVault-associated hospitals are intended to support cashless claims for eligible
              MediVault insurance members. Actual cashless availability depends on an active policy,
              claim authorization, and the facility&apos;s participation. Current enrollments in this
              app are demos and do not provide real coverage.
            </span>
          </p>
        </div>

        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </span>
            <button type="button" onClick={retryLoadingHospitals} className="shrink-0 font-semibold underline">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500" role="status">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading MediVault hospitals...
          </div>
        ) : !error && filteredHospitals.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-950/50">
            <Building2 className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              {hospitals.length ? 'No matching hospitals' : 'No associated hospitals listed yet'}
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {hospitals.length
                ? 'Try another hospital name or specialty.'
                : 'Hospitals appear here when active, approved MediVault clinicians are affiliated with them.'}
            </p>
          </div>
        ) : !error ? (
          <div className="grid gap-3 md:grid-cols-2">
            {filteredHospitals.map((hospital) => (
              <article
                key={hospital.name.toLocaleLowerCase()}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{hospital.name}</h3>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    MediVault network
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  {hospital.doctors.length} associated clinician{hospital.doctors.length === 1 ? '' : 's'}
                </p>
                <ul className="mt-2 space-y-1">
                  {hospital.doctors.slice(0, 3).map((doctor) => (
                    <li key={doctor.id} className="text-xs text-slate-700 dark:text-slate-300">
                      {doctor.name}
                      {doctor.specialization ? ` · ${doctor.specialization}` : ''}
                    </li>
                  ))}
                  {hospital.doctors.length > 3 && (
                    <li className="text-xs text-slate-500">
                      and {hospital.doctors.length - 3} more
                    </li>
                  )}
                </ul>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
};
