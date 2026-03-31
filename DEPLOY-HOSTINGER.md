# Deploy to Hostinger (Full-Stack Node.js Deployment)

## Option 1: GitHub Integration (Recommended) ✅

Hostinger Node.js Web Apps can pull directly from GitHub and build both frontend and backend automatically.

### Architecture

```
GitHub Repository (main branch)
        │
        └──┐ Hostinger Node.js Web App
           │
    ┌──────┴──────┐
    │              │
┌───▼───┐     ┌───▼────┐
│ Build │     │ Express│
│ Frontend      │ Server │
│ (dist/)│     │ (API)  │
└───┬───┘     └───┬────┘
    │              │
    └──────┬───────┘
           │
    Single Domain (https://yourdomain.com)
```

### Setup Steps

#### 1. Remove GitHub Actions (It conflicts with Hostinger)

**Disable or delete the workflow:**

You have two options:

**Option A: Delete the workflow file** (Recommended)
- Delete `.github/workflows/deploy-hostinger.yml`
- Delete `.github/workflows/deploy-backend-hostinger.yml` (if it exists)

**Option B: Keep it but never run it**
- Don't configure the required GitHub secrets
- The workflow will skip due to missing secrets

#### 2. Configure Hostinger Node.js Web App

1. Log into Hostinger hPanel
2. Go to **Websites** → **Add Website**
3. Select **Node.js Apps**
4. Choose **Import Git Repository**
5. Connect GitHub and select: `xenosweb-org/hris-system`
6. Configure build settings:

```
Build Command: npm run build
Start Command: npm start
Node.js Version: 20.x
```

7. Click **Deploy**

#### 3. Environment Variables in Hostinger

In the Node.js Web App dashboard, go to **Environment Variables** and add:

```env
# Database (from your Hostinger MySQL setup)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=demo_kpi
MYSQL_USER=your_db_user
MYSQL_PASSWORD=your_db_password

# Security
SESSION_SECRET=your-random-secret-string-min-32-characters
NODE_ENV=production
PORT=3000

# CORS (your actual domain)
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
SESSION_COOKIE_DOMAIN=.yourdomain.com
SESSION_COOKIE_SAME_SITE=none
SESSION_COOKIE_SECURE=true

# Frontend Build Variables (these are optional for runtime)
# VITE_API_BASE_URL is set to /api at build time in hostinger.json
VITE_API_BASE_URL=/api
VITE_FEATURE_KPI=true
VITE_FEATURE_PROBATION=true
VITE_FEATURE_PIP=true
VITE_FEATURE_TNA=true
VITE_FEATURE_LMS=true
VITE_SESSION_TIMEOUT_MINUTES=30
```

#### 4. Database Setup

1. Go to **Databases** → **MySQL Databases**
2. Create database `demo_kpi`
3. Go to **phpMyAdmin**
4. Import SQL files in order:
   - `mysql-setup.sql`
   - `mysql-demo-seed.sql` (optional, for demo data)
   - `migrations/004_create_module_settings.sql`
   - `migrations/005_create_lms_tables.sql`
   - `migrations/20260315_tna_tables.sql`
   - `mysql-demo-lms-courses.sql` (New! LMS demo courses)

#### 5. Deploy Process

When you push to `main` branch:

1. Hostinger pulls latest code from GitHub
2. Runs `npm install`
3. Runs `npm run build` (builds frontend to `dist/`)
4. Runs `npm start` (starts Express server)
5. Express serves:
   - `/api/*` → Backend API endpoints
   - `/*` → Frontend SPA from `dist/`

### Why this works

**hostinger.json** already configured correctly:

```json
{
  "framework": "express",
  "buildCommand": "npm run build",
  "startCommand": "npm start",
  "nodeVersion": "20",
  "distDirectory": "dist"
}
```

**Express server** (server/app.js) already serves static files:

```javascript
// Serves dist/ folder for frontend
if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^(?!\/api).*/, (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
    });
}
```

---

## Option 2: Manual Deployment (Not Recommended)

If you prefer manual control, you can package and upload manually:

```bash
# Build frontend locally
npm run build

# Package backend
npm run package:backend

# Upload to Hostinger
# - Upload deploy/backend-hostinger/ via FTP
# - Import MySQL schema via phpMyAdmin
# - Configure environment variables in hPanel
```

