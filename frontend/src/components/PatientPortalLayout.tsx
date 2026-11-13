import { NotificationInbox } from './NotificationInbox';
import { MedicationReminderCenter } from './MedicationReminderCenter';
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  CalendarDays,
  FileCheck2,
  FileText,
  Heart,
  History,
  KeyRound,
  Pill,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';

const navigationSections = [
  {
    label: 'Overview',
    links: [{ label: 'Dashboard', to: '/dashboard', icon: Activity }],
  },
  {
    label: 'Health records',
    links: [
      { label: 'Medical records', to: '/records', icon: FileText },
      { label: 'Prescriptions', to: '/prescriptions', icon: Pill },
      { label: 'Pharmacy sharing', to: '/pharmacy', icon: ShieldCheck },
      { label: 'Health profile', to: '/profile', icon: Heart },
    ],
  },
  {
    label: 'Care & access',
    links: [
      { label: 'Appointments', to: '/appointments', icon: CalendarDays },
      { label: 'Caregivers & sharing', to: '/caregivers', icon: Users },
      { label: 'Access requests', to: '/access-requests', icon: KeyRound },
      { label: 'Vault activity', to: '/audit-logs', icon: History },
    ],
  },
  {
    label: 'Insurance',
    links: [
      { label: 'Claims', to: '/claims', icon: FileCheck2 },
      { label: 'Policies', to: '/policies', icon: ShieldCheck },
    ],
  },
];

export const PatientPortalLayout: React.FC = () => {
  const { user, activeDependent } = useAuth();

  if (user?.role !== 'patient') {
    return <Outlet />;
  }

  return (
    <div className="patient-portal-layout">
      <aside className="patient-sidebar" aria-label="Patient portal navigation">
        <div className="patient-sidebar__identity">
          <span className="patient-sidebar__identity-icon" aria-hidden="true">
            <UserRound className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="patient-sidebar__identity-name">{activeDependent?.name || user.name}</span>
            <span className="patient-sidebar__identity-id">{activeDependent ? "Viewing dependent" : "Your personal vault"}</span>
          </span>
        </div>

        <nav className="patient-sidebar__nav">
          {navigationSections.map((section) => (
            <div className="patient-sidebar__section" key={section.label}>
              <h2>{section.label}</h2>
              {section.links.map(({ label, to, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `patient-sidebar__link${isActive ? ' is-active' : ''}`
                  }
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="patient-portal-content">
        <div className="patient-context-strip">
          <span><strong>{activeDependent ? `${activeDependent.name}'s vault` : 'Your health, in one place'}</strong><span className="patient-context-strip__id">{activeDependent?.mediVaultId || user.mediVaultId}</span></span>
          <span className="patient-context-strip__badge">{activeDependent?.accessLevel === 'read_only' ? 'Read-only access' : activeDependent ? 'Caregiver access' : 'Personal workspace'}</span>
        </div>
        <NotificationInbox key={`notifications-${user.id}-${activeDependent?.mediVaultId || user.mediVaultId}`} />
        <MedicationReminderCenter key={`medication-reminders-${activeDependent?.mediVaultId || user.mediVaultId}`} />
        <Outlet key={activeDependent?.mediVaultId || user.mediVaultId} />
      </div>
    </div>
  );
};
