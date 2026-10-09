import React from 'react';
import { ArrowRight, FileCheck2, Shield, Stethoscope } from 'lucide-react';
import { Link } from 'react-router-dom';

export const OrganizationPortalPage: React.FC = () => (
  <main className="min-h-[calc(100vh-8rem)] px-4 py-12 sm:px-6">
    <div className="mx-auto max-w-5xl">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <div className="mb-4 inline-flex rounded-2xl bg-slate-800 p-3 text-white dark:bg-slate-700">
          <Shield className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Organization access
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Sign in to the workspace that matches your organization role. Access is limited
          to approved accounts.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Stethoscope className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Medical staff</h2>
          <p className="mt-2 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            For approved clinicians and hospital staff. Patient records require a
            patient-specific, time-limited access grant.
          </p>
          <Link
            to="/clinical/login"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Clinical staff sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <FileCheck2 className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Insurance &amp; governance
          </h2>
          <p className="mt-2 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            For approved insurance claims staff and administrators managing platform
            governance.
          </p>
          <Link
            to="/insurance/login"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Insurance or admin sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-center text-[11px] text-slate-500">
            Administrator accounts are provisioned by the system owner.
          </p>
        </section>
      </div>

      <p className="mt-8 text-center text-xs text-slate-500">
        Need organization access?{' '}
        <Link to="/organization/register" className="font-semibold hover:underline">
          Submit a staff application
        </Link>
      </p>
    </div>
  </main>
);
