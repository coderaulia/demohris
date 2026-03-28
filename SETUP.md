# HR Performance Suite - Local Development Setup

## Prerequisites

- Node.js 20.x or higher
- MySQL 8.0 or higher (or MariaDB 10.5+)
- Git

## 1. Clone the Repository

```bash
git clone <your-repo-url>
cd demo-kpi
```

## 2. Setup MySQL Database

### Option A: Using MySQL CLI

```bash
mysql -u root -p
```

```sql
CREATE DATABASE demo_kpi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

Import the schema:
```bash
mysql -u root -p demo_kpi < mysql-setup.sql
mysql -u root -p demo_kpi < mysql-demo-seed.sql
```

### Option B: Using phpMyAdmin

1. Create database named `demo_kpi`
2. Import `mysql-setup.sql`
3. Import `mysql-demo-seed.sql`

## 3. Run Database Migrations

If you have existing data and need to add new tables:

```bash
mysql -u root -p demo_kpi < migrations/20260315_tna_tables.sql
```

For a fresh install with TNA tables:
```bash
mysql -u root -p demo_kpi < migrations/20260315_tna_tables.sql
```

## 4. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# API Configuration
VITE_API_BASE_URL=/api
VITE_API_PROXY_TARGET=http://127.0.0.1:3000
VITE_SESSION_TIMEOUT_MINUTES=30

# MySQL Database
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=demo_kpi
MYSQL_USER=root
MYSQL_PASSWORD=your_password_here

# Backend Server
PORT=3000
SESSION_SECRET=change-this-to-a-random-string

# CORS (for development, allow all)
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Cookie Settings (development)
SESSION_COOKIE_DOMAIN=
SESSION_COOKIE_SAME_SITE=lax
SESSION_COOKIE_SECURE=false

# Feature Flags (all enabled by default)
VITE_FEATURE_KPI=true
VITE_FEATURE_PROBATION=true
VITE_FEATURE_PIP=true
VITE_FEATURE_TNA=true
VITE_FEATURE_LMS=true
ENABLE_KPI=true
ENABLE_PROBATION=true
ENABLE_PIP=true
ENABLE_TNA=true
ENABLE_LMS=true
```

## 5. Install Dependencies

```bash
npm install
```

## 6. Start Development Servers

### Option A: Two Terminals (Recommended for full development)

Terminal 1 - Backend API:
```bash
npm run dev:server
```

Terminal 2 - Frontend:
```bash
npm run dev
```

### Option B: Single Command (Backend only)

```bash
npm start
```

This starts the backend only. The frontend is built statically and served by Express.

## 7. Access the Application

- **Frontend:** http://localhost:5173 (Vite dev server)
- **Backend API:** http://localhost:3000/api
- **phpMyAdmin:** http://localhost:8080 (if using XAMPP/WAMP)

## Demo Login Credentials

Password for all: `Demo123!`

| Email | Role |
|-------|------|
| admin.demo@xenos.local | Super Admin |
| hr.demo@xenos.local | HR Manager |
| director.demo@xenos.local | Director |
| manager.demo@xenos.local | Manager |
| farhan.demo@xenos.local | Employee |
| nadia.demo@xenos.local | Employee |
| kevin.demo@xenos.local | Employee |

## Feature Flags

Control which modules are active by setting these env vars:

| Flag | Description |
|------|-------------|
| `VITE_FEATURE_KPI` / `ENABLE_KPI` | KPI tracking |
| `VITE_FEATURE_PROBATION` / `ENABLE_PROBATION` | Probation reviews |
| `VITE_FEATURE_PIP` / `ENABLE_PIP` | Performance Improvement Plans |
| `VITE_FEATURE_TNA` / `ENABLE_TNA` | Training Needs Analysis |
| `VITE_FEATURE_LMS` / `ENABLE_LMS` | Learning Management System |

## Troubleshooting

### Database Connection Issues

```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

Make sure MySQL is running and credentials in `.env` are correct.

### Port Already in Use

```
Error: listen EADDRINUSE :::3000
```

Another process is using port 3000. Either kill that process or change the PORT in `.env`.

### CORS Errors

```
Access-Control-Allow-Origin missing
```

Make sure `CORS_ALLOWED_ORIGINS` in `.env` includes your frontend URL.

### Session Issues

```
Unauthorized
```

Try:
1. Clear browser cookies
2. Check `SESSION_SECRET` is set (not the default placeholder)
3. Ensure `SESSION_COOKIE_SECURE` matches your environment (`true` for HTTPS, `false` for HTTP)

## Building for Production

```bash
npm run build
```

This creates a `dist/` folder with the compiled frontend.

## Creating Backend Deployment Package

On Windows (PowerShell):
```bash
npm run package:backend
```

This creates `deploy/backend-hostinger.zip` ready for Hostinger upload.

## Project Structure

```
demo-kpi/
├── server/                  # Backend API
│   ├── app.js              # Express app
│   ├── tableMeta.js        # Table metadata
│   ├── features.js         # Feature flags
│   └── modules/            # Modular routes
│       ├── registry.js     # Table registry
│       └── tna.js          # TNA API routes
├── src/                     # Frontend source
│   ├── main.js            # Entry point
│   ├── components/        # HTML components
│   ├── modules/           # Feature modules
│   │   ├── data/         # Data layer
│   │   ├── dashboard.js
│   │   ├── assessment.js
│   │   ├── kpi.js
│   │   └── tna.js        # TNA module
│   └── lib/               # Utilities
├── migrations/             # Database migrations
├── mysql-setup.sql        # Core schema
├── mysql-demo-seed.sql    # Demo data
└── dist/                  # Built frontend
```
