# MediVault frontend

React 19, TypeScript, Vite, and Tailwind CSS power the patient, clinical, pharmacy organization, insurance, and administrator portals. See the [main README](../README.md) for backend setup, roles, and feature documentation.

## Local development

From this directory:

```bash
npm ci
npm run dev
```

Vite uses port 5173 and proxies `/api` to `http://localhost:5000`. Set `VITE_API_BASE_URL=/api` in a local `.env` and start the backend separately. Do not put secrets in `VITE_` variables; they are exposed to the browser.

## Checks

```bash
npm test
npm run build
npm run lint
```

The build checks TypeScript and creates `dist/`. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

## Interface conventions

- Use self-hosted Source Sans 3 for all app text, including IDs and numbers.
- Reuse theme variables in `src/index.css`. Light mode uses burgundy accents and white cards on cool grey. Scope light-only rules with `:root:not(.dark)`.
- Dashboard attention follows patient context. Ongoing profile medications are separate from prescription history.
- Pharmacy organizations may be hospitals, independent pharmacies, or franchise chains. Chain parents require platform admin approval; chain admins add and approve their own locations and manage pharmacist membership. Insurers can also self-enroll and require platform admin approval; company admins manage agents in their own insurer. The initial enrollment admin keeps their chosen password; additional admins created by the platform admin must change a temporary password at first login. Directory visibility means registration documents were reviewed and are currently valid, not a guarantee of service quality or outcomes. Patients may share one digital prescription with a verified directory organization or via a 24-hour code. Pharmacists can append dispense records but cannot edit prescriptions or access other patient records; caregiver sharing and uploaded prescription files are not included.
- Uploads support multiple files, editable details, per-file progress, queue duplicate warnings, and retries.
- The full-page record viewer embeds PDFs and supported images in the app, rechecks record access every 10 seconds, and clears the active preview when access cannot be confirmed. It cannot revoke copies already saved or captured.
- Emergency contacts display fixed `+91` with 10 national digits and save the complete number; backend validation also enforces the format.
- Physician and nurse registration requires selecting an active hospital created by an administrator. Hospital laboratory and hospital pharmacy applications use the same directory; independent organizations do not need a hospital selection. The server links clinical staff to the selected hospital record.
- The chief administrator creates hospitals and dedicated hospital-admin accounts through Hospital Administration. Hospital administrator phone numbers use the `+91` prefix and a validated 10-digit Indian mobile number. Hospital administrators review credentials and approve physicians and nurses assigned to their hospital; those applications do not appear in the chief administrator's user directory. Their workspace lists active staff with approved accounts and current verified credentials. The new hospital administrator must change the temporary password at first login.
- Insurers and pharmacy/laboratory franchise parents can self-enroll and remain inactive until chief-admin approval. The first applicant retains their chosen password. Indian mobile forms collect exactly 10 digits with a fixed `+91` prefix; the server normalizes and validates the number too. Credential dates are validated as calendar dates and remain valid through the selected date in India Standard Time. Chief admins can provision additional organization admins with temporary passwords; those admins must change the password at first sign-in. Insurer admins review their own agents, and chain admins add and approve franchise locations and manage staff for their organization.
- Insurer admins alone manage marketplace plans for their own company. They can create agents or approve self-applicants, assign each agent to one or more active hospitals, and update those assignments. Agents can review only claims for their assigned hospitals and insurer; unassigned-hospital claims remain in the insurer-admin queue. Patients still browse published plans.
- Claim amount, payout, and supplemental-payment forms accept finite values with at most two decimal places; the server checks ranges, record ownership, date order, and text limits before saving.
- Address forms use a shared India PIN lookup for hospital, insurer, pharmacy, laboratory, and franchise branch registration. Patients can add an optional address during registration and update it from My Profile. The backend proxies the community PostalPincode lookup service, caches successful results for 12 hours, and limits lookups to 60 per IP per minute. The lookup can be unavailable, so users can still enter address details manually. The selected post office, city/locality, district, state, and PIN are saved with the organization or patient profile.

Keep `data/`, tests, public fonts and assets, and lockfiles in Git. Dependencies, builds, local environment files, and logs are ignored.
