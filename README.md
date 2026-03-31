# HR Performance Suite

HR Performance Suite is a Vite single-page app backed by an Express session API and a MySQL database.

## Stack

- Frontend: Vanilla JavaScript, Bootstrap 5, Chart.js, jsPDF, ExcelJS
- Backend: Express.js
- Database: MySQL / MariaDB
- Hosting target: Hostinger Node.js app hosting for the backend and Hostinger static/FTP hosting for the frontend

## Project Layout

- `src/`: browser application
- `server/app.js`: Express API and optional static file host
- `server/tableMeta.js`: table metadata for the query layer
- `mysql-setup.sql`: MySQL schema bootstrap
- `mysql-demo-seed.sql`: demo dataset bootstrap
- `scripts/package-backend.ps1`: builds the backend upload bundle and ZIP
- `.github/workflows/deploy-hostinger.yml`: frontend deploy workflow

## Environment Variables

Frontend build/runtime:

- `VITE_API_BASE_URL`
- `VITE_API_PROXY_TARGET`
- `VITE_SESSION_TIMEOUT_MINUTES`
- `VITE_MONITOR_WEBHOOK_URL`
- `VITE_SENTRY_DSN`

Backend runtime:

- `PORT`
- `SESSION_SECRET`
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `CORS_ALLOWED_ORIGINS`
- `SESSION_COOKIE_DOMAIN`
- `SESSION_COOKIE_SAME_SITE`
- `SESSION_COOKIE_SECURE`

Copy [.env.example](D:/web/demo-kpi/.env.example) to `.env` for local development.

## Local Development

1. Install dependencies.

```bash
npm install
```

2. Create the MySQL schema.

```sql
SOURCE mysql-setup.sql;
```

3. Load demo data if needed.

```sql
SOURCE mysql-demo-seed.sql;
```

4. Start the backend.

```bash
npm run dev:server
```

5. Start the frontend.

```bash
npm run dev
```

Vite runs on `http://127.0.0.1:5173` and proxies `/api` to `http://127.0.0.1:3000`.

## Demo Seed

Seeded demo logins:

- `admin.demo@xenos.local`
- `hr.demo@xenos.local`
- `director.demo@xenos.local`
- `manager.demo@xenos.local`
- `farhan.demo@xenos.local`
- `nadia.demo@xenos.local`
- `kevin.demo@xenos.local`

Shared demo password: `Demo123!`

## Deploying to Hostinger

**For Hostinger Node.js Web Apps deployment, see [DEPLOY-HOSTINGER.md](DEPLOY-HOSTINGER.md) or [QUICK-START.md](QUICK-START.md)**

The recommended deployment method is to use Hostinger's native Git integration:

1. Push code to GitHub
2. Connect Hostinger Node.js Web App to your GitHub repo
3. Hostinger automatically builds and deploys on every push to `main`

**Both frontend and backend run on the same domain** - no CORS issues!

### Backend env guidance

For a split frontend/backend deployment, set:

- `CORS_ALLOWED_ORIGINS=https://your-frontend-domain.example.com`
- `SESSION_COOKIE_SAME_SITE=none`
- `SESSION_COOKIE_SECURE=true`

If frontend and backend are on the same registrable site and you intentionally want stricter cookies, you can relax those values, but the defaults above are the safer deployment baseline.

## GitHub Actions Deployment

**Note:** GitHub Actions workflows have been removed in favor of Hostinger's native Git integration. 

To deploy:
1. See [QUICK-START.md](QUICK-START.md) for quick setup
2. See [DEPLOY-HOSTINGER.md](DEPLOY-HOSTINGER.md) for detailed guide

Hostinger will automatically build and deploy when you push to `main` branch.

## Production Commands

Frontend build:

```bash
npm run build
```

Backend start:

```bash
npm start
```

## Notes

- The frontend no longer depends on Supabase.
- The active runtime path is Express + MySQL.
- Legacy Supabase SQL and QA files are still present only as historical reference.
