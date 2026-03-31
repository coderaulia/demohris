# Hostinger Deployment - Setup Checklist

## What Changed

✅ **Removed:** GitHub Actions workflows (deploy-hostinger.yml, deploy-backend-hostinger.yml)
✅ **Added:** DEPLOY-HOSTINGER.md - Complete deployment guide
✅ **Added:** QUICK-START.md - 5-minute setup guide

## Why?

The GitHub Actions workflows were deploying ONLY the frontend via FTP, which conflicts with Hostinger's Node.js Git integration. 

**New approach:** Use Hostinger's native Git integration to deploy BOTH frontend and backend from the same repository.

## Architecture

```
┌─────────────────────────────────────────┐
│   GitHub Repository (xenosweb-org/hris-system)  │
│   Branch: main                           │
└─────────────────┬───────────────────────┘
                  │
      ┌───────────┴──────────────┐
      │ Hostinger Node.js Web App │
      │   (Auto-build on push)     │
      └───────────┬───────────────┘
                  │
         ┌────────┴────────┐
         │                  │
    ┌────▼─────┐      ┌────▼─────┐
    │ npm run   │      │  npm run  │
    │  build    │      │  start    │
    │  (Vite)   │      │ (Express) │
    └────┬─────┘      └────┬─────┘
         │                  │
         │   dist/           │  API
         │                  │
         └────────┬─────────┘
                  │
         Single Domain (https://yourdomain.com)
                  │
         ┌────────┴────────┐
         │                  │
      /api/*             /*
         │                  │
      Backend            Frontend
       (API)            (SPA)
```

**Result:** Both FE and BE on same domain = **No CORS issues!**

---

## Setup Steps (5 minutes)

### 1. Create MySQL Database

1. Go to Hostinger hPanel → **Databases** → **MySQL Databases**
2. Create new database:
   - Database name: `demo_kpi`
   - Username: (auto-generated, note it)
   - Password: (your choice, note it)
3. Note the **MySQL hostname** (usually `localhost` or `mysql.yourdomain.com`)

### 2. Create Node.js Web App

1. Go to **Websites** → **Add Website**
2. Select **Node.js Apps**
3. Choose **Import Git Repository**
4. Connect your GitHub account
5. Select repository: `xenosweb-org/hris-system`
6. Branch: `main`
7. Configure:
   - **Build command:** `npm run build`
   - **Start command:** `npm start`
   - **Node.js version:** `20.x`
8. Click **Deploy**

### 3. Set Environment Variables

In the Node.js Web App dashboard, go to **Environment Variables** and add:

```env
# Database (from step 1)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=demo_kpi
MYSQL_USER=u123456789_user
MYSQL_PASSWORD=your_db_password

# Security (generate a random 32+ char string)
SESSION_SECRET=change_this_to_random_32_chars_minimum

# Runtime
NODE_ENV=production
PORT=3000

# CORS (your actual domain)
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Cookie settings (for HTTPS)
SESSION_COOKIE_DOMAIN=.yourdomain.com
SESSION_COOKIE_SAME_SITE=none
SESSION_COOKIE_SECURE=true

# Feature flags (all enabled)
ENABLE_KPI=true
ENABLE_PROBATION=true
ENABLE_PIP=true
ENABLE_TNA=true
ENABLE_LMS=true
```

### 4. Import Database Schema

1. Go to **Databases** → **phpMyAdmin**
2. Select `demo_kpi` database
3. Go to **Import** tab
4. Import these files **in order**:

```
1. mysql-setup.sql
2. mysql-demo-seed.sql (optional - adds demo data)
3. migrations/004_create_module_settings.sql
4. migrations/005_create_lms_tables.sql
5. migrations/20260315_tna_tables.sql
6. mysql-demo-lms-courses.sql (NEW - LMS demo courses)
```

### 5. Deploy

Click **Deploy** button in Hostinger dashboard.

---

## Verify Deployment

### Check Frontend

```bash
curl https://yourdomain.com
# Should return HTML
```

### Check API

```bash
curl https://yourdomain.com/api?action=auth/session
# Should return: {"profile":null}
```

### Check Health

```bash
curl https://yourdomain.com/healthz.json
# Should return: {"status":"ok"}
```

