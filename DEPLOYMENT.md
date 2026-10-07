# Deploy on Render with Neon PostgreSQL

## Hosting accounts

Create free accounts on GitHub, Render, and Neon. Sign in directly on their websites; do not send account passwords or verification codes in chat.

## Repository

Upload the contents of this project folder to a private GitHub repository. `package.json` and `render.yaml` must be at the repository root. Exclude `node_modules`, SQLite database files (including `-wal` and `-shm`), `.env` files, and backups. The `.gitignore` covers these paths.

## Neon

Create an empty PostgreSQL project using the Free plan. Copy the direct (non-pooled) connection string from the Connect dialog and put it in Render's `DATABASE_URL` secret. Use the database only for this app. The app verifies TLS certificates when connecting.

## Render

Create a Blueprint from the GitHub repository to use `render.yaml`, or create a Web Service with these values:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Instance | Free |
| Build command | `npm ci --omit=dev` |
| Start command | `npm start` |
| Health check | `/healthz` |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22` |
| `TRUST_PROXY` | `1` |
| `DATABASE_URL` | Neon connection string (secret) |
| `AUTH_USERS_JSON` | JSON array of login accounts (secret) |

`AUTH_USERS_JSON` is the complete account list. See `readme.md` for the fields and password hash generation. JavaScript account entries need to be converted to valid JSON (double quotes, no trailing commas). Do not use an empty array. Keep employee IDs matched to the employee profiles in the database. The local demo accounts are not used in production.

The first start creates the PostgreSQL schema and imports the CSV seed data. Later starts leave the database data intact. The public root URL redirects to the login page. Render assigns an HTTPS URL after a successful deployment.

The deployment starts from the CSV sample data. Existing local SQLite leave requests are not uploaded or migrated automatically. If you need those records online, migrate them separately before using the deployed app.

## Later schema changes

After backing up the database and reviewing model changes, run `npm run db:migrate` from an environment with `NODE_ENV=production` and `DATABASE_URL` set. It applies CAP PostgreSQL schema evolution without reimporting seed CSVs. Normal restarts do not run schema migrations on an existing database.

## Verification after deployment

1. Open the public root URL and verify the login screen loads.
2. Sign in as an employee and submit a request.
3. Sign in as a manager and approve or reject it.
4. Sign in as the employee and verify the decision.
5. Restart the service and verify the request and decision remain stored.

## Free hosting behavior

Render's free service can sleep when idle; the next visit can take longer to load. Neon keeps the database outside Render's temporary filesystem. App sessions currently live in memory, so users sign in again after restarts. Use one app instance with this session implementation. Free services have usage quotas; do not select a paid plan if you want to stay free.

References: [Render free services](https://render.com/docs/free), [Render environment variables](https://render.com/docs/configure-environment-variables), [CAP PostgreSQL](https://cap.cloud.sap/docs/guides/databases/postgres).
