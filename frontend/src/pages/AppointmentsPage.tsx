import React from 'react';
import { CalendarDays } from 'lucide-react';
import { AppointmentsPanel } from '../components/AppointmentsPanel';

export const AppointmentsPage: React.FC = () => (
  <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
    <header className="border-b border-slate-200 pb-5 dark:border-slate-800">
      <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        <CalendarDays className="h-6 w-6 text-emerald-500" />
        Appointments
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Review your schedule, manage appointment requests, and see upcoming and recent visits.
      </p>
    </header>
    <AppointmentsPanel />
  </main>
);
