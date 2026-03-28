# Hostinger Deployment Guide

This guide covers deploying the HR Performance Suite to Hostinger using the modern **Node.js Web Apps** deployment method (recommended) or **VPS** for more control.

## Architecture Overview

```
                    ┌─────────────────┐
                    │   GitHub Repo   │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
     ┌────────▼────────┐       ┌────────────▼────────────┐
     │  Hostinger     │       │   Hostinger Node.js     │
     │  Web Apps      │       │   Web Apps (Full-Stack) │
     │  (Vite Build)  │       │                        │
     └────────────────┘       └────────────┬────────────┘
                                          │
                              ┌───────────┴───────────┐
                              │                       │
                     ┌────────▼────────┐    ┌────────▼────────┐
                     │  Express API    │    │  MySQL DB      │
                     │  (Port 3000)    │    │  (External)    │
                     └─────────────────┘    └────────────────┘
```

---

## Part 1: Hostinger Setup (Node.js Web Apps - Recommended)

### 1.1 Create MySQL Database

1. Log into Hostinger hPanel
2. Go to **Databases** → **MySQL Databases**
3. Create a new database:
   - Database name: `demo_kpi`
   - Username: (note this)
   - Password: (note this)
4. Note the **hostname** (usually `localhost` or a specific host like `mysql.yourdomain.com`)

### 1.2 Create Node.js Web App (Full-Stack Deployment)

1. Log into **hPanel**
2. Go to **Websites** → **Add Website**
3. Select **Node.js Apps**
4. Choose **Import Git Repository** (recommended) or **Upload ZIP**
5. For Git Repository:
   - Connect your GitHub account
   - Select repository: `xenosweb-org/demo-kpi`
   - Branch: `main`
6. Configure build settings:
   - **Build command:** `npm run build`
   - **Start command:** `npm run start`
   - **Node.js version:** `20.x`
7. Click **Deploy**

### 1.3 Configure Environment Variables

In the Node.js Web App dashboard, go to **Environment Variables** and add:

```env
# Database
MYSQL_HOST=your-mysql-host
MYSQL_PORT=3306
MYSQL_DATABASE=demo_kpi
MYSQL_USER=your-db-user
MYSQL_PASSWORD=your-db-password

# Security
SESSION_SECRET=generate-a-strong-random-string-here
NODE_ENV=production
PORT=3000

# CORS (your domain)
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Feature Flags
ENABLE_KPI=true
ENABLE_PROBATION=true
ENABLE_PIP=true
ENABLE_TNA=true
ENABLE_LMS=true
```

### 1.4 Import Database Schema

1. Go to **Databases** → **phpMyAdmin**
2. Select your `demo_kpi` database
3. Import files in order:
   - `mysql-setup.sql`
   - `mysql-demo-seed.sql` (optional)
   - `migrations/20260315_tna_tables.sql`
   - `migrations/004_create_module_settings.sql` (NEW - Module System)

---

## Part 2: Configure Environment Variables (Frontend Build)

For the frontend build to work correctly with environment variables, you can set build-time variables:

### Option A: In hostinger.json (Recommended)

The `hostinger.json` file already configures the build:

```json
{
  "framework": "express",
  "buildCommand": "npm run build",
  "startCommand": "npm run start",
  "nodeVersion": "20",
  "env": {
    "NODE_ENV": "production",
    "PORT": "3000",
    "VITE_API_BASE_URL": "/api"
  }
}
```

### Option B: Build Environment Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_API_BASE_URL` | `/api` | API endpoint (relative for same-domain) |
| `VITE_FEATURE_KPI` | `true` | Enable KPI module |
| `VITE_FEATURE_PROBATION` | `true` | Enable probation |
| `VITE_FEATURE_PIP` | `true` | Enable PIP |
| `VITE_FEATURE_TNA` | `true` | Enable TNA |
| `VITE_FEATURE_LMS` | `true` | Enable LMS |
| `VITE_SESSION_TIMEOUT_MINUTES` | `30` | Session timeout |

**Note:** `VITE_*` variables are baked in at build time. Changes require a rebuild.

---

## Part 3: Automatic Deployment via GitHub

When you push to `main`, Hostinger will automatically:
1. Pull the latest code from GitHub
2. Run `npm install`
3. Run `npm run build`
4. Start the application

### Manual Redeploy
In Hostinger Node.js Web App dashboard, click **Redeploy** or go to **Deployments** → **Create deployment**.

---

## Part 4: Verify Deployment

### Health Check
```bash
curl https://yourdomain.com/api?action=auth/session
```

Should return `{"profile": null}` for unauthenticated request.

### Demo Login
Email: `admin.demo@xenos.local`
Password: `Demo123!`

### Module Manager
After login, go to **Settings** → **Module Manager** to enable/disable modules.

---

## Troubleshooting

### Deployment Failed
1. Check **Deployments** → **Deployment Logs** in Hostinger
2. Common issues:
   - Missing environment variables
   - Build command failed (check package.json scripts)
   - Wrong Node.js version

### 502 Bad Gateway
- The Node.js app may have crashed
- Check logs in Hostinger dashboard
- Verify `PORT` is set to `3000`

### Database Connection Failed
1. Verify MySQL credentials in environment variables
2. Ensure MySQL database exists
3. Check if Hostinger requires `MYSQL_SOCKET`

### CORS Errors
- Ensure `CORS_ALLOWED_ORIGINS` includes your domain with `https://`
- Format: `https://yourdomain.com,https://www.yourdomain.com`

### Module System Not Working
1. Ensure `migrations/004_create_module_settings.sql` was imported
2. Check browser console for errors
3. Verify backend can connect to database

---

## Updating Deployments

### Automatic (Recommended)
Simply push to `main` branch. Hostinger will auto-deploy.

### Manual
In Hostinger dashboard → **Deployments** → **Redeploy**

### Database Migrations
Run via phpMyAdmin:
1. Go to **Databases** → **phpMyAdmin**
2. Select `demo_kpi` database
3. Go to **Import** tab
4. Upload migration file

---

## Module System (New in v1.0)

The app now has a modular architecture with 17 HR modules:

| Category | Modules |
|----------|---------|
| Performance | ASSESSMENT, KPI, PROBATION, PIP |
| Talent | TNA, LMS, RECRUITMENT, ONBOARDING, SUCCESSION |
| Operations | LEAVE, ATTENDANCE, PAYROLL, EXPENSES, DOCUMENTS |
| Analytics | ANALYTICS, WELLNESS |

### Managing Modules
1. Login as Super Admin
2. Go to **Settings** → **Module Manager**
3. Toggle modules on/off
4. Modules with dependencies must have their dependencies enabled first

---

## Security Checklist

- [ ] Changed `SESSION_SECRET` from default
- [ ] Set strong MySQL password
- [ ] Enabled `SESSION_COOKIE_SECURE=true`
- [ ] Set `CORS_ALLOWED_ORIGINS` to your actual domain
- [ ] Removed demo data in production (or changed demo passwords)
- [ ] Enabled SSL on your domain
- [ ] Set `NODE_ENV=production`
- [ ] Enabled only needed feature flags
