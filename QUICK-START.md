# Quick Start: Hostinger Deployment

## One-Time Setup (5 minutes)

### 1. Disable GitHub Actions (if using Hostinger Git integration)

The GitHub Actions workflows conflict with Hostinger's native Git deployment. Disable them:

```bash
# Rename to disable (files are kept for reference if needed later)
mv .github/workflows/deploy-hostinger.yml .github/workflows/deploy-hostinger.yml.DISABLED
mv .github/workflows/deploy-backend-hostinger.yml .github/workflows/deploy-backend-hostinger.yml.DISABLED
```

Or delete them:
```bash
rm .github/workflows/deploy-hostinger.yml
rm .github/workflows/deploy-backend-hostinger.yml
```

### 2. Push to GitHub

```bash
git add .
git commit -m "docs: configure for Hostinger Git deployment"
git push origin main
```

### 3. Hostinger Setup

Go to Hostinger hPanel:

1. **Create MySQL Database**
   - Databases → MySQL Databases
   - Database: `demo_kpi`
   - Note username and password

2. **Create Node.js Web App**
   - Websites → Add Website
   - Select: Node.js Apps
   - Import from Git: `xenosweb-org/hris-system`
   - Branch: `main`
   - Build command: `npm run build`
   - Start command: `npm start`
   - Node version: `20.x`

3. **Configure Environment Variables** (in Node.js app dashboard)
   ```
   MYSQL_HOST=localhost
   MYSQL_DATABASE=demo_kpi
   MYSQL_USER=<your-db-user>
   MYSQL_PASSWORD=<your-db-password>
   SESSION_SECRET=<random-32-char-string>
   NODE_ENV=production
   PORT=3000
   CORS_ALLOWED_ORIGINS=https://yourdomain.com
   VITE_API_BASE_URL=/api
   ```

4. **Import Database** (Databases → phpMyAdmin)

   Run these SQL files in order:
   - mysql-setup.sql
   - mysql-demo-seed.sql (optional)
   - migrations/*.sql
   - mysql-demo-lms-courses.sql

5. **Deploy**
   
   Click "Deploy" button in Hostinger dashboard.

### 4. Verify

```bash
# Check your site
curl https://yourdomain.com

# Check API
curl https://yourdomain.com/api?action=auth/session
# Should return: {"profile":null}

# Test login
# Email: admin.demo@xenos.local
# Password: Demo123!
```

### Done! 🎉

Every push to `main` will auto-deploy via Hostinger's Git integration.

---

## Architecture

```
https://yourdomain.com
         │
    Express Server
         │
    ┌────┴─────┐
    │          │
  /api/*    /*
    │          │
  API      Frontend
 (JSON)   (dist/)
```

**Single domain = No CORS issues** ✅

---

## Troubleshooting

**Build fails?**
- Check logs in Hostinger dashboard
- Verify Node.js is 20.x
- Check all dependencies in package.json

**Database connection error?**
- Verify MYSQL_* environment variables
- Check database exists in phpMyAdmin
- Test: `mysql -u user -p demo_kpi`

**Can't access site?**
- Check if port 3000 is set
- Verify SSL is enabled
- Check deployment logs for errors

**Need help?**
- Hostinger Node.js docs: https://support.hostinger.com
- Check `DEPLOY-HOSTINGER.md` for detailed guide