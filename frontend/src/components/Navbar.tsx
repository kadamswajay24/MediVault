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
  Users,
  Stethoscope,
  Shield,
  ArrowRightLeft,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  onOpenUpload?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenUpload }) => {
  const { user, logout, isAuthenticated, activeDependent, setActiveDependent } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Determine role-specific nav items
  const getNavItems = () => {
    if (!user) return [];

    switch (user.role) {
      case 'insurance_agent':
        return [
          { name: 'Claims Queue', path: '/claims', icon: FileCheck2 },
          { name: 'Audit Trail', path: '/audit-logs', icon: History },
        ];
      case 'medical_staff':
        return [
          { name: 'Clinical Consultations', path: '/medical-staff', icon: Stethoscope },
          { name: 'Audit Trail', path: '/audit-logs', icon: History },
        ];
      case 'admin':
        return [
          { name: 'Governance', path: '/admin', icon: Shield },
          { name: 'Claims', path: '/claims', icon: FileCheck2 },
          { name: 'Clinical Care', path: '/medical-staff', icon: Stethoscope },
          { name: 'Records Hub', path: '/records', icon: FileText },
          { name: 'Audit Trail', path: '/audit-logs', icon: History },
        ];
      case 'patient':
      default:
        return [
          { name: 'Dashboard', path: '/dashboard', icon: Activity },
          { name: 'Medical Records', path: '/records', icon: FileText },
          { name: 'Insurance Claims', path: '/claims', icon: FileCheck2 },
          { name: 'Caregivers', path: '/caregivers', icon: Users },
          { name: 'Health Profile', path: '/profile', icon: User },
          { name: 'Audit Trail', path: '/audit-logs', icon: History },
        ];
    }
  };

  const navItems = getNavItems();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return { label: 'Admin', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' };
      case 'medical_staff':
        return { label: 'Clinician', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
      case 'insurance_agent':
        return { label: 'Adjuster', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
      case 'patient':
      default:
        return { label: 'Patient', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    }
  };

  const roleBadge = getRoleBadge(user?.role);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
      {/* Top dependent switcher alert bar if proxy is active */}
      {activeDependent && (
        <div className="bg-teal-600 text-white px-4 py-1.5 text-xs flex items-center justify-between font-medium">
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
              user?.role === 'admin'
                ? '/admin'
                : user?.role === 'insurance_agent'
                ? '/claims'
                : user?.role === 'medical_staff'
                ? '/medical-staff'
                : '/dashboard'
            }
            className="flex items-center gap-2 group"
          >
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm">
              <ShieldCheck className="w-4 h-4 stroke-[2.4]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Medi<span className="text-emerald-600 dark:text-emerald-400">Vault</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">2.0</span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          {isAuthenticated && (
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
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
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {isAuthenticated ? (
            <>
              {onOpenUpload && user?.role === 'patient' && (
                <button
                  onClick={onOpenUpload}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm"
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
                      className={`text-[9px] px-1.5 py-0.2 rounded border font-mono uppercase font-bold ${roleBadge.color}`}
                    >
                      {roleBadge.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                    {user?.email}
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
                className="lg:hidden p-1.5 text-slate-600 dark:text-slate-400"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <Link
                to="/login"
                className="px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-3 py-1.5 rounded-lg font-semibold bg-emerald-600 text-white hover:bg-emerald-500"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && isAuthenticated && (
        <div className="lg:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 space-y-1">
          {navItems.map((item) => {
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
      )}
    </header>
  );
};
