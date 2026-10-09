import React from 'react';
import { ArrowRight, FileText, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PatientLandingPage: React.FC = () => (
  <main className="min-h-[calc(100vh-8rem)] px-4 py-12 sm:px-6">
    <div className="mx-auto grid min-h-[60vh] max-w-6xl items-center gap-10 lg:grid-cols-2">
      <section className="max-w-xl">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <ShieldCheck className="h-4 w-4" />
          Your personal health vault
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
          Your health records, in your hands.
        </h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 dark:text-slate-400">
          Keep your medical records organized, manage your health profile, and decide when
          approved care teams can access your information.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/patient/login"
            className="button-primary inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold shadow-sm"
          >
            Sign in to your account
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/patient/register"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Create a patient account
          </Link>
        </div>
      </section>

      <section className="grid items-stretch gap-4 sm:grid-cols-2" aria-label="Patient portal features">
        <article className="surface-card flex min-h-44 flex-col p-6">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <FileText className="h-5 w-5" />
          </div>
          <h2 className="font-semibold text-slate-900 dark:text-white">One organized record</h2>
          <p className="mt-2 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Store and find your reports, prescriptions, and medical history.
          </p>
        </article>
        <article className="surface-card flex min-h-44 flex-col p-6">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <UserRound className="h-5 w-5" />
          </div>
          <h2 className="font-semibold text-slate-900 dark:text-white">You control access</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Review requests and grant care teams access for a defined period.
          </p>
        </article>
      </section>
    </div>
  </main>
);
