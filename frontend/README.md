# MediVault frontend

React 19, TypeScript, Vite, and Tailwind CSS power the patient, clinical, insurance, and administrator portals. See the [main README](../README.md) for backend setup, roles, and feature documentation.

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
- Uploads support multiple files, editable details, per-file progress, queue duplicate warnings, and retries.
- Emergency contacts display fixed `+91` with 10 national digits and save the complete number; backend validation also enforces the format.

Keep `data/`, tests, public fonts and assets, and lockfiles in Git. Dependencies, builds, local environment files, and logs are ignored.
