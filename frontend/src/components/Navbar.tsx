import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  FileText,
  Activity,
  User,
  History,
  LogOut,
  Menu,
  X,
  Plus,
  Sun,
  Moon,
  FileCheck2,
  Pill,
  Users,
  Heart,
  Stethoscope,
  Shield,
  ArrowRightLeft,
  XCircle,
  KeyRound,
  ChevronDown,
  CalendarDays,
  Building2,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';

interface NavbarProps {
  onOpenUpload?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenUpload }) => {
  const { user, logout, isAuthenticated, activeDependent, setActiveDependent } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openNavGroup, setOpenNavGroup] = useState<string | null>(null);
  const isRegistrationPage = location.pathname.endsWith('/register');
  const isLoginPage = location.pathname.endsWith('/login');
  const isPortalHome = location.pathname === '/';
  const guestPortal = location.pathname.startsWith('/lab/')
    ? {
        signInPath: '/lab/login',
        signInLabel: 'Laboratory Sign In',
        secondary: isRegistrationPage ? null : { path: '/lab/register', label: 'Register laboratory' },
      }
    : location.pathname.startsWith('/clinical/')
    ? {
        signInPath: '/clinical/login',
        signInLabel: 'Clinical Sign In',
        secondary: isRegistrationPage ? null : { path: '/clinical/register', label: 'Apply' },
      }
    : location.pathname.startsWith('/pharmacy/')
      ? {
          signInPath: '/pharmacy/login',
          signInLabel: 'Pharmacy Sign In',
          secondary: isRegistrationPage ? null : { path: '/pharmacy/register', label: 'Register pharmacy' },
        }
      : location.pathname.startsWith('/insurance/')
      ? {
          signInPath: '/insurance/login',
          signInLabel: 'Insurance Sign In',
          secondary: isRegistrationPage ? null : { path: '/insurance/register', label: 'Apply' },
        }
      : location.pathname.startsWith('/admin/')
        ? {
            signInPath: '/admin/login',
            signInLabel: 'Admin Sign In',
            secondary: { path: '/', label: 'Home' },
          }
        : {
            signInPath: '/patient/login',
            signInLabel: 'Sign In',
            secondary: isRegistrationPage ? null : { path: '/patient/register', label: 'Create account' },
          };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Keep patient navigation focused by grouping related destinations under a few clear headings.
  const getNavItems = () => {
    if (!user) return { primary: [], groups: [] };

    switch (user.role) {
      case 'insurance_agent':
        return {
          primary: [
            { name: 'Claims Queue', path: '/claims', icon: FileCheck2 },
            { name: 'Audit Trail', path: '/audit-logs', icon: History },
            { name: 'My Profile', path: '/profile', icon: User },
          ],
          groups: [],
        };
      case 'insurer_admin':
        return {
          primary: [
            { name: 'Company workspace', path: '/insurance/company/admin', icon: Users },
            { name: 'Claims Queue', path: '/claims', icon: FileCheck2 },
            { name: 'Marketplace Plans', path: '/insurance/company/admin#plans', icon: ShieldCheck },
            { name: 'Audit Trail', path: '/audit-logs', icon: History },
            { name: 'My Profile', path: '/profile', icon: User },
          ],
          groups: [],
        };
      case 'pharmacy_manager':
      case 'pharmacy_chain_admin':
        return {
          primary: [
            { name: 'Organization', path: '/pharmacy/manager', icon: Building2 },
            { name: 'Audit Trail', path: '/audit-logs', icon: History },
            { name: 'My Profile', path: '/profile', icon: User },
          ],
          groups: [],
        };
      case 'lab_manager':
      case 'lab_chain_admin':
        return {
          primary: [
            { name: 'Laboratory', path: '/lab/manager', icon: Building2 },
            { name: 'Audit Trail', path: '/audit-logs', icon: History },
            { name: 'My Profile', path: '/profile', icon: User },
          ],
          groups: [],
        };
      case 'medical_staff':
        if (user.medicalStaffDetails?.professionalType === 'lab_technologist') {
          return {
            primary: [
              { name: 'Laboratory', path: '/lab/workspace', icon: Building2 },
              { name: 'Audit Trail', path: '/audit-logs', icon: History },
              { name: 'My Profile', path: '/profile', icon: User },
            ],
            groups: [],
          };
        }
        if (user.medicalStaffDetails?.professionalType === 'pharmacist') {
          return {
            primary: [
              { name: 'Pharmacy', path: '/pharmacy', icon: Pill },
              { name: 'Audit Trail', path: '/audit-logs', icon: History },
              { name: 'My Profile', path: '/profile', icon: User },
            ],
            groups: [],
          };
        }
        if (user.medicalStaffDetails?.professionalType === 'nurse' || user.medicalStaffDetails?.specialization?.toLowerCase() === 'nursing') {
          return {
            primary: [
              { name: 'Nursing care', path: '/medical-staff', icon: Heart },
              { name: 'Audit Trail', path: '/audit-logs', icon: History },
              { name: 'My Profile', path: '/profile', icon: User },
            ],
            groups: [],
          };
        }
        return {
          primary: [
            { name: 'Clinical Consultations', path: '/medical-staff', icon: Stethoscope },
            { name: 'Appointments', path: '/medical-staff/appointments', icon: CalendarDays },
            { name: 'Patient Access', path: '/access-requests', icon: KeyRound },
            { name: 'Audit Trail', path: '/audit-logs', icon: History },
            { name: 'My Profile', path: '/profile', icon: User },
          ],
          groups: [],
        };
      case 'admin':
        return {
          primary: [
            { name: 'Governance', path: '/admin', icon: Shield },
            { name: 'Hospitals', path: '/hospital/admin', icon: Building2 },
            { name: 'Access Requests', path: '/access-requests', icon: KeyRound },
            { name: 'Audit Trail', path: '/audit-logs', icon: History },
            { name: 'My Profile', path: '/profile', icon: User },
          ],
          groups: [],
        };
      case 'hospital_admin':
        return { primary: [{ name: 'Hospital', path: '/hospital/admin', icon: Building2 }, { name: 'Audit Trail', path: '/audit-logs', icon: History }, { name: 'My Profile', path: '/profile', icon: User }], groups: [] };
      case 'patient':
      default:
        return {
          primary: [
            { name: 'Dashboard', path: '/dashboard', icon: Activity },
          ],
          groups: [
            {
              name: 'My Health',
              icon: Heart,
              items: [
                { name: 'Medical Records', path: '/records', icon: FileText },
                { name: 'Prescriptions', path: '/prescriptions', icon: Pill },
                { name: 'Pharmacy sharing', path: '/pharmacy', icon: ShieldCheck },
                { name: 'Laboratory services', path: '/labs', icon: Building2 },
                { name: 'Health Profile', path: '/profile', icon: User },
              ],
            },
            {
              name: 'Insurance',
              icon: ShieldCheck,
              items: [
                { name: 'Insurance Claims', path: '/claims', icon: FileCheck2 },
                { name: 'My Policies', path: '/policies', icon: ShieldCheck },
              ],
            },
            {
              name: 'Care & Access',
              icon: Users,
              items: [
                { name: 'Appointments', path: '/appointments', icon: CalendarDays },
                { name: 'Caregivers', path: '/caregivers', icon: Users },
                { name: 'Access Approvals', path: '/access-requests', icon: KeyRound },
                { name: 'Vault activity', path: '/audit-logs', icon: History },
              ],
            },
          ],
        };
    }
  };

  const navItems = getNavItems();
  const primaryNavItems = navItems.primary;
  const navGroups = navItems.groups;

  const getRoleBadge = (role?: string, professionalType?: string) => {
    switch (role) {
      case 'admin':
        return { label: 'Admin', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' };
      case 'hospital_admin':
        return { label: 'Hospital Admin', color: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20' };
      case 'medical_staff':
        return professionalType === 'pharmacist'
          ? { label: 'Pharmacist', color: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20' }
          : { label: 'Clinician', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
      case 'pharmacy_manager':
        return { label: 'Pharmacy manager', color: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20' };
      case 'insurance_agent':
        return { label: 'Adjuster', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
      case 'patient':
      default:
        return { label: 'Patient', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    }
  };

  const roleBadge = getRoleBadge(user?.role, user?.medicalStaffDetails?.professionalType);

  return (
    <header className="app-header sticky top-0 z-40 w-full border-b backdrop-blur-md">
      {/* Top dependent switcher alert bar if proxy is active */}
      {activeDependent && (
        <div className="bg-teal-700 text-white px-4 py-1.5 text-xs flex items-center justify-between font-medium">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Active Dependent Vault: <strong>{activeDependent.name}</strong> ({activeDependent.relationship} • {activeDependent.accessLevel})
            </span>
            <button
              onClick={() => setActiveDependent(null)}
              className="underline hover:opacity-80 flex items-center gap-1 text-[11px]"
            >
              <XCircle className="w-3.5 h-3.5" />
              Switch back to my vault
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link
            to={
              !isAuthenticated
                ? '/'
                : user?.role === 'admin'
                ? '/admin'
                : user?.role === 'hospital_admin'
                ? '/hospital/admin'
                : user?.role === 'insurance_agent'
                ? '/claims'
                : user?.role === 'insurer_admin'
                ? '/insurance/company/admin'
                : user?.role === 'medical_staff'
                ? user.medicalStaffDetails?.professionalType === 'pharmacist'
                  ? '/pharmacy'
                  : '/medical-staff'
                : user?.role === 'pharmacy_manager'
                ? '/pharmacy/manager'
                : '/dashboard'
            }
            className="flex items-center gap-2 group"
          >
            <img
              src="/medivault-icon.svg"
              alt=""
              aria-hidden="true"
              width="40"
              height="40"
              className="shrink-0 dark:hidden"
            />
            <img
              src="/medivault-logo.svg"
              alt="MediVault"
              width="172"
              height="40"
              className="hidden h-10 w-auto dark:block"
            />
            <span className="brand-wordmark text-base font-bold tracking-tight text-slate-900 dark:hidden">
              Medi<span className="text-[#914B54]">Vault</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          {isAuthenticated && user?.role !== 'patient' && (
            <nav className="hidden lg:flex items-center gap-1">
              {primaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                    {item.name}
                  </Link>
                );
              })}

              {navGroups.map((group) => {
                const GroupIcon = group.icon;
                const isGroupActive = group.items.some((item) => location.pathname === item.path);
                const isOpen = openNavGroup === group.name;

                return (
                  <div key={group.name} className="relative">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenNavGroup(isOpen ? null : group.name)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        isGroupActive
                          ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <GroupIcon className="h-3.5 w-3.5 text-slate-400" />
                      {group.name}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isOpen && (
                      <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-950">
                        {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setOpenNavGroup(null)}
                            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold ${
                              isActive
                                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5 text-slate-400" />
                            {item.name}
                          </Link>
                        );
                      })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2.5">
          {/* Theme Switcher Toggle */}
          <button
            onClick={toggleTheme}
            id="theme-toggle-btn"
            title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {isAuthenticated ? (
            <>
              {onOpenUpload && user?.role === 'patient' && activeDependent?.accessLevel !== 'read_only' && (
                <button
                  onClick={onOpenUpload}
                  className="button-primary flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Upload Record</span>
                </button>
              )}

              {/* User Pill */}
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                <div className="flex flex-col text-right">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-xs font-bold text-slate-900 dark:text-white max-w-[120px] truncate">
                      {user?.name}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded border uppercase font-bold ${roleBadge.color}`}
                    >
                      {roleBadge.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 truncate max-w-[140px]" title="Your MediVault ID">
                    ID: {user?.mediVaultId}
                  </span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                id="nav-logout-btn"
                title="Log Out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
              >
                <LogOut className="w-4 h-4" />
              </button>

              {/* Mobile Menu */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={mobileMenuOpen}
                className="lg:hidden p-1.5 text-slate-600 dark:text-slate-400"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              {!isLoginPage && !isPortalHome && (
                <Link
                  to={guestPortal.signInPath}
                  className="px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900"
                >
                  {guestPortal.signInLabel}
                </Link>
              )}
              {!isPortalHome && guestPortal.secondary && (
                <Link
                  to={guestPortal.secondary.path}
                  className="button-primary px-3 py-1.5 rounded-lg font-semibold"
                >
                  {guestPortal.secondary.label}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && isAuthenticated && (
        <div className="lg:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 space-y-1">
          <p className="px-3 py-2 text-xs text-slate-500">
            Your MediVault ID: <span className="font-semibold text-slate-700 dark:text-slate-300">{user?.mediVaultId}</span>
          </p>

          <div className="space-y-1">
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold ${
                    isActive
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4 text-slate-400" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {navGroups.map((group) => {
            const GroupIcon = group.icon;
            const isGroupActive = group.items.some((item) => location.pathname === item.path);
            const isOpen = openNavGroup === group.name;

            return (
              <div key={group.name} className="border-t border-slate-200 pt-1 dark:border-slate-800">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenNavGroup(isOpen ? null : group.name)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold ${
                    isGroupActive
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <GroupIcon className="h-4 w-4 text-slate-400" />
                    {group.name}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="ml-5 border-l border-slate-200 pl-2 dark:border-slate-800">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => {
                            setMobileMenuOpen(false);
                            setOpenNavGroup(null);
                          }}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold ${
                            isActive
                              ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <Icon className="h-4 w-4 text-slate-400" />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </header>
  );
};
