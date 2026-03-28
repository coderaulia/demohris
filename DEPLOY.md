# Hostinger Deployment Guide

This guide covers deploying the HR Performance Suite to Hostinger with separate frontend and backend.

## Architecture

```
                    ┌─────────────────┐
                    │   GitHub Repo   │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
    ┌─────────▼──────────┐      ┌──────────▼────────┐
    │  GitHub Actions    │      │  GitHub Actions   │
    │  (Frontend Deploy)  │      │  (Backend Deploy) │
    └─────────┬──────────┘      └──────────┬────────┘
              │                            │
              │ FTP                        │ FTP/SFTP
              │                            │
    ┌─────────▼──────────┐      ┌──────────▼────────┐
    │  Hostinger Static  │      │  Hostinger Node.js │
    │     Website        │      │      App          │
    │  (public_html)     │      │   (Node.js)       │
    └────────────────────┘      └──────────┬────────┘
                                           │
                                           │ MySQL
                                  ┌────────▼────────┐
                                  │  Hostinger     │
                                  │  MySQL DB      │
                                  └────────────────┘
```

---

## Part 1: Hostinger Setup

### 1.1 Create MySQL Database

1. Log into Hostinger hPanel
2. Go to **Databases** → **MySQL Databases**
3. Create a new database:
   - Database name: `demo_kpi`
   - Username: (note this)
   - Password: (note this)
4. Note the **hostname** (usually `localhost` or a specific host like `mysql.yourdomain.com`)

### 1.2 Create Node.js Application (Backend)

1. Go to **Hosting** → **Node.js Apps** (or **Websites** → **Node.js**)
2. Click **Create Application**
3. Configure:
   - **Runtime:** Node.js 20.x
   - **Application root:** `/` (or a subdirectory like `/api`)
   - **Start command:** `npm start`
   - **Build command:** `npm install`
4. Note the **Application URL** (e.g., `https://api.yourdomain.com`)

### 1.3 Create Static Website (Frontend)

1. Go to **Hosting** → **File Manager**
2. Navigate to `public_html`
3. We'll deploy the built frontend here via FTPS

---

## Part 2: GitHub Secrets Configuration

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**

### Frontend Secrets

| Secret Name | Value | Description |
|------------|-------|-------------|
| `VITE_API_BASE_URL` | `https://api.yourdomain.com/api` | Backend API URL |
| `HOSTINGER_FTP_HOST` | `files.yourdomain.com` | FTPS hostname |
| `HOSTINGER_FTP_USER` | `your-ftp-username` | FTPS username |
| `HOSTINGER_FTP_PASSWORD` | `your-ftp-password` | FTPS password |
| `HOSTINGER_FTP_REMOTE_DIR` | `/public_html` | Remote directory |
| `VITE_FEATURE_KPI` | `true` | Enable KPI module |
| `VITE_FEATURE_PROBATION` | `true` | Enable probation |
| `VITE_FEATURE_PIP` | `true` | Enable PIP |
| `VITE_FEATURE_TNA` | `true` | Enable TNA |
| `VITE_FEATURE_LMS` | `true` | Enable LMS |
| `SITE_BASE_URL` | `https://yourdomain.com` | Frontend URL for health checks |

### Backend Secrets

| Secret Name | Value | Description |
|------------|-------|-------------|
| `HOSTINGER_BACKEND_FTP_HOST` | `files.yourdomain.com` | FTPS hostname |
| `HOSTINGER_BACKEND_FTP_USER` | `your-ftp-username` | FTPS username |
| `HOSTINGER_BACKEND_FTP_PASSWORD` | `your-ftp-password` | FTPS password |
| `HOSTINGER_BACKEND_FTP_REMOTE_DIR` | `/api` or `/` | Backend app root |

---

## Part 3: Deploy Backend First

### 3.1 Create Backend Deployment Package

```bash
npm install
npm run package:backend
```

This creates `deploy/backend-hostinger.zip`.

### 3.2 Upload Backend via FTPS

1. Connect to Hostinger FTPS using FileZilla or similar:
   - Host: `files.yourdomain.com`
   - User: `your-ftp-username`
   - Password: `your-ftp-password`
   - Protocol: FTPS (explicit)

