import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ClipboardList,
  FileText,
  Pill,
  ShieldCheck,
} from 'lucide-react';

const sampleRecords = [
  {
    icon: FileText,
    title: 'Blood test report',
    detail: 'Lab report · PDF',
  },
  {
    icon: Pill,
    title: 'Prescription',
    detail: 'Medication instructions',
  },
  {
    icon: ClipboardList,
    title: 'Visit summary',
    detail: 'Clinical notes · PDF',
  },
];

export const PatientLandingPage: React.FC = () => (
  <main className="portal-home">
    <div className="portal-home__wrap">
      <section className="portal-home__hero" aria-labelledby="portal-home-title">
        <div className="portal-home__intro">
          <div className="portal-home__eyebrow">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Patient portal
          </div>
          <h1 id="portal-home-title">Your health records, care details, and access.</h1>
          <p className="portal-home__description">
            Keep reports and prescriptions together, update key health details, and review who
            can access your records.
          </p>
          <div className="portal-home__actions">
            <Link to="/patient/login" className="button-primary portal-home__primary">
              Sign in
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link to="/patient/register" className="portal-home__secondary">
              Create account
            </Link>
          </div>
          <p className="portal-home__privacy">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Your records are available after sign-in.
          </p>
        </div>

        <section className="portal-home__overview" aria-labelledby="portal-overview-title">
          <div className="portal-preview">
            <div className="portal-preview__topbar">
              <span className="portal-preview__wordmark">
                <img
                  src="/medivault-icon.svg"
                  alt=""
                  aria-hidden="true"
                  width="28"
                  height="28"
                  className="portal-preview__mark"
                />
                MediVault
              </span>
              <span className="portal-preview__sample-label">Sample workspace</span>
            </div>

            <div className="portal-preview__content">
              <div className="portal-preview__heading">
                <div>
                  <p className="portal-preview__eyebrow">Patient portal</p>
                  <h2 id="portal-overview-title">Health records</h2>
                </div>
                <span className="portal-preview__count">3 examples</span>
              </div>

              <ul className="portal-preview__records" aria-label="Illustrative sample records">
                {sampleRecords.map(({ icon: Icon, title, detail }) => (
                  <li key={title}>
                    <span className="portal-preview__record-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span className="portal-preview__record-copy">
                      <strong>{title}</strong>
                      <span>{detail}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="portal-preview__access">
                <span className="portal-preview__access-icon" aria-hidden="true">
                  <ShieldCheck />
                </span>
                <span>
                  <strong>Record access</strong>
                  <span>Review requests and caregiver permissions</span>
                </span>
              </div>
            </div>
          </div>
          <p className="portal-preview__caption">
            Example content only. No patient information is shown.
          </p>
        </section>
      </section>

      <section className="portal-home__support" aria-label="MediVault portal access">
        <nav className="portal-home__professional" aria-label="Professional portals">
          <span>Professional portals</span>
          <Link to="/clinical/login">Medical staff</Link>
          <Link to="/insurance/login">Insurance</Link>
          <Link to="/admin/login">Administrator</Link>
        </nav>
      </section>
    </div>
  </main>
);