⚠️ **Not recommended** - Loses benefits of automatic Git deployment.

---

## Troubleshooting

### "Frontend not loading"

1. Check **Deployments** → **Logs** for build errors
2. Verify `dist/` folder was created: Look for `Build completed successfully`
3. Check Express server logs for errors

### "API returns 404"

1. Verify `server/app.js` is the entry point
2. Check environment variables are set
3. Ensure Node.js version is 20.x

### "Database connection failed"

1. Verify MySQL credentials in environment variables
2. Check database exists: `SHOW DATABASES LIKE 'demo_kpi'`
3. Test connection in Hostinger terminal: `mysql -u user -p demo_kpi`

### "CORS errors"

1. Set `CORS_ALLOWED_ORIGINS=https://yourdomain.com`
2. Set `SESSION_COOKIE_SAME_SITE=none`
3. Set `SESSION_COOKIE_SECURE=true`

### "Build fails"

1. Check Node.js version is 20.x
2. Verify `package.json` has correct build script: `"build": "vite build"`
3. Check for missing dependencies

---

## Continuous Deployment

### Automatic Deploy on Push

With Hostinger Git integration, every push to `main` automatically:

1. Pulls latest code
2. Rebuilds frontend (`npm run build`)
3. Restarts backend (`npm start`)
4. Zero downtime during rebuild

### Manual Redeploy

If needed, manually redeploy:

1. Go to Hostinger dashboard
2. Find your Node.js Web App
3. Click **Redeploy** button

---

## Environment Variables Reference

### Required for Backend

| Variable | Example | Description |
|----------|---------|-------------|
| `MYSQL_HOST` | `localhost` | Database host |
| `MYSQL_PORT` | `3306` | Database port |
| `MYSQL_DATABASE` | `demo_kpi` | Database name |
| `MYSQL_USER` | `u123456789_user` | Database user |
| `MYSQL_PASSWORD` | `securePass123` | Database password |
| `SESSION_SECRET` | `min-32-random-chars` | Session encryption key |
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `production` | Environment mode |

### Frontend Build Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `/api` | API endpoint (relative path) |
| `VITE_SESSION_TIMEOUT_MINUTES` | `30` | Session timeout |
| `VITE_FEATURE_KPI` | `true` | Enable KPI module |
| `VITE_FEATURE_PROBATION` | `true` | Enable Probation |
| `VITE_FEATURE_PIP` | `true` | Enable PIP |
| `VITE_FEATURE_TNA` | `true` | Enable TNA |
| `VITE_FEATURE_LMS` | `true` | Enable LMS |

---

## Security Checklist

Before going live:

- [ ] Change `SESSION_SECRET` to a strong random string (32+ chars)
- [ ] Set strong MySQL password
- [ ] Set `CORS_ALLOWED_ORIGINS` to your actual domain
- [ ] Set `SESSION_COOKIE_SECURE=true`
- [ ] Set `SESSION_COOKIE_SAME_SITE=none`
- [ ] Enable SSL/HTTPS on your domain
- [ ] Change demo user passwords or remove demo data
- [ ] Set `NODE_ENV=production`

---

## Monitoring

### Check Deployment Status

```bash
# SSH into Hostinger (if available)
ssh your-user@yourdomain.com

# Check if app is running
pm2 status

# View logs
pm2 logs
```

### Health Check Endpoint

Your app has a built-in health check:

```bash
curl https://yourdomain.com/api?action=auth/session
# Should return: {"profile":null}
```

---

## Rollback

If deployment fails:

1. Go to Hostinger dashboard
2. Find **Deployments** history
3. Click **Rollback** on previous successful deployment
4. Or redeploy from specific Git commit

---

## Summary

✅ **Use Hostinger Git integration** - No GitHub Actions needed
✅ **Single domain deployment** - FE and BE on same domain
✅ **Auto-build on push** - Push to main, Hostinger builds automatically
✅ **Same architecture** - Express serves both static and API
✅ **Environment variables** - Configure in Hostinger dashboard

🚫 **Don't use GitHub Actions** - It will conflict with Hostinger Git deployment