2. Navigate to your Node.js app directory

3. Upload the contents of `deploy/backend-hostinger/`:
   - `server/`
   - `migrations/`
   - `mysql-setup.sql`
   - `mysql-demo-seed.sql`
   - `package.json`
   - `.env.example`
   - `README.md`

### 3.3 Configure Backend Environment Variables

In Hostinger Node.js app settings, add these environment variables:

```env
PORT=3000
SESSION_SECRET=your-strong-random-secret-here
MYSQL_HOST=your-mysql-host
MYSQL_PORT=3306
MYSQL_DATABASE=demo_kpi
MYSQL_USER=your-db-user
MYSQL_PASSWORD=your-db-password
CORS_ALLOWED_ORIGINS=https://yourdomain.com
SESSION_COOKIE_DOMAIN=
SESSION_COOKIE_SAME_SITE=none
SESSION_COOKIE_SECURE=true
ENABLE_KPI=true
ENABLE_PROBATION=true
ENABLE_PIP=true
ENABLE_TNA=true
ENABLE_LMS=true
```

### 3.4 Import Database Schema

1. Go to **Databases** → **phpMyAdmin**
2. Select your `demo_kpi` database
3. Import `mysql-setup.sql`
4. Import `mysql-demo-seed.sql` (optional, for demo data)
5. Import `migrations/20260315_tna_tables.sql` (for TNA tables)

### 3.5 Restart Node.js App

In Hostinger Node.js app settings, click **Restart** or **Stop** then **Start**.

Test the API:
```bash
curl https://api.yourdomain.com/api?action=auth/session
```

---

## Part 4: Deploy Frontend

### 4.1 Configure GitHub Secrets for Frontend

Make sure all secrets in **Part 2** are set.

### 4.2 Trigger Deployment

Push to `main` branch or go to **Actions** → **Deploy Frontend to Hostinger** → **Run workflow**.

The workflow will:
1. Build the frontend with your `VITE_API_BASE_URL`
2. Deploy `dist/` to Hostinger via FTPS

---

## Part 5: Verify Deployment

### Frontend Health Check
Visit `https://yourdomain.com/` and verify the login page loads.

### Backend Health Check
```bash
curl https://api.yourdomain.com/api?action=auth/session
```

Should return `{"profile": null}` for unauthenticated request.

### Demo Login
Email: `admin.demo@xenos.local`
Password: `Demo123!`

---

## Troubleshooting

### Frontend Shows 502 Bad Gateway
- Check that the backend Node.js app is running
- Verify `VITE_API_BASE_URL` points to correct backend URL

### Backend Returns 404
- Verify the Node.js app started successfully
- Check Hostinger logs for errors
- Ensure `PORT` environment variable matches Hostinger's assigned port

### Database Connection Failed
- Verify MySQL credentials in environment variables
- Ensure MySQL database exists
- Check if Hostinger requires `MYSQL_SOCKET` instead of `MYSQL_HOST`

### CORS Errors
- Ensure `CORS_ALLOWED_ORIGINS` includes your frontend domain with `https://`
- For development, you can set it to `*` but never in production

### Feature Flags Not Working
- Backend: Check `ENABLE_*` environment variables
- Frontend: Check `VITE_FEATURE_*` build-time variables (requires rebuild)
- Rebuild frontend after changing feature flags

---

## Updating Deployments

### Frontend Update
Simply push to `main` branch - GitHub Actions will rebuild and deploy.

### Backend Update
1. Make changes to backend code
2. Run `npm run package:backend`
3. Upload updated files via FTPS or push to trigger GitHub Actions (if using the backend workflow)

### Database Migrations
Run migrations manually via phpMyAdmin or MySQL CLI:
```bash
mysql -h your-host -u your-user -p demo_kpi < migrations/filename.sql
```

---

## Security Checklist

- [ ] Changed `SESSION_SECRET` from default
- [ ] Set strong MySQL password
- [ ] Enabled `SESSION_COOKIE_SECURE=true`
- [ ] Set `CORS_ALLOWED_ORIGINS` to your actual domain
- [ ] Removed demo data in production (or changed demo passwords)
- [ ] Enabled only needed feature flags
