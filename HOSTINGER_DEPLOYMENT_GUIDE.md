# Hostinger Deployment Guide - Step by Step

## Prerequisites

Before starting, make sure you have:
- Hostinger account with Business or Cloud hosting plan
- Domain configured in Hostinger
- GitHub account with repository access

---

## Part 1: Create MySQL Database

### Step 1: Access hPanel
1. Log into Hostinger hPanel: https://hpanel.hostinger.com
2. Go to **Hosting** → Select your domain

### Step 2: Create Database
1. Navigate to **Databases** → **MySQL Databases**
2. Create new database:
   - **Database name:** `demo_kpi` (or your preferred name)
   - **Username:** (note this down)
   - **Password:** (generate strong password, note it down)
3. Note the **MySQL Host** (usually `localhost` or something like `mysql.yourdomain.com`)

### Step 3: Note Your Database Details
Write down these values - you'll need them later:
```
MYSQL_HOST = localhost (or provided host)
MYSQL_PORT = 3306
MYSQL_DATABASE = demo_kpi
MYSQL_USER = u123456789_demo (your actual username)
MYSQL_PASSWORD = your_strong_password
```

---

## Part 2: Create Node.js Application

### Step 1: Navigate to Websites
1. In hPanel, go to **Websites**
2. Click **Add Website**

### Step 2: Choose Node.js Apps
1. Select **Node.js Apps**
2. Click **Import Git Repository**

### Step 3: Connect GitHub
1. Click **Authorize GitHub**
2. Log into GitHub if prompted
3. Authorize Hostinger to access your repositories

### Step 4: Select Repository
1. Choose repository: `xenosweb-org/demo-kpi`
2. Select branch: `main`

### Step 5: Configure Build Settings
Set these values:
- **Build Command:** `npm run build`
- **Start Command:** `npm run start`
- **Node.js Version:** `20.x` (or latest available)
- **Install Command:** `npm install`

### Step 6: Deploy
Click **Deploy** and wait for the build to complete.

---

## Part 3: Configure Environment Variables

### Step 1: Access Environment Variables
1. In your Node.js App dashboard
2. Find **Environment Variables** section
3. Click **Add Environment Variable**

### Step 2: Add Required Variables
Add these variables one by one:

```env
# Database Connection
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=demo_kpi
MYSQL_USER=u123456789_demo
MYSQL_PASSWORD=your_strong_password

# Security (generate a random string)
SESSION_SECRET=change-this-to-a-random-32-character-string

# App Configuration
NODE_ENV=production
PORT=3000

# CORS (your domain)
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Session Cookie Settings
SESSION_COOKIE_DOMAIN=
SESSION_COOKIE_SAME_SITE=lax
SESSION_COOKIE_SECURE=true

# Feature Flags (enable modules)
ENABLE_KPI=true
ENABLE_PROBATION=true
ENABLE_PIP=true
ENABLE_TNA=true
ENABLE_LMS=true
VITE_FEATURE_KPI=true
VITE_FEATURE_PROBATION=true
VITE_FEATURE_PIP=true
VITE_FEATURE_TNA=true
VITE_FEATURE_LMS=true
VITE_FEATURE_CORE=true
VITE_FEATURE_ASSESSMENT=true

# API Configuration
VITE_API_BASE_URL=/api

# Optional: Branding
VITE_APP_NAME=HR Performance Suite
VITE_COMPANY_NAME=Your Company Name
```

### Step 3: Generate SESSION_SECRET
Use this command to generate a secure session secret:
```bash
# On Windows PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# On Mac/Linux:
openssl rand -base64 32
```

---

## Part 4: Import Database Schema

### Method A: Using phpMyAdmin (Recommended)

1. In hPanel, go to **Databases** → **phpMyAdmin**
2. Select your database (`demo_kpi`) from the left sidebar
3. Click **Import** tab
4. Import files in this order:

**File 1: Base Schema**
- Click **Choose File**
- Select: `mysql-setup.sql` from your local repo
- Click **Import**

**File 2: Demo Data (Optional)**
- Click **Import** again
- Select: `mysql-demo-seed.sql`
- Click **Import**

**File 3: TNA Tables**
- Click **Import** again
- Select: `migrations/20260315_tna_tables.sql`
- Click **Import**

**File 4: Module Settings**
- Click **Import** again
- Select: `migrations/004_create_module_settings.sql`
- Click **Import**

**File 5: LMS Tables**
- Click **Import** again
- Select: `migrations/005_create_lms_tables.sql`
- Click **Import**

### Method B: Using MySQL CLI (If you have SSH access)

```bash
# Connect to MySQL
mysql -h localhost -u u123456789_demo -p demo_kpi

# Run migrations
source mysql-setup.sql;
source mysql-demo-seed.sql;
source migrations/20260315_tna_tables.sql;
source migrations/004_create_module_settings.sql;
source migrations/005_create_lms_tables.sql;

exit;
```

