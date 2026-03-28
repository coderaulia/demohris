$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$deployRoot = Join-Path $root 'deploy'
$stageDir = Join-Path $deployRoot 'backend-hostinger'
$zipPath = Join-Path $deployRoot 'backend-hostinger.zip'

if (Test-Path $stageDir) {
    Remove-Item $stageDir -Recurse -Force
}
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

New-Item -ItemType Directory -Path $stageDir | Out-Null

# Copy server files (includes server/app.js, server/modules/, server/tableMeta.js, server/features.js)
Copy-Item (Join-Path $root 'server') -Destination $stageDir -Recurse

# Copy SQL files
Copy-Item (Join-Path $root 'mysql-setup.sql') -Destination $stageDir
Copy-Item (Join-Path $root 'mysql-demo-seed.sql') -Destination $stageDir

# Copy migrations folder
$migrationsDest = Join-Path $stageDir 'migrations'
New-Item -ItemType Directory -Path $migrationsDest | Out-Null
Get-ChildItem -Path (Join-Path $root 'migrations') -Filter '*.sql' | Copy-Item -Destination $migrationsDest

# Create package.json for backend
@'
{
  "name": "demo-kpi-backend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "engines": {
    "node": "20.x"
  },
  "scripts": {
    "start": "node server/app.js"
  },
  "dependencies": {
    "bcryptjs": "^3.0.2",
    "express": "^5.1.0",
    "express-session": "^1.18.2",
    "mysql2": "^3.15.2"
  }
}
'@ | Set-Content -Path (Join-Path $stageDir 'package.json')

# Create .env.example with all feature flags
@'
# Server Configuration
PORT=3000
SESSION_SECRET=change-this-in-production

# MySQL Database
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=demo_kpi
MYSQL_USER=root
MYSQL_PASSWORD=

# CORS - Frontend domain(s) allowed to call this API
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.example.com

# Cookie Settings
SESSION_COOKIE_DOMAIN=
SESSION_COOKIE_SAME_SITE=none
SESSION_COOKIE_SECURE=true

# Feature Flags (set to 'true' or 'false')
ENABLE_KPI=true
ENABLE_PROBATION=true
ENABLE_PIP=true
ENABLE_TNA=true
ENABLE_LMS=true
'@ | Set-Content -Path (Join-Path $stageDir '.env.example')

# Create README.md
@'
# HR Performance Suite - Backend API

Node.js Express backend for the HR Performance Suite application.

## Hostinger Setup

### 1. Upload Files
Upload the contents of this folder to your Hostinger Node.js app directory via File Manager or FTPS.

### 2. Create MySQL Database
- Go to Hostinger hPanel → Databases → MySQL
- Create a new database (e.g., `demo_kpi`)
- Note the database name, username, and password

### 3. Import Database Schema
- Go to phpMyAdmin (from Hostinger databases page)
- Select your database
- Import `mysql-setup.sql` first (core schema)
- Then import `mysql-demo-seed.sql` (demo data with sample employees)
- Run migrations in order from `migrations/` folder if needed

### 4. Configure Environment Variables
In Hostinger Node.js app settings, set these environment variables:

| Variable | Value |
|----------|-------|
| PORT | 3000 |
| SESSION_SECRET | (generate a strong random string) |
| MYSQL_HOST | (your Hostinger MySQL host) |
| MYSQL_PORT | 3306 |
| MYSQL_DATABASE | (your database name) |
| MYSQL_USER | (your database user) |
| MYSQL_PASSWORD | (your database password) |
| CORS_ALLOWED_ORIGINS | https://your-frontend-domain.com |
| ENABLE_KPI | true |
| ENABLE_PROBATION | true |
| ENABLE_PIP | true |
| ENABLE_TNA | true |
| ENABLE_LMS | true |

### 5. App Settings
- **Runtime:** Node.js 20.x
- **Start command:** `npm start`
- **Build command:** `npm install` (if prompted)

### 6. Frontend Configuration
Set your frontend VITE_API_BASE_URL to point to this backend:
```
https://your-backend-domain.com/api
```

## Feature Flags

Control which modules are active:

| Flag | Description |
|------|-------------|
| ENABLE_KPI | KPI tracking and performance scores |
| ENABLE_PROBATION | Probation review system (requires KPI) |
| ENABLE_PIP | Performance Improvement Plans (requires KPI) |
| ENABLE_TNA | Training Needs Analysis |
| ENABLE_LMS | Learning Management System |

## Demo Logins

Password for all: `Demo123!`

- admin.demo@xenos.local (Super Admin)
- hr.demo@xenos.local (HR)
- director.demo@xenos.local (Director)
- manager.demo@xenos.local (Manager)
- farhan.demo@xenos.local (Employee)
- nadia.demo@xenos.local (Employee)
- kevin.demo@xenos.local (Employee)

## API Endpoints

- `POST /api?action=auth/login` - User login
- `POST /api?action=auth/logout` - User logout
- `POST /api?action=auth/session` - Get current session
- `POST /api?action=db/query` - Database operations

See source code in `server/app.js` for full API documentation.
'@ | Set-Content -Path (Join-Path $stageDir 'README.md')

# Create ZIP archive
Compress-Archive -Path (Join-Path $stageDir '*') -DestinationPath $zipPath -Force
Write-Host "Backend package created: $zipPath"
Write-Host ""
Write-Host "Contents:"
Get-ChildItem -Path $stageDir -Recurse | ForEach-Object { $_.FullName.Replace($stageDir, '') }