### Test Login

1. Open `https://yourdomain.com`
2. Login with demo credentials:
   - Email: `admin.demo@xenos.local`
   - Password: `Demo123!`

---

## Auto-Deploy

Every push to `main` branch will:

1. Hostinger pulls latest code from GitHub
2. Runs `npm install`
3. Runs `npm run build` (builds frontend to `dist/`)
4. Runs `npm start` (starts Express server)
5. Express serves:
   - `/api/*` → Backend API endpoints
   - `/*` → Frontend SPA from `dist/`

**No manual action needed!**

---

## Troubleshooting

### Build Fails

Check deployment logs in Hostinger dashboard:

**Common causes:**
- Missing environment variables
- Node.js version not 20.x
- Database connection failed

**Solution:**
1. Verify all environment variables are set
2. Check Node.js version in Hostinger dashboard
3. Check database credentials

### 502 Bad Gateway

**Causes:**
- App crashed on startup
- Port conflict
- Missing dependencies

**Solutions:**
1. Check logs in Hostinger dashboard
2. Verify `PORT=3000` is set
3. Run `npm install` locally to test

### Database Connection Error

```
Error: connect ECONNREFUSED
```

**Solutions:**
1. Check `MYSQL_HOST` (try `localhost` first)
2. Verify database exists: `SHOW DATABASES LIKE 'demo_kpi'`
3. Check database user has permissions
4. Some Hostinger plans require socket connection - check Hostinger docs

### CORS Errors

```
Access-Control-Allow-Origin error
```

**Solutions:**
1. Set `CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com`
2. Set `SESSION_COOKIE_SAME_SITE=none`
3. Set `SESSION_COOKIE_SECURE=true`
4. Enable SSL on your domain

### Frontend Not Loading

**Causes:**
- `dist/` folder not created during build
- Express not serving static files

**Solutions:**
1. Check build logs for `npm run build` success
2. Verify `server/app.js` serves static files (lines 814-819)
3. Check if `dist/` folder exists after build

---

## Database Migrations

When you add new SQL migrations:

1. Go to Hostinger → **Databases** → **phpMyAdmin**
2. Select `demo_kpi` database
3. Go to **Import** tab
4. Upload new migration file
5. Click **Go**

---

## Security Checklist

Before going live:

- [ ] Changed `SESSION_SECRET` to random 32+ char string
- [ ] Set strong MySQL password
- [ ] Set `CORS_ALLOWED_ORIGINS` to your actual domain
- [ ] Set `SESSION_COOKIE_SECURE=true`
- [ ] Set `SESSION_COOKIE_SAME_SITE=none`
- [ ] Enabled SSL/HTTPS on domain
- [ ] Changed demo passwords (or removed demo data)
- [ ] Set `NODE_ENV=production`

---

## Architecture Details

### How It Works

1. **Build Phase**
   - Vite builds frontend to `dist/` folder
   - Static files ready to serve

2. **Runtime Phase**
   - Express starts on port 3000
   - Checks if `dist/` folder exists
   - If yes, serves static files + SPA fallback
   - All `/api/*` routes go to API handlers

3. **Request Flow**
   ```
   Browser → https://yourdomain.com
                    ↓
              Express Server
                    ↓
         ┌────────┴────────┐
         │                 │
      /api/*              /*
         │                 │
    API Handlers      dist/index.html
   (JSON responses)   (SPA entry point)
   ```

### Why Same Domain?

**Advantages:**
- ✅ No CORS issues
- ✅ Simpler deployment
- ✅ Single SSL certificate
- ✅ Shared session cookies
- ✅ Faster development

**Alternative (not recommended):**
- Deploy frontend to static hosting
- Deploy backend to separate domain
- Configure CORS
- Handle cookie issues

---

## Support

- **Hostinger Node.js Docs:** https://support.hostinger.com
- **Express.js Docs:** https://expressjs.com
- **Vite Build Docs:** https://vitejs.dev/guide/build.html

---

## Need Help?

1. Check `DEPLOY-HOSTINGER.md` for detailed guide
2. Check `QUICK-START.md` for quick setup
3. Check Hostinger deployment logs
4. Check browser console for errors

Good luck! 🚀