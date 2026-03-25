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
Copy-Item (Join-Path $root 'server') -Destination $stageDir -Recurse
Copy-Item (Join-Path $root 'mysql-setup.sql') -Destination $stageDir
Copy-Item (Join-Path $root 'mysql-demo-seed.sql') -Destination $stageDir

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

@'
PORT=3000
SESSION_SECRET=change-this-in-production
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=demo_kpi
MYSQL_USER=root
MYSQL_PASSWORD=
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.example.com
SESSION_COOKIE_DOMAIN=
SESSION_COOKIE_SAME_SITE=none
SESSION_COOKIE_SECURE=true
'@ | Set-Content -Path (Join-Path $stageDir '.env.example')

@'
# Backend Upload Package

This ZIP is intended for Hostinger Node.js web app hosting.

## Before upload

1. Create the MySQL database in Hostinger.
2. Import mysql-setup.sql in phpMyAdmin.
3. Import mysql-demo-seed.sql if you want demo data.
4. Set the backend environment variables in Hostinger.

## Hostinger app settings

- Runtime: Node.js 20.x
- Start command: npm start
- Build/install step: review Hostinger's detected settings; if it asks for a build command, use npm install

## Required backend env vars

- PORT
- SESSION_SECRET
- MYSQL_HOST
- MYSQL_PORT
- MYSQL_DATABASE
- MYSQL_USER
- MYSQL_PASSWORD
- CORS_ALLOWED_ORIGINS

## Frontend API URL

Point the frontend to this backend with:

- VITE_API_BASE_URL=https://your-backend-domain.example.com/api

## Demo logins

Shared password: Demo123!

- admin.demo@xenos.local
- hr.demo@xenos.local
- director.demo@xenos.local
- manager.demo@xenos.local
- farhan.demo@xenos.local
- nadia.demo@xenos.local
- kevin.demo@xenos.local
'@ | Set-Content -Path (Join-Path $stageDir 'README.md')

Compress-Archive -Path (Join-Path $stageDir '*') -DestinationPath $zipPath -Force
Write-Host "Backend package created: $zipPath"