### Verify Tables Were Created
In phpMyAdmin, you should see these tables:
- `employees`
- `kpi_definitions`
- `kpi_records`
- `employee_assessments`
- `probation_reviews`
- `pip_plans`
- `training_needs`
- `training_courses`
- `courses` (LMS)
- `course_enrollments` (LMS)
- `module_settings`
- ... and more

---

## Part 5: Restart Application

### Step 1: Redeploy
1. Go to your Node.js App dashboard
2. Click **Redeploy** or **Stop** then **Start**

### Step 2: Check Logs
1. In the **Logs** section
2. Look for any errors during startup
3. You should see: `demo-kpi server listening on http://127.0.0.1:3000`

---

## Part 6: Verify Deployment

### Test API Health
Visit: `https://yourdomain.com/api/health`

Should return:
```json
{"ok": true}
```

### Test Session Endpoint
Visit: `https://yourdomain.com/api?action=auth/session`

Should return:
```json
{"profile": null}
```

### Test Login
1. Visit: `https://yourdomain.com/`
2. Login with demo credentials:
   - **Email:** `admin.demo@xenos.local`
   - **Password:** `Demo123!`

### Test Module Endpoint
Visit: `https://yourdomain.com/api/modules?action=list`
(Login as superadmin first)

---

## Part 7: Troubleshooting

### Database Connection Error
**Error:** `ER_ACCESS_DENIED_ERROR: Access denied for user`

**Solution:**
1. Verify MYSQL_USER and MYSQL_PASSWORD in environment variables
2. Check if database user has correct permissions
3. Try resetting database password in hPanel

### 502 Bad Gateway
**Error:** Site shows 502 error

**Solution:**
1. Check if Node.js app is running in hPanel
2. Verify PORT environment variable is set to `3000`
3. Check logs for startup errors
4. Ensure all dependencies installed correctly

### CORS Errors
**Error:** Browser console shows CORS errors

**Solution:**
1. Verify CORS_ALLOWED_ORIGINS includes your domain
2. Include both `https://yourdomain.com` AND `https://www.yourdomain.com`
3. Don't include trailing slashes

### Login Not Working
**Error:** Cannot login or session resets

**Solution:**
1. Verify SESSION_SECRET is set (32+ characters)
2. Check SESSION_COOKIE_SECURE is `true` for HTTPS
3. Ensure database has `app_settings` table with session config

### Tables Not Found
**Error:** `Table 'demo_kpi.employees' doesn't exist`

**Solution:**
1. Re-import `mysql-setup.sql` first
2. Then import other migrations in order
3. Verify table names in phpMyAdmin

### Module Manager Shows Empty
**Error:** Module settings page shows no modules

**Solution:**
1. Import `migrations/004_create_module_settings.sql`
2. Or manually insert default modules:
```sql
INSERT INTO module_settings (module_id, module_name, status, is_enabled) VALUES
('CORE', 'Core HR', 'active', 1),
('KPI', 'KPI Management', 'active', 1),
('ASSESSMENT', 'Assessment', 'active', 1),
('TNA', 'Training Needs', 'active', 1),
('LMS', 'Learning Management', 'active', 1);
```

---

## Part 8: Post-Deployment Checklist

- [ ] Database created and schema imported
- [ ] Environment variables configured
- [ ] Application deployed and running
- [ ] Health check returns `{"ok": true}`
- [ ] Can login with demo credentials
- [ ] Module Manager shows on dashboard (for superadmin)
- [ ] TNA module working
- [ ] Can navigate between tabs
- [ ] SESSION_SECRET is a strong random string
- [ ] CORS set to actual domain
- [ ] SSL certificate active (automatic with Hostinger)

---

## Quick Reference Commands

### Check Application Status
```bash
# Via SSH (if available)
pm2 status
pm2 logs demo-kpi
```

### View Application Logs
In hPanel: **Logs** → **Application Logs**

### Database Backup
In phpMyAdmin: **Export** → **Quick** → **SQL**

### Update Deployment
1. Push changes to GitHub `main` branch
2. Hostinger will auto-redeploy (if configured)
3. Or manually click **Redeploy** in hPanel

---

## Support

- Hostinger Support: https://www.hostinger.com/contacts
- Live Chat available 24/7
- Check logs first before contacting support

---

## Security Reminders

1. **Change default passwords** for all demo accounts
2. **Generate new SESSION_SECRET** (don't use default)
3. **Remove demo data** in production if not needed
4. **Enable SSL** (Hostinger does this automatically)
5. **Set NODE_ENV=production**
6. **Restrict database user permissions** to only what's needed
7. **Regular backups** of database

---

If you encounter any issues, check the logs first and refer to the troubleshooting section above. Good luck with your deployment!