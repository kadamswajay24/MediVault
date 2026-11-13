# MediVault localhost links

Use these links while running the Vite frontend locally:

Frontend base URL: http://localhost:5173

## Public sign-in links

- [Patient sign in](http://localhost:5173/patient/login)
- [Clinical staff sign in](http://localhost:5173/clinical/login)
- [Insurance agent sign in](http://localhost:5173/insurance/login)
- [Insurer admin sign in](http://localhost:5173/insurance/admin/login)
- [Pharmacy manager sign in](http://localhost:5173/pharmacy/login)
- [Laboratory sign in](http://localhost:5173/lab/login)
- [Administrator sign in](http://localhost:5173/admin/login)
- [Hospital administrator sign in](http://localhost:5173/hospital/login)

Hospital administrators use the dedicated hospital portal. Their account must already be assigned the `hospital_admin` role by a main administrator.

## Public registration links

- [Patient registration](http://localhost:5173/patient/register)
- [Clinical staff application](http://localhost:5173/clinical/register)
- [Insurance agent application](http://localhost:5173/insurance/register)
- [Insurer company enrollment](http://localhost:5173/insurance/company/register)
- [Pharmacy organization registration](http://localhost:5173/pharmacy/register)
- [Laboratory organization registration](http://localhost:5173/lab/register)
- [Laboratory staff application](http://localhost:5173/lab/staff/register)

## Portal shortcuts

- [Portal landing page](http://localhost:5173/)
- [Legacy portal path](http://localhost:5173/portals)
- [Legacy login path](http://localhost:5173/login)
- [Legacy registration path](http://localhost:5173/register)

The legacy paths redirect to the portal landing page.

## Protected workspace links

These links require an authenticated account with the matching role:

- [Patient dashboard](http://localhost:5173/dashboard)
- [Medical records](http://localhost:5173/records)
- [Patient pharmacy sharing](http://localhost:5173/pharmacy)
- [Patient laboratory services](http://localhost:5173/labs)
- [Appointments](http://localhost:5173/appointments)
- [Patient profile](http://localhost:5173/profile)
- [Clinical staff workspace](http://localhost:5173/medical-staff)
- [Clinical appointments](http://localhost:5173/medical-staff/appointments)
- [Pharmacy manager workspace](http://localhost:5173/pharmacy/manager)
- [Laboratory manager workspace](http://localhost:5173/lab/manager)
- [Laboratory technologist workspace](http://localhost:5173/lab/workspace)
- [Hospital administration workspace](http://localhost:5173/hospital/admin)
- [Insurer company workspace](http://localhost:5173/insurance/company/admin)
- [Insurer claims queue](http://localhost:5173/claims)
- [Main administration workspace](http://localhost:5173/admin)
- [Audit logs](http://localhost:5173/audit-logs)

## Backend checks

- [API health check](http://localhost:5000/api/health)
- API base URL: `http://localhost:5000/api`

The frontend normally proxies `/api` requests during development. If the backend is configured on another port, update the frontend `VITE_API_BASE_URL` value.